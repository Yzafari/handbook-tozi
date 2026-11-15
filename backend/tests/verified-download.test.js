import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { downloadResponseToFile } from '../src/utils/verified-download.js';

const sha = value => createHash('sha256').update(value).digest('hex');

test('verified download streams a file and checks both byte length and SHA-256', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'handbook-download-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const payload = Buffer.from('verified document content');
  const filePath = path.join(directory, 'document.bin');
  const result = await downloadResponseToFile(new Response(payload), filePath, { expectedSize: payload.length, expectedSha256: sha(payload), maxBytes: 1024 });
  assert.equal(result.sizeBytes, payload.length);
  assert.equal(await readFile(filePath, 'utf8'), payload.toString());
});

test('verified download removes incomplete files after checksum, size or limit failure', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'handbook-download-failure-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const payload = Buffer.from('tampered content');
  const cases = [
    { expectedSize: payload.length, expectedSha256: '0'.repeat(64), maxBytes: 1024 },
    { expectedSize: payload.length + 1, expectedSha256: sha(payload), maxBytes: 1024 },
    { expectedSize: payload.length, expectedSha256: sha(payload), maxBytes: 4 },
  ];
  for (let index = 0; index < cases.length; index += 1) {
    const filePath = path.join(directory, `failed-${index}.bin`);
    await assert.rejects(downloadResponseToFile(new Response(payload), filePath, cases[index]));
    await assert.rejects(stat(filePath));
  }
});
