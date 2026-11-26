import axios from 'axios';
import { getApiBaseUrl } from './api';

export type ConnectionTestResult = {
  apiUrl: string;
  healthUrl: string;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  health: unknown;
  message: string;
};

/**
 * Calls the versioned health endpoint exactly where the app sends its API
 * traffic. This distinguishes "the phone cannot reach the server / the address
 * is wrong" from "the API answered but rejected the login".
 */
export async function testApiConnection(): Promise<ConnectionTestResult> {
  let base: string;
  try {
    base = getApiBaseUrl();
  } catch (error: any) {
    return {
      apiUrl: '—',
      healthUrl: '—',
      ok: false,
      status: null,
      latencyMs: 0,
      health: null,
      message: `آدرس API تنظیم نشده است: ${error?.message ?? ''}`.trim(),
    };
  }

  const healthUrl = `${base.replace(/\/$/, '')}/health`;
  const startedAt = Date.now();

  try {
    const response = await axios.get(healthUrl, {
      timeout: 15000,
      headers: { Accept: 'application/json' },
      validateStatus: () => true,
    });
    const latencyMs = Date.now() - startedAt;
    const body: any = response.data;
    const health = body?.data ?? body;
    const ok = response.status >= 200 && response.status < 300 && body?.success !== false;
    const statusText = health?.status ?? health?.state ?? '—';

    return {
      apiUrl: base,
      healthUrl,
      ok,
      status: response.status,
      latencyMs,
      health: body,
      message: ok
        ? `سرور پاسخ داد (${response.status}) · وضعیت: ${statusText}`
        : `سرور پاسخ داد ولی سلامت را تأیید نکرد (${response.status})`,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startedAt;
    const code = error?.code ? `${error.code} · ` : '';
    const detail = error?.message ? String(error.message) : 'خطای شبکه';
    return {
      apiUrl: base,
      healthUrl,
      ok: false,
      status: error?.response?.status ?? null,
      latencyMs,
      health: null,
      message: `${code}${detail}`,
    };
  }
}
