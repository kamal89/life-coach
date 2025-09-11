// src/services/api.js - Centralized API client
import axios from 'axios';
import toast from 'react-hot-toast';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_TIMEOUT = parseInt(process.env.REACT_APP_API_TIMEOUT) || 30000;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };
    
    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params,
      });
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle responses and errors
api.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const endTime = new Date();
    const duration = endTime - response.config.metadata.startTime;
    
    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        duration: `${duration}ms`,
        data: response.data,
      });
    }
    
    // Return the response data directly
    return response.data;
  },
  (error) => {
    // Calculate request duration if metadata exists
    const duration = error.config?.metadata 
      ? new Date() - error.config.metadata.startTime 
      : 'unknown';
    
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: error.response?.status,
        duration: `${duration}ms`,
        message: error.message,
        data: error.response?.data,
      });
    }
    
    // Handle different error types
    const apiError = handleApiError(error);
    
    // Show toast notification for errors (except 401)
    if (apiError.status !== 401) {
      toast.error(apiError.message);
    }
    
    return Promise.reject(apiError);
  }
);

// Error handler function
const handleApiError = (error) => {
  const defaultError = {
    status: 500,
    message: 'Something went wrong. Please try again.',
    code: 'UNKNOWN_ERROR',
    details: null,
  };

  // Network error
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return {
        ...defaultError,
        status: 408,
        message: 'Request timeout. Please check your connection.',
        code: 'TIMEOUT_ERROR',
      };
    }
    
    return {
      ...defaultError,
      status: 0,
      message: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
    };
  }

  // Server responded with error status
  const { status, data } = error.response;
  
  // Handle specific status codes
  switch (status) {
    case 400:
      return {
        status,
        message: data?.error || 'Invalid request data.',
        code: 'BAD_REQUEST',
        details: data?.details || null,
      };
      
    case 401:
      // Handle authentication errors
      localStorage.removeItem('token');
      window.location.href = '/login';
      return {
        status,
        message: data?.error || 'Authentication required.',
        code: 'UNAUTHORIZED',
        details: null,
      };
      
    case 403:
      return {
        status,
        message: data?.error || 'Access denied.',
        code: 'FORBIDDEN',
        details: null,
      };
      
    case 404:
      return {
        status,
        message: data?.error || 'Resource not found.',
        code: 'NOT_FOUND',
        details: null,
      };
      
    case 409:
      return {
        status,
        message: data?.error || 'Resource conflict.',
        code: 'CONFLICT',
        details: data?.details || null,
      };
      
    case 422:
      return {
        status,
        message: data?.error || 'Validation failed.',
        code: 'VALIDATION_ERROR',
        details: data?.details || null,
      };
      
    case 429:
      return {
        status,
        message: data?.error || 'Too many requests. Please slow down.',
        code: 'RATE_LIMIT',
        details: { retryAfter: data?.retryAfter },
      };
      
    case 500:
      return {
        status,
        message: 'Server error. Please try again later.',
        code: 'SERVER_ERROR',
        details: null,
      };
      
    case 503:
      return {
        status,
        message: 'Service temporarily unavailable.',
        code: 'SERVICE_UNAVAILABLE',
        details: null,
      };
      
    default:
      return {
        status,
        message: data?.error || defaultError.message,
        code: 'HTTP_ERROR',
        details: data?.details || null,
      };
  }
};

// API service methods
export const apiService = {
  // Generic HTTP methods
  get: (url, config = {}) => api.get(url, config),
  post: (url, data = {}, config = {}) => api.post(url, data, config),
  put: (url, data = {}, config = {}) => api.put(url, data, config),
  patch: (url, data = {}, config = {}) => api.patch(url, data, config),
  delete: (url, config = {}) => api.delete(url, config),
  
  // File upload
  upload: (url, formData, onUploadProgress = null) => {
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onUploadProgress ? (progressEvent) => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onUploadProgress(progress);
      } : undefined,
    });
  },
  
  // Download file
  download: async (url, filename = 'download') => {
    try {
      const response = await api.get(url, {
        responseType: 'blob',
      });
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  // Health check
  healthCheck: () => api.get('/health'),
  
  // Set auth token
  setAuthToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
    }
  },
  
  // Clear auth token
  clearAuthToken: () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  },
  
  // Get current token
  getAuthToken: () => {
    return localStorage.getItem('token');
  },
  
  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
      // Check if token is expired (basic check)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp > currentTime;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  },
};

// Authentication API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
};

// Users API
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.patch('/users/profile', data),
  updatePassword: (data) => api.patch('/users/password', data),
  deleteAccount: () => api.delete('/users/profile'),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiService.upload('/users/avatar', formData);
  },
};

// Goals API
export const goalsAPI = {
  getGoals: (params = {}) => api.get('/goals', { params }),
  getGoal: (id) => api.get(`/goals/${id}`),
  createGoal: (data) => api.post('/goals', data),
  updateGoal: (id, data) => api.patch(`/goals/${id}`, data),
  deleteGoal: (id) => api.delete(`/goals/${id}`),
  updateProgress: (id, progress, note = '') => 
    api.put(`/goals/${id}/progress`, { progress, note }),
  addCheckIn: (id, checkInData) => api.post(`/goals/${id}/checkin`, checkInData),
  getAnalytics: () => api.get('/goals/analytics'),
};

// Chat API
export const chatAPI = {
  sendMessage: (message, conversationId = null) => 
    api.post('/chat/message', { message, conversationId }),
  getHistory: (params = {}) => api.get('/chat/history', { params }),
  getConversations: () => api.get('/chat/conversations'),
  deleteConversation: (id) => api.delete(`/chat/conversations/${id}`),
  provideFeedback: (messageId, rating, feedback = '') => 
    api.post('/chat/feedback', { messageId, rating, feedback }),
};

// Analytics API
export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getGoalProgress: (timeframe = '30d') => 
    api.get('/analytics/goals', { params: { timeframe } }),
  getChatMetrics: () => api.get('/analytics/chat'),
  getUserEngagement: () => api.get('/analytics/engagement'),
  exportData: (type = 'all') => api.get('/analytics/export', { params: { type } }),
};

// Real-time WebSocket connection
export class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000;
    this.listeners = new Map();
  }
  
  connect() {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
    const token = apiService.getAuthToken();
    
    if (!token) {
      console.warn('No auth token found for WebSocket connection');
      return;
    }
    
    try {
      this.ws = new WebSocket(`${wsUrl}?token=${token}`);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data.payload);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.emit('disconnected');
        this.handleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket not connected');
    }
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('WebSocket event callback error:', error);
        }
      });
    }
  }
  
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Reconnecting WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('❌ Max WebSocket reconnection attempts reached');
    }
  }
}

// Export default API service and WebSocket
export default apiService;
export const wsService = new WebSocketService();