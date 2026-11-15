import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { api } from '../network/api';
import { getDatabase } from '../database';

export type LocalOcrJob = {
  localId: string; remoteJobId: string | null; status: string; resultText: string | null;
  confidence: number | null; errorMessage: string | null; createdAt: string;
};

function mapRow(row: any): LocalOcrJob {
  return { localId: row.local_id, remoteJobId: row.remote_job_id, status: row.status,
    resultText: row.result_text, confidence: row.confidence == null ? null : Number(row.confidence),
    errorMessage: row.error_message, createdAt: row.created_at };
}

export async function enqueueOcrPhoto(userId: string, sourceUri: string): Promise<LocalOcrJob> {
  if (!FileSystem.documentDirectory) throw new Error('فضای پایدار ذخیره‌سازی فایل در دسترس نیست');
  const directory = `${FileSystem.documentDirectory}handbook-ocr/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});
  const localId = randomUUID();
  const localUri = `${directory}${localId}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: localUri });
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO ocr_queue(local_id,owner_user_id,local_uri,status,created_at,updated_at)
     VALUES(?,?,?,'PENDING_UPLOAD',?,?)`, [localId, userId, localUri, now, now],
  );
  return { localId, remoteJobId: null, status: 'PENDING_UPLOAD', resultText: null, confidence: null, errorMessage: null, createdAt: now };
}

export async function listOcrJobs(userId: string): Promise<LocalOcrJob[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM ocr_queue WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 30', [userId]);
  return rows.map(mapRow);
}

export async function getOcrJobLocal(userId: string, localId: string): Promise<LocalOcrJob | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM ocr_queue WHERE owner_user_id=? AND local_id=?', [userId, localId]);
  return row ? mapRow(row) : null;
}

export async function syncOcrQueue(userId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const uploadRows = await db.getAllAsync<any>(
    `SELECT * FROM ocr_queue WHERE owner_user_id=? AND status IN ('PENDING_UPLOAD','RETRY_UPLOAD')
     AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at ASC LIMIT 5`, [userId, now]);

  for (const row of uploadRows) {
    try {
      const info = await FileSystem.getInfoAsync(row.local_uri);
      if (!info.exists) throw new Error('تصویر ذخیره‌شده روی گوشی پیدا نشد');
      const form = new FormData();
      form.append('file', { uri: row.local_uri, name: `${row.local_id}.jpg`, type: 'image/jpeg' } as any);
      const response = await api.post('/ocr', form, { timeout: 45000 });
      const remoteJobId = response.data?.data?.id;
      if (!remoteJobId) throw new Error('شناسه درخواست OCR از سرور دریافت نشد');
      await db.runAsync("UPDATE ocr_queue SET remote_job_id=?,status='UPLOADED',retry_count=0,next_attempt_at=NULL,error_message=NULL,updated_at=? WHERE local_id=? AND owner_user_id=?",
        [remoteJobId, new Date().toISOString(), row.local_id, userId]);
    } catch (error: any) {
      const retries = Number(row.retry_count) + 1;
      const delay = Math.min(6 * 60 * 60 * 1000, 2000 * (2 ** Math.min(retries, 12)));
      await db.runAsync("UPDATE ocr_queue SET status='RETRY_UPLOAD',retry_count=?,next_attempt_at=?,error_message=?,updated_at=? WHERE local_id=? AND owner_user_id=?",
        [retries, new Date(Date.now() + delay).toISOString(), String(error?.response?.data?.error?.message || error?.message || 'خطای شبکه').slice(0, 400), new Date().toISOString(), row.local_id, userId]);
    }
  }

  const remoteRows = await db.getAllAsync<any>(
    "SELECT * FROM ocr_queue WHERE owner_user_id=? AND status IN ('UPLOADED','RUNNING') AND remote_job_id IS NOT NULL ORDER BY created_at ASC LIMIT 10", [userId]);
  for (const row of remoteRows) {
    try {
      const response = await api.get(`/ocr/${row.remote_job_id}`, { timeout: 15000 });
      const remote = response.data?.data;
      if (!remote) continue;
      const status = remote.status === 'DONE' ? 'DONE' : remote.status === 'FAILED' ? 'FAILED' : remote.status === 'CANCELLED' ? 'CANCELLED' : 'RUNNING';
      await db.runAsync('UPDATE ocr_queue SET status=?,result_text=?,confidence=?,error_message=?,updated_at=? WHERE local_id=? AND owner_user_id=?',
        [status, remote.resultText ?? null, remote.confidence ?? null, remote.errorMessage ?? null, new Date().toISOString(), row.local_id, userId]);
    } catch { /* Keep the local job and retry status polling on the next sync cycle. */ }
  }
}

export async function retryOcrJobLocal(userId: string, localId: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM ocr_queue WHERE owner_user_id=? AND local_id=?', [userId, localId]);
  if (!row) throw new Error('درخواست OCR محلی پیدا نشد');
  if (row.remote_job_id) {
    await api.post(`/ocr/${row.remote_job_id}/retry`);
    await db.runAsync("UPDATE ocr_queue SET status='UPLOADED',error_message=NULL,updated_at=? WHERE local_id=? AND owner_user_id=?", [new Date().toISOString(), localId, userId]);
  } else {
    await db.runAsync("UPDATE ocr_queue SET status='PENDING_UPLOAD',next_attempt_at=NULL,error_message=NULL,updated_at=? WHERE local_id=? AND owner_user_id=?", [new Date().toISOString(), localId, userId]);
  }
}

export async function deleteOcrJobLocal(userId: string, localId: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT local_uri,remote_job_id FROM ocr_queue WHERE owner_user_id=? AND local_id=?', [userId, localId]);
  if (!row) return;
  if (row.remote_job_id) await api.delete(`/ocr/${row.remote_job_id}`).catch(() => {});
  await FileSystem.deleteAsync(row.local_uri, { idempotent: true }).catch(() => {});
  await db.runAsync('DELETE FROM ocr_queue WHERE owner_user_id=? AND local_id=?', [userId, localId]);
}
