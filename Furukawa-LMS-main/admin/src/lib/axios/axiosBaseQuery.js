import { toast } from "sonner";
import axiosInstance from "./axiosInstance";

const axiosBaseQuery = async (arg) => {
    // Handle both object and string arguments
    const { url, method, data, params, responseHandler } = typeof arg === 'string' ? { url: arg } : arg;
    try {
        const response = await axiosInstance({
            url,
            method,
            data,
            params,
            ...(responseHandler && { responseType: 'blob' })
        })

        // Handle different response types
        if (responseHandler) {
            return { data: await responseHandler(response) }
        }

        return { data: response.data }
    } catch (error) {
        console.error('API Error:', error);

        let errorMessage = 'An unexpected error occurred';
        let errorStatus = 500;

        if (error.response) {
            errorStatus = error.response.status;
            errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${errorStatus}`;
        } else if (error.request) {
            errorMessage = 'Network error: Unable to connect to server';
            errorStatus = 0;
        } else {
            errorMessage = error.message || errorMessage;
        }

        return {
            error: {
                status: errorStatus,
                message: errorMessage,
                data: error.response?.data
            }
        }
    }
}

export default axiosBaseQuery;