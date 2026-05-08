import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For Android emulator use 10.0.2.2, for physical device use your machine IP
const API_BASE = 'https://womanhood-backend.onrender.com';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 60000,
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (username, phoneNumber) =>
  api.post('/auth/login', { username, phoneNumber });

// Orders
export const createOrder = (formData) =>
  api.post('/orders', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const searchOrders = (query) =>
  api.get(`/orders/search?q=${encodeURIComponent(query || '')}`);

export const getOrder = (id) => api.get(`/orders/${id}`);

export const updateOrder = (id, data) => api.patch(`/orders/${id}`, data);

export const updateOrderWithImage = (id, formData) =>
  api.patch(`/orders/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status });

export const deleteOrder = (id) => api.delete(`/orders/${id}`);

// Calendar
export const getOrdersByDate = (dateStr) =>
  api.get(`/orders/by-date?date=${encodeURIComponent(dateStr)}`);

export const getMonthOrders = (year, month) =>
  api.get(`/orders/month-orders?year=${year}&month=${month}`);

export default api;
