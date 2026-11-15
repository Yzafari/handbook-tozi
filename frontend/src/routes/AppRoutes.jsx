import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from '../components/layout/Layout.jsx';
import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import AdminLayout from '../components/layout/AdminLayout.jsx';
import ProtectedRoute from '../components/auth/ProtectedRoute.jsx';

import Home from '../pages/Home.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import Profile from '../pages/Profile.jsx';
import Pricing from '../pages/Pricing.jsx';
import Checkout from '../pages/Checkout.jsx';
import PaymentResult from '../pages/PaymentResult.jsx';
import Unauthorized from '../pages/Unauthorized.jsx';
import NotFound from '../pages/NotFound.jsx';

import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import Users from '../pages/admin/Users.jsx';
import Payments from '../pages/admin/Payments.jsx';
import AuditLogs from '../pages/admin/AuditLogs.jsx';
import Documents from '../pages/admin/Documents.jsx';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/payment/result" element={<PaymentResult />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/checkout" element={<Navigate to="/pricing" replace />} />
          <Route path="/checkout/:planId" element={<Checkout />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
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
