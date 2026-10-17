import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import ENV from "../configs/env.config.js";

// A video put on a spreadsheet: a multipart upload with one file in the field
// "file". It is written to a temporary file (never held in memory) and moved into
// uploads/sheet-media by the controller; the sheet then stores only its URL, so a
// large video doesn't ride along in every save of the workbook's JSON.

export const SHEET_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

const tempDir = path.join(os.tmpdir(), "sheet-media-uploads");

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            fs.mkdir(tempDir, { recursive: true }, (err) => cb(err, tempDir));
        },
        filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || "")}`),
    }),
    limits: { fileSize: ENV.SHEET_VIDEO_MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        if (SHEET_VIDEO_TYPES.includes(file.mimetype)) return cb(null, true);
        const error = new Error("Only MP4, WebM, Ogg and QuickTime videos can be added to a sheet.");
        error.status = 415;
        cb(error);
    },
}).single("file");

const megabytes = (bytes) => Math.round(bytes / (1024 * 1024));

// Runs the upload, answering a refused one with JSON instead of the default error page.
export const sheetVideoUpload = (req, res, next) => {
    upload(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ success: false, message: `The video is larger than ${megabytes(ENV.SHEET_VIDEO_MAX_BYTES)} MB.` });
        }
        return res.status(err.status || 400).json({ success: false, message: err.message || "Upload failed" });
    });
};
