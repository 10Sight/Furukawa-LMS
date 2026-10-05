// Worker-thread half of utils/sheetCompactor.js: folds a meeting's pending patches
// into its stored workbook. Parsing and re-serialising a large workbook takes around
// a second of solid CPU, which on the main thread would stall every other request.
import { parentPort, workerData } from "worker_threads";
import { encodeSheetPayload, decodeSheetPayload, gunzipText } from "./sheetCodec.js";
import { foldPatches } from "./sheetWorkbook.js";

const run = async () => {
    const { text, gz, patches, compress } = workerData;
    const snapshotJson = await decodeSheetPayload(text, gz ? Buffer.from(gz) : null);
    const patchJsons = [];
    for (const patch of patches) patchJsons.push(await gunzipText(Buffer.from(patch)));
    const { json, missingSheets } = foldPatches(snapshotJson, patchJsons);
    const encoded = await encodeSheetPayload(json, { compress });
    return { text: encoded.text, gz: encoded.gz, missingSheets };
};

run().then(
    (result) => parentPort.postMessage({ ok: true, ...result }),
    (error) => parentPort.postMessage({ ok: false, message: error?.message || String(error) })
);
