import 'dotenv/config';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import prisma from '../config/database.js';
import { getDocumentFile } from '../utils/datacenter-client.js';
import { downloadResponseToFile } from '../utils/verified-download.js';
import { indexDocument, removeIndexedDocument } from '../modules/search/public-api.js';
import { env } from '../config/env.js';
import { extractDocumentPages } from './document-extraction.js';

const execFile = promisify(execFileCallback);
const MAX_EXTRACTED_CHARS = env.DOCUMENT_MAX_INDEX_CHARS;
const POLL_MS = env.DOCUMENT_WORKER_POLL_MS;
const MAX_ATTEMPTS = env.DOCUMENT_WORKER_MAX_ATTEMPTS;
let stopping = false;

async function run(command, args, options = {}) {
  const { stdout } = await execFile(command, args, { maxBuffer: 64 * 1024 * 1024, timeout: 180_000, ...options });
  return stdout;
}

function detectLanguage(text) {
  const sample = text.slice(0, 250_000);
  const persian = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  const kurdish = (sample.match(/[ەێۆڕڵڤ]/g) || []).length;
  if (kurdish > 2) return 'ku';
  if (persian > 0 && latin > 0) return 'und';
  if (persian > 0) return 'fa';
  if (latin > 0) return 'en';
  return 'und';
}

async function claimJob() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1000);
  const job = await prisma.documentIndexJob.findFirst({
    where: {
      availableAt: { lte: now },
      OR: [
        { status: 'PENDING' },
        { status: 'RETRY' },
        { status: 'RUNNING', lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
  });
  if (!job) return null;
  const claimed = await prisma.documentIndexJob.updateMany({
    where: { id: job.id, status: job.status, ...(job.status === 'RUNNING' ? { lockedAt: { lt: staleBefore } } : {}) },
    data: { status: 'RUNNING', lockedAt: now, attempts: { increment: 1 }, lastError: null },
  });
  return claimed.count === 1 ? { ...job, lockedAt: now, attempts: job.attempts + 1 } : null;
}

function startJobHeartbeat(jobId, initialLock) {
  let currentLock = initialLock;
  const timer = setInterval(async () => {
    const nextLock = new Date();
    try {
      const result = await prisma.documentIndexJob.updateMany({
        where: { id: jobId, status: 'RUNNING', lockedAt: currentLock },
        data: { lockedAt: nextLock },
      });
      if (result.count === 1) currentLock = nextLock;
      else clearInterval(timer);
    } catch (error) {
      process.stderr.write(`[document-index] heartbeat ${jobId}: ${error?.message || error}\n`);
    }
  }, 60_000);
  timer.unref?.();
  return () => clearInterval(timer);
}

async function processJob(job) {
  const document = await prisma.document.findUnique({ where: { id: job.documentId } });
  if (!document || !document.isActive) {
    await prisma.documentIndexJob.update({ where: { id: job.id }, data: { status: 'DONE', lockedAt: null } });
    return;
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'handbook-index-'));
  const stopHeartbeat = startJobHeartbeat(job.id, job.lockedAt);
  const filePath = path.join(tempDir, `${randomUUID()}${path.extname(document.originalName).toLowerCase()}`);
  try {
    const response = await getDocumentFile(document.storageKey);
    await downloadResponseToFile(response, filePath, { expectedSize: document.sizeBytes, expectedSha256: document.checksumSha256, maxBytes: env.DOCUMENT_MAX_FILE_BYTES });
    const pages = await extractDocumentPages({ document, filePath, tempDir, run, maxChars: MAX_EXTRACTED_CHARS, ocrLanguages: env.DOCUMENT_OCR_LANGUAGES });
    const content = pages.map(page => page.text).join('\n');
    if (document.mimeType === 'application/pdf') {
      try {
        const info = await run('pdfinfo', [filePath]);
        const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
        if (Number.isInteger(pages) && pages > 0) await prisma.document.update({ where: { id: document.id }, data: { pageCount: pages } });
      } catch { /* page count is optional; text indexing remains valid */ }
    }
    if (content.trim().length < 2) throw new Error('متن قابل جستجویی از سند استخراج نشد');
    const stillActive = await prisma.document.findFirst({ where: { id: document.id, isActive: true }, select: { id: true } });
    if (!stillActive) {
      await prisma.documentIndexJob.update({ where: { id: job.id }, data: { status: 'DONE', lockedAt: null } });
      return;
    }
    const language = document.language === 'und' ? detectLanguage(content) : document.language;
    if (language !== document.language) await prisma.document.update({ where: { id: document.id }, data: { language } });
    const indexSource = await prisma.document.findUnique({ where: { id: document.id } });
    if (!indexSource) throw new Error('سند هنگام ایندکس‌گذاری حذف شده است');
    await indexDocument(indexSource, pages);
    const activeAfterIndex = await prisma.document.findFirst({ where: { id: document.id, isActive: true }, select: { id: true } });
    if (!activeAfterIndex) {
      await removeIndexedDocument(document.id).catch(() => {});
      await prisma.documentIndexJob.update({ where: { id: job.id }, data: { status: 'DONE', lockedAt: null } });
      return;
    }
    await prisma.$transaction([
      prisma.document.update({ where: { id: document.id }, data: { indexStatus: 'READY', indexedAt: new Date() } }),
      prisma.documentIndexJob.update({ where: { id: job.id }, data: { status: 'DONE', lockedAt: null, lastError: null } }),
    ]);
  } catch (error) {
    const current = await prisma.document.findUnique({ where: { id: document.id }, select: { isActive: true } }).catch(() => null);
    if (!current?.isActive) {
      await prisma.documentIndexJob.update({ where: { id: job.id }, data: { status: 'DONE', lockedAt: null } }).catch(() => {});
      await removeIndexedDocument(document.id).catch(() => {});
      return;
    }
    const exhausted = job.attempts >= MAX_ATTEMPTS;
    const delayMs = Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.max(0, job.attempts - 1)));
    await prisma.$transaction([
      prisma.document.update({ where: { id: document.id }, data: { indexStatus: exhausted ? 'FAILED' : 'RETRY' } }),
      prisma.documentIndexJob.update({ where: { id: job.id }, data: {
        status: exhausted ? 'FAILED' : 'RETRY',
        lockedAt: null,
        availableAt: new Date(Date.now() + delayMs),
        lastError: String(error?.message || error).slice(0, 1000),
      } }),
    ]);
    process.stderr.write(`[document-index] ${document.id}: ${error?.stack || error}\n`);
  } finally {
    stopHeartbeat();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function sleep(ms) { await new Promise(resolve => setTimeout(resolve, ms)); }

process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

process.stdout.write('Document indexing worker started\n');
while (!stopping) {
  try {
    const job = await claimJob();
    if (job) await processJob(job);
    else await sleep(POLL_MS);
  } catch (error) {
    process.stderr.write(`[document-index] worker loop: ${error?.stack || error}\n`);
    await sleep(Math.max(POLL_MS, 5000));
  }
}
await prisma.$disconnect();
