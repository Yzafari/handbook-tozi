import Constants from 'expo-constants';
import { api } from '../../../core/network/api';

const API_PORT = 3000;
const FALLBACK_API_BASE_URL = 'http://192.168.1.9:3000/api/v1';

/**
 * Resolves the API base URL for the technical-tools service.
 *
 * Mirrors the resolution logic in `core/network/api` so this module can
 * expose the base URL to consumers that need to build absolute URLs.
 * The shared `api` client already applies this base URL to every request.
 */
export function getApiBaseUrl(): string {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri?.split(':')[0];
    if (host) {
      return `http://${host}:${API_PORT}/api/v1`;
    }
  }
  return FALLBACK_API_BASE_URL;
}

/**
 * Payload contract expected by the backend CalculationHistory model.
 *
 * Note: `createdAt` is accepted by this type but the backend currently
 * stamps its own timestamp via `@default(now())`.
 */
export type CalculationHistorySyncPayload = {
  toolId: string;
  toolVersion: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  sources?: Record<string, unknown> | null;
  createdAt?: string;
};

export type CalculationHistorySyncResponse = {
  success: boolean;
  data?: unknown;
  message?: string;
};

/**
 * Sends a batch of calculation history records to the backend.
 *
 * Uses the shared `api` client, which already:
 * - prefixes requests with the dynamically resolved base URL
 * - attaches the `Authorization: Bearer <token>` header
 * - refreshes the session and retries once on a 401
 *
 * @param historyItems - Records to persist server-side.
 * @returns The parsed server response.
 * @throws AxiosError on network failure or non-2xx status.
 */
export async function syncHistoryToBackend(
  historyItems: CalculationHistorySyncPayload[]
): Promise<CalculationHistorySyncResponse> {
  const response = await api.post<CalculationHistorySyncResponse>(
    '/calculation-history/sync',
    historyItems
  );

  return response.data;
}
