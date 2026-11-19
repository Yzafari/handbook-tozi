import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../../../core/database';

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

/**
 * The shared connection opened by `core/database`, so this module and
 * `core/offline/repository` always read and write the same SQLite file.
 */
type Database = Awaited<ReturnType<typeof getDatabase>>;

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
  const database: Database = await getDatabase();

  const id = randomUUID();
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
  const database: Database = await getDatabase();

  const rows = await database.getAllAsync<RawHistoryRow>(
    `SELECT id, tool_id, user_id, inputs, outputs, created_at, sync_status
       FROM calculation_history
      ORDER BY created_at DESC`
  );

  return rows.map(mapRow);
}

/**
 * Fetches a single calculation history record by its id.
 *
 * @param id - The record's primary key.
 * @returns The parsed record, or null when no row matches.
 */
export async function getHistoryById(id: string): Promise<CalculationHistoryRecord | null> {
  const database: Database = await getDatabase();

  const row = await database.getFirstAsync<RawHistoryRow>(
    `SELECT id, tool_id, user_id, inputs, outputs, created_at, sync_status
       FROM calculation_history
      WHERE id = ?`,
    [id]
  );

  return row ? mapRow(row) : null;
}
