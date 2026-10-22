import axiosInstance from "../requests/axiosInstance.js";

const BASE_PATH = "/api/v1/lpa";

export const lpaApi = {
  // A. Templates & Configuration
  getTemplates: async () => {
    const response = await axiosInstance.get(`${BASE_PATH}/templates`);
    return response.data?.data || response.data;
  },

  getTemplate: async (section) => {
    const response = await axiosInstance.get(`${BASE_PATH}/templates/${section}`);
    return response.data?.data || response.data;
  },

  // B. Master Data & Dropdowns
  getDropdowns: async () => {
    const response = await axiosInstance.get(`${BASE_PATH}/dropdowns`);
    return response.data?.data || response.data;
  },

  // C. Records CRUD & Queries
  getSameDaySourceData: async (params = {}) => {
    const response = await axiosInstance.get(`${BASE_PATH}/same-day-source`, { params });
    return response.data?.data || response.data;
  },

  getRecords: async (params = {}) => {
    const response = await axiosInstance.get(`${BASE_PATH}/records`, { params });
    return response.data?.data || response.data;
  },

  getRecord: async (id) => {
    const response = await axiosInstance.get(`${BASE_PATH}/records/${id}`);
    return response.data?.data || response.data;
  },

  createRecord: async (data) => {
    const response = await axiosInstance.post(`${BASE_PATH}/records`, data);
    return response.data?.data || response.data;
  },

  updateRecord: async (id, data) => {
    const response = await axiosInstance.put(`${BASE_PATH}/records/${id}`, data);
    return response.data?.data || response.data;
  },

  deleteRecord: async (id) => {
    const response = await axiosInstance.delete(`${BASE_PATH}/records/${id}`);
    return response.data?.data || response.data;
  },

  // D. Authoritative Score Preview
  calculateScores: async (sheet, section = "assembly") => {
    const response = await axiosInstance.post(`${BASE_PATH}/calculate-scores`, { sheet, section });
    return response.data?.data || response.data;
  },

  // F. CMS sheet email delivery
  sendEmail: async (emailData, idempotencyKey) => {
    const response = await axiosInstance.post(`${BASE_PATH}/send-email`, emailData, {
      headers: { "Idempotency-Key": idempotencyKey }
    });
    return response.data?.data || response.data;
  },

  getDefaultMailRecipients: async () => {
    const response = await axiosInstance.get(`${BASE_PATH}/default-mails`);
    return response.data?.data || response.data;
  },

  saveDefaultMailRecipients: async (emails) => {
    const response = await axiosInstance.put(`${BASE_PATH}/default-mails`, { emails });
    return response.data?.data || response.data;
  },

  // G. Admin Excel Upload
  uploadExcel: async (formData) => {
    const response = await axiosInstance.post(`${BASE_PATH}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data?.data || response.data;
  }
};

export default lpaApi;
