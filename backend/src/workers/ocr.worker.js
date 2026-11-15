import 'dotenv/config';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import prisma from '../config/database.js';
import { getDocumentFile, deleteDocumentFile } from '../utils/datacenter-client.js';
import { downloadResponseToFile } from '../utils/verified-download.js';
import { env } from '../config/env.js';

const execFile = promisify(execFileCallback);
const POLL_MS = env.OCR_WORKER_POLL_MS;
const MAX_ATTEMPTS = env.OCR_WORKER_MAX_ATTEMPTS;
const MAX_TEXT_CHARS = env.OCR_MAX_TEXT_CHARS;
const OCR_LANGUAGES = env.OCR_LANGUAGES;
const MAX_FILE_BYTES = env.OCR_MAX_FILE_BYTES;
let stopping = false;

async function run(command, args) {
  return execFile(command, args, { maxBuffer: 32 * 1024 * 1024, timeout: 180_000 });
}

function parseConfidence(tsv) {
  const lines = tsv.split(/\r?\n/).slice(1);
  const values = [];
  for (const line of lines) {
    const columns = line.split('\t');
    const confidence = Number(columns[10]);
    if (Number.isFinite(confidence) && confidence >= 0) values.push(confidence);
  }
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100;
}

async function readTextLimited(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const chunks = [];
    const maxBytes = MAX_TEXT_CHARS * 4;
    let total = 0;
    const buffer = Buffer.alloc(64 * 1024);
    while (total < maxBytes) {
      const length = Math.min(buffer.length, maxBytes - total);
      const { bytesRead } = await handle.read(buffer, 0, length, total);
      if (!bytesRead) break;
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
      total += bytesRead;
    }
    return Buffer.concat(chunks).toString('utf8').slice(0, MAX_TEXT_CHARS);
  } finally { await handle.close(); }
}

async function recognize(job, filePath, tempDir) {
  if (job.mimeType === 'application/pdf') {
    const textPath = path.join(tempDir, 'extracted.txt');
    await run('pdftotext', ['-enc', 'UTF-8', '-layout', filePath, textPath]);
    const originalText = await readTextLimited(textPath);
    if (originalText.trim().length >= 40) return { text: originalText, confidence: null };
    const ocrPath = path.join(tempDir, 'ocr.pdf');
    await run('ocrmypdf', ['--skip-text', '--rotate-pages', '--deskew', '-l', OCR_LANGUAGES, filePath, ocrPath]);
    await run('pdftotext', ['-enc', 'UTF-8', '-layout', ocrPath, textPath]);
    return { text: await readTextLimited(textPath), confidence: null };
  }
  const outputBase = path.join(tempDir, 'image-ocr');
  await run('tesseract', [filePath, outputBase, '-l', OCR_LANGUAGES, '--oem', '1', '--psm', '6']);
  await run('tesseract', [filePath, outputBase, '-l', OCR_LANGUAGES, '--oem', '1', '--psm', '6', 'tsv']);
  return { text: await readTextLimited(`${outputBase}.txt`), confidence: parseConfidence(await readTextLimited(`${outputBase}.tsv`)) };
}

async function cleanupFinishedFiles() {
  const jobs = await prisma.ocrJob.findMany({ where: { status: { in: ['DONE', 'CANCELLED'] }, storageDeleted: false }, take: 20, orderBy: { updatedAt: 'asc' } });
  for (const job of jobs) {
    try {
      await deleteDocumentFile(job.storageKey);
      await prisma.ocrJob.update({ where: { id: job.id }, data: { storageDeleted: true } });
    } catch { /* Retry on the next worker cycle. */ }
  }
}

async function claimJob() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1000);
  const job = await prisma.ocrJob.findFirst({
    where: { availableAt: { lte: now }, OR: [
      { status: 'PENDING' },
      { status: 'RETRY' },
      { status: 'RUNNING', lockedAt: { lt: staleBefore } },
    ] },
    orderBy: [{ createdAt: 'asc' }],
  });
  if (!job) return null;
  const claimed = await prisma.ocrJob.updateMany({
    where: { id: job.id, status: job.status, ...(job.status === 'RUNNING' ? { lockedAt: { lt: staleBefore } } : {}) },
    data: { status: 'RUNNING', lockedAt: now, attempts: { increment: 1 }, errorMessage: null },
  });
  return claimed.count === 1 ? { ...job, lockedAt: now, attempts: job.attempts + 1 } : null;
}

function startJobHeartbeat(jobId, initialLock) {
  let currentLock = initialLock;
  const timer = setInterval(async () => {
    const nextLock = new Date();
    try {
      const result = await prisma.ocrJob.updateMany({
        where: { id: jobId, status: 'RUNNING', lockedAt: currentLock },
        data: { lockedAt: nextLock },
      });
      if (result.count === 1) currentLock = nextLock;
      else clearInterval(timer);
    } catch (error) {
      process.stderr.write(`[ocr-worker] heartbeat ${jobId}: ${error?.message || error}\n`);
    }
  }, 60_000);
  timer.unref?.();
  return () => clearInterval(timer);
}

async function processJob(job) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'handbook-ocr-'));
  const stopHeartbeat = startJobHeartbeat(job.id, job.lockedAt);
  const ext = job.mimeType === 'application/pdf' ? '.pdf' : job.mimeType === 'image/png' ? '.png' : job.mimeType === 'image/webp' ? '.webp' : '.jpg';
  const filePath = path.join(tempDir, `${randomUUID()}${ext}`);
  try {
    const response = await getDocumentFile(job.storageKey);
    await downloadResponseToFile(response, filePath, { expectedSize: job.sizeBytes, expectedSha256: job.checksumSha256, maxBytes: MAX_FILE_BYTES });
    const result = await recognize(job, filePath, tempDir);
    const text = result.text.replace(/\u0000/g, '').slice(0, MAX_TEXT_CHARS).trim();
    if (text.length < 2) throw new Error('متنی از تصویر یا سند استخراج نشد');
    const current = await prisma.ocrJob.findUnique({ where: { id: job.id }, select: { status: true } });
    if (!current || current.status === 'CANCELLED') return;
    await prisma.ocrJob.update({ where: { id: job.id }, data: {
      status: 'DONE', resultText: text, confidence: result.confidence, errorMessage: null, lockedAt: null,
    } });
    try {
      await deleteDocumentFile(job.storageKey);
      await prisma.ocrJob.update({ where: { id: job.id }, data: { storageDeleted: true } });
    } catch { /* cleanupFinishedFiles retries storage deletion */ }
  } catch (error) {
    const current = await prisma.ocrJob.findUnique({ where: { id: job.id }, select: { status: true } }).catch(() => null);
    if (!current || current.status === 'CANCELLED') return;
    const exhausted = job.attempts >= MAX_ATTEMPTS;
    const delayMs = Math.min(30 * 60 * 1000, 20_000 * (2 ** Math.max(0, job.attempts - 1)));
    await prisma.ocrJob.update({ where: { id: job.id }, data: {
      status: exhausted ? 'FAILED' : 'RETRY', lockedAt: null,
      errorMessage: exhausted ? 'پردازش تصویر پس از چند تلاش ناموفق بود' : 'پردازش تصویر با خطای موقت روبه‌رو شد',
      ...(exhausted ? {} : { availableAt: new Date(Date.now() + delayMs) }),
    } });
    process.stderr.write(`[ocr-worker] ${job.id}: ${error?.stack || error}\n`);
  } finally {
    stopHeartbeat();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function sleep(ms) { await new Promise(resolve => setTimeout(resolve, ms)); }
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
process.stdout.write('OCR worker started\n');
while (!stopping) {
  try {
    await cleanupFinishedFiles();
    const job = await claimJob();
    if (job) await processJob(job);
    else await sleep(POLL_MS);
  } catch (error) {
    process.stderr.write(`[ocr-worker] loop: ${error?.stack || error}\n`);
    await sleep(Math.max(POLL_MS, 5000));
  }
}
await prisma.$disconnect();
