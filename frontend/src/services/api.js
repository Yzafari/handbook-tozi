// frontend/src/services/api.js
// Compatibility shim only. The canonical Axios client (auth + CSRF + refresh
// interceptors) lives in utils/api.js; nothing may be duplicated here.
import api, {
  unwrap,
  getErrorMessage,
  setAccessToken,
  getAccessToken,
  getCookie,
  ensureCsrfToken,
  refreshSession,
  refreshAccessToken,
} from '../utils/api.js';

export {
  api,
  unwrap,
  getErrorMessage,
  setAccessToken,
  getAccessToken,
  getCookie,
  ensureCsrfToken,
  refreshSession,
  refreshAccessToken,
};

export default api;
