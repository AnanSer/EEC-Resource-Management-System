import axios from 'axios';

/**
 * Pre-configured Axios instance for EEC Resource Management System (RMS)
 * Configured with baseURL pointing to backend Express API and withCredentials enabled
 * for cross-origin cookie / session management.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Response interceptor for consistent error handling and logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.warn(`[EEC-RMS API Error] ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      console.warn('[EEC-RMS API Error] No response received from server. Is backend running?');
    } else {
      console.warn('[EEC-RMS API Error]', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
