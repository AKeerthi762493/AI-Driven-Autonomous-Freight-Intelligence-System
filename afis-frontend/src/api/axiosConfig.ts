import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('afis_token');
  if (token && config.headers) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

// Handle unauthorized responses
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const path = window.location.pathname;
      if (path !== '/' && path !== '/login') {
        localStorage.removeItem('afis_token');
        localStorage.removeItem('afis_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;