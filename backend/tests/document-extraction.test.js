import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractDocumentPages, splitPdfTextIntoPages } from '../src/workers/document-extraction.js';

test('PDF text is split into stable one-based page numbers and empty pages are skipped', () => {
  assert.deepEqual(splitPdfTextIntoPages('صفحه اول\n\f\fصفحه سوم\n\f'), [
    { pageNumber: 1, text: 'صفحه اول' },
    { pageNumber: 3, text: 'صفحه سوم' },
  ]);
});

test('PDF extraction preserves pages and falls back to OCR for image-only documents', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'handbook-extract-test-'));
  try {
    const source = path.join(dir, 'source.pdf');
    await writeFile(source, '%PDF-test');
    const calls = [];
    const run = async (command, args) => {
      calls.push([command, args]);
      if (command === 'pdftotext') {
        const target = args.at(-1);
        const previous = calls.filter(item => item[0] === 'pdftotext').length;
        await writeFile(target, previous === 1 ? '\f' : 'صفحه OCR شده\fصفحه دوم');
      }
      return '';
    };
    const pages = await extractDocumentPages({
      document: { mimeType: 'application/pdf' }, filePath: source, tempDir: dir,
      run, maxChars: 1000, ocrLanguages: 'fas+eng',
    });
    assert.deepEqual(pages, [
      { pageNumber: 1, text: 'صفحه OCR شده' },
      { pageNumber: 2, text: 'صفحه دوم' },
    ]);
    assert.ok(calls.some(([command]) => command === 'ocrmypdf'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('plain text extraction creates a single page and enforces a character limit', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'handbook-extract-test-'));
  try {
    const source = path.join(dir, 'source.txt');
    await writeFile(source, 'abcdefghij');
    const pages = await extractDocumentPages({
      document: { mimeType: 'text/plain' }, filePath: source, tempDir: dir,
      run: async () => '', maxChars: 4, ocrLanguages: 'fas+eng',
    });
    assert.deepEqual(pages, [{ pageNumber: 1, text: 'abcd' }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
