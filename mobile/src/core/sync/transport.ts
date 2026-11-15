import { api } from '../network/api';
import { getDatabase } from '../database';
import { randomUUID } from 'expo-crypto';
import { syncOutbox } from './outbox';
import type { OutboxOperation, PushResult } from './outbox';
import { syncOcrQueue } from '../ocr/queue';
const scopedLocalId = (userId: string, id: string) => `${userId}:${id}`;

type PullRecord = {
  moduleName: 'notebook' | 'forms';
  entityType: 'NotebookEntry' | 'FormDraft';
  entityId: string;
  version: number;
  deleted: boolean;
  payload: Record<string, unknown> | null;
  updatedAt: string;
};

type PullPage = { items: PullRecord[]; nextCursor: string | null; hasMore: boolean };

type SyncResult = { accepted: number; conflicts: number; pulled: number };

// In-process, per-user lock so concurrent runSync callers (auto-sync, manual
// refresh, conflict resolution) share one pass instead of duplicating push/pull
// and OCR work.
const ACTIVE_SYNCS = new Map<string, Promise<SyncResult>>();

const transport = {
  async push(operations: OutboxOperation[]): Promise<PushResult> {
    const response = await api.post('/sync/push', { operations });
    return response.data?.data as PushResult;
  },
};

async function pullPage(cursor: string | null): Promise<PullPage> {
  const response = await api.get('/sync/pull', { params: { cursor: cursor ?? undefined, limit: 100 } });
  return {
    items: response.data?.data ?? [],
    nextCursor: response.data?.meta?.nextCursor ?? cursor,
    hasMore: Boolean(response.data?.meta?.hasMore),
  };
}

async function enqueueResolvedOperation(db: Awaited<ReturnType<typeof getDatabase>>, input: {
  userId: string; moduleName: string; entityType: string; entityId: string; operation: 'CREATE' | 'UPDATE';
  baseVersion?: number; payload: unknown;
}): Promise<void> {
  const operationId = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO outbox(operation_id,owner_user_id,module_name,entity_type,entity_id,operation,base_version,payload_json,status,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,'PENDING',?,?)`,
    [operationId, input.userId, input.moduleName, input.entityType, input.entityId, input.operation,
      input.baseVersion ?? null, JSON.stringify(input.payload), now, now],
  );
}

async function applyRemotePage(userId: string, records: PullRecord[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const record of records) {
      if (record.moduleName === 'notebook' && record.entityType === 'NotebookEntry') {
        const local = await db.getFirstAsync<{ sync_status: string }>(
          'SELECT sync_status FROM notebook_entries WHERE entry_id=? AND owner_user_id=?', [scopedLocalId(userId, record.entityId), userId]);
        if (local?.sync_status === 'PENDING' || local?.sync_status === 'CONFLICT') continue;
        if (record.deleted) {
          await db.runAsync('DELETE FROM notebook_entries WHERE entry_id=? AND owner_user_id=?', [scopedLocalId(userId, record.entityId), userId]);
        } else {
          const payload = record.payload ?? {};
          await db.runAsync(
            `INSERT INTO notebook_entries(entry_id,owner_user_id,title,body,version,server_version,sync_status,updated_at)
             VALUES(?,?,?,?,?,?, 'SYNCED',?) ON CONFLICT(entry_id) DO UPDATE SET
             title=excluded.title, body=excluded.body, version=excluded.version,
             server_version=excluded.server_version, sync_status='SYNCED', updated_at=excluded.updated_at`,
            [scopedLocalId(userId, record.entityId), userId, String(payload.title ?? ''), String(payload.body ?? ''), record.version, record.version, record.updatedAt],
          );
        }
      } else if (record.moduleName === 'forms' && record.entityType === 'FormDraft') {
        const local = await db.getFirstAsync<{ sync_status: string }>(
          'SELECT sync_status FROM form_drafts WHERE draft_id=? AND owner_user_id=?', [scopedLocalId(userId, record.entityId), userId]);
        if (local?.sync_status === 'PENDING' || local?.sync_status === 'CONFLICT') continue;
        if (record.deleted) {
          await db.runAsync('DELETE FROM form_drafts WHERE draft_id=? AND owner_user_id=?', [scopedLocalId(userId, record.entityId), userId]);
        } else {
          const payload = record.payload ?? {};
          await db.runAsync(
            `INSERT INTO form_drafts(draft_id,owner_user_id,form_type,payload_json,version,server_version,sync_status,updated_at)
             VALUES(?,?,?,?,?,?, 'SYNCED',?) ON CONFLICT(draft_id) DO UPDATE SET
             form_type=excluded.form_type, payload_json=excluded.payload_json, version=excluded.version,
             server_version=excluded.server_version, sync_status='SYNCED', updated_at=excluded.updated_at`,
            [scopedLocalId(userId, record.entityId), userId, String(payload.formType ?? ''), JSON.stringify(payload.values ?? {}), record.version, record.version, record.updatedAt],
          );
        }
      }
    }
  });
}

async function performSync(userId: string): Promise<SyncResult> {
  let accepted = 0;
  let conflicts = 0;
  for (let batch = 0; batch < 10; batch += 1) {
    const result = await syncOutbox(userId, transport, 50);
    accepted += result.accepted;
    conflicts += result.conflicts;
    if (result.accepted === 0) break;
  }
  await syncOcrQueue(userId).catch(() => {});
  const db = await getDatabase();
  const scope = `user:${userId}`;
  const state = await db.getFirstAsync<{ cursor: string | null }>('SELECT cursor FROM sync_state WHERE scope=?', [scope]);
  let cursor = state?.cursor ?? null;
  let pulled = 0;
  let hasMore = true;
  let pages = 0;
  while (hasMore && pages < 20) {
    const page = await pullPage(cursor);
    await applyRemotePage(userId, page.items);
    pulled += page.items.length;
    cursor = page.nextCursor;
    hasMore = page.hasMore;
    pages += 1;
    await db.runAsync(
      `INSERT INTO sync_state(scope,cursor,last_success_at) VALUES(?,?,?)
       ON CONFLICT(scope) DO UPDATE SET cursor=excluded.cursor,last_success_at=excluded.last_success_at`,
      [scope, cursor, new Date().toISOString()],
    );
    if (!page.items.length) break;
  }
  return { accepted, conflicts, pulled };
}

export function runSync(userId: string): Promise<SyncResult> {
  if (!userId) throw new Error('برای همگام‌سازی شناسه کاربر الزامی است');
  const existing = ACTIVE_SYNCS.get(userId);
  if (existing) return existing;
  const run = performSync(userId);
  ACTIVE_SYNCS.set(userId, run);
  const release = () => {
    if (ACTIVE_SYNCS.get(userId) === run) ACTIVE_SYNCS.delete(userId);
  };
  run.then(release, release);
  return run;
}


export async function resolveNotebookConflict(userId: string, entryId: string, strategy: 'LOCAL' | 'SERVER'): Promise<void> {
  const db = await getDatabase();
  const localId = scopedLocalId(userId, entryId);
  const local = await db.getFirstAsync<any>('SELECT title,body,server_version FROM notebook_entries WHERE entry_id=? AND owner_user_id=?', [localId, userId]);
  if (!local) throw new Error('یادداشت محلی برای حل تعارض پیدا نشد');
  const response = await api.get(`/sync/record/notebook/NotebookEntry/${encodeURIComponent(entryId)}`);
  const remote = response.data?.data as PullRecord;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE outbox SET status='RESOLVED', updated_at=? WHERE owner_user_id=? AND module_name='notebook' AND entity_type='NotebookEntry' AND entity_id=? AND status='CONFLICT'",
      [new Date().toISOString(), userId, entryId]);
    if (strategy === 'SERVER') {
      if (remote.deleted || !remote.payload) {
        await db.runAsync('DELETE FROM notebook_entries WHERE entry_id=? AND owner_user_id=?', [localId, userId]);
      } else {
        await db.runAsync("UPDATE notebook_entries SET title=?,body=?,version=?,server_version=?,sync_status='SYNCED',updated_at=? WHERE entry_id=? AND owner_user_id=?",
          [String(remote.payload.title ?? ''), String(remote.payload.body ?? ''), remote.version, remote.version, remote.updatedAt, localId, userId]);
      }
    } else {
      await db.runAsync("UPDATE notebook_entries SET server_version=?,sync_status='PENDING' WHERE entry_id=? AND owner_user_id=?",
        [remote.version, localId, userId]);
      await enqueueResolvedOperation(db, { userId, moduleName: 'notebook', entityType: 'NotebookEntry', entityId: entryId,
        operation: remote.deleted ? 'CREATE' : 'UPDATE', baseVersion: remote.deleted ? undefined : remote.version,
        payload: { entryId, title: local.title, body: local.body } });
    }
  });
}

export async function resolveFormConflict(userId: string, draftId: string, strategy: 'LOCAL' | 'SERVER'): Promise<void> {
  const db = await getDatabase();
  const localId = scopedLocalId(userId, draftId);
  const local = await db.getFirstAsync<any>('SELECT form_type,payload_json,server_version FROM form_drafts WHERE draft_id=? AND owner_user_id=?', [localId, userId]);
  if (!local) throw new Error('پیش‌نویس محلی برای حل تعارض پیدا نشد');
  const response = await api.get(`/sync/record/forms/FormDraft/${encodeURIComponent(draftId)}`);
  const remote = response.data?.data as PullRecord;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE outbox SET status='RESOLVED', updated_at=? WHERE owner_user_id=? AND module_name='forms' AND entity_type='FormDraft' AND entity_id=? AND status='CONFLICT'",
      [new Date().toISOString(), userId, draftId]);
    if (strategy === 'SERVER') {
      if (remote.deleted || !remote.payload) {
        await db.runAsync('DELETE FROM form_drafts WHERE draft_id=? AND owner_user_id=?', [localId, userId]);
      } else {
        await db.runAsync("UPDATE form_drafts SET form_type=?,payload_json=?,version=?,server_version=?,sync_status='SYNCED',updated_at=? WHERE draft_id=? AND owner_user_id=?",
          [String(remote.payload.formType ?? ''), JSON.stringify(remote.payload.values ?? {}), remote.version, remote.version, remote.updatedAt, localId, userId]);
      }
    } else {
      await db.runAsync("UPDATE form_drafts SET server_version=?,sync_status='PENDING' WHERE draft_id=? AND owner_user_id=?",
        [remote.version, localId, userId]);
      await enqueueResolvedOperation(db, { userId, moduleName: 'forms', entityType: 'FormDraft', entityId: draftId,
        operation: remote.deleted ? 'CREATE' : 'UPDATE', baseVersion: remote.deleted ? undefined : remote.version,
        payload: { draftId, formType: local.form_type, values: JSON.parse(local.payload_json) } });
    }
  });
}
