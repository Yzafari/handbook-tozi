import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
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

export default function Profile() {
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

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

  const fetchUser = async () => {
    try {
      const res = await api.get('/users/me');
      setUser(res.data.data.user || res.data.data);
      resetProfile({
        fullName: res.data.data.user?.fullName || res.data.data.fullName || '',
        phone: res.data.data.user?.phone || res.data.data.phone || '',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayments = async (p = 1) => {
    try {
      setPaymentsLoading(true);
      const res = await api.get(`/users/me/payments?page=${p}&limit=10`);
      setPayments(res.data.data);
      setTotalPages(res.data.meta?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchPayments(page);
  }, [page]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const onUpdateProfile = async (data) => {
    try {
      const res = await api.patch('/users/me', data);
      setUser(res.data.data.user);
      showToast('اطلاعات حساب با موفقیت بروز شد');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'خطا در بروزرسانی اطلاعات', 'error');
    }
  };

  const onChangePassword = async (data) => {
    try {
      await api.post('/auth/change-password', data);
      showToast('رمز عبور تغییر کرد. در حال خروج...');
      setTimeout(() => {
        localStorage.clear();
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'خطا در تغییر رمز عبور', 'error');
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('حجم فایل نباید بیشتر از ۲ مگابایت باشد', 'error');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('فرمت فایل نامعتبر است (فقط JPG, PNG, WEBP)', 'error');
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
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser({ ...user, avatarUrl: res.data.data.avatarUrl });
      showToast('تصویر پروفایل بروز شد');
      setAvatarFile(null);
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'خطا در آپلود تصویر', 'error');
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">تنظیمات پروفایل و حساب</h1>

      {toast && (
        <div className={`p-4 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {toast.message}
        </div>
      )}

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
            <img
              src={avatarPreview || user?.avatarUrl || 'https://via.placeholder.com/100'}
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border border-gray-200"
            />
            <div className="space-y-2">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100" />
              {avatarFile && (
                <button onClick={handleAvatarUpload} disabled={avatarLoading} className="px-4 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700">
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
            <button type="submit" disabled={profileSubmitting} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
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
            <button type="submit" disabled={passwordSubmitting} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
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
                        <td className="py-3 px-4 text-gray-900 font-mono text-xs">{p.id.slice(0, 8)}</td>
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
                      <span className="font-mono text-xs text-gray-500">{p.id.slice(0, 8)}</span>
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