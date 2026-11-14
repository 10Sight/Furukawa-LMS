// PTM API Service
function getApiBase() {
  if (typeof window !== 'undefined') {
    const envBase = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_BASE_URL) || '';
    if (envBase) {
      return `${envBase.replace(/\/+$/, '')}/api`;
    }
    const rawHost = window.location.hostname || 'localhost';
    const hostname = (rawHost === 'localhost' || rawHost === '::1') ? '127.0.0.1' : rawHost;
    // Server runs on port 3000 by default in FME LMS
    return `http://${hostname}:3000/api`;
  }
  return '/api';
}

const API_BASE = getApiBase();

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const rawUser = localStorage.getItem('ptm_auth_user') || localStorage.getItem('user') || sessionStorage.getItem('user');
    if (rawUser) {
      const u = typeof rawUser === 'object' ? rawUser : JSON.parse(rawUser);
      const role = u.role || (u.isAdmin ? 'ADMIN' : 'EMPLOYEE');
      const isAdmin = Boolean(
        u.isAdmin ||
        String(role).toUpperCase() === 'ADMIN' ||
        String(role).toUpperCase() === 'SUPERADMIN'
      );
      headers['x-user-role'] = role;
      headers['x-user-is-admin'] = String(isAdmin);
      headers['x-user-name'] = u.userName || u.username || u.name || '';
      headers['x-user-id'] = String(u.id || u._id || '');
    }
  } catch {}
  return headers;
}

async function request(url, options = {}) {
  const config = {
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(`${API_BASE}${url}`, config);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`[PTM API] Error request ${url}:`, err);
    throw err;
  }
}

export const authApi = {
  login: async (username, password) => {
    // Try PTM auth endpoint first, then fallback
    try {
      const res = await request('/ptm/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res && res.success) return res;
    } catch {}
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  getMe: async (username) => {
    const query = username ? `?username=${encodeURIComponent(username)}` : '';
    try {
      const res = await request(`/ptm/auth/me${query}`);
      if (res && res.success) return res;
    } catch {}
    return request(`/auth/me${query}`);
  },
  logout: async () => {
    try {
      await request('/ptm/auth/logout', { method: 'POST' });
    } catch {}
    return { success: true };
  },
};

export const ptmApi = {
  getAll: async () => {
    return request('/ptm');
  },
  create: async (item) => {
    return request('/ptm', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },
  update: async (id, item) => {
    return request(`/ptm/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  },
  delete: async (id) => {
    return request(`/ptm/${id}`, {
      method: 'DELETE',
    });
  },
};

export const sheetApi = {
  get: async (key) => {
    return request(`/sheets/${encodeURIComponent(key)}`);
  },
  save: async (key, { headerInfo, rows }) => {
    return request(`/sheets/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ headerInfo, rows }),
    });
  },
};

export const apqpApi = {
  getSuggestions: async () => {
    return request('/apqp/suggestions');
  },
  addSuggestion: async (value) => {
    return request('/apqp/suggestions', {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  },
};

export const employeeApi = {
  getAll: async (search = '') => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    try {
      const res = await request(`/v1/pdca/employees${query}`);
      const list = res?.data || res;
      if (Array.isArray(list)) return list;
    } catch {}
    try {
      const metaRes = await request('/v1/pdca/metadata');
      const meta = metaRes?.data || metaRes;
      if (Array.isArray(meta?.employees)) return meta.employees;
    } catch {}
    return [];
  },
};

export default {
  authApi,
  ptmApi,
  sheetApi,
  apqpApi,
  employeeApi,
};
