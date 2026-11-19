import { getDatabase } from '../../../core/database';
import {
  listCalculationHistory,
  saveCalculation,
} from '../../../core/offline/repository';

/**
 * Default owner id. `repository.ts` scopes every row by `owner_user_id` and
 * receives that id from its caller, so once the app has an authenticated
 * session these helpers must be given the same id or the two paths will
 * write to different partitions of the same table.
 */
const LOCAL_USER_ID = 'local_user';

/**
 * Stamped on rows saved without an explicit version. The voltage-drop formula
 * is still under review, so this deliberately signals "unapproved".
 */
const DEFAULT_FORMULA_VERSION = '0.0.0-draft';

/**
 * Mirrors the return shape of `repository.listCalculationHistory` so the two
 * modules expose identical types for the same table.
 */
export type CalculationHistoryRecord = {
  calculationId: string;
  ownerUserId: string;
  calculatorId: string;
  formulaVersion: string;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  source: Record<string, unknown> | null;
  createdAt: string;
};

type RawHistoryRow = {
  calculation_id: string;
  owner_user_id: string;
  calculator_id: string;
  formula_version: string;
  inputs_json: string | null;
  result_json: string | null;
  source_json: string | null;
  created_at: string;
};

type Database = Awaited<ReturnType<typeof getDatabase>>;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};

  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

function parseNullableJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
}

function mapRow(row: RawHistoryRow): CalculationHistoryRecord {
  return {
    calculationId: row.calculation_id,
    ownerUserId: row.owner_user_id,
    calculatorId: row.calculator_id,
    formulaVersion: row.formula_version,
    inputs: parseJsonObject(row.inputs_json),
    result: parseJsonObject(row.result_json),
    source: parseNullableJsonObject(row.source_json),
    createdAt: row.created_at,
  };
}

export type SaveCalculationHistoryOptions = {
  formulaVersion?: string;
  source?: Record<string, unknown> | null;
  userId?: string;
};

/**
 * Persists one calculation through `repository.saveCalculation`, so the
 * column set and the 100-row retention policy are identical to every other
 * writer of `calculation_history`.
 *
 * @returns The generated `calculation_id`.
 */
export async function saveCalculationHistory(
  calculatorId: string,
  inputs: Record<string, unknown>,
  result: Record<string, unknown>,
  options?: SaveCalculationHistoryOptions
): Promise<string> {
  return saveCalculation({
    userId: options?.userId ?? LOCAL_USER_ID,
    calculatorId,
    formulaVersion: options?.formulaVersion ?? DEFAULT_FORMULA_VERSION,
    inputs,
    result,
    source: options?.source ?? undefined,
  });
}

/**
 * Returns the owner's calculation history, newest first.
 *
 * @param userId - Owner scope. Defaults to the local owner id.
 */
export async function getCalculationHistory(
  userId: string = LOCAL_USER_ID
): Promise<CalculationHistoryRecord[]> {
  const rows = await listCalculationHistory(userId);

  return rows.map((row) => ({
    calculationId: row.calculationId,
    ownerUserId: userId,
    calculatorId: row.calculatorId,
    formulaVersion: row.formulaVersion,
    inputs: asRecord(row.inputs),
    result: asRecord(row.result),
    source: row.source === null || row.source === undefined ? null : asRecord(row.source),
    createdAt: row.createdAt,
  }));
}

/**
 * Fetches a single calculation history record by its primary key.
 *
 * @param id - The record's `calculation_id`.
 * @returns The parsed record, or null when no row matches.
 */
export async function getHistoryById(id: string): Promise<CalculationHistoryRecord | null> {
  const database: Database = await getDatabase();

  const row = await database.getFirstAsync<RawHistoryRow>(
    `SELECT calculation_id, owner_user_id, calculator_id, formula_version, inputs_json, result_json, source_json, created_at
       FROM calculation_history
      WHERE calculation_id = ?`,
    [id]
  );

  return row ? mapRow(row) : null;
}
