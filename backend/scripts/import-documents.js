import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import prisma from '../src/config/database.js';
import { putDocumentFile, deleteDocumentFile } from '../src/utils/datacenter-client.js';
import { normalizePersian } from '../src/utils/persian-text.js';
import { JOB_ROLE_VALUES } from '../src/config/job-roles.js';

const ROOT = path.resolve(process.env.DOCUMENT_IMPORT_DIR || '');
const MAX_BYTES = Number(process.env.DOCUMENT_MAX_FILE_BYTES || 100 * 1024 * 1024);
const CONCURRENCY_INPUT = Number(process.env.DOCUMENT_IMPORT_CONCURRENCY || 3);
const CONCURRENCY = Number.isInteger(CONCURRENCY_INPUT) ? Math.min(8, Math.max(1, CONCURRENCY_INPUT)) : 3;
if (!Number.isSafeInteger(MAX_BYTES) || MAX_BYTES < 1) throw new Error('DOCUMENT_MAX_FILE_BYTES must be a positive safe integer');
const DRY_RUN = process.argv.includes('--dry-run');
const VISIBILITY = process.env.DOCUMENT_IMPORT_VISIBILITY || 'PUBLIC';
const ACCESS_JOB_ROLES = (process.env.DOCUMENT_IMPORT_JOB_ROLES || '').split(',').map(value => value.trim()).filter(Boolean);
const OWNER_ID = process.env.DOCUMENT_IMPORT_OWNER_ID || null;
const LANGUAGE = process.env.DOCUMENT_IMPORT_LANGUAGE || 'und';
const MIME = {
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
};

if (!process.env.DOCUMENT_IMPORT_DIR) throw new Error('DOCUMENT_IMPORT_DIR must point to the source document directory');
if (!(await fs.stat(ROOT)).isDirectory()) throw new Error('DOCUMENT_IMPORT_DIR is not a directory');
if (!['PUBLIC', 'ROLE_RESTRICTED', 'PRIVATE'].includes(VISIBILITY)) throw new Error('DOCUMENT_IMPORT_VISIBILITY is invalid');
if (ACCESS_JOB_ROLES.some(role => !JOB_ROLE_VALUES.includes(role))) throw new Error('DOCUMENT_IMPORT_JOB_ROLES contains an unknown role');
if (VISIBILITY === 'ROLE_RESTRICTED' && ACCESS_JOB_ROLES.length === 0) throw new Error('DOCUMENT_IMPORT_JOB_ROLES is required for ROLE_RESTRICTED visibility');
if (!['fa', 'en', 'ku', 'und'].includes(LANGUAGE)) throw new Error('DOCUMENT_IMPORT_LANGUAGE must be fa, en, ku, or und');
if (VISIBILITY === 'PRIVATE' && !OWNER_ID) throw new Error('DOCUMENT_IMPORT_OWNER_ID is required for PRIVATE visibility');
if (OWNER_ID && !(await prisma.user.findUnique({ where: { id: OWNER_ID }, select: { id: true } }))) throw new Error('DOCUMENT_IMPORT_OWNER_ID does not identify an existing user');

async function walk(directory) {
  const output = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(fullPath));
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function verifySignature(filePath, ext) {
  const handle = await fs.open(filePath, 'r');
  try {
    const bytes = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const head = bytes.subarray(0, bytesRead);
    const valid = ext === 'pdf' ? head.toString('latin1').includes('%PDF-')
      : ext === 'png' ? head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : ['jpg', 'jpeg'].includes(ext) ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
      : ext === 'webp' ? head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP'
      : true;
    if (!valid) throw new Error('signature does not match extension');
  } finally { await handle.close(); }
}

async function importOne(filePath, counters) {
  const sourcePath = path.relative(ROOT, filePath).split(path.sep).join('/');
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (!MIME[ext]) { counters.skipped += 1; return; }
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) { counters.skipped += 1; return; }
  await verifySignature(filePath, ext);
  const checksumSha256 = await sha256(filePath);
  const verifiedStat = await fs.stat(filePath);
  if (verifiedStat.size !== stat.size || verifiedStat.mtimeMs !== stat.mtimeMs) throw new Error('file changed while being scanned; rerun import after the source is stable');
  const existing = await prisma.document.findUnique({ where: { checksumSha256 }, select: { id: true } });
  if (existing) { counters.duplicates += 1; return; }
  if (DRY_RUN) { counters.dryRun += 1; return; }

  const title = normalizePersian(path.basename(filePath, path.extname(filePath))).slice(0, 240) || 'سند بدون عنوان';
  const storageKey = randomUUID().replaceAll('-', '');
  let uploaded = false;
  try {
    await putDocumentFile(storageKey, filePath, MIME[ext], checksumSha256);
    uploaded = true;
    await prisma.$transaction(async tx => {
      const document = await tx.document.create({ data: {
        title,
        originalName: path.basename(filePath).slice(0, 255),
        sourcePath,
        mimeType: MIME[ext],
        sizeBytes: stat.size,
        checksumSha256,
        storageKey,
        visibility: VISIBILITY,
        accessJobRoles: ACCESS_JOB_ROLES,
        ownerId: OWNER_ID,
        description: null,
        language: LANGUAGE,
        indexStatus: 'PENDING',
      } });
      await tx.documentIndexJob.create({ data: { documentId: document.id } });
    });
    counters.imported += 1;
  } catch (error) {
    if (uploaded) await deleteDocumentFile(storageKey).catch(() => {});
    if (error?.code === 'P2002') { counters.duplicates += 1; return; }
    throw error;
  }
}

const files = await walk(ROOT);
const counters = { imported: 0, duplicates: 0, skipped: 0, failed: 0, dryRun: 0 };
let next = 0;
let completed = 0;
let fatalError = null;
async function worker() {
  while (next < files.length && !fatalError) {
    const index = next++;
    try { await importOne(files[index], counters); }
    catch (error) {
      counters.failed += 1;
      process.stderr.write(`[import] ${path.basename(files[index])}: ${error.message}\n`);
      if (error?.status >= 500 || String(error?.code || '').startsWith('STORAGE_') || ['ECONNREFUSED', 'P1001', 'P1002', 'P1008', 'P1017'].includes(error?.code)) fatalError = error;
    } finally {
      completed += 1;
      if (completed % 100 === 0 || completed === files.length) process.stdout.write(`Processed ${completed}/${files.length} files\n`);
    }
  }
}

process.stdout.write(`Found ${files.length} files. Mode: ${DRY_RUN ? 'DRY RUN' : 'IMPORT'}. Concurrency: ${CONCURRENCY}.\n`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
process.stdout.write(`${JSON.stringify({ total: files.length, ...counters }, null, 2)}\n`);
await prisma.$disconnect();
if (fatalError || counters.failed > 0) process.exitCode = 1;
