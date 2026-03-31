import { BASE_URL } from "../Helper/axiosInstance";

/**
 * Resolves a media URL, prepending the BASE_URL if it's a local path
 * @param {string} url - The URL from the database
 * @returns {string} - The resolved absolute URL
 */
export const getMediaUrl = (url) => {
    if (!url) return "";
    
    // If it's already an absolute URL (Cloudinary, external link)
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // If it's a local storage path (starting with /uploads)
    if (url.startsWith('/uploads')) {
        return `${BASE_URL}${url}`;
    }
    
    return url;
};
