import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import StatusBadge from '../components/common/StatusBadge';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/me/dashboard');
      setDashboardData(res.data.data);
      const notifRes = await api.get('/users/me/notifications?limit=5');
      setNotifications(notifRes.data.data);
    } catch (err) {
      setError('خطا در دریافت اطلاعات داشبورد');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCancelSubscription = async () => {
    try {
      setCanceling(true);
      await api.post('/subscriptions/me/cancel');
      setShowCancelModal(false);
      await fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'خطا در لغو اشتراک');
    } finally {
      setCanceling(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/users/me/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="h-32 bg-gray-200 rounded-xl"></div>
        </div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={fetchDashboard} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">تلاش مجدد</button>
      </div>
    );
  }

  const { subscription, stats, unreadNotifications } = dashboardData || {};
  const formattedEndsAt = subscription?.endsAt 
    ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', calendar: 'persian' }).format(new Date(subscription.endsAt))
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">داشبورد کاربری</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">کل پرداخت‌ها</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{stats?.totalPayments || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">مجموع هزینه کرد</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{(stats?.totalSpentToman || 0).toLocaleString()} تومان</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">روزهای باقی‌مانده اشتراک</p>
          <p className="mt-2 text-3xl font-semibold text-indigo-600">{stats?.daysRemaining || 0} روز</p>
        </div>
      </div>

      {/* Subscription Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-medium text-gray-900">وضعیت اشتراک</h2>
            <p className="text-sm text-gray-500 mt-1">مدیریت طرح و اشتراک فعلی شما</p>
          </div>
          {subscription ? <StatusBadge status={subscription.status} /> : <StatusBadge status="EXPIRED" />}
        </div>

        {subscription ? (
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">طرح: {subscription.plan?.name}</span>
              <span className="text-gray-500">انقضا: {formattedEndsAt}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full" 
                style={{ width: `${Math.min(100, Math.max(0, (subscription.daysRemaining / (subscription.plan?.durationDays || 30)) * 100))}%` }}
              ></div>
            </div>
            <div className="flex space-x-3 space-x-reverse pt-2">
              <Link to="/pricing" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                تمدید / ارتقا
              </Link>
              {subscription.status === 'ACTIVE' && (
                <button 
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50"
                >
                  لغو تمدید خودکار / لغو اشتراک
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <p className="text-gray-500">شما در حال حاضر اشتراک فعالی ندارید.</p>
            <Link to="/pricing" className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              خرید اشتراک
            </Link>
          </div>
        )}
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-medium text-gray-900">اعلان‌ها {unreadNotifications > 0 && <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">{unreadNotifications} خوانده نشده</span>}</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">اعلانی وجود ندارد.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((n) => (
              <div key={n.id} className={`py-3 flex justify-between items-center ${!n.readAt ? 'bg-indigo-50/50 px-3 rounded-lg' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                </div>
                {!n.readAt && (
                  <button onClick={() => handleMarkAsRead(n.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    علامت به عنوان خوانده شده
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">لغو تمدید اشتراک</h3>
            <p className="text-sm text-gray-500">آیا مطمئن هستید که می‌خواهید اشتراک خود را لغو کنید؟ اشتراک شما تا پایان تاریخ اعتبار فعال باقی خواهد ماند.</p>
            <div className="flex justify-end space-x-3 space-x-reverse pt-4">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                انصراف
              </button>
              <button 
                onClick={handleCancelSubscription} 
                disabled={canceling}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {canceling ? 'در حال لغو...' : 'تایید لغو'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}