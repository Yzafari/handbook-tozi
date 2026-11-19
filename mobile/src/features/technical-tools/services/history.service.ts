import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Name of the SQLite database file used by the app.
 * Change this constant if the app opens a different database file.
 */
const DATABASE_NAME = 'app.db';

const LOCAL_USER_ID = 'local_user';
const PENDING_SYNC_STATUS = 'pending';

export type CalculationHistoryRecord = {
  id: string;
  tool_id: string;
  user_id: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  created_at: string;
  sync_status: string;
};

type RawHistoryRow = {
  id: string;
  tool_id: string;
  user_id: string;
  inputs: string | null;
  outputs: string | null;
  created_at: string;
  sync_status: string;
};

let databasePromise: Promise<SQLiteDatabase> | null = null;

function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function generateUuid(): string {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

  return template.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return {};
  } catch {
    return {};
  }
}

function mapRow(row: RawHistoryRow): CalculationHistoryRecord {
  return {
    id: row.id,
    tool_id: row.tool_id,
    user_id: row.user_id,
    inputs: parseJsonObject(row.inputs),
    outputs: parseJsonObject(row.outputs),
    created_at: row.created_at,
    sync_status: row.sync_status,
  };
}

export async function saveCalculationHistory(
  toolId: string,
  inputs: Record<string, unknown>,
  outputs: Record<string, unknown>
): Promise<string> {
  const database = await getDatabase();

  const id = generateUuid();
  const createdAt = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO calculation_history
       (id, tool_id, user_id, inputs, outputs, created_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      toolId,
      LOCAL_USER_ID,
      JSON.stringify(inputs),
      JSON.stringify(outputs),
      createdAt,
      PENDING_SYNC_STATUS,
    ]
  );

  return id;
}

export async function getCalculationHistory(): Promise<CalculationHistoryRecord[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<RawHistoryRow>(
    `SELECT id, tool_id, user_id, inputs, outputs, created_at, sync_status
       FROM calculation_history
      ORDER BY created_at DESC`
  );

  return rows.map(mapRow);
}
