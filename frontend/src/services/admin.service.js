import { api } from '../utils/api.js';

function listEnvelope(response) {
  return { items: response?.data?.data ?? [], meta: response?.data?.meta ?? {} };
}

export async function fetchAdminStats() {
  const response = await api.get('/admin/stats');
  return response.data?.data ?? response.data;
}

export async function fetchRevenueStats(days = 30) {
  const response = await api.get('/admin/stats/revenue', { params: { days } });
  const data = response.data?.data ?? {};
  return { items: data.items ?? data.series ?? [], range: data.range };
}

export async function fetchAdminPayments(params = {}) {
  return listEnvelope(await api.get('/admin/payments', { params }));
}

export async function fetchAdminPayment(id) {
  const response = await api.get(`/admin/payments/${encodeURIComponent(id)}`);
  return response.data?.data ?? response.data;
}

export async function fetchAuditLogs(params = {}) {
  return listEnvelope(await api.get('/admin/audit-logs', { params }));
}

export async function fetchAdminUser(id) {
  const response = await api.get(`/admin/users/${encodeURIComponent(id)}`);
  return response.data?.data ?? response.data;
}

export async function fetchAdminUsers(params = {}) {
  return listEnvelope(await api.get('/admin/users', { params }));
}

export async function updateAdminUser(id, userData) {
  const response = await api.patch(`/admin/users/${encodeURIComponent(id)}`, userData);
  return response.data?.data ?? response.data;
}
