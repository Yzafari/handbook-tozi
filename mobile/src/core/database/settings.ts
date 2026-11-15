import { getDatabase } from './index';

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE settings_key=?', [key]);
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

export async function writeSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO app_settings(settings_key,value,updated_at) VALUES(?,?,?) ON CONFLICT(settings_key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', [key, JSON.stringify(value), new Date().toISOString()]);
}
