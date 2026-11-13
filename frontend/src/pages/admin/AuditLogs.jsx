import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, FileSearch, Search, X } from 'lucide-react';
import { fetchAuditLogs } from '../../services/admin.service.js';
import { getErrorMessage } from '../../utils/api.js';
import { formatJalaliDate, toPersianDigits } from '../../utils/format.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../hooks/useToast.js';
import { Modal } from '../../components/common/Modal.jsx';

const PAGE_SIZE = 10;

function normalizeList(response) {
  const items =
    response?.items ??
    response?.logs ??
    response?.data?.items ??
    response?.data?.logs ??
    (Array.isArray(response) ? response : []);

  const meta = response?.meta ?? response?.pagination ?? response?.data?.meta ?? {};

  return {
    items: Array.isArray(items) ? items : [],
    meta: {
      page: Number(meta.page ?? meta.currentPage ?? 1),
      limit: Number(meta.limit ?? meta.pageSize ?? PAGE_SIZE),
      total: Number(meta.total ?? meta.totalItems ?? items.length),
      totalPages: Number(
        meta.totalPages ??
        meta.pages ??
        Math.max(1, Math.ceil(Number(meta.total ?? items.length) / Number(meta.limit ?? PAGE_SIZE)))
      )
    }
  };
}

function prettyJson(value) {
  if (value === null || value === undefined) return '—';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function MetadataView({ value }) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-slate-500">داده تکمیلی ثبت نشده است.</p>;
  }

  return (
    <pre
      dir="ltr"
      className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-left text-xs leading-6 text-emerald-200"
    >
      {prettyJson(value)}
    </pre>
  );
}

function AuditDetail({ log, onClose }) {
  if (!log) return null;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">جزئیات رویداد</h3>
          <p className="mt-1 text-xs text-slate-500">اطلاعات ثبت‌شده در گزارش ممیزی</p>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن جزئیات" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500">رویداد</p>
          <p dir="ltr" className="mt-1 break-all text-sm font-bold text-slate-900 dark:text-white">{log.action}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500">زمان</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {formatJalaliDate(log.createdAt, { 
			hour: '2-digit',
			minute: '2-digit'
		    })} 
          </p>
        </div>
      </div>

      <section>
        <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">اطلاعات رویداد</h4>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-4 dark:divide-slate-800 dark:border-slate-800">
          <div className="py-3">
            <p className="text-xs text-slate-500">شناسه گزارش</p>
            <p dir="ltr" className="mt-1 break-all text-xs font-mono text-slate-700 dark:text-slate-300">{log.id}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-slate-500">کاربر</p>
            <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{log.userEmail || 'کاربر سیستمی / ناشناس'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-slate-500">شناسه کاربر</p>
            <p dir="ltr" className="mt-1 break-all text-xs font-mono text-slate-700 dark:text-slate-300">{log.userId || '—'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-slate-500">موجودیت</p>
            <p dir="ltr" className="mt-1 break-all text-sm text-slate-800 dark:text-slate-200">{log.entity || '—'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-slate-500">شناسه موجودیت</p>
            <p dir="ltr" className="mt-1 break-all text-xs font-mono text-slate-700 dark:text-slate-300">{log.entityId || '—'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-slate-500">IP</p>
            <p dir="ltr" className="mt-1 text-sm font-mono text-slate-700 dark:text-slate-300">{log.ip || '—'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-slate-500">User-Agent</p>
            <p dir="ltr" className="mt-1 break-all text-xs text-slate-700 dark:text-slate-300">{log.userAgent || '—'}</p>
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Metadata</h4>
        <MetadataView value={log.metadata} />
      </section>
    </div>
  );
}

export default function AuditLogs() {
  const toast = useToast();

  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const debouncedUserId = useDebounce(userId.trim(), 350);
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const response = await fetchAuditLogs({
        page,
        limit: PAGE_SIZE,
        ...(action ? { action } : {}),
        ...(debouncedUserId ? { userId: debouncedUserId } : {})
      });

      const normalized = normalizeList(response);
      setLogs(normalized.items);
      setMeta(normalized.meta);
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'دریافت گزارش‌های ممیزی انجام نشد.'));
    } finally {
      setLoading(false);
    }
  }, [page, action, debouncedUserId, toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    setPage(1);
  }, [action, debouncedUserId]);

  const pageNumbers = useMemo(() => {
    const totalPages = Math.max(1, meta.totalPages);
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));

    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
  }, [page, meta.totalPages]);

  const rangeStart = meta.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, meta.total);

  return (
    <main dir="rtl" className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">گزارش‌های ممیزی</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          رهگیری رویدادهای مدیریتی و فعالیت‌های ثبت‌شده در سامانه
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">نوع رویداد (Action)</span>
            <input
              type="text"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="مثلاً USER_UPDATED"
              dir="ltr"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-left text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="relative">
            <span className="mb-1 block text-xs font-medium text-slate-500">شناسه کاربر</span>
            <Search className="pointer-events-none absolute end-3 top-[2.65rem] size-4 text-slate-400" />
            <input
              type="search"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="شناسه کاربر موردنظر"
              dir="ltr"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pe-10 ps-3 text-left text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileSearch className="size-5 text-violet-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">رویدادهای ثبت‌شده</h2>
          </div>
          <span className="text-xs text-slate-500">{toPersianDigits(meta.total)} گزارش</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-5" aria-label="در حال بارگذاری گزارش‌ها">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="p-10 text-center text-sm text-slate-500">
            دریافت گزارش‌ها ناموفق بود.
            <button type="button" onClick={loadLogs} className="ms-2 font-semibold text-violet-600 hover:underline">
              تلاش مجدد
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            گزارشی مطابق فیلترها پیدا نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">رویداد</th>
                  <th className="px-5 py-3 font-semibold">کاربر</th>
                  <th className="px-5 py-3 font-semibold">موجودیت</th>
                  <th className="px-5 py-3 font-semibold">IP</th>
                  <th className="px-5 py-3 font-semibold">زمان</th>
                  <th className="px-5 py-3 font-semibold">جزئیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-5 py-4">
                      <span dir="ltr" className="inline-block max-w-56 truncate rounded-lg bg-violet-50 px-2.5 py-1 font-mono text-xs font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="max-w-52 truncate px-5 py-4">{log.userEmail || 'سیستمی / ناشناس'}</td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{log.entity || '—'}</td>
                    <td dir="ltr" className="whitespace-nowrap px-5 py-4 text-left font-mono text-xs text-slate-500">{log.ip || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">
                      {formatJalaliDate(log.createdAt, { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        aria-label={`جزئیات رویداد ${log.action}`}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-violet-700 dark:hover:bg-slate-800"
                      >
                        <Eye className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            نمایش {toPersianDigits(rangeStart)} تا {toPersianDigits(rangeEnd)} از {toPersianDigits(meta.total)} گزارش
          </p>
          <nav aria-label="صفحه‌بندی گزارش‌های ممیزی" className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="صفحه قبل"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
            >
              <ChevronRight className="size-4" />
            </button>
            {pageNumbers.map((number) => (
              <button
                key={number}
                type="button"
                aria-current={page === number ? 'page' : undefined}
                onClick={() => setPage(number)}
                className={`min-w-9 rounded-lg px-3 py-2 text-xs font-semibold ${
                  page === number
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {toPersianDigits(number)}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= meta.totalPages || loading}
              onClick={() => setPage((value) => Math.min(meta.totalPages, value + 1))}
              aria-label="صفحه بعد"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
            >
              <ChevronLeft className="size-4" />
            </button>
          </nav>
        </footer>
      </section>

      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="جزئیات گزارش ممیزی"
        showCloseButton={false}
        className="max-w-2xl"
      >
        <AuditDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
      </Modal>
    </main>
  );
}