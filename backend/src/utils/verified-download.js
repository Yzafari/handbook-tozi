import { createHash } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function downloadResponseToFile(response, filePath, { expectedSize, expectedSha256, maxBytes = 100 * 1024 * 1024 } = {}) {
  if (!response?.ok || !response.body) throw new Error('دریافت فایل از فضای ذخیره‌سازی ناموفق بود');
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > maxBytes) throw new Error('اندازهٔ مورد انتظار فایل معتبر نیست');
  if (!/^[a-f0-9]{64}$/i.test(String(expectedSha256 || ''))) throw new Error('SHA-256 مورد انتظار معتبر نیست');
  let bytes = 0;
  const hash = createHash('sha256');
  const verifier = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes || bytes > expectedSize) return callback(new Error('فایل دریافتی از اندازهٔ مجاز بیشتر است'));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), verifier, createWriteStream(filePath, { flags: 'wx', mode: 0o600 }));
    const checksumSha256 = hash.digest('hex');
    if (bytes !== expectedSize || checksumSha256 !== expectedSha256.toLowerCase()) throw new Error('اندازه یا SHA-256 فایل دریافتی مطابقت ندارد');
    return { sizeBytes: bytes, checksumSha256 };
  } catch (error) {
    await fs.rm(filePath, { force: true }).catch(() => {});
    throw error;
  }
}
