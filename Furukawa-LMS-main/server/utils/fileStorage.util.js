import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directory exists
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Save a file from temporary upload location to a permanent local directory
 * @param {Object} file - The file object from multer (req.file)
 * @param {string} subFolder - The subfolder within uploads (e.g., 'resources', 'avatars')
 * @returns {Promise<Object>} - Object with success, url, size, and format
 */
export const saveToLocal = async (file, subFolder = 'others') => {
    try {
        if (!file || !file.path) throw new Error("No file path provided");

        const uploadBase = path.join(process.cwd(), 'uploads');
        const targetDir = path.join(uploadBase, subFolder);
        ensureDir(targetDir);

        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        const targetPath = path.join(targetDir, fileName);

        // Move file from temp to target
        fs.renameSync(file.path, targetPath);

        // Construct relative URL for storage in DB
        // Format: /uploads/subFolder/fileName
        const relativeUrl = `/uploads/${subFolder}/${fileName}`;

        return {
            success: true,
            url: relativeUrl,
            fileName: file.originalname,
            format: path.extname(file.originalname).replace('.', ''),
            size: file.size,
            localPath: targetPath
        };
    } catch (error) {
        console.error('Local storage save error:', error);
        // Clean up temp file if move failed and it still exists
        if (file && file.path && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch (e) {}
        }
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Delete a file from local storage
 * @param {string} relativeUrl - The relative URL stored in the database
 * @returns {Promise<boolean>} - True if deleted or already gone
 */
export const deleteFromLocal = async (relativeUrl) => {
    try {
        if (!relativeUrl || !relativeUrl.startsWith('/uploads/')) return true;

        const absolutePath = path.join(process.cwd(), relativeUrl);
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }
        return true;
    } catch (error) {
        console.error('Local storage delete error:', error);
        return false;
    }
};

/**
 * Helper to get absolute path from relative URL
 */
export const getAbsolutePath = (relativeUrl) => {
    if (!relativeUrl) return null;
    return path.join(process.cwd(), relativeUrl);
};
