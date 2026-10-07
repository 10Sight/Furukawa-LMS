import { Worker } from "worker_threads";
import ENV from "../configs/env.config.js";
import logger from "../logger/winston.logger.js";
import { encodeSheetPayload, decodeSheetPayload, gunzipText } from "./sheetCodec.js";
import { foldPatches } from "./sheetWorkbook.js";

// Folds a meeting's pending patches into a new stored workbook.
//
// The work is done on a worker thread so the server keeps answering other requests
// meanwhile. If a worker can't be started or fails, the same work is done here on the
// main thread instead — slower for everyone for a moment, but the fold still happens.

const WORKER_URL = new URL("./sheetCompactWorker.js", import.meta.url);
// A fold that takes longer than this is abandoned and done inline.
const WORKER_TIMEOUT_MS = 5 * 60 * 1000;

const foldInline = async ({ text, gz, patches, compress }) => {
    const snapshotJson = await decodeSheetPayload(text, gz);
    const patchJsons = [];
    for (const patch of patches) patchJsons.push(await gunzipText(patch));
    const { json, missingSheets } = foldPatches(snapshotJson, patchJsons);
    const encoded = await encodeSheetPayload(json, { compress });
    return { text: encoded.text, gz: encoded.gz, missingSheets };
};

const foldInWorker = (input) => new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { workerData: input });
    let settled = false;
    const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
    };
    const timer = setTimeout(() => {
        worker.terminate();
        finish(reject, new Error("timed out"));
    }, WORKER_TIMEOUT_MS);
    worker.once("message", (message) => {
        if (!message?.ok) return finish(reject, new Error(message?.message || "worker failed"));
        // Binary values arrive as plain Uint8Arrays; the database driver wants Buffers.
        finish(resolve, { text: message.text, gz: message.gz ? Buffer.from(message.gz) : null, missingSheets: message.missingSheets });
    });
    worker.once("error", (error) => finish(reject, error));
    worker.once("exit", (code) => finish(reject, new Error(`worker exited with code ${code}`)));
});

/**
 * @param {{ text: string|null, gz: Buffer|null, patches: Buffer[], compress?: boolean }} input
 *   the stored workbook (text column and compressed column) and its pending patches,
 *   gzipped as stored, oldest first
 * @returns {Promise<{ text: string, gz: Buffer|null, missingSheets: string[], inWorker: boolean }>}
 *   the values for the two columns of the new stored workbook
 */
export const foldStoredPatches = async ({ text, gz, patches, compress = ENV.SHEET_COMPRESSION_WRITE }) => {
    const input = { text, gz, patches, compress };
    if (ENV.SHEET_COMPACT_IN_WORKER) {
        try {
            return { ...(await foldInWorker(input)), inWorker: true };
        } catch (error) {
            logger.warn(`[SHEET PATCH] worker fold failed (${error.message}); folding on the main thread instead`);
        }
    }
    return { ...(await foldInline(input)), inWorker: false };
};
