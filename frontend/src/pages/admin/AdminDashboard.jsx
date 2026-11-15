import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpLeft,
  CreditCard,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  fetchAdminStats,
  fetchAdminPayments,
  fetchRevenueStats
} from '../../services/admin.service.js';
import { formatJalaliDate, formatToman, toPersianDigits } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/api.js';
import { useToast } from '../../hooks/useToast.js';

const RANGE_OPTIONS = [
  { label: '۷ روز', value: 7 },
  { label: '۳۰ روز', value: 30 },
  { label: '۹۰ روز', value: 90 }
];

const STAT_DEFINITIONS = [
  {
    key: 'totalUsers',
    label: 'کل کاربران',
    icon: Users,
    format: 'number',
    hint: 'تمام حساب‌های ثبت‌شده'
  },
  {
    key: 'activeUsers',
    label: 'کاربران فعال',
    icon: Activity,
    format: 'number',
    hint: 'حساب‌های فعال'
  },
  {
    key: 'newUsersLast30Days',
    label: 'کاربران جدید',
    icon: TrendingUp,
    format: 'number',
    hint: '۳۰ روز گذشته'
  },
  {
    key: 'activeSubscriptions',
    label: 'اشتراک‌های فعال',
    icon: CreditCard,
    format: 'number',
    hint: 'اشتراک‌های معتبر'
  },
  {
    key: 'totalRevenueToman',
    label: 'مجموع درآمد',
    icon: Wallet,
    format: 'money',
    hint: 'پرداخت‌های موفق'
  },
  {
    key: 'successfulPayments',
    label: 'پرداخت موفق',
    icon: ArrowUpLeft,
    format: 'number',
    hint: 'تعداد تراکنش‌های موفق'
  }
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return toPersianDigits(
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
      Number.isFinite(number) ? number : 0
    )
  );
}

function formatCompactDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 size-11 rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="mb-3 h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-7 w-32 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-3 h-3 w-28 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

function PanelSkeleton({ height = 'h-72' }) {
  return (
    <div
      className={`${height} animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800`}
      aria-label="در حال بارگذاری"
    />
  );
}

function PaymentStatus({ status }) {
  const config = {
    SUCCESS: {
      label: 'موفق',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    },
    PENDING: {
      label: 'در انتظار',
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
    },
    FAILED: {
      label: 'ناموفق',
      className: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
    },
    EXPIRED: {
      label: 'منقضی',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    }
  };

  const item = config[status] ?? {
    label: status || 'نامشخص',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.className}`}>
      {item.label}
    </span>
  );
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      dir="rtl"
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        {formatCompactDate(label)}
      </p>
      <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
        {formatToman(payload[0]?.value)}
      </p>
      {payload[0]?.payload?.count !== undefined && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {formatNumber(payload[0].payload.count)} پرداخت با مبلغ مشخص
        </p>
      )}
      {Number(payload[0]?.payload?.unknownAmountCount ?? 0) > 0 && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          {formatNumber(payload[0].payload.unknownAmountCount)} پرداخت قدیمی با مبلغ نامشخص
        </p>
      )}
    </div>
  );
}

function normalizeRevenue(data) {
  return asArray(data)
    .map((item) => ({
      date: item.date ?? item.day ?? item.label,
      revenueToman: Number(item.revenueToman ?? item.revenue ?? 0),
      count: Number(item.count ?? 0),
      unknownAmountCount: Number(item.unknownAmountCount ?? 0)
    }))
    .filter((item) => item.date && Number.isFinite(item.revenueToman));
}

function getPaymentName(payment) {
  return (
    payment?.user?.fullName ||
    payment?.user?.email ||
    payment?.userEmail ||
    payment?.planName ||
    'کاربر'
  );
}

export default function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [payments, setPayments] = useState([]);
  const [range, setRange] = useState(30);
  const [statsLoading, setStatsLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [revenueError, setRevenueError] = useState(false);
  const [paymentsError, setPaymentsError] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(false);

    try {
      const result = await fetchAdminStats();
      setStats(result?.stats ?? result);
    } catch (error) {
      setStatsError(true);
      toast.error(getErrorMessage(error, 'دریافت آمار داشبورد انجام نشد.'));
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    setRevenueError(false);

    try {
      const result = await fetchRevenueStats(range);
      setRevenue(normalizeRevenue(result?.items ?? result?.data ?? result));
    } catch (error) {
      setRevenueError(true);
      toast.error(getErrorMessage(error, 'دریافت نمودار درآمد انجام نشد.'));
    } finally {
      setRevenueLoading(false);
    }
  }, [range, toast]);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError(false);

    try {
      const result = await fetchAdminPayments({ page: 1, limit: 5 });
      setPayments(asArray(result?.items ?? result?.payments ?? result).slice(0, 5));
    } catch (error) {
      setPaymentsError(true);
      toast.error(getErrorMessage(error, 'دریافت پرداخت‌های اخیر انجام نشد.'));
    } finally {
      setPaymentsLoading(false);
    }
  }, [toast]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadRevenue(), loadPayments()]);
    setRefreshing(false);
  }, [loadStats, loadRevenue, loadPayments]);

  useEffect(() => {
    loadStats();
    loadPayments();
  }, [loadStats, loadPayments]);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  const statCards = useMemo(
    () =>
      STAT_DEFINITIONS.map((definition) => {
        const rawValue = stats?.[definition.key];
        const value =
          definition.format === 'money'
            ? formatToman(rawValue)
            : formatNumber(rawValue);

        return { ...definition, value };
      }),
    [stats]
  );

  const successfulPaymentCount = Number(stats?.successfulPayments ?? 0);
  const pendingPaymentCount = Number(stats?.pendingPayments ?? 0);
  const failedPaymentCount = Number(stats?.failedPayments ?? 0);

  return (
    <main dir="rtl" className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            داشبورد مدیریت
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            نمای کلی کاربران، پرداخت‌ها و عملکرد مالی سامانه
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          disabled={refreshing}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:self-auto"
        >
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          بروزرسانی
        </button>
      </header>

      {statsError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="size-4 shrink-0" />
          بخشی از آمار قابل دریافت نبود. برای تلاش مجدد، بروزرسانی را انتخاب کنید.
        </div>
      )}

      <section aria-label="آمار اصلی" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statsLoading
          ? Array.from({ length: 6 }, (_, index) => <StatSkeleton key={index} />)
          : statCards.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.key}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs text-slate-400">{item.hint}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 break-words text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                    {item.value}
                  </p>
                </article>
              );
            })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">روند درآمد</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                مجموع مبالغ پرداخت موفق در بازه انتخاب‌شده
              </p>
            </div>

            <div
              role="group"
              aria-label="بازه زمانی نمودار درآمد"
              className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
            >
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={range === option.value}
                  onClick={() => setRange(option.value)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    range === option.value
                      ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-200'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {stats?.legacyAmountUnknownCount > 0 && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">مبلغ تومانی {formatNumber(stats.legacyAmountUnknownCount)} پرداخت قدیمی مشخص نیست؛ این پرداخت‌ها در جمع درآمد لحاظ نشده‌اند تا مبلغ اشتباه گزارش نشود.</p>
          )}

          {revenueLoading ? (
            <PanelSkeleton />
          ) : revenueError ? (
            <div role="alert" className="flex h-72 flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <AlertCircle className="size-6 text-red-500" />
              نمودار درآمد بارگذاری نشد.
              <button type="button" onClick={loadRevenue} className="font-semibold text-violet-600 hover:underline">
                تلاش مجدد
              </button>
            </div>
          ) : revenue.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              در این بازه داده‌ای برای نمایش وجود ندارد.
            </div>
          ) : (
            <div className="h-72 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue} margin={{ top: 12, right: 8, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="adminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatCompactDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={18}
                  />
                  <YAxis
                    orientation="right"
                    tickFormatter={(value) => toPersianDigits(new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value))}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenueToman"
                    name="درآمد"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    fill="url(#adminRevenueGradient)"
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold text-slate-900 dark:text-white">وضعیت پرداخت‌ها</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">بر اساس آمار کلی سامانه</p>

          {statsLoading ? (
            <div className="mt-6 space-y-4">
              <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <ArrowUpLeft className="size-4" />
                  <span className="text-sm font-semibold">موفق</span>
                </div>
                <strong className="tabular-nums text-emerald-800 dark:text-emerald-200">{formatNumber(successfulPaymentCount)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4 dark:bg-amber-950/30">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <RefreshCw className="size-4" />
                  <span className="text-sm font-semibold">در انتظار</span>
                </div>
                <strong className="tabular-nums text-amber-800 dark:text-amber-200">{formatNumber(pendingPaymentCount)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <ArrowDownLeft className="size-4" />
                  <span className="text-sm font-semibold">ناموفق</span>
                </div>
                <strong className="tabular-nums text-red-800 dark:text-red-200">{formatNumber(failedPaymentCount)}</strong>
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">آخرین پرداخت‌ها</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">پنج تراکنش اخیر ثبت‌شده</p>
          </div>
          <span className="text-xs text-slate-400">۵ مورد آخر</span>
        </div>

        {paymentsLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : paymentsError ? (
          <div role="alert" className="p-8 text-center text-sm text-slate-500">
            دریافت پرداخت‌های اخیر ناموفق بود.
            <button type="button" onClick={loadPayments} className="ms-2 font-semibold text-violet-600 hover:underline">
              تلاش مجدد
            </button>
          </div>
        ) : payments.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            هنوز پرداختی ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">کاربر / پلن</th>
                  <th className="px-5 py-3 font-semibold">مبلغ</th>
                  <th className="px-5 py-3 font-semibold">وضعیت</th>
                  <th className="px-5 py-3 font-semibold">تاریخ</th>
                  <th className="px-5 py-3 font-semibold">شناسه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((payment) => (
                  <tr key={payment.id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-5 py-4 font-medium">{getPaymentName(payment)}</td>
                    <td className="whitespace-nowrap px-5 py-4">{formatToman(payment.amountToman)}</td>
                    <td className="px-5 py-4"><PaymentStatus status={payment.status} /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">
                      {formatJalaliDate(payment.createdAt)}
                    </td>
                    <td className="max-w-36 truncate px-5 py-4 font-mono text-xs text-slate-400" title={payment.id}>
                      {payment.refId || payment.id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}