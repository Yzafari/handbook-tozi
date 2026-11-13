import api, { unwrap } from './api.js';

export const register = (payload) =>
  unwrap(api.post('/auth/register', payload, { skipAuthRefresh: true }));

export const login = (email, password) =>
  unwrap(
    api.post('/auth/login', { email, password }, { skipAuthRefresh: true })
  );

export const fetchCsrfToken = () =>
  unwrap(api.get('/auth/csrf-token', { skipAuthRefresh: true }));

export const refreshSession = (csrfToken) =>
  unwrap(
    api.post(
      '/auth/refresh',
      {},
      {
        headers: { 'X-CSRF-Token': csrfToken },
        skipAuthRefresh: true
      }
    )
  );

export const logout = (csrfToken) =>
  unwrap(
    api.post(
      '/auth/logout',
      {},
      {
        headers: { 'X-CSRF-Token': csrfToken },
        skipAuthRefresh: true
      }
    )
  );

export const changePassword = (currentPassword, newPassword) =>
  unwrap(
    api.post('/auth/change-password', {
      currentPassword,
      newPassword
    })
  );