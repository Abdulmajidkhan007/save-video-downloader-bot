import axios, { AxiosError } from 'axios';
import { store } from '../store';
import { logout, setTokens } from '../store/slices/auth.slice';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// Request interceptor — attach JWT
api.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401 and token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        store.dispatch(logout());
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
        store.dispatch(setTokens({ accessToken: data.data.accessToken, refreshToken: data.data.refreshToken }));
        processQueue(null, data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        store.dispatch(logout());
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// Typed API methods
export const authApi = {
  loginTelegram: (telegramId: string, firstName: string, username?: string) =>
    api.post('/auth/telegram', { telegramId, firstName, username }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const expensesApi = {
  list: (params?: Record<string, unknown>) => api.get('/expenses', { params }),
  create: (data: Record<string, unknown>) => api.post('/expenses', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  stats: (groupId: string, month?: number, year?: number) =>
    api.get(`/expenses/stats/${groupId}`, { params: { month, year } }),
};

export const analyticsApi = {
  dashboard: (groupId: string) => api.get(`/analytics/dashboard/${groupId}`),
  full: (groupId: string, startDate?: string, endDate?: string) =>
    api.get(`/analytics/full/${groupId}`, { params: { startDate, endDate } }),
  trends: (groupId: string, period: 'daily' | 'weekly' | 'monthly') =>
    api.get(`/analytics/trends/${groupId}`, { params: { period } }),
};

export const categoriesApi = {
  list: (groupId?: string) => api.get('/categories', { params: { groupId } }),
  create: (data: Record<string, unknown>) => api.post('/categories', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

export const groupsApi = {
  list: () => api.get('/groups'),
  get: (id: string) => api.get(`/groups/${id}`),
  summary: (id: string) => api.get(`/groups/${id}/summary`),
  updateSettings: (id: string, data: Record<string, unknown>) => api.patch(`/groups/${id}/settings`, data),
};

export const limitsApi = {
  list: (groupId: string, month?: number, year?: number) =>
    api.get('/limits', { params: { groupId, month, year } }),
  set: (data: Record<string, unknown>) => api.post('/limits', data),
  delete: (id: string) => api.delete(`/limits/${id}`),
};

export const exportsApi = {
  generate: (data: Record<string, unknown>) =>
    api.post('/exports/generate', data, { responseType: 'blob' }),
};
