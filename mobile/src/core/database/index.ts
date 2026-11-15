import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';

const DATABASE_NAME = 'handbook-distribution.db';
const DATABASE_KEY_NAME = 'handbook.sqlite-key.v1';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getOrCreateDatabaseKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(DATABASE_KEY_NAME);
  if (!key) {
    const bytes = await getRandomBytesAsync(32);
    key = Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(DATABASE_KEY_NAME, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return key;
}


async function ensureColumn(db: SQLite.SQLiteDatabase, table: string, column: string, definition: string): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item: { name: string }) => item.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      // SQLCipher is enabled by the expo-sqlite config plugin. The key is stored
      // in the platform secure store and is never persisted in the database.
      const key = await getOrCreateDatabaseKey();
      await db.execAsync(`PRAGMA key = "x'${key}'";`);
      await db.getFirstAsync('SELECT count(*) AS ready FROM sqlite_master');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS local_schema_migrations (
          version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS outbox (
          operation_id TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT NOT NULL DEFAULT '', module_name TEXT NOT NULL,
          entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL,
          base_version INTEGER, payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
          retry_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, last_error TEXT,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS outbox_status_created_idx ON outbox(status, created_at);
        CREATE TABLE IF NOT EXISTS cached_documents (
          document_id TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT NOT NULL DEFAULT '', metadata_json TEXT NOT NULL,
          local_uri TEXT, content_hash TEXT, document_version TEXT, size_bytes INTEGER NOT NULL DEFAULT 0,
          last_accessed_at TEXT, cached_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notebook_entries (
          entry_id TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, body TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1, server_version INTEGER NOT NULL DEFAULT 0, sync_status TEXT NOT NULL DEFAULT 'PENDING', updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS form_drafts (
          draft_id TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT NOT NULL DEFAULT '', form_type TEXT NOT NULL, payload_json TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1, server_version INTEGER NOT NULL DEFAULT 0, sync_status TEXT NOT NULL DEFAULT 'PENDING', updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS calculation_history (
          calculation_id TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT NOT NULL DEFAULT '', calculator_id TEXT NOT NULL,
          formula_version TEXT NOT NULL, inputs_json TEXT NOT NULL, result_json TEXT NOT NULL,
          source_json TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_state (
          scope TEXT PRIMARY KEY NOT NULL, cursor TEXT, last_success_at TEXT
        );
        CREATE TABLE IF NOT EXISTS search_cache (
          cache_key TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT NOT NULL DEFAULT '', results_json TEXT NOT NULL,
          next_cursor TEXT, has_more INTEGER NOT NULL DEFAULT 0,
          cached_at TEXT NOT NULL, expires_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS search_cache_expiry_idx ON search_cache(expires_at);
        CREATE TABLE IF NOT EXISTS ocr_queue (
          local_id TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT NOT NULL,
          local_uri TEXT NOT NULL, remote_job_id TEXT, status TEXT NOT NULL,
          result_text TEXT, confidence REAL, error_message TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ocr_queue_owner_status_idx ON ocr_queue(owner_user_id,status,created_at);
      `);
      const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const currentVersion = Number(versionRow?.user_version ?? 0);

      // Forward-only, additive migrations keep existing local records intact.
      await ensureColumn(db, 'outbox', 'owner_user_id', "TEXT NOT NULL DEFAULT ''");
      await ensureColumn(db, 'notebook_entries', 'owner_user_id', "TEXT NOT NULL DEFAULT ''");
      await ensureColumn(db, 'notebook_entries', 'server_version', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumn(db, 'notebook_entries', 'sync_status', "TEXT NOT NULL DEFAULT 'PENDING'");
      await ensureColumn(db, 'form_drafts', 'owner_user_id', "TEXT NOT NULL DEFAULT ''");
      await ensureColumn(db, 'form_drafts', 'server_version', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumn(db, 'form_drafts', 'sync_status', "TEXT NOT NULL DEFAULT 'PENDING'");
      await ensureColumn(db, 'calculation_history', 'owner_user_id', "TEXT NOT NULL DEFAULT ''");
      await ensureColumn(db, 'search_cache', 'owner_user_id', "TEXT NOT NULL DEFAULT ''");
      await ensureColumn(db, 'cached_documents', 'owner_user_id', "TEXT NOT NULL DEFAULT ''");
      await ensureColumn(db, 'cached_documents', 'size_bytes', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumn(db, 'cached_documents', 'last_accessed_at', 'TEXT');

      await db.execAsync('CREATE INDEX IF NOT EXISTS outbox_owner_status_idx ON outbox(owner_user_id, status, created_at)');
      await db.runAsync('INSERT OR IGNORE INTO local_schema_migrations(version, applied_at) VALUES (?, ?)', [1, new Date().toISOString()]);
      await db.runAsync('INSERT OR IGNORE INTO local_schema_migrations(version, applied_at) VALUES (?, ?)', [2, new Date().toISOString()]);
      if (currentVersion < 3) {
        await db.execAsync('CREATE INDEX IF NOT EXISTS ocr_queue_owner_status_idx ON ocr_queue(owner_user_id,status,created_at)');
        await db.execAsync('CREATE INDEX IF NOT EXISTS search_cache_expiry_idx ON search_cache(expires_at)');
        await db.runAsync('INSERT OR IGNORE INTO local_schema_migrations(version, applied_at) VALUES (?, ?)', [3, new Date().toISOString()]);
        await db.execAsync('PRAGMA user_version = 3');
      }
      if (currentVersion < 4) {
        await db.execAsync('CREATE TABLE IF NOT EXISTS app_settings (settings_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
        await db.runAsync('INSERT OR IGNORE INTO local_schema_migrations(version, applied_at) VALUES (?, ?)', [4, new Date().toISOString()]);
        await db.execAsync('PRAGMA user_version = 4');
      }
      if (currentVersion < 5) {
        await db.execAsync('CREATE INDEX IF NOT EXISTS cached_documents_owner_accessed_idx ON cached_documents(owner_user_id,last_accessed_at)');
        await db.runAsync('INSERT OR IGNORE INTO local_schema_migrations(version, applied_at) VALUES (?, ?)', [5, new Date().toISOString()]);
        await db.execAsync('PRAGMA user_version = 5');
      }
      return db;
    })().catch(error => { databasePromise = null; throw error; });
  }
  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  if (!databasePromise) return;
  const db = await databasePromise;
  await db.closeAsync();
  databasePromise = null;
}
