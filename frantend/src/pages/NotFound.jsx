import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
      <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        {/* آیکون یا عدد 404 */}
        <div className="text-7xl font-extrabold text-blue-600 mb-4 tracking-wider">
          404
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          صفحه مورد نظر یافت نشد
        </h1>
        
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          متأسفانه صفحه‌ای که به دنبال آن هستید وجود ندارد یا ممکن است آدرس آن تغییر کرده باشد.
        </p>

        <div className="flex flex-col gap-3">
          <Link 
            to="/" 
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200"
          >
            بازگشت به صفحه اصلی
          </Link>
          
          <Link 
            to="/dashboard" 
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200"
          >
            رفتن به داشبورد
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;