import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50" dir="rtl">
      {/* سایدبار */}
      <aside className="w-64 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-6 text-2xl font-bold text-blue-600 border-b border-gray-100">
          Grid Hand
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
            داشبورد
          </Link>
          <Link to="/pricing" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
            خرید اشتراک
          </Link>
          <Link to="/profile" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
            پروفایل کاربری
          </Link>
          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="block px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium mt-4 border-t border-gray-100 pt-4">
              پنل مدیریت
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="w-full text-right px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            خروج از حساب
          </button>
        </div>
      </aside>

      {/* بخش اصلی */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">خوش آمدید، {user?.name || 'کاربر'}</h2>
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
            {user?.name ? user.name[0] : 'U'}
          </div>
        </header>
        <div className="p-6 flex-1 overflow-auto">
          <Outlet /> {/* اینجا صفحات داخلی مثل داشبورد لود میشن */}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;