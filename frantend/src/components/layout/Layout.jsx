import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Layout = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir="rtl">
      {/* هدر سایت */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">
            Grid Hand
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-gray-600 hover:text-blue-600 transition-colors">خانه</Link>
            <Link to="/pricing" className="text-gray-600 hover:text-blue-600 transition-colors">تعرفه‌ها</Link>
            
            {user ? (
              <Link to="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                داشبورد
              </Link>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="text-blue-600 px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors">ورود</Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">ثبت‌نام</Link>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* محتوای صفحات */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* فوتر سایت */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Grid Hand. تمامی حقوق محفوظ است.
      </footer>
    </div>
  );
};

export default Layout;