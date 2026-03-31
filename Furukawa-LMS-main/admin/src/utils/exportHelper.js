import axiosInstance from '../Helper/axiosInstance';
import { toast } from 'sonner';

/**
 * Utility to export high-fidelity Excel reports by calling the backend API.
 * 
 * @param {string} formName - The exact name of the form (matches backend switch case)
 * @param {object} params - Query parameters like id, departmentId, studentId
 */
export const exportToExcel = async (formName, params = {}) => {
    const toastId = toast.loading(`Generating ${formName} Excel...`);
    try {
        const response = await axiosInstance.get(`/api/reports/${encodeURIComponent(formName)}`, {
            params,
            responseType: 'blob'
        });

        // Create a URL for the blob
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Extract filename from header or use default
        let filename = `${formName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
            const matches = /filename="?([^"]*)"?/.exec(contentDisposition);
            if (matches && matches[1]) filename = matches[1];
        }

        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success(`${formName} exported successfully!`, { id: toastId });
    } catch (error) {
        console.error('Export Error:', error);
        toast.error(`Failed to export ${formName}. Please try again.`, { id: toastId });
    }
};
