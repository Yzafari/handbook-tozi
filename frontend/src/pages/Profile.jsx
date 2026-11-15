import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api, { getErrorMessage } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';

const profileSchema = z.object({
  fullName: z.string().min(2, 'نام کامل الزامی است'),
  phone: z.string().optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'رمز عبور فعلی الزامی است'),
  newPassword: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد'),
});

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Local, dependency-free avatar fallback: initials derived from the user's name.
const getInitials = (value) => {
  const source = typeof value === 'string' ? value.trim() : '';
  if (!source) return '؟';

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function Profile() {
  const navigate = useNavigate();
  const toast = useToast();
  const { logout } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarInputRef = useRef(null);

  // Payments state
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { register: registerProfile, handleSubmit: handleSubmitProfile, reset: resetProfile, formState: { errors: profileErrors, isSubmitting: profileSubmitting } } = useForm({
    resolver: zodResolver(profileSchema),
  });

  const { register: registerPassword, handleSubmit: handleSubmitPassword, reset: resetPassword, formState: { errors: passwordErrors, isSubmitting: passwordSubmitting } } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const showToast = useCallback(
    (message, type = 'success') => {
      if (!message) return;
      if (type === 'error') toast.error(message);
      else if (type === 'warning') toast.warning(message);
      else if (type === 'info') toast.info(message);
      else toast.success(message);
    },
    [toast],
  );

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get('/users/me');
      const payload = res?.data?.data;
      const currentUser = payload?.user ?? payload ?? null;
      setUser(currentUser);
      resetProfile({
        fullName: currentUser?.fullName || '',
        phone: currentUser?.phone || '',
      });
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  }, [resetProfile, showToast]);

  const fetchPayments = useCallback(async (targetPage = 1) => {
    try {
      setPaymentsLoading(true);
      const res = await api.get(`/users/me/payments?page=${targetPage}&limit=10`);
      const payload = res?.data?.data;
      const list = Array.isArray(payload) ? payload : payload?.items ?? [];
      setPayments(list);
      setTotalPages(res?.data?.meta?.totalPages ?? payload?.totalPages ?? 1);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setPaymentsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    fetchPayments(page);
  }, [fetchPayments, page]);

  // Revoke the object URL as soon as it is replaced or the component unmounts.
  useEffect(() => {
    if (!avatarPreview) return undefined;
    return () => {
      URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const avatarSrc = avatarPreview || user?.avatarUrl || null;

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarSrc]);

  const onUpdateProfile = async (data) => {
    try {
      const res = await api.patch('/users/me', data);
      const payload = res?.data?.data;
      const updatedUser = payload?.user ?? payload ?? null;
      if (updatedUser) setUser(updatedUser);
      showToast('اطلاعات حساب با موفقیت بروز شد');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const onChangePassword = async (data) => {
    try {
      await api.post('/auth/change-password', data);
      resetPassword();
      showToast('رمز عبور تغییر کرد. لطفاً دوباره وارد شوید.');
      // Clear the session through AuthContext so React state and the in-memory
      // access token are reset together (no localStorage.clear()).
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      showToast('حجم فایل نباید بیشتر از ۲ مگابایت باشد', 'error');
      e.target.value = '';
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      showToast('فرمت فایل نامعتبر است (فقط JPG, PNG, WEBP)', 'error');
      e.target.value = '';
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    try {
      setAvatarLoading(true);
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      // No manual Content-Type: the browser/axios must add the multipart boundary.
      const res = await api.post('/users/me/avatar', formData);
      const payload = res?.data?.data;
      const avatarUrl = payload?.avatarUrl ?? payload?.user?.avatarUrl ?? null;

      setUser((prev) => ({ ...(prev || {}), avatarUrl }));
      setAvatarFile(null);
      setAvatarPreview(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      showToast('تصویر پروفایل بروز شد');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setAvatarLoading(false);
    }
  };

  const initials = getInitials(user?.fullName || user?.email);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">تنظیمات پروفایل و حساب</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 space-x-reverse">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            اطلاعات حساب
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'security' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            امنیت
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'payments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            پرداخت‌ها
          </button>
        </nav>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center space-x-6 space-x-reverse">
            {avatarSrc && !avatarFailed ? (
              <img
                src={avatarSrc}
                alt="تصویر پروفایل"
                onError={() => setAvatarFailed(true)}
                className="w-20 h-20 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div
                role="img"
                aria-label="تصویر پروفایل پیش‌فرض"
                className="w-20 h-20 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 flex items-center justify-center text-xl font-semibold select-none"
              >
                {initials}
              </div>
            )}
            <div className="space-y-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
              />
              {avatarFile && (
                <button onClick={handleAvatarUpload} disabled={avatarLoading} className="px-4 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 disabled:opacity-50">
                  {avatarLoading ? 'در حال آپلود...' : 'ذخیره تصویر'}
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmitProfile(onUpdateProfile)} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-gray-700">ایمیل (غیرقابل تغییر)</label>
              <input type="email" disabled value={user?.email || ''} className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">نام کامل</label>
              <input type="text" {...registerProfile('fullName')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
              {profileErrors.fullName && <p className="text-xs text-red-600 mt-1">{profileErrors.fullName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">شماره تماس</label>
              <input type="text" {...registerProfile('phone')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
            </div>
            <button type="submit" disabled={profileSubmitting} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {profileSubmitting ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Security */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-xl">
          <h2 className="text-lg font-medium text-gray-900 mb-4">تغییر رمز عبور</h2>
          <form onSubmit={handleSubmitPassword(onChangePassword)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">رمز عبور فعلی</label>
              <input type="password" {...registerPassword('currentPassword')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              {passwordErrors.currentPassword && <p className="text-xs text-red-600 mt-1">{passwordErrors.currentPassword.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">رمز عبور جدید</label>
              <input type="password" {...registerPassword('newPassword')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              {passwordErrors.newPassword && <p className="text-xs text-red-600 mt-1">{passwordErrors.newPassword.message}</p>}
            </div>
            <button type="submit" disabled={passwordSubmitting} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {passwordSubmitting ? 'در حال تغییر...' : 'تغییر رمز عبور'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Payments */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">تاریخچه پرداخت‌ها</h2>
          {paymentsLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">پرداختی ثبت نشده است.</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-right">
                  <thead>
                    <tr>
                      <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase">شناسه</th>
                      <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase">مبلغ (تومان)</th>
                      <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase">وضعیت</th>
                      <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase">تاریخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4 text-gray-900 font-mono text-xs">{String(p.id || '').slice(0, 8)}</td>
                        <td className="py-3 px-4 text-gray-900">{p.amountToman == null ? 'نامشخص' : p.amountToman.toLocaleString()}</td>
                        <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                        <td className="py-3 px-4 text-gray-500">{new Date(p.createdAt).toLocaleDateString('fa-IR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {payments.map((p) => (
                  <div key={p.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs text-gray-500">{String(p.id || '').slice(0, 8)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">مبلغ:</span>
                      <span className="font-medium text-gray-900">{p.amountToman == null ? 'مبلغ نامشخص' : `${p.amountToman.toLocaleString()} تومان`}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">تاریخ:</span>
                      <span className="text-gray-700">{new Date(p.createdAt).toLocaleDateString('fa-IR')}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
