import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Small JSON store for the local-only modules (projects, chat drafts). Every
 * key is scoped to the signed-in account so two accounts on one phone never
 * read each other's data, and guests get a stable local partition.
 */
function scopedKey(area: string, ownerId: string) {
  return `@handbook/${area}/${ownerId}`;
}

export async function readLocal<T>(area: string, ownerId: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(area, ownerId));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeLocal<T>(area: string, ownerId: string, value: T): Promise<void> {
  await AsyncStorage.setItem(scopedKey(area, ownerId), JSON.stringify(value));
}

export async function clearLocal(area: string, ownerId: string): Promise<void> {
  await AsyncStorage.removeItem(scopedKey(area, ownerId));
}
