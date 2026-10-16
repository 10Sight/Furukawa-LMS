import { createDemoAdapter, demoModeEnabled } from "../../../../shared/demoData.js";
import { authSession } from "../../utils/authSession.js";
import axios from "axios";

const ENV_BASE = import.meta?.env?.VITE_BASE_URL;
const rawHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const hostname = (rawHost === "localhost" || rawHost === "::1") ? "127.0.0.1" : rawHost;
export const BASE_URL = ENV_BASE || `http://${hostname}:3000`;
// const BASE_URL = "https://swargaya-learning-management-system-3vcz.onrender.com";

const axiosInstance = axios.create({ baseURL: BASE_URL, withCredentials: true });

// Request interceptor - for authentication token handling
axiosInstance.interceptors.request.use(
    (config) => {
        let token = authSession.getItem('token');
        if (!token) {
            try {
                token = sessionStorage.getItem('token') || localStorage.getItem('token');
            } catch {}
        }
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Also pass X-User-Code and X-User-Id headers as fallback for iframe context
        try {
            const userRaw = authSession.getItem('user') || sessionStorage.getItem('user');
            if (userRaw) {
                const u = typeof userRaw === 'object' ? userRaw : JSON.parse(userRaw);
                const code = u.employeeId || u.empId || u.code || u.userName;
                if (code) config.headers['X-User-Code'] = code;
                if (u.id || u._id) config.headers['X-User-Id'] = u.id || u._id;
                if (u.name || u.fullName) config.headers['X-User-Name'] = u.name || u.fullName;
            }
        } catch {}

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

if (demoModeEnabled(import.meta.env)) {
    axiosInstance.defaults.adapter = createDemoAdapter(() => authSession.getItem("token"));
}

export default axiosInstance;
