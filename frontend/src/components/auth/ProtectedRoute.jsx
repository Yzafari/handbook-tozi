import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // تا زمانی که وضعیت احراز هویت در حال بررسی است، لودینگ نمایش داده شود
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // اگر کاربر احراز هویت نشده یا اطلاعات کاربر وجود ندارد، به صفحه لاگین هدایت شود
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // بررسی دسترسی بر اساس نقش کاربر (در صورت نیاز)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
