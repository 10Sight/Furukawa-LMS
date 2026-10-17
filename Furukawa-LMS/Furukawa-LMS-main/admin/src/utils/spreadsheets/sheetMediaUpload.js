// Videos for a spreadsheet are uploaded to the server as files, and the sheet keeps
// only the URL it answers with (see the server's controllers/sheetMedia.controller.js).
// A video embedded in the sheet itself, as pictures are, would be resent with every
// save of the workbook and to everyone editing it.

import axiosInstance from "../../services/requests/axiosInstance.js";

// Matches the server's SHEET_VIDEO_MAX_BYTES default.
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const SHEET_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

/**
 * Why `file` can't be added as a sheet's video, or null when it can.
 * @param {{ size: number, type: string }} file
 */
export const videoFileProblem = (file) => {
    if (!SHEET_VIDEO_TYPES.includes(file.type)) return "Only MP4, WebM, Ogg and QuickTime videos can be added.";
    if (file.size > VIDEO_MAX_BYTES) return `The video is larger than ${VIDEO_MAX_BYTES / (1024 * 1024)} MB.`;
    return null;
};

/**
 * Uploads a video for a meeting's sheet (or, without a meeting, a section's sheet).
 * @param {{ meetingId?: string|number, sectionId?: string|number, file: File,
 *   onProgress?: (loaded: number, total: number) => void, signal?: AbortSignal }} options
 * @returns {Promise<{ url: string, name: string, size: number, mime: string }>}
 *   rejects with an Error whose message can be shown, or with `canceled: true` set
 *   when `signal` aborted it.
 */
export const uploadSheetVideo = async ({ meetingId, sectionId, file, onProgress, signal }) => {
    const url = meetingId
        ? `/api/daily-morning-meetings/${encodeURIComponent(meetingId)}/sheet/media`
        : `/api/daily-meeting-sheets/${encodeURIComponent(sectionId)}/media`;
    const form = new FormData();
    form.append("file", file);
    try {
        const res = await axiosInstance.post(url, form, {
            signal,
            onUploadProgress: (event) => onProgress?.(event.loaded, event.total || file.size),
        });
        return res.data.data;
    } catch (err) {
        const error = new Error(err?.response?.data?.message || "Failed to upload the video.");
        error.canceled = err?.code === "ERR_CANCELED" || signal?.aborted === true;
        throw error;
    }
};
