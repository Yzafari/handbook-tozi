import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../database';
const scopedLocalId = (userId: string, id: string) => `${userId}:${id}`;

export type OutboxOperation = {
  operationId: string;
  moduleName: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  baseVersion?: number;
  payload: unknown;
  createdAt: string;
};

export type PushResult = {
  acceptedOperationIds: string[];
  acceptedVersions?: Array<{ operationId: string; version: number }>;
  conflicts: Array<{ operationId: string; reason: string }>;
};

export type SyncTransport = {
  push: (operations: OutboxOperation[]) => Promise<PushResult>;
};

export async function enqueueOperation(input: Omit<OutboxOperation, 'operationId' | 'createdAt'> & { userId: string }): Promise<string> {
  const db = await getDatabase();
  const operationId = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO outbox(operation_id,owner_user_id,module_name,entity_type,entity_id,operation,base_version,payload_json,status,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,'PENDING',?,?)`,
    [operationId, input.userId, input.moduleName, input.entityType, input.entityId, input.operation,
      input.baseVersion ?? null, JSON.stringify(input.payload), now, now],
  );
  return operationId;
}

export async function syncOutbox(userId: string, transport: SyncTransport, batchSize = 50): Promise<{ accepted: number; conflicts: number }> {
  const db = await getDatabase();
  // Retain only recent acknowledgements for diagnostics; never prune unsynced or conflicted work.
  await db.runAsync("DELETE FROM outbox WHERE owner_user_id=? AND status='SYNCED' AND updated_at < ?",
    [userId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()]);
  const candidates = await db.getAllAsync<any>(
    `SELECT current.* FROM outbox AS current WHERE current.owner_user_id=? AND (
       (current.status IN ('PENDING','RETRY') AND (current.next_attempt_at IS NULL OR current.next_attempt_at <= ?)) OR
       (current.status='SENDING' AND current.updated_at <= ?)
     ) AND NOT EXISTS (
       SELECT 1 FROM outbox AS earlier
       WHERE earlier.owner_user_id=current.owner_user_id
         AND earlier.module_name=current.module_name
         AND earlier.entity_type=current.entity_type
         AND earlier.entity_id=current.entity_id
         AND earlier.status IN ('PENDING','RETRY','SENDING')
         AND (earlier.created_at < current.created_at OR (earlier.created_at = current.created_at AND earlier.operation_id < current.operation_id))
     ) ORDER BY current.created_at ASC LIMIT ?`,
    [userId, new Date().toISOString(), new Date(Date.now() - 5 * 60 * 1000).toISOString(), Math.min(100, Math.max(1, batchSize))],
  );
  if (!candidates.length) return { accepted: 0, conflicts: 0 };

  // Claim the batch before network I/O. New edits made while this batch is in
  // flight create a separate PENDING operation and cannot mutate this payload.
  const rows: any[] = [];
  for (const row of candidates) {
    const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const claimed = await db.runAsync("UPDATE outbox SET status='SENDING', updated_at=? WHERE operation_id=? AND (status IN ('PENDING','RETRY') OR (status='SENDING' AND updated_at<=?))",
      [new Date().toISOString(), row.operation_id, staleCutoff]);
    if (claimed.changes === 1) rows.push(row);
  }
  if (!rows.length) return { accepted: 0, conflicts: 0 };

  const operations: OutboxOperation[] = rows.map(row => ({
    operationId: row.operation_id, moduleName: row.module_name, entityType: row.entity_type,
    entityId: row.entity_id, operation: row.operation, baseVersion: row.base_version ?? undefined,
    payload: JSON.parse(row.payload_json), createdAt: row.created_at,
  }));
  let result: PushResult;
  try {
    result = await transport.push(operations);
  } catch (error) {
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      for (const row of rows) {
        const retryCount = Number(row.retry_count) + 1;
        const delayMs = Math.min(6 * 60 * 60 * 1000, 1000 * (2 ** Math.min(retryCount, 12)));
        await db.runAsync("UPDATE outbox SET status='RETRY', retry_count=?, next_attempt_at=?, last_error=?, updated_at=? WHERE operation_id=? AND status='SENDING'",
          [retryCount, new Date(Date.now() + delayMs).toISOString(), String((error as Error)?.message ?? 'Network error').slice(0, 500), now, row.operation_id]);
      }
    });
    throw error;
  }
  const rowIds = new Set<string>(rows.map(row => row.operation_id));
  const accepted = new Set((result.acceptedOperationIds ?? []).filter(id => rowIds.has(id)));
  const conflicts = new Map((result.conflicts ?? []).filter(item => rowIds.has(item.operationId)).map(item => [item.operationId, item.reason]));
  const acceptedVersions = new Map((result.acceptedVersions ?? []).filter(item => rowIds.has(item.operationId)).map(item => [item.operationId, item.version]));

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const now = new Date().toISOString();
      if (accepted.has(row.operation_id)) {
        await db.runAsync("UPDATE outbox SET status='SYNCED', last_error=NULL, updated_at=? WHERE operation_id=?", [now, row.operation_id]);
        const serverVersion = acceptedVersions.get(row.operation_id);
        if (serverVersion !== undefined) {
          const pending = await db.getFirstAsync<{ operation_id: string }>(
            "SELECT operation_id FROM outbox WHERE owner_user_id=? AND module_name=? AND entity_type=? AND entity_id=? AND status IN ('PENDING','RETRY') ORDER BY created_at ASC LIMIT 1",
            [userId, row.module_name, row.entity_type, row.entity_id]);
          if (row.module_name === 'notebook' && row.entity_type === 'NotebookEntry') {
            await db.runAsync("UPDATE notebook_entries SET server_version=?, sync_status=? WHERE entry_id=? AND owner_user_id=?",
              [serverVersion, pending ? 'PENDING' : 'SYNCED', scopedLocalId(userId, row.entity_id), userId]);
          } else if (row.module_name === 'forms' && row.entity_type === 'FormDraft') {
            await db.runAsync("UPDATE form_drafts SET server_version=?, sync_status=? WHERE draft_id=? AND owner_user_id=?",
              [serverVersion, pending ? 'PENDING' : 'SYNCED', scopedLocalId(userId, row.entity_id), userId]);
          }
          if (pending) {
            await db.runAsync("UPDATE outbox SET operation=CASE WHEN operation='DELETE' THEN 'DELETE' ELSE 'UPDATE' END, base_version=?, updated_at=? WHERE operation_id=? AND status IN ('PENDING','RETRY')",
              [serverVersion, now, pending.operation_id]);
          }
        }
      } else if (conflicts.has(row.operation_id)) {
        await db.runAsync("UPDATE outbox SET status='CONFLICT', last_error=?, updated_at=? WHERE operation_id=?", [conflicts.get(row.operation_id), now, row.operation_id]);
        if (row.module_name === 'notebook' && row.entity_type === 'NotebookEntry') {
          await db.runAsync("UPDATE notebook_entries SET sync_status='CONFLICT' WHERE entry_id=? AND owner_user_id=?", [scopedLocalId(userId, row.entity_id), userId]);
        } else if (row.module_name === 'forms' && row.entity_type === 'FormDraft') {
          await db.runAsync("UPDATE form_drafts SET sync_status='CONFLICT' WHERE draft_id=? AND owner_user_id=?", [scopedLocalId(userId, row.entity_id), userId]);
        }
      } else {
        const retryCount = Number(row.retry_count) + 1;
        const delayMs = Math.min(6 * 60 * 60 * 1000, 1000 * (2 ** Math.min(retryCount, 12)));
        await db.runAsync("UPDATE outbox SET status='RETRY', retry_count=?, next_attempt_at=?, last_error='Not acknowledged by server', updated_at=? WHERE operation_id=? AND status='SENDING'",
          [retryCount, new Date(Date.now() + delayMs).toISOString(), now, row.operation_id]);
      }
    }
  });
  return { accepted: accepted.size, conflicts: conflicts.size };
}
