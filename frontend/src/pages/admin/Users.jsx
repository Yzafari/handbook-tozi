import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  Search,
  Shield,
  UserCheck,
  UserX,
  X
} from 'lucide-react';
import { fetchAdminUser, fetchAdminUsers, updateAdminUser } from '../../services/admin.service.js';
import { getErrorMessage } from '../../utils/api.js';
import { formatJalaliDate, formatToman, formatRelativeDays, toPersianDigits } from '../../utils/format.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../hooks/useToast.js';
import { Modal } from '../../components/common/Modal.jsx';
import Button from '../../components/ui/Button';

const PAGE_SIZE = 10;

const ROLE_LABELS = {
  USER: 'کاربر',
  ADMIN: 'مدیر',
  SUPER_ADMIN: 'مدیر ارشد'
};

const ROLE_OPTIONS = [
  { value: 'USER', label: 'کاربر' },
  { value: 'ADMIN', label: 'مدیر' },
  { value: 'SUPER_ADMIN', label: 'مدیر ارشد' }
];

function normalizeList(response) {
  const items =
    response?.items ??
    response?.users ??
    response?.data?.items ??
    response?.data?.users ??
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

function RoleBadge({ role }) {
  const styles = {
    USER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    ADMIN: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    SUPER_ADMIN: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[role] ?? styles.USER}`}>
      {ROLE_LABELS[role] ?? role ?? 'نامشخص'}
    </span>
  );
}

function ActiveBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      فعال
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
      <span className="size-1.5 rounded-full bg-red-500" />
      غیرفعال
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-5" aria-label="در حال بارگذاری کاربران">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="break-all text-sm font-medium text-slate-800 dark:text-slate-200">{children ?? '—'}</span>
    </div>
  );
}

function UserDetailsDrawer({ open, loading, details, onClose }) {
  if (!open) return null;

  const user = details?.user ?? details;
  const subscription = details?.subscription;
  const payments = details?.recentPayments ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-details-title"
        dir="rtl"
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-7"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 id="user-details-title" className="text-lg font-black text-slate-900 dark:text-white">
              جزئیات کاربر
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              اطلاعات حساب، اشتراک و تراکنش‌های اخیر
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن جزئیات" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="size-5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : !user ? (
          <p className="py-12 text-center text-sm text-slate-500">اطلاعات کاربر در دسترس نیست.</p>
        ) : (
          <>
            <section className="mb-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="size-12 rounded-full object-cover" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {(user.fullName || user.email || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900 dark:text-white">
                    {user.fullName || 'بدون نام'}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <RoleBadge role={user.role} />
                <ActiveBadge active={user.isActive} />
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-bold text-slate-900 dark:text-white">اطلاعات حساب</h3>
              <DetailRow label="شناسه">{user.id}</DetailRow>
              <DetailRow label="شماره همراه">{user.phone || 'ثبت نشده'}</DetailRow>
              <DetailRow label="تاریخ عضویت">{formatJalaliDate(user.createdAt)}</DetailRow>
              <DetailRow label="آخرین ورود">{formatJalaliDate(user.lastLoginAt, { hour: '2-digit', minute: '2-digit' })}</DetailRow>
            </section>

            <section className="mt-6">
              <h3 className="mb-2 font-bold text-slate-900 dark:text-white">اشتراک</h3>
              {subscription ? (
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {subscription.plan?.name || subscription.planName || 'اشتراک'}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      subscription.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {subscription.status === 'ACTIVE' ? 'فعال' : subscription.status || 'نامشخص'}
                    </span>
                  </div>
                  <DetailRow label="شروع">{formatJalaliDate(subscription.startsAt)}</DetailRow>
                  <DetailRow label="پایان">{formatJalaliDate(subscription.endsAt)}</DetailRow>
                  <DetailRow label="روزهای باقی‌مانده">{formatRelativeDays(subscription.daysRemaining)}</DetailRow>
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  این کاربر اشتراک فعالی ندارد.
                </p>
              )}
            </section>

            <section className="mt-6">
              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">پرداخت‌های اخیر</h3>
              {payments.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60">
                  پرداختی برای نمایش وجود ندارد.
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {payment.planName || 'پرداخت'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatJalaliDate(payment.createdAt)}</p>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatToman(payment.amountToman)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {payment.status === 'SUCCESS' ? 'موفق' : payment.status === 'PENDING' ? 'در انتظار' : payment.status === 'FAILED' ? 'ناموفق' : payment.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

export default function Users() {
  const { user: currentUser, hasRole } = useAuth();
  const toast = useToast();
  const isSuperAdmin = hasRole('SUPER_ADMIN');
  const currentUserId = currentUser?.id;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const params = {
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(activeFilter !== '' ? { isActive: activeFilter === 'true' } : {})
    };

    try {
      const response = await fetchAdminUsers(params);
      const normalized = normalizeList(response);
      setRows(normalized.items);
      setMeta(normalized.meta);
    } catch (error) {
      setLoadError(true);
      toast.error(getErrorMessage(error, 'دریافت فهرست کاربران انجام نشد.'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, activeFilter, toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, activeFilter]);

  const openDetails = async (user) => {
    setSelectedUser(user);
    setDetails(null);
    setDetailsLoading(true);

    try {
      const response = await fetchAdminUser(user.id);
      setDetails(response?.user ? response : response?.data ?? response);
    } catch (error) {
      toast.error(getErrorMessage(error, 'دریافت جزئیات کاربر انجام نشد.'));
    } finally {
      setDetailsLoading(false);
    }
  };

  const canManageUser = useCallback((target) => {
    if (!target || target.id === currentUserId) return false;
    if (target.role === 'SUPER_ADMIN' && !isSuperAdmin) return false;
    return true;
  }, [currentUserId, isSuperAdmin]);

  const requestAction = (target, action) => {
    if (!canManageUser(target)) {
      toast.warning('طبق سطح دسترسی شما امکان تغییر این حساب وجود ندارد.');
      return;
    }

    setPendingAction({ target, action });
  };

  const confirmAction = async () => {
  if (!pendingAction) return;

  const { target, action } = pendingAction;

  const payload = action.type === 'toggle'
    ? { isActive: !target.isActive }
    : { role: action.role };

  setActionLoading(true);

  try {
    await updateAdminUser(target.id, payload);

    toast.success('تغییرات کاربر با موفقیت ثبت شد.');
    setPendingAction(null);

    await loadUsers();

    if (selectedUser?.id === target.id) {
      const refreshed = await fetchAdminUser(target.id);
      setDetails(refreshed?.user ? refreshed : refreshed?.data ?? refreshed);
    }
  } catch (error) {
    toast.error(getErrorMessage(error, 'ثبت تغییرات کاربر انجام نشد.'));
  } finally {
    setActionLoading(false);
  } 
  };

  const pageNumbers = useMemo(() => {
    const totalPages = Math.max(1, meta.totalPages);
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));

    return Array.from(
      { length: Math.min(5, totalPages) },
      (_, index) => start + index
    );
  }, [page, meta.totalPages]);

  const rangeStart = meta.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, meta.total);

  return (
    <main dir="rtl" className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">مدیریت کاربران</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          جست‌وجو، مشاهده جزئیات و مدیریت وضعیت حساب کاربران
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="relative block">
            <span className="sr-only">جست‌وجوی کاربر</span>
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجو با نام، ایمیل یا شماره همراه"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pe-10 ps-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label>
            <span className="sr-only">فیلتر نقش</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">همه نقش‌ها</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">فیلتر وضعیت حساب</span>
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="true">فقط فعال</option>
              <option value="false">فقط غیرفعال</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white">فهرست کاربران</h2>
          <span className="text-xs text-slate-500">
            {toPersianDigits(meta.total)} کاربر
          </span>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : loadError ? (
          <div role="alert" className="p-10 text-center text-sm text-slate-500">
            دریافت اطلاعات با خطا مواجه شد.
            <button type="button" onClick={loadUsers} className="ms-2 font-semibold text-violet-600 hover:underline">
              تلاش مجدد
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            کاربری با این مشخصات پیدا نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">کاربر</th>
                  <th className="px-5 py-3 font-semibold">نقش</th>
                  <th className="px-5 py-3 font-semibold">وضعیت</th>
                  <th className="px-5 py-3 font-semibold">تاریخ عضویت</th>
                  <th className="px-5 py-3 font-semibold">آخرین ورود</th>
                  <th className="px-5 py-3 font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => {
                  const isSelf = row.id === currentUserId;
                  const isProtectedSuperAdmin = row.role === 'SUPER_ADMIN' && !isSuperAdmin;
                  const canManage = canManageUser(row);

                  return (
                    <tr key={row.id} className="text-slate-700 dark:text-slate-200">
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {row.avatarUrl ? (
                            <img src={row.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                              {(row.fullName || row.email || '?').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{row.fullName || 'بدون نام'}</p>
                            <p className="max-w-56 truncate text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><RoleBadge role={row.role} /></td>
                      <td className="px-5 py-4"><ActiveBadge active={row.isActive} /></td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">
                        {formatJalaliDate(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">
                        {formatJalaliDate(row.lastLoginAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetails(row)}
                            aria-label={`مشاهده جزئیات ${row.fullName || row.email}`}
                            title="مشاهده جزئیات"
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-violet-700 dark:hover:bg-slate-800 dark:hover:text-violet-300"
                          >
                            <Eye className="size-4" />
                          </button>

                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => requestAction(row, { type: 'toggle' })}
                            aria-label={row.isActive ? 'غیرفعال کردن کاربر' : 'فعال کردن کاربر'}
                            title={row.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-800"
                          >
                            {row.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                          </button>

                          {isSuperAdmin && !isSelf && !isProtectedSuperAdmin && (
                            <label className="sr-only" htmlFor={`role-${row.id}`}>تغییر نقش</label>
                          )}
                          {isSuperAdmin && !isSelf && !isProtectedSuperAdmin && (
                            <select
                              id={`role-${row.id}`}
                              value={row.role}
                              onChange={(event) => requestAction(row, { type: 'role', role: event.target.value })}
                              aria-label={`تغییر نقش ${row.fullName || row.email}`}
                              className="max-w-28 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role.value} value={role.value}>{role.label}</option>
                              ))}
                            </select>
                          )}
                          {isSelf && (
                            <span className="px-2 text-xs text-slate-400">حساب شما</span>
                          )}
                          {isProtectedSuperAdmin && (
                            <span className="px-2 text-xs text-slate-400" title="مدیر عادی اجازه مدیریت مدیر ارشد را ندارد">
                              <Shield className="inline size-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            نمایش {toPersianDigits(rangeStart)} تا {toPersianDigits(rangeEnd)} از {toPersianDigits(meta.total)} کاربر
          </p>
          <nav aria-label="صفحه‌بندی کاربران" className="flex items-center gap-1">
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

      <UserDetailsDrawer
        open={Boolean(selectedUser)}
        loading={detailsLoading}
        details={details}
        onClose={() => {
          setSelectedUser(null);
          setDetails(null);
        }}
      />

      <Modal
        open={Boolean(pendingAction)}
        onClose={() => !actionLoading && setPendingAction(null)}
        title="تأیید تغییرات کاربر"
        description={
          pendingAction?.action.type === 'toggle'
            ? `آیا از ${pendingAction?.target.isActive ? 'غیرفعال کردن' : 'فعال کردن'} حساب «${pendingAction?.target.fullName || pendingAction?.target.email}» مطمئن هستید؟`
            : `نقش کاربر «${pendingAction?.target.fullName || pendingAction?.target.email}» به «${ROLE_LABELS[pendingAction?.action.role]}» تغییر می‌کند.`
        }
        confirmText="ثبت تغییرات"
        cancelText="انصراف"
        confirmVariant={pendingAction?.action.type === 'toggle' && pendingAction?.target.isActive}
        confirmLoading={actionLoading}
        onConfirm={confirmAction}
      />
    </main>
  );
}