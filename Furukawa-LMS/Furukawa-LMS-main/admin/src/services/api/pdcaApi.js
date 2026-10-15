import axiosInstance from "../requests/axiosInstance.js";

const BASE_PATH = "/api/v1/pdca";

export const pdcaApi = {
    // A. PDCA Record Management
    getRecords: async (params = {}) => {
        const response = await axiosInstance.get(BASE_PATH, { params });
        return response.data?.data || response.data;
    },

    getRecord: async (id) => {
        const response = await axiosInstance.get(`${BASE_PATH}/${id}`);
        return response.data?.data || response.data;
    },

    createRecord: async (data) => {
        const response = await axiosInstance.post(BASE_PATH, data);
        return response.data?.data || response.data;
    },

    updateRecord: async (id, data) => {
        const response = await axiosInstance.put(`${BASE_PATH}/${id}`, data);
        return response.data?.data || response.data;
    },

    deleteRecord: async (id) => {
        const response = await axiosInstance.delete(`${BASE_PATH}/${id}`);
        return response.data?.data || response.data;
    },

    // B. Sheet Management
    getSheet: async (id) => {
        const response = await axiosInstance.get(`${BASE_PATH}/${id}/sheet`);
        return response.data?.data || response.data;
    },

    saveSheet: async (id, sheetData) => {
        const response = await axiosInstance.put(`${BASE_PATH}/${id}/sheet`, sheetData);
        return response.data?.data || response.data;
    },

    // C. CFT Topic Management
    getCftTopics: async (params = {}) => {
        const response = await axiosInstance.get(`${BASE_PATH}/cft`, { params });
        return response.data?.data || response.data;
    },

    createCftTopic: async (data) => {
        const response = await axiosInstance.post(`${BASE_PATH}/cft`, data);
        return response.data?.data || response.data;
    },

    updateCftTopic: async (id, data) => {
        const response = await axiosInstance.put(`${BASE_PATH}/cft/${id}`, data);
        return response.data?.data || response.data;
    },

    deleteCftTopic: async (id) => {
        const response = await axiosInstance.delete(`${BASE_PATH}/cft/${id}`);
        return response.data?.data || response.data;
    },

    // D. CFT Member Management
    getCftMembers: async (id) => {
        const response = await axiosInstance.get(`${BASE_PATH}/cft/${id}/members`);
        return response.data?.data || response.data;
    },

    updateCftMembers: async (id, members) => {
        const response = await axiosInstance.put(`${BASE_PATH}/cft/${id}/members`, { members });
        return response.data?.data || response.data;
    },

    // E. Attachment and Evidence Management
    uploadAttachment: async (id, formData) => {
        const response = await axiosInstance.post(`${BASE_PATH}/${id}/attachments`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        return response.data?.data || response.data;
    },

    deleteAttachment: async (id, attachmentId) => {
        const response = await axiosInstance.delete(`${BASE_PATH}/${id}/attachments/${attachmentId}`);
        return response.data?.data || response.data;
    },

    // F. Audit History
    getHistory: async (id) => {
        const response = await axiosInstance.get(`${BASE_PATH}/${id}/history`);
        return response.data?.data || response.data;
    },

    // G. Metadata and Dropdown Data
    getMetadata: async () => {
        const response = await axiosInstance.get(`${BASE_PATH}/metadata`);
        return response.data?.data || response.data;
    },

    getSections: async () => {
        const response = await axiosInstance.get(`${BASE_PATH}/sections`);
        return response.data?.data || response.data;
    },

    getEmployees: async (search = '') => {
        const response = await axiosInstance.get(`${BASE_PATH}/employees`, {
            params: search ? { search } : {}
        });
        return response.data?.data || response.data;
    }
};

export default pdcaApi;
