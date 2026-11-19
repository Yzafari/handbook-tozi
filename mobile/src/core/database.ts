import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Single SQLite file for the whole app. Every module must obtain its
 * connection through `getDatabase()` so there is exactly one open handle
 * and one schema.
 */
const DATABASE_NAME = 'handbook.db';

/**
 * Schema is derived from the queries in `core/offline/repository.ts`.
 * Keep the two in sync: a column added here must be written there and
 * vice versa.
 */
const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS calculation_history (
     calculation_id TEXT PRIMARY KEY NOT NULL,
     owner_user_id TEXT NOT NULL,
     calculator_id TEXT NOT NULL,
     formula_version TEXT NOT NULL,
     inputs_json TEXT NOT NULL,
     result_json TEXT NOT NULL,
     source_json TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_calculation_history_owner_created
     ON calculation_history (owner_user_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS outbox (
     operation_id TEXT PRIMARY KEY NOT NULL,
     owner_user_id TEXT NOT NULL,
     module_name TEXT NOT NULL,
     entity_type TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     operation TEXT NOT NULL,
     base_version INTEGER,
     payload_json TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'PENDING',
     retry_count INTEGER NOT NULL DEFAULT 0,
     last_error TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_pending
     ON outbox (owner_user_id, status, created_at)`,

  `CREATE TABLE IF NOT EXISTS notebook_entries (
     entry_id TEXT PRIMARY KEY NOT NULL,
     owner_user_id TEXT NOT NULL,
     title TEXT NOT NULL,
     body TEXT NOT NULL,
     version INTEGER NOT NULL DEFAULT 1,
     server_version INTEGER NOT NULL DEFAULT 0,
     sync_status TEXT NOT NULL DEFAULT 'PENDING',
     updated_at TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS form_drafts (
     draft_id TEXT PRIMARY KEY NOT NULL,
     owner_user_id TEXT NOT NULL,
     form_type TEXT NOT NULL,
     payload_json TEXT NOT NULL,
     version INTEGER NOT NULL DEFAULT 1,
     server_version INTEGER NOT NULL DEFAULT 0,
     sync_status TEXT NOT NULL DEFAULT 'PENDING',
     updated_at TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS cached_documents (
     document_id TEXT PRIMARY KEY NOT NULL,
     owner_user_id TEXT NOT NULL,
     metadata_json TEXT NOT NULL,
     local_uri TEXT,
     content_hash TEXT,
     document_version TEXT,
     size_bytes INTEGER NOT NULL DEFAULT 0,
     last_accessed_at TEXT,
     cached_at TEXT NOT NULL
   )`,
];

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function initialize(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  for (const statement of SCHEMA_STATEMENTS) {
    await db.execAsync(statement);
  }
}

/**
 * Returns the shared database handle, opening and migrating it on first use.
 *
 * The promise is cached so concurrent callers share one connection. A failed
 * open clears the cache so the next call can retry.
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME)
      .then(async (db) => {
        await initialize(db);
        return db;
      })
      .catch((error: unknown) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}
