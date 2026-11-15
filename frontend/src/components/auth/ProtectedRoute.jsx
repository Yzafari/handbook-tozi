import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Single route guard used by AppRoutes.jsx.
 *
 * - No `allowedRoles`  -> any authenticated user may pass.
 * - With `allowedRoles` -> the user's role must be in the list, otherwise the
 *   request is redirected to /unauthorized (which AppRoutes.jsx registers).
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // تا زمانی که وضعیت احراز هویت در حال بررسی است، لودینگ نمایش داده شود
  if (isLoading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[50vh] items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <span className="size-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          در حال بررسی نشست کاربری...
        </div>
      </div>
    );
  }

  // اگر کاربر احراز هویت نشده یا اطلاعات کاربر وجود ندارد، به صفحه لاگین هدایت شود
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // بررسی دسترسی بر اساس نقش کاربر (در صورت نیاز)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
