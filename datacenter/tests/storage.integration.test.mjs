import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createHmac, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const serverFile = path.resolve(root, '../server.mjs');
const token = '0123456789abcdef0123456789abcdef';
const signingSecret = 'abcdef0123456789abcdef0123456789fedcba9876543210';
const payload = Buffer.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Data center process exited before becoming healthy');
    try { const response = await fetch(`${url}/health`); if (response.ok) return; } catch { /* retry startup */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Data center did not become healthy in time');
}

test('storage service enforces auth, safe keys, HEAD, Range and deletion', async t => {
  const port = await freePort();
  const storageDir = await mkdtemp(path.join(os.tmpdir(), 'handbook-storage-test-'));
  const child = spawn(process.execPath, [serverFile], { env: {
    ...process.env, NODE_ENV: 'production', DATACENTER_PORT: String(port),
    DATACENTER_STORAGE_DIR: storageDir, DATACENTER_INTERNAL_TOKEN: token, DATACENTER_SIGNING_SECRET: signingSecret,
    DATACENTER_MAX_FILE_BYTES: '1024',
  }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  const key = 'abcdef0123456789abcdef0123456789';
  const url = `${base}/internal/files/${key}`;
  t.after(async () => {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 1500))]);
    await rm(storageDir, { recursive: true, force: true });
  });

  await waitForHealth(base, child);
  assert.equal((await fetch(url, { method: 'PUT', body: payload })).status, 401);
  assert.equal((await fetch(url, { method: 'PUT', headers: { Authorization: 'Bearer wrong-token' }, body: payload })).status, 401);
  const traversal = await fetch(`${base}/internal/files/%2e%2e%2fsecret`, { headers: { Authorization: `Bearer ${token}` } });
  assert.ok(traversal.status >= 400, 'path traversal must never return a successful response');

  const checksum = createHash('sha256').update(payload).digest('hex');
  const missingChecksum = await fetch(`${base}/internal/files/${key}-missing`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: payload });
  assert.equal(missingChecksum.status, 400);
  const wrongChecksum = await fetch(`${base}/internal/files/${key}-wrong`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'x-content-sha256': '0'.repeat(64) }, body: payload });
  assert.equal(wrongChecksum.status, 422);
  const uploaded = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'x-content-sha256': checksum }, body: payload });
  assert.equal(uploaded.status, 201);
  const head = await fetch(url, { method: 'HEAD', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), payload.length);

  const publicPayload = Buffer.from(JSON.stringify({ key, scope: 'document:read', mimeType: 'application/pdf', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
  const publicSignature = createHmac('sha256', signingSecret).update(publicPayload).digest('base64url');
  const publicUrl = `${base}/public/files/${key}?token=${publicPayload}.${publicSignature}`;
  assert.equal((await fetch(`${base}/public/files/${key}`)).status, 401);
  const publicRead = await fetch(publicUrl);
  assert.equal(publicRead.status, 200);
  assert.equal(publicRead.headers.get('content-type'), 'application/pdf');
  assert.equal(await publicRead.text(), payload.toString());
  const publicRange = await fetch(publicUrl, { headers: { Range: 'bytes=2-4' } });
  assert.equal(publicRange.status, 206);
  assert.equal(await publicRange.text(), payload.subarray(2, 5).toString());
  const expiredPayload = Buffer.from(JSON.stringify({ key, scope: 'document:read', mimeType: 'application/pdf', exp: Math.floor(Date.now() / 1000) - 1 })).toString('base64url');
  const expiredSignature = createHmac('sha256', signingSecret).update(expiredPayload).digest('base64url');
  assert.equal((await fetch(`${base}/public/files/${key}?token=${expiredPayload}.${expiredSignature}`)).status, 401);

  const range = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Range: 'bytes=3-8' } });
  assert.equal(range.status, 206);
  assert.equal(await range.text(), payload.subarray(3, 9).toString());
  const invalidRange = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Range: 'bytes=999-1000' } });
  assert.equal(invalidRange.status, 416);
  const deleted = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(deleted.status, 200);
  const missing = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(missing.status, 200);
});
