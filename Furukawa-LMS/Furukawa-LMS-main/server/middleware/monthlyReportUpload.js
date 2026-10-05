import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Separate multer instance from middleware/upload.js — that one's fileFilter
// only allows images/documents/videos, not .pptx/.ppt, and this feature also
// needs a deck-appropriate size ceiling instead of the generic 10GB default.
const tempDir = path.join('uploads', 'tmp', 'monthly-report');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const ALLOWED_MIMETYPES = new Set([
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-powerpoint', // .ppt
]);

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validExt = ext === '.pptx' || ext === '.ppt';
    const validMimetype = ALLOWED_MIMETYPES.has(file.mimetype);

    if (validExt && validMimetype) return cb(null, true);
    cb(new Error('Only PowerPoint files (.pptx or .ppt) are allowed'));
};

const monthlyReportUpload = multer({
    storage,
    limits: {
        fileSize: 300 * 1024 * 1024, // 300MB — comfortably above the ~117MB sample deck
    },
    fileFilter
});

export default monthlyReportUpload;
