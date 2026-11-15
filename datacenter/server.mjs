import http from 'node:http';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID, timingSafeEqual, createHmac, createHash } from 'node:crypto';

const PORT = Number(process.env.DATACENTER_PORT || 8081);
const ROOT = path.resolve(process.env.DATACENTER_STORAGE_DIR || '/var/lib/handbook-documents');
const TOKEN = process.env.DATACENTER_INTERNAL_TOKEN || '';
const SIGNING_SECRET = process.env.DATACENTER_SIGNING_SECRET || '';
const MAX_BYTES = Number(process.env.DATACENTER_MAX_FILE_BYTES || 104857600);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('DATACENTER_PORT must be a valid TCP port');
if (!Number.isSafeInteger(MAX_BYTES) || MAX_BYTES < 1) throw new Error('DATACENTER_MAX_FILE_BYTES must be a positive safe integer');

if (process.env.NODE_ENV === 'production' && TOKEN.length < 32) throw new Error('DATACENTER_INTERNAL_TOKEN must be at least 32 characters in production');
if (process.env.NODE_ENV === 'production' && SIGNING_SECRET.length < 32) throw new Error('DATACENTER_SIGNING_SECRET must be at least 32 characters in production');

await fs.mkdir(ROOT, { recursive: true });

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!TOKEN) return process.env.NODE_ENV !== 'production';
  const value = req.headers.authorization || '';
  const expected = `Bearer ${TOKEN}`;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}


function verifyPublicReadToken(token, key) {
  if (typeof token !== 'string' || SIGNING_SECRET.length < 32) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  const expected = createHmac('sha256', SIGNING_SECRET).update(encodedPayload).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/markdown']);
    if (payload.key !== key || payload.scope !== 'document:read' || !Number.isInteger(payload.exp) || payload.exp < now || !allowedMimeTypes.has(payload.mimeType)) return null;
    return payload;
  } catch { return null; }
}

async function streamFile(req, res, finalPath, contentType = 'application/octet-stream') {
  const stat = await fs.stat(finalPath);
  if (!stat.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
  const range = parseRange(req.headers.range, stat.size);
  if (range === false) {
    res.writeHead(416, { 'content-range': `bytes */${stat.size}` });
    return res.end();
  }
  const headers = {
    'content-type': contentType,
    'accept-ranges': 'bytes',
    'content-length': range ? range.end - range.start + 1 : stat.size,
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
  if (range) headers['content-range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') return res.end();
  return await pipeline(createReadStream(finalPath, range || undefined), res);
}

function safeKey(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{16,100}$/.test(value);
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) return false;
  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;
  if (start === null && end !== null) {
    const suffix = end;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start ??= 0;
    end ??= size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return false;
  return { start, end: Math.min(end, size - 1) };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health' && req.method === 'GET') return sendJson(res, 200, { status: 'up', service: 'document-storage' });

    const publicMatch = /^\/public\/files\/([a-zA-Z0-9_-]{16,100})$/.exec(url.pathname);
    if (publicMatch) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('allow', 'GET, HEAD'); return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
      const key = publicMatch[1];
      const signed = verifyPublicReadToken(url.searchParams.get('token'), key);
      if (!signed) return sendJson(res, 401, { error: 'INVALID_OR_EXPIRED_LINK' });
      try { return await streamFile(req, res, path.join(ROOT, key), signed.mimeType); }
      catch (error) { if (error.code === 'ENOENT') return sendJson(res, 404, { error: 'NOT_FOUND' }); throw error; }
    }

    if (!authorized(req)) return sendJson(res, 401, { error: 'UNAUTHORIZED' });

    const match = /^\/internal\/files\/([a-zA-Z0-9_-]{16,100})$/.exec(url.pathname);
    if (!match) return sendJson(res, 404, { error: 'NOT_FOUND' });
    const key = match[1];
    if (!safeKey(key)) return sendJson(res, 400, { error: 'INVALID_KEY' });
    const finalPath = path.join(ROOT, key);

    if (req.method === 'PUT') {
      const declared = Number(req.headers['content-length'] || 0);
      if (declared > MAX_BYTES) return sendJson(res, 413, { error: 'FILE_TOO_LARGE' });
      const expectedChecksum = String(req.headers['x-content-sha256'] || '').toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(expectedChecksum)) return sendJson(res, 400, { error: 'CHECKSUM_REQUIRED' });
      const tempPath = path.join(ROOT, `.upload-${randomUUID()}.tmp`);
      let bytes = 0;
      const checksum = createHash('sha256');
      const limiter = new (await import('node:stream')).Transform({
        transform(chunk, encoding, callback) {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) return callback(new Error('FILE_TOO_LARGE'));
          checksum.update(chunk);
          callback(null, chunk);
        },
      });
      try {
        await pipeline(req, limiter, createWriteStream(tempPath, { flags: 'wx', mode: 0o600 }));
        if (declared > 0 && declared !== bytes) throw new Error('CONTENT_LENGTH_MISMATCH');
        if (checksum.digest('hex') !== expectedChecksum) throw new Error('CHECKSUM_MISMATCH');
        await fs.rename(tempPath, finalPath);
        return sendJson(res, 201, { key, sizeBytes: bytes });
      } catch (error) {
        await fs.rm(tempPath, { force: true });
        if (error.message === 'FILE_TOO_LARGE') return sendJson(res, 413, { error: 'FILE_TOO_LARGE' });
        if (error.message === 'CONTENT_LENGTH_MISMATCH') return sendJson(res, 400, { error: 'CONTENT_LENGTH_MISMATCH' });
        if (error.message === 'CHECKSUM_MISMATCH') return sendJson(res, 422, { error: 'CHECKSUM_MISMATCH' });
        throw error;
      }
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      try { return await streamFile(req, res, finalPath); }
      catch (error) { if (error.code === 'ENOENT') return sendJson(res, 404, { error: 'FILE_NOT_FOUND' }); throw error; }
    }

    if (req.method === 'DELETE') {
      await fs.rm(finalPath, { force: true });
      return sendJson(res, 200, { deleted: true });
    }
    res.setHeader('allow', 'GET, HEAD, PUT, DELETE');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    if (res.destroyed || error?.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
    if (!res.headersSent) sendJson(res, 500, { error: 'STORAGE_ERROR' });
    else res.destroy(error);
    process.stderr.write(`[document-storage] ${error.stack || error}\n`);
  }
});

server.listen(PORT, '0.0.0.0', () => process.stdout.write(`Document storage listening on ${PORT}\n`));
