import axios from 'axios';
import { FloodRiskData, WeatherData, ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    // Provide more detailed error information
    if (error.response?.status === 422) {
      console.error('Validation Error Details:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

export const floodRiskApi = {
  // Get latest flood risk predictions
  getLatest: async (limit: number = 10): Promise<FloodRiskData[]> => {
    const response = await api.get(`/risk/latest?limit=${limit}`);
    return response.data;
  },

  // Get flood risk by city
  getByCity: async (city: string): Promise<FloodRiskData[]> => {
    const response = await api.get(`/risk/city/${city}`);
    return response.data;
  },

  // Get flood risk statistics
  getStats: async (): Promise<{
    total_predictions: number;
    high_risk_cities: number;
    avg_risk_score: number;
    last_updated: string;
  }> => {
    const response = await api.get('/risk/stats');
    return response.data;
  },
};

export const weatherApi = {
  // Get current weather data
  getCurrent: async (city: string): Promise<WeatherData> => {
    const response = await api.get(`/weather/current/${city}`);
    return response.data;
  },
};

export const sosApi = {
  // Get recent SOS reports
  getRecent: async (limit: number = 10): Promise<any[]> => {
    const response = await api.get(`/sos/recent?limit=${limit}`);
    return response.data;
  },

  // Submit SOS report
  submitReport: async (reportData: FormData): Promise<ApiResponse<any>> => {
    const response = await api.post('/sos/report', reportData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;
