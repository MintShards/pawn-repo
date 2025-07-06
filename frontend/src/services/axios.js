// services/axios.js - Updated Axios Configuration for PIN System
import axios from 'axios';
import { resetSession } from '../utils/sessions';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const axiosInstance = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
    (config) => {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                
                if (refreshToken) {
                    // Try to refresh the token
                    const response = await axios.post(`${API_BASE}/auth/refresh`, {
                        refresh_token: refreshToken
                    });

                    const { access_token, refresh_token: newRefreshToken } = response.data;
                    
                    // Update stored tokens
                    localStorage.setItem('accessToken', access_token);
                    localStorage.setItem('refreshToken', newRefreshToken);
                    
                    // Update the authorization header
                    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                    originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

                    // Retry the original request
                    return axiosInstance(originalRequest);
                }
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                
                // Refresh failed, redirect to login
                resetSession();
                
                // Only redirect if we're not already on a public page
                if (!window.location.pathname.includes('/login') && 
                    !window.location.pathname.includes('/setup')) {
                    window.location.href = '/login';
                }
                
                return Promise.reject(refreshError);
            }
        }

        // Handle other error cases
        if (error.response?.status === 403) {
            console.error('Access forbidden:', error.response.data);
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;