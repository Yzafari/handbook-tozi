import { api } from '../utils/api.js';

export async function fetchAdminDocumentMetrics() {
  const response = await api.get('/v1/documents/admin/metrics');
  return response.data?.data ?? {};
}

export async function fetchAdminDocuments(params = {}) {
  const response = await api.get('/v1/documents/admin/list', { params });
  return { items: response.data?.data ?? [], meta: response.data?.meta ?? {} };
}

export async function uploadAdminDocument(formData) {
  const response = await api.post('/v1/documents', formData);
  return response.data?.data ?? response.data;
}

export async function reindexAdminDocument(id) {
  const response = await api.post(`/v1/documents/${encodeURIComponent(id)}/reindex`);
  return response.data?.data ?? response.data;
}

export async function deleteAdminDocument(id) {
  const response = await api.delete(`/v1/documents/${encodeURIComponent(id)}`);
  return response.data?.data ?? response.data;
}

export async function restoreAdminDocument(id) {
  const response = await api.post(`/v1/documents/${encodeURIComponent(id)}/restore`);
  return response.data?.data ?? response.data;
}

export async function getAdminDocumentOpenLink(id) {
  const response = await api.get(`/v1/documents/${encodeURIComponent(id)}/open-link`);
  return response.data?.data?.url;
}
