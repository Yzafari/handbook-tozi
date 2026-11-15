import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Search,
  X
} from 'lucide-react';
import { fetchAdminPayment, fetchAdminPayments } from '../../services/admin.service.js';
import { getErrorMessage } from '../../utils/api.js';
import { formatJalaliDate, formatToman, toPersianDigits } from '../../utils/format.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../hooks/useToast.js';
import { Modal } from '../../components/common/Modal.jsx';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'SUCCESS', label: 'موفق' },
  { value: 'PENDING', label: 'در انتظار' },
  { value: 'FAILED', label: 'ناموفق' }
];

function normalizeList(response) {
  const items =
    response?.items ??
    response?.payments ??
    response?.data?.items ??
    response?.data?.payments ??
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

function paymentStatusLabel(status) {
  return ({
    SUCCESS: 'موفق',
    PENDING: 'در انتظار',
    FAILED: 'ناموفق'
  })[status] ?? status ?? 'نامشخص';
}

function PaymentStatus({ status }) {
  const styles = {
    SUCCESS: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    FAILED: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
      {paymentStatusLabel(status)}
    </span>
  );
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  const safeText = /^[\s]*[=+\-@]/.test(text)
    ? `'${text}`
    : text;

  return `"${safeText.replace(/"/g, '""')}"`;
}

/**
 * Pure CSV serializer. Exported to make encoding and escaping testable.
 * The BOM helps spreadsheet software recognize UTF-8 Persian text.
 */
export function buildPaymentsCsv(payments) {
  const headers = [
    'شناسه پرداخت',
    'نام کاربر',
    'ایمیل کاربر',
    'نام پلن',
    'مبلغ (تومان)',
    'وضعیت',
    'شناسه مرجع',
    'چهار رقم/کارت ماسک‌شده',
    'تاریخ ایجاد',
    'تاریخ تأیید'
  ];

  const rows = (Array.isArray(payments) ? payments : []).map((payment) => [
    payment.id,
    payment.user?.fullName ?? payment.userFullName ?? '',
    payment.user?.email ?? payment.userEmail ?? '',
    payment.planName,
    payment.amountToman ?? 'نامشخص',
    paymentStatusLabel(payment.status),
    payment.refId,
    payment.cardPanMasked,
    payment.createdAt,
    payment.verifiedAt
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');

  return `\uFEFF${csv}`;
}

function downloadCsv(payments) {
  const csv = buildPaymentsCsv(payments);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `handbook-distribution-payments-page-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function DetailLine({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`break-all text-sm font-semibold text-slate-800 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function PaymentDetail({ payment, onClose }) {
  if (!payment) return null;

  const user = payment.user ?? {};

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-900 dark:text-white">اطلاعات تراکنش</p>
          <p className="mt-1 text-xs text-slate-500">جزئیات پرداخت انتخاب‌شده</p>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن جزئیات" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="size-5" />
        </button>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
        <p className="text-xs text-slate-500 dark:text-slate-400">مبلغ پرداخت</p>
        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
          {formatToman(payment.amountToman)}
        </p>
        <div className="mt-3"><PaymentStatus status={payment.status} /></div>
      </div>

      <section>
        <h3 className="mb-1 font-bold text-slate-900 dark:text-white">مشخصات پرداخت</h3>
        <DetailLine label="شناسه پرداخت" value={payment.id} mono />
        <DetailLine label="پلن" value={payment.planName} />
        <DetailLine label="شناسه مرجع" value={payment.refId} mono />
        <DetailLine label="کارت" value={payment.cardPanMasked} mono />
        <DetailLine label="تاریخ ایجاد" value={formatJalaliDate(payment.createdAt, { hour: '2-digit', minute: '2-digit' })} />
        <DetailLine label="تاریخ تأیید" value={formatJalaliDate(payment.verifiedAt, { hour: '2-digit', minute: '2-digit' })} />
      </section>

      <section>
        <h3 className="mb-1 font-bold text-slate-900 dark:text-white">مشخصات کاربر</h3>
        <DetailLine label="نام" value={user.fullName ?? payment.userFullName} />
        <DetailLine label="ایمیل" value={user.email ?? payment.userEmail} />
        <DetailLine label="شناسه کاربر" value={user.id ?? payment.userId} mono />
      </section>
    </div>
  );
}

export default function Payments() {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [payments, setPayments] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtersValid = !from || !to || from <= to;

  const loadPayments = useCallback(async () => {
    if (!filtersValid) {
      setPayments([]);
      setMeta({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);

    const params = {
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {})
    };

    try {
      const response = await fetchAdminPayments(params);
      const normalized = normalizeList(response);
      setPayments(normalized.items);
      setMeta(normalized.meta);
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'دریافت فهرست پرداخت‌ها انجام نشد.'));
    } finally {
      setLoading(false);
    }
  }, [page, status, from, to, debouncedSearch, filtersValid, toast]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    setPage(1);
  }, [status, from, to, debouncedSearch]);

  const openPayment = async (payment) => {
    setSelectedPayment(payment);
    setDetailLoading(true);

    try {
      const response = await fetchAdminPayment(payment.id);
      setSelectedPayment(response?.payment ? response.payment : response?.data?.payment ?? response?.data ?? response);
    } catch (error) {
      toast.error(getErrorMessage(error, 'دریافت جزئیات پرداخت انجام نشد.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const totalPages = Math.max(1, meta.totalPages);
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));

    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
  }, [page, meta.totalPages]);

  const rangeStart = meta.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, meta.total);

  return (
    <main dir="rtl" className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">مدیریت پرداخت‌ها</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            بررسی تراکنش‌ها، فیلتر وضعیت و دریافت خروجی صفحه جاری
          </p>
        </div>

        <button
          type="button"
          onClick={() => downloadCsv(payments)}
          disabled={payments.length === 0 || loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="size-4" />
          خروجی CSV صفحه فعلی
        </button>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="relative sm:col-span-2 xl:col-span-2">
            <span className="sr-only">جست‌وجوی پرداخت</span>
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجو با شناسه، ایمیل یا نام کاربر"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pe-10 ps-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label>
            <span className="sr-only">وضعیت پرداخت</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs text-slate-500">از تاریخ</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs text-slate-500">تا تاریخ</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>

        {!filtersValid && (
          <p role="alert" className="mt-3 text-xs font-medium text-red-600">
            تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">فهرست تراکنش‌ها</h2>
            <p className="mt-1 text-xs text-slate-500">تعداد کل: {toPersianDigits(meta.total)}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <FileSpreadsheet className="size-4" />
            CSV فقط صفحه فعلی
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 p-5" aria-label="در حال بارگذاری پرداخت‌ها">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="p-10 text-center text-sm text-slate-500">
            دریافت پرداخت‌ها با خطا مواجه شد.
            <button type="button" onClick={loadPayments} className="ms-2 font-semibold text-violet-600 hover:underline">
              تلاش مجدد
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            پرداختی با فیلترهای انتخاب‌شده پیدا نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">کاربر</th>
                  <th className="px-5 py-3 font-semibold">پلن</th>
                  <th className="px-5 py-3 font-semibold">مبلغ</th>
                  <th className="px-5 py-3 font-semibold">وضعیت</th>
                  <th className="px-5 py-3 font-semibold">تاریخ</th>
                  <th className="px-5 py-3 font-semibold">شناسه مرجع</th>
                  <th className="px-5 py-3 font-semibold">جزئیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((payment) => (
                  <tr key={payment.id} className="text-slate-700 dark:text-slate-200">
                    <td className="max-w-56 px-5 py-4">
                      <p className="truncate font-semibold">{payment.user?.fullName || payment.userFullName || '—'}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{payment.user?.email || payment.userEmail || '—'}</p>
                    </td>
                    <td className="px-5 py-4">{payment.planName || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold">{formatToman(payment.amountToman)}</td>
                    <td className="px-5 py-4"><PaymentStatus status={payment.status} /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">
                      {formatJalaliDate(payment.createdAt)}
                    </td>
                    <td className="max-w-36 truncate px-5 py-4 font-mono text-xs text-slate-400" title={payment.refId || ''}>
                      {payment.refId || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => openPayment(payment)}
                        aria-label={`مشاهده پرداخت ${payment.id}`}
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
            نمایش {toPersianDigits(rangeStart)} تا {toPersianDigits(rangeEnd)} از {toPersianDigits(meta.total)} پرداخت
          </p>
          <nav aria-label="صفحه‌بندی پرداخت‌ها" className="flex items-center gap-1">
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
        open={Boolean(selectedPayment)}
        onClose={() => !detailLoading && setSelectedPayment(null)}
        title="جزئیات پرداخت"
        showCloseButton={false}
        closeOnOverlay={!detailLoading}
        className="max-w-xl"
      >
        {detailLoading ? (
          <div className="space-y-3 py-4">
            <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : (
          <PaymentDetail payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
        )}
      </Modal>
    </main>
  );
}