/**
 * Extracts the most useful message from an API failure.
 *
 * The backend returns `{ success:false, error:{ code, message, details } }`;
 * validation failures put the first human-readable (Persian) issue in
 * `message` and the full issue list in `details`. Network failures have no
 * response at all, so they get an explicit connectivity hint instead of the
 * generic credential error.
 */
export function apiErrorMessage(error: any, fallback: string): string {
  const data = error?.response?.data;
  const detail = data?.error?.details ?? data?.meta;
  const firstIssue = Array.isArray(detail) ? detail[0]?.message : null;
  if (firstIssue) return String(firstIssue);
  if (data?.error?.message) return String(data.error.message);
  if (data?.message) return String(data.message);
  if (error?.response?.status) return `${fallback} (HTTP ${error.response.status})`;
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'اتصال به سرور برقرار نشد. آدرس API و اینترنت را با «تست اتصال» بررسی کنید.';
  }
  if (error?.code === 'ECONNABORTED') return 'پاسخی از سرور دریافت نشد (Timeout). دوباره تلاش کنید.';
  return error?.message ? String(error.message) : fallback;
}
