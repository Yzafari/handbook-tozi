import prisma from '../src/config/database.js';

const BATCH_SIZE = Math.min(500, Math.max(50, Number(process.env.DOCUMENT_REINDEX_BATCH_SIZE) || 200));

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.CONFIRM_DOCUMENT_REINDEX !== 'YES') {
    throw new Error('Production reindex requires CONFIRM_DOCUMENT_REINDEX=YES. Stop workers and take a database/OpenSearch snapshot first.');
  }
  const now = new Date();
  let cursor;
  let queued = 0;
  while (true) {
    const documents = await prisma.document.findMany({
      where: { isActive: true, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' }, take: BATCH_SIZE, select: { id: true },
    });
    if (!documents.length) break;
    const operations = documents.flatMap(document => [
      prisma.documentIndexJob.upsert({
        where: { documentId: document.id },
        create: { documentId: document.id, status: 'PENDING', attempts: 0, availableAt: now },
        update: { status: 'PENDING', attempts: 0, availableAt: now, lockedAt: null, lastError: null },
      }),
      prisma.document.update({ where: { id: document.id }, data: { indexStatus: 'PENDING' } }),
    ]);
    await prisma.$transaction(operations);
    queued += documents.length;
    cursor = documents.at(-1).id;
    process.stdout.write(`Queued ${queued} documents for reindexing\n`);
  }
  process.stdout.write(`Reindex queue prepared: ${queued} documents. Start document-index workers to process the queue.\n`);
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
