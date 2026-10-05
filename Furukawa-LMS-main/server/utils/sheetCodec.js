import zlib from "zlib";
import { promisify } from "util";
import ENV from "../configs/env.config.js";

// A workbook is stored as JSON text in an NVARCHAR(MAX) column, which SQL Server keeps
// as UTF-16: a 50 MB workbook costs ~100 MB on the wire to the database, in the data
// file and in the transaction log, on every save. Large workbooks are gzipped into a
// VARBINARY(MAX) column instead; small ones stay as plain text where they are still
// readable in a query window.
//
// Reading always understands both forms. Writing the compressed form can be turned
// off (SHEET_COMPRESSION_WRITE=false), which is what makes it possible to go back to
// a release that only knows the text column: services/sheetStorageMaintenance.js
// converts every existing row to match the setting.

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Below this, compression saves nothing worth the CPU ('{}' and chart-only payloads).
const MIN_COMPRESS_BYTES = 32 * 1024;
// Refuse to inflate past this — guards against a corrupt blob exhausting memory.
const MAX_INFLATED_BYTES = 512 * 1024 * 1024;
// Level 3 is several times faster than the default 6 for a few percent more bytes.
const GZIP_LEVEL = 3;

// What the text column holds when the workbook lives in the compressed column.
export const COMPRESSED_PLACEHOLDER = "{}";

/**
 * Splits a workbook's JSON into the values for the text column and the compressed
 * column. Both are always returned so a write sets the pair together and can never
 * leave one of them stale: exactly one holds the workbook, the other is the
 * placeholder / null.
 * @param {string} json
 * @param {{ compress?: boolean }} [options] defaults to the SHEET_COMPRESSION_WRITE flag
 * @returns {Promise<{ text: string, gz: Buffer|null, rawBytes: number, storedBytes: number }>}
 */
export const encodeSheetPayload = async (json, { compress = ENV.SHEET_COMPRESSION_WRITE } = {}) => {
    const rawBytes = Buffer.byteLength(json, "utf8");
    if (!compress || rawBytes < MIN_COMPRESS_BYTES) {
        // NVARCHAR stores two bytes per UTF-16 code unit.
        return { text: json, gz: null, rawBytes, storedBytes: json.length * 2 };
    }
    const gz = await gzip(json, { level: GZIP_LEVEL });
    return { text: COMPRESSED_PLACEHOLDER, gz, rawBytes, storedBytes: gz.length };
};

// Unconditional gzip of a short text (a sheet patch), and its inverse.
export const gzipText = (text) => gzip(text, { level: GZIP_LEVEL });
export const gunzipText = async (gz) => (await gunzip(gz, { maxOutputLength: MAX_INFLATED_BYTES })).toString("utf8");

/**
 * The workbook JSON for a stored row: the compressed column when it has content,
 * otherwise the text column as is.
 * @param {string|null|undefined} text
 * @param {Buffer|null|undefined} gz
 * @returns {Promise<string|null|undefined>}
 */
export const decodeSheetPayload = async (text, gz) => {
    if (!gz || gz.length === 0) return text;
    const raw = await gunzip(gz, { maxOutputLength: MAX_INFLATED_BYTES });
    return raw.toString("utf8");
};
