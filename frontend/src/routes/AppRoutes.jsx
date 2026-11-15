import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

import Layout from '../components/layout/Layout.jsx';
import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import AdminLayout from '../components/layout/AdminLayout.jsx';

import Home from '../pages/Home.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import Profile from '../pages/Profile.jsx';
import Pricing from '../pages/Pricing.jsx';
import Checkout from '../pages/Checkout.jsx';
import PaymentResult from '../pages/PaymentResult.jsx';
import NotFound from '../pages/NotFound.jsx';

import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import Users from '../pages/admin/Users.jsx';
import Payments from '../pages/admin/Payments.jsx';
import AuditLogs from '../pages/admin/AuditLogs.jsx';
import Documents from '../pages/admin/Documents.jsx';

function RouteLoading() {
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

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <RouteLoading />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function RequireAdmin() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <RouteLoading />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/payment/result" element={<PaymentResult />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/checkout" element={<Navigate to="/pricing" replace />} />
          <Route path="/checkout/:planId" element={<Checkout />} />
        </Route>
      </Route>

      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/payments" element={<Payments />} />
          <Route path="/admin/audit-logs" element={<AuditLogs />} />
          <Route path="/admin/documents" element={<Documents />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;
