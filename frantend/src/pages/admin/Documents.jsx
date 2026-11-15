import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveRestore, ExternalLink, FilePlus2, FileSearch, RefreshCw, RotateCw, Search, Trash2, UploadCloud } from 'lucide-react';
import { fetchAdminDocumentMetrics, fetchAdminDocuments, uploadAdminDocument, reindexAdminDocument, deleteAdminDocument, restoreAdminDocument, getAdminDocumentOpenLink } from '../../services/documents.service.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../utils/api.js';
import { formatJalaliDate, toPersianDigits } from '../../utils/format.js';
import { Button } from '../../components/common/Button.jsx';
import { Modal } from '../../components/common/Modal.jsx';

const PAGE_SIZE = 20;
const JOB_ROLE_OPTIONS = [
  ['SIMBAN', 'سیم‌بان'], ['TECHNICAL_OPERATION_SPECIALIST', 'کارشناس فنی و بهره‌برداری'], ['NETWORK_TECHNICIAN', 'تکنسین شبکه برق'],
  ['ENGINEERING_DESIGN_SPECIALIST', 'کارشناس مهندسی و طراحی'], ['METER_READER', 'مأمور قرائت'], ['ELECTRICITY_MANAGER', 'مدیر برق'],
  ['CONNECTION_SALES_OPERATOR', 'اپراتور فروش انشعاب'], ['ENERGY_SALES_OPERATOR', 'اپراتور فروش انرژی'], ['CONTRACTOR', 'پیمانکار'],
  ['CONSULTANT_SUPERVISOR', 'ناظر مشاور'], ['NETWORK_DESIGNER', 'طراح شبکه'], ['LEGAL_SPECIALIST', 'کارشناس حقوقی'], ['FINANCE_ADMIN_SPECIALIST', 'کارشناس مالی و اداری'],
];
const STATUS_LABELS = { PENDING: 'در صف پردازش', RUNNING: 'در حال پردازش', RETRY: 'تلاش مجدد', READY: 'ایندکس‌شده', INDEXED: 'ایندکس‌شده', FAILED: 'خطا', DELETED: 'حذف‌شده' };
const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  RUNNING: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  RETRY: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  READY: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  INDEXED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  FAILED: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  DELETED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
};

function StatusBadge({ status }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}>{STATUS_LABELS[status] ?? status ?? 'نامشخص'}</span>;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toPersianDigits((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

export default function Documents() {
  const { showToast } = useToast();
  const requestSequence = useRef(0);
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [cursorStack, setCursorStack] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [accessJobRoles, setAccessJobRoles] = useState([]);
  const [language, setLanguage] = useState('fa');
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const debouncedQuery = useDebounce(query, 350);

  const loadDocuments = useCallback(async (next = null, stack = []) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await fetchAdminDocuments({ cursor: next || undefined, limit: PAGE_SIZE, q: debouncedQuery || undefined, status: status || undefined, includeDeleted: String(includeDeleted) });
      if (requestId !== requestSequence.current) return;
      setItems(result.items);
      setNextCursor(result.meta?.nextCursor ?? null);
      setHasMore(Boolean(result.meta?.hasMore));
      setCursor(next);
      setCursorStack(stack);
    } catch (error) {
      if (requestId === requestSequence.current) showToast(getErrorMessage(error, 'دریافت فهرست اسناد ناموفق بود'), 'error');
    } finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [debouncedQuery, includeDeleted, showToast, status]);

  useEffect(() => { void loadDocuments(null, []); }, [loadDocuments]);
  useEffect(() => { fetchAdminDocumentMetrics().then(setMetrics).catch(error => showToast(getErrorMessage(error, 'دریافت آمار دیتاسنتر ناموفق بود'), 'error')); }, [showToast]);

  const runAction = async (id, action, successMessage) => {
    setBusyId(id);
    try { await action(id); showToast(successMessage, 'success'); await Promise.all([loadDocuments(cursor, cursorStack), fetchAdminDocumentMetrics().then(setMetrics)]); }
    catch (error) { showToast(getErrorMessage(error, 'انجام عملیات ناموفق بود'), 'error'); }
    finally { setBusyId(null); setConfirm(null); }
  };

  const openDocument = async (id) => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const url = await getAdminDocumentOpenLink(id);
      if (!url) throw new Error('لینک مشاهده سند دریافت نشد');
      if (popup) popup.location.replace(url);
      else showToast('مرورگر بازکردن پنجرهٔ جدید را مسدود کرد.', 'error');
    } catch (error) { popup?.close(); showToast(getErrorMessage(error, 'بازکردن سند ناموفق بود'), 'error'); }
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!file) { showToast('ابتدا فایل سند را انتخاب کنید.', 'error'); return; }
    const form = new FormData();
    form.append('file', file);
    form.append('title', title.trim() || file.name);
    form.append('description', description.trim());
    if (visibility === 'ROLE_RESTRICTED' && accessJobRoles.length === 0) { showToast('برای دسترسی محدود، حداقل یک سمت شغلی انتخاب کنید.', 'error'); return; }
    form.append('visibility', visibility);
    form.append('accessJobRoles', JSON.stringify(visibility === 'ROLE_RESTRICTED' ? accessJobRoles : []));
    form.append('language', language);
    setUploading(true);
    try {
      await uploadAdminDocument(form);
      showToast('سند ثبت شد و در صف ایندکس قرار گرفت.', 'success');
      setUploadOpen(false); setFile(null); setTitle(''); setDescription(''); setVisibility('PUBLIC'); setAccessJobRoles([]); setLanguage('fa');
      await Promise.all([loadDocuments(null, []), fetchAdminDocumentMetrics().then(setMetrics)]);
    } catch (error) { showToast(getErrorMessage(error, 'بارگذاری سند ناموفق بود'), 'error'); }
    finally { setUploading(false); }
  };

  const pageLabel = useMemo(() => cursorStack.length + 1, [cursorStack.length]);

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-black text-slate-900 dark:text-white">مدیریت دیتاسنتر و اسناد</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">بارگذاری، کنترل ایندکس، بازیابی و مدیریت دسترسی اسناد</p></div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => void Promise.all([loadDocuments(cursor, cursorStack), fetchAdminDocumentMetrics().then(setMetrics)])}><RefreshCw className="size-4"/>تازه‌سازی</Button><Button onClick={() => setUploadOpen(true)}><FilePlus2 className="size-4"/>افزودن سند</Button></div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        {[
          ['کل اسناد', metrics?.total, 'text-slate-700 dark:text-slate-200'],
          ['ایندکس‌شده', metrics?.ready, 'text-emerald-600 dark:text-emerald-300'],
          ['در صف پردازش', metrics?.pending, 'text-amber-600 dark:text-amber-300'],
          ['در حال اجرا', metrics?.running, 'text-blue-600 dark:text-blue-300'],
          ['صف OCR', metrics?.ocrPending, 'text-blue-600 dark:text-blue-300'],
          ['دارای خطا', (metrics?.failed ?? 0) + (metrics?.ocrFailed ?? 0), 'text-red-600 dark:text-red-300'],
          ['حجم ثبت‌شده', metrics ? formatBytes(metrics.registeredBytes) : '—', 'text-blue-600 dark:text-blue-300'],
        ].map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-xl font-black ${color}`}>{value == null ? '—' : typeof value === 'number' ? toPersianDigits(value) : value}</p></div>)}
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_190px_auto]">
        <label className="relative"><span className="sr-only">جستجوی سند</span><Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="جستجو در عنوان یا نام فایل..." className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <select value={status} onChange={event => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">همه وضعیت‌ها</option><option value="PENDING">در صف پردازش</option><option value="RUNNING">در حال اجرا</option><option value="READY">ایندکس‌شده</option><option value="RETRY">نیازمند تلاش مجدد</option><option value="FAILED">دارای خطا</option><option value="DELETED">حذف‌شده</option></select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={includeDeleted} onChange={event => setIncludeDeleted(event.target.checked)} className="size-4 accent-violet-600"/>نمایش اسناد حذف‌شده</label>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"/>)}</div> : items.length === 0 ? <div className="p-12 text-center"><FileSearch className="mx-auto size-9 text-slate-300"/><p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">سندی پیدا نشد</p><p className="mt-1 text-xs text-slate-500">فیلترها را تغییر دهید یا سند جدید بارگذاری کنید.</p></div> : (
          <div className="overflow-x-auto"><table className="min-w-full text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"><tr><th className="px-4 py-3">سند</th><th className="px-4 py-3">نوع / حجم</th><th className="px-4 py-3">دسترسی</th><th className="px-4 py-3">وضعیت ایندکس</th><th className="px-4 py-3">تاریخ ثبت</th><th className="px-4 py-3">عملیات</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{items.map(item => <tr key={item.id} className="align-top"><td className="max-w-xs px-4 py-4"><p className="font-bold text-slate-800 dark:text-slate-100">{item.title}</p><p className="mt-1 truncate text-xs text-slate-500" title={item.originalName}>{item.originalName}</p>{item.sourcePath && <p className="mt-1 truncate text-[10px] text-slate-400" title={item.sourcePath}>مسیر مبدأ: {item.sourcePath}</p>}{item.latestJob?.lastError && <p className="mt-2 line-clamp-2 text-xs text-red-600 dark:text-red-300">{item.latestJob.lastError}</p>}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600 dark:text-slate-300"><p>{item.mimeType}</p><p className="mt-1">{formatBytes(item.sizeBytes)}</p></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600 dark:text-slate-300">{item.visibility === 'PRIVATE' ? 'خصوصی' : item.visibility === 'ROLE_RESTRICTED' ? <span title={(item.accessJobRoles || []).map(role => JOB_ROLE_OPTIONS.find(([value]) => value === role)?.[1] || role).join('،')}>محدود به {toPersianDigits(item.accessJobRoles?.length || 0)} سمت</span> : 'عمومی'}</td><td className="whitespace-nowrap px-4 py-4"><StatusBadge status={!item.isActive ? 'DELETED' : item.latestJob?.status === 'RUNNING' || item.latestJob?.status === 'RETRY' || item.latestJob?.status === 'FAILED' ? item.latestJob.status : item.indexStatus}/>{item.latestJob?.attempts > 0 && <p className="mt-1 text-[11px] text-slate-400">تلاش: {toPersianDigits(item.latestJob.attempts)}</p>}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{formatJalaliDate(item.createdAt)}</td><td className="whitespace-nowrap px-4 py-4"><div className="flex flex-wrap gap-1.5">{item.isActive && <button onClick={() => void openDocument(item.id)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" title="مشاهده سند"><ExternalLink className="size-4"/></button>}{item.isActive && <button disabled={busyId === item.id} onClick={() => void runAction(item.id, reindexAdminDocument, 'درخواست ایندکس مجدد ثبت شد.')} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-950/40" title="ایندکس مجدد"><RotateCw className="size-4"/></button>}{item.isActive ? <button disabled={busyId === item.id} onClick={() => setConfirm({ id: item.id, type: 'delete' })} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40" title="حذف نرم"><Trash2 className="size-4"/></button> : <button disabled={busyId === item.id} onClick={() => void runAction(item.id, restoreAdminDocument, 'سند بازیابی و برای ایندکس صف شد.')} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/40" title="بازیابی"><ArchiveRestore className="size-4"/></button>}</div></td></tr>)}</tbody></table></div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs dark:border-slate-800"><span className="text-slate-500">صفحه {toPersianDigits(pageLabel)} · {toPersianDigits(items.length)} سند</span><div className="flex gap-2"><Button variant="secondary" disabled={!cursorStack.length || loading} onClick={() => { const previous = cursorStack.at(-1) ?? null; void loadDocuments(previous, cursorStack.slice(0, -1)); }}>قبلی</Button><Button variant="secondary" disabled={!hasMore || !nextCursor || loading} onClick={() => void loadDocuments(nextCursor, [...cursorStack, cursor])}>بعدی</Button></div></div>
      </section>

      <Modal open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} title="بارگذاری سند جدید" description="فایل اصلی در فضای ذخیره‌سازی مستقل نگهداری و متن آن در پس‌زمینه ایندکس می‌شود." className="max-w-xl">
        <form onSubmit={submitUpload} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">فایل PDF، تصویر یا متن</span><input type="file" accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={event => { const selected = event.target.files?.[0] ?? null; setFile(selected); if (selected && !title) setTitle(selected.name); }} className="block w-full rounded-xl border border-slate-200 p-2 text-sm dark:border-slate-700"/><span className="mt-1 block text-xs text-slate-500">حداکثر حجم فایل: ۱۰۰ مگابایت</span></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">عنوان سند</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={240} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">توضیحات</span><textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={2000} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-semibold">سطح دسترسی</span><select value={visibility} onChange={event => setVisibility(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="PUBLIC">عمومی</option><option value="PRIVATE">خصوصی برای مدیر بارگذار</option><option value="ROLE_RESTRICTED">محدود به سمت‌های شغلی</option></select></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">زبان سند</span><select value={language} onChange={event => setLanguage(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="fa">فارسی</option><option value="en">انگلیسی</option><option value="ku">کوردی</option><option value="und">نامشخص / ترکیبی</option></select></label></div>
          {visibility === 'ROLE_RESTRICTED' && <label className="block"><span className="mb-1.5 block text-sm font-semibold">سمت‌های مجاز برای مشاهده</span><select multiple size={6} value={accessJobRoles} onChange={event => setAccessJobRoles(Array.from(event.target.selectedOptions, option => option.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">{JOB_ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="mt-1 block text-xs text-slate-500">برای انتخاب چند سمت، کلید Ctrl یا Command را نگه دارید.</span></label>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setUploadOpen(false)} disabled={uploading}>انصراف</Button><Button type="submit" loading={uploading}><UploadCloud className="size-4"/>بارگذاری و ایندکس</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="حذف سند" description="سند از جستجو و دسترسی کاربران خارج می‌شود؛ فایل اصلی برای امکان بازیابی نگهداری خواهد شد." confirmVariant confirmText="حذف سند" onConfirm={() => confirm && runAction(confirm.id, deleteAdminDocument, 'سند حذف نرم شد و از جستجو خارج شد.')} confirmLoading={busyId === confirm?.id}/>
    </div>
  );
}
