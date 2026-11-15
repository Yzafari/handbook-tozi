import { promises as fs } from 'node:fs';
import path from 'node:path';

export function splitPdfTextIntoPages(text, maxChars = 5_000_000) {
  const source = String(text ?? '').replace(/\u0000/g, '').slice(0, maxChars);
  const rawPages = source.split('\f');
  const pages = [];
  let remaining = maxChars;
  for (let index = 0; index < rawPages.length && remaining > 0; index += 1) {
    const pageText = rawPages[index].slice(0, remaining).trim();
    remaining -= pageText.length;
    if (pageText) pages.push({ pageNumber: index + 1, text: pageText });
  }
  return pages;
}

export async function readTextLimited(filePath, maxChars = 5_000_000) {
  const handle = await fs.open(filePath, 'r');
  try {
    const chunks = [];
    const maxBytes = maxChars * 4;
    let total = 0;
    const buffer = Buffer.alloc(64 * 1024);
    while (total < maxBytes) {
      const length = Math.min(buffer.length, maxBytes - total);
      const { bytesRead } = await handle.read(buffer, 0, length, total);
      if (!bytesRead) break;
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
      total += bytesRead;
    }
    return Buffer.concat(chunks).toString('utf8').replace(/\u0000/g, '').slice(0, maxChars);
  } finally {
    await handle.close();
  }
}

export async function extractDocumentPages({ document, filePath, tempDir, run, maxChars, ocrLanguages }) {
  if (document.mimeType === 'text/plain' || document.mimeType === 'text/markdown') {
    const text = await readTextLimited(filePath, maxChars);
    return text.trim() ? [{ pageNumber: 1, text }] : [];
  }

  if (document.mimeType === 'application/pdf') {
    const textPath = path.join(tempDir, 'extracted.txt');
    try {
      await run('pdftotext', ['-enc', 'UTF-8', '-layout', filePath, textPath]);
      let text = await readTextLimited(textPath, maxChars);
      if (text.replace(/\s/g, '').length < 40) {
        const ocrPath = path.join(tempDir, 'ocr.pdf');
        await run('ocrmypdf', ['--skip-text', '--rotate-pages', '--deskew', '-l', ocrLanguages, filePath, ocrPath]);
        await run('pdftotext', ['-enc', 'UTF-8', '-layout', ocrPath, textPath]);
        text = await readTextLimited(textPath, maxChars);
      }
      return splitPdfTextIntoPages(text, maxChars);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('ابزار pdftotext یا ocrmypdf روی Worker نصب نیست');
      throw error;
    }
  }

  if (document.mimeType.startsWith('image/')) {
    try {
      const outputBase = path.join(tempDir, 'image-ocr');
      await run('tesseract', [filePath, outputBase, '-l', ocrLanguages, '--oem', '1', '--psm', '6']);
      const text = await readTextLimited(`${outputBase}.txt`, maxChars);
      return text.trim() ? [{ pageNumber: 1, text }] : [];
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('Tesseract روی Worker نصب نیست');
      throw error;
    }
  }

  throw new Error('نوع سند برای استخراج متن پشتیبانی نمی‌شود');
}
