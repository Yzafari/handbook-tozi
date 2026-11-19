import { api, getApiBaseUrl } from '../../../core/network/api';

export { getApiBaseUrl };

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
