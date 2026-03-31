import axios from "axios";

const ENV_BASE = import.meta?.env?.VITE_BASE_URL;
export const BASE_URL = ENV_BASE || "http://192.168.90.19:3000" ;
// const BASE_URL = "https://swargaya-learning-management-system-3vcz.onrender.com";

const axiosInstance = axios.create({ baseURL: BASE_URL, withCredentials: true });

// Request interceptor - for authentication token handling
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - for handling auth errors globally
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        console.error('Axios Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });

        // Handle 401 errors globally if needed
        if (error.response?.status === 401) {
            console.warn('Unauthorized request - token may be invalid or expired');
            // Could redirect to login or refresh tokens here
        }

        // Handle 404 errors
        if (error.response?.status === 404) {
            console.warn('API endpoint not found:', error.config?.url);
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
