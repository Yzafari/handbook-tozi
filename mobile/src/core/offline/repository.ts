import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../database';

type NotebookEntry = { userId: string; entryId?: string; title: string; body: string; version?: number };
type FormDraft = { userId: string; draftId?: string; formType: string; payload: unknown; version?: number };
const scopedLocalId = (userId: string, id: string) => `${userId}:${id}`;

async function queueOrUpdateOutbox(db: Awaited<ReturnType<typeof getDatabase>>, values: {
  operationId: string; userId: string; moduleName: string; entityType: string; entityId: string;
  operation: 'CREATE' | 'UPDATE'; baseVersion?: number; payload: unknown; now: string;
}) {
  // Only coalesce into a row that has never been attempted. A row that already
  // failed a push (retry_count > 0) or is mid-flight (RETRY) must be left alone
  // so its retry bookkeeping and payload stay consistent with what the server saw.
  const pending = await db.getFirstAsync<{ operation_id: string }>(
    `SELECT operation_id FROM outbox WHERE owner_user_id=? AND module_name=? AND entity_type=? AND entity_id=?
     AND status='PENDING' AND COALESCE(retry_count,0)=0 ORDER BY created_at DESC LIMIT 1`,
    [values.userId, values.moduleName, values.entityType, values.entityId],
  );
  if (pending) {
    await db.runAsync('UPDATE outbox SET payload_json=?, updated_at=?, last_error=NULL WHERE operation_id=?',
      [JSON.stringify(values.payload), values.now, pending.operation_id]);
    return pending.operation_id;
  }
  await db.runAsync(
    `INSERT INTO outbox(operation_id,owner_user_id,module_name,entity_type,entity_id,operation,base_version,payload_json,status,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,'PENDING',?,?)`,
    [values.operationId, values.userId, values.moduleName, values.entityType, values.entityId, values.operation,
      values.baseVersion ?? null, JSON.stringify(values.payload), values.now, values.now],
  );
  return values.operationId;
}

export async function saveNotebookEntry(input: NotebookEntry): Promise<string> {
  const db = await getDatabase();
  const entryId = input.entryId ?? randomUUID();
  const now = new Date().toISOString();
  const operationId = randomUUID();
  const localId = scopedLocalId(input.userId, entryId);
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ version: number; server_version: number; sync_status: string }>(
      'SELECT version, server_version, sync_status FROM notebook_entries WHERE entry_id=? AND owner_user_id=?', [localId, input.userId]);
    if (existing?.sync_status === 'CONFLICT') throw new Error('ابتدا تعارض همگام‌سازی این یادداشت را تعیین تکلیف کنید');
    const localVersion = existing ? Number(existing.version) + 1 : 1;
    await db.runAsync(
      `INSERT INTO notebook_entries(entry_id,owner_user_id,title,body,version,server_version,sync_status,updated_at)
       VALUES(?,?,?,?,?,?, 'PENDING',?)
       ON CONFLICT(entry_id) DO UPDATE SET title=excluded.title, body=excluded.body,
       version=notebook_entries.version+1, sync_status='PENDING', updated_at=excluded.updated_at`,
      [localId, input.userId, input.title, input.body, localVersion, existing?.server_version ?? 0, now],
    );
    await queueOrUpdateOutbox(db, { operationId, userId: input.userId, moduleName: 'notebook', entityType: 'NotebookEntry', entityId: entryId,
      operation: existing?.server_version ? 'UPDATE' : 'CREATE', baseVersion: existing?.server_version || undefined,
      payload: { entryId, title: input.title, body: input.body }, now });
  });
  return entryId;
}

export async function saveFormDraft(input: FormDraft): Promise<string> {
  const db = await getDatabase();
  const draftId = input.draftId ?? randomUUID();
  const now = new Date().toISOString();
  const operationId = randomUUID();
  const payload = { draftId, formType: input.formType, values: input.payload };
  const localId = scopedLocalId(input.userId, draftId);
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ version: number; server_version: number; sync_status: string }>(
      'SELECT version, server_version, sync_status FROM form_drafts WHERE draft_id=? AND owner_user_id=?', [localId, input.userId]);
    if (existing?.sync_status === 'CONFLICT') throw new Error('ابتدا تعارض همگام‌سازی این فرم را تعیین تکلیف کنید');
    const localVersion = existing ? Number(existing.version) + 1 : 1;
    await db.runAsync(
      `INSERT INTO form_drafts(draft_id,owner_user_id,form_type,payload_json,version,server_version,sync_status,updated_at)
       VALUES(?,?,?,?,?,?, 'PENDING',?)
       ON CONFLICT(draft_id) DO UPDATE SET payload_json=excluded.payload_json,
       version=form_drafts.version+1, sync_status='PENDING', updated_at=excluded.updated_at`,
      [localId, input.userId, input.formType, JSON.stringify(input.payload), localVersion, existing?.server_version ?? 0, now],
    );
    await queueOrUpdateOutbox(db, { operationId, userId: input.userId, moduleName: 'forms', entityType: 'FormDraft', entityId: draftId,
      operation: existing?.server_version ? 'UPDATE' : 'CREATE', baseVersion: existing?.server_version || undefined, payload, now });
  });
  return draftId;
}

export async function saveCalculation(input: {
  userId: string; calculatorId: string; formulaVersion: string; inputs: unknown; result: unknown; source?: unknown;
}): Promise<string> {
  const db = await getDatabase();
  const calculationId = randomUUID();
  await db.runAsync(
    `INSERT INTO calculation_history(calculation_id,owner_user_id,calculator_id,formula_version,inputs_json,result_json,source_json,created_at)
     VALUES(?,?,?,?,?,?,?,?)`,
    [calculationId, input.userId, input.calculatorId, input.formulaVersion, JSON.stringify(input.inputs),
      JSON.stringify(input.result), input.source === undefined ? null : JSON.stringify(input.source), new Date().toISOString()],
  );
  await db.runAsync(
    `DELETE FROM calculation_history WHERE owner_user_id=? AND calculation_id NOT IN
     (SELECT calculation_id FROM calculation_history WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 100)`,
    [input.userId, input.userId],
  );
  return calculationId;
}


export async function listCalculations(userId: string): Promise<Array<{ id: string; expression: string; result: string; createdAt: string }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT calculation_id,inputs_json,result_json,created_at FROM calculation_history WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 50',
    [userId],
  );
  return rows.map((row: any) => {
    const inputs = JSON.parse(row.inputs_json);
    const result = JSON.parse(row.result_json);
    return { id: row.calculation_id, expression: String(inputs.expression ?? ''), result: String(result.value ?? ''), createdAt: row.created_at };
  });
}

export async function cacheDocument(input: {
  userId: string; documentId: string; metadata: unknown; localUri?: string; contentHash?: string; version?: string; sizeBytes?: number;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO cached_documents(document_id,owner_user_id,metadata_json,local_uri,content_hash,document_version,size_bytes,last_accessed_at,cached_at)
     VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(document_id) DO UPDATE SET metadata_json=excluded.metadata_json,
     local_uri=COALESCE(excluded.local_uri,cached_documents.local_uri),
     content_hash=COALESCE(excluded.content_hash,cached_documents.content_hash),
     document_version=CASE WHEN excluded.local_uri IS NOT NULL THEN excluded.document_version ELSE cached_documents.document_version END,
     size_bytes=CASE WHEN excluded.local_uri IS NOT NULL THEN excluded.size_bytes ELSE cached_documents.size_bytes END,
     last_accessed_at=excluded.last_accessed_at,cached_at=excluded.cached_at`,
    [scopedLocalId(input.userId, input.documentId), input.userId, JSON.stringify(input.metadata), input.localUri ?? null, input.contentHash ?? null,
      input.version ?? null, Math.max(0, Math.floor(input.sizeBytes ?? 0)), now, now],
  );
  await db.runAsync(
    `DELETE FROM cached_documents WHERE owner_user_id=? AND local_uri IS NULL AND document_id NOT IN
     (SELECT document_id FROM cached_documents WHERE owner_user_id=? AND local_uri IS NULL ORDER BY cached_at DESC LIMIT 200)`,
    [input.userId, input.userId],
  );
}

export async function getCachedDocumentEvictions(userId: string, keepDocumentId: string, maxDocuments = 25, maxBytes = 100 * 1024 * 1024): Promise<Array<{ documentId: string; localUri: string }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT document_id,local_uri,size_bytes FROM cached_documents WHERE owner_user_id=? AND local_uri IS NOT NULL
     ORDER BY COALESCE(last_accessed_at,cached_at) ASC`, [userId],
  );
  let count = rows.length;
  let bytes = rows.reduce((sum: number, row: any) => sum + Math.max(0, Number(row.size_bytes) || 0), 0);
  const keepId = scopedLocalId(userId, keepDocumentId);
  const evictions: Array<{ documentId: string; localUri: string }> = [];
  for (const row of rows) {
    if (count <= maxDocuments && bytes <= maxBytes) break;
    if (row.document_id === keepId) continue;
    evictions.push({ documentId: row.document_id.slice(userId.length + 1), localUri: row.local_uri });
    count -= 1;
    bytes -= Math.max(0, Number(row.size_bytes) || 0);
  }
  return evictions;
}

export async function listNotebookEntries(userId: string): Promise<Array<{ entryId: string; title: string; body: string; version: number; serverVersion: number; syncStatus: string; updatedAt: string }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    "SELECT entry_id,title,body,version,server_version,sync_status,updated_at FROM notebook_entries WHERE owner_user_id=? ORDER BY updated_at DESC",
    [userId],
  );
  return rows.map((row: any) => ({ entryId: row.entry_id.slice(userId.length + 1), title: row.title, body: row.body,
    version: Number(row.version), serverVersion: Number(row.server_version), syncStatus: row.sync_status, updatedAt: row.updated_at }));
}

export async function listFormDrafts(userId: string): Promise<Array<{ draftId: string; formType: string; payload: unknown; version: number; serverVersion: number; syncStatus: string; updatedAt: string }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    "SELECT draft_id,form_type,payload_json,version,server_version,sync_status,updated_at FROM form_drafts WHERE owner_user_id=? ORDER BY updated_at DESC",
    [userId],
  );
  return rows.map((row: any) => ({ draftId: row.draft_id.slice(userId.length + 1), formType: row.form_type,
    payload: JSON.parse(row.payload_json), version: Number(row.version), serverVersion: Number(row.server_version),
    syncStatus: row.sync_status, updatedAt: row.updated_at }));
}

export async function listCalculationHistory(userId: string): Promise<Array<{ calculationId: string; calculatorId: string; formulaVersion: string; inputs: unknown; result: unknown; source: unknown; createdAt: string }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT calculation_id,calculator_id,formula_version,inputs_json,result_json,source_json,created_at FROM calculation_history WHERE owner_user_id=? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map((row: any) => ({ calculationId: row.calculation_id, calculatorId: row.calculator_id, formulaVersion: row.formula_version,
    inputs: JSON.parse(row.inputs_json), result: JSON.parse(row.result_json), source: row.source_json ? JSON.parse(row.source_json) : null, createdAt: row.created_at }));
}

export async function listCachedDocuments(userId: string): Promise<Array<{ documentId: string; metadata: unknown; localUri: string | null; version: string | null; cachedAt: string }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT document_id,metadata_json,local_uri,document_version,cached_at FROM cached_documents WHERE owner_user_id=? ORDER BY cached_at DESC',
    [userId],
  );
  return rows.map((row: any) => ({ documentId: row.document_id.slice(userId.length + 1), metadata: JSON.parse(row.metadata_json),
    localUri: row.local_uri, version: row.document_version, cachedAt: row.cached_at }));
}

export async function getCachedDocument(userId: string, documentId: string): Promise<{ metadata: any; localUri: string | null; version: string | null } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT metadata_json,local_uri,document_version FROM cached_documents WHERE document_id=? AND owner_user_id=?',
    [scopedLocalId(userId, documentId), userId]);
  if (!row) return null;
  await db.runAsync('UPDATE cached_documents SET last_accessed_at=? WHERE document_id=? AND owner_user_id=?',
    [new Date().toISOString(), scopedLocalId(userId, documentId), userId]);
  return { metadata: JSON.parse(row.metadata_json), localUri: row.local_uri, version: row.document_version };
}

export async function removeCachedDocument(userId: string, documentId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM cached_documents WHERE document_id=? AND owner_user_id=?', [scopedLocalId(userId, documentId), userId]);
}
