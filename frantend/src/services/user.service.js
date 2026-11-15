import api, { unwrap } from './api.js';

export const fetchCurrentUser = () =>
  unwrap(api.get('/users/me'));

export const updateProfile = (payload) =>
  unwrap(api.patch('/users/me', payload));

export const uploadAvatar = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('avatar', file);

  return unwrap(
    api.post('/users/me/avatar', formData, {
      onUploadProgress,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  );
};

export const fetchDashboard = () =>
  unwrap(api.get('/users/me/dashboard'));

export const fetchMyPayments = (params = {}) =>
  unwrap(api.get('/users/me/payments', { params }));

export const fetchNotifications = (params = {}) =>
  unwrap(api.get('/users/me/notifications', { params }));

export const markNotificationRead = (id) =>
  unwrap(
    api.patch(`/users/me/notifications/${encodeURIComponent(id)}/read`)
  );