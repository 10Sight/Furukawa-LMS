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

/**
 * Rewrites relative /uploads src attributes inside an HTML string to absolute
 * URLs (prefixed with BASE_URL) so embedded images render correctly regardless
 * of which host serves the frontend.
 * @param {string} html - HTML string that may contain relative /uploads src attributes
 * @returns {string} - HTML string with absolute src attributes
 */
export const convertRelativeToAbsolute = (html) => {
    if (!html) return html;
    return html.replace(/src="(\/uploads\/[^"]*)"/g, `src="${BASE_URL}$1"`);
};

/**
 * Reverses convertRelativeToAbsolute, stripping the BASE_URL prefix from
 * /uploads src attributes so stored HTML stays portable across environments.
 * @param {string} html - HTML string that may contain absolute /uploads src attributes
 * @returns {string} - HTML string with relative src attributes
 */
export const convertAbsoluteToRelative = (html) => {
    if (!html) return html;
    const escapedBaseUrl = BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`src="${escapedBaseUrl}(\\/uploads\\/[^"]*)"`, 'g');
    return html.replace(pattern, 'src="$1"');
};
