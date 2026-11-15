// Single shared Axios client: authentication state and refresh coordination
// must not be duplicated between services and page components.
import api, { unwrap, getErrorMessage, setAccessToken, getAccessToken, getCookie } from '../utils/api.js';

export { api, unwrap, getErrorMessage, setAccessToken, getAccessToken, getCookie };
export default api;
