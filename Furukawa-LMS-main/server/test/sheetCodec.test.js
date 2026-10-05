// Run with: node --test test/sheetCodec.test.js
import test from "node:test";
import assert from "node:assert/strict";
import zlib from "zlib";
import { encodeSheetPayload, decodeSheetPayload, COMPRESSED_PLACEHOLDER } from "../utils/sheetCodec.js";

const workbookJson = (cellCount) => {
    const cells = {};
    for (let i = 0; i < cellCount; i++) cells[`A${i + 1}`] = { value: `row ${i} — ₹ ${i * 3}`, bold: i % 2 === 0 };
    return JSON.stringify({ sheets: { "Sheet 1": { cells, rowCount: cellCount, columnCount: 15 } }, activeSheet: "Sheet 1" });
};

test("writes plain text when compression is off, whatever the size", async () => {
    const json = workbookJson(5000);
    const encoded = await encodeSheetPayload(json, { compress: false });
    assert.equal(encoded.text, json);
    assert.equal(encoded.gz, null);
    assert.equal(await decodeSheetPayload(encoded.text, encoded.gz), json);
});

test("keeps small payloads as text even when compression is on", async () => {
    const encoded = await encodeSheetPayload("{}", { compress: true });
    assert.equal(encoded.text, "{}");
    assert.equal(encoded.gz, null);
});

test("compresses large payloads and round-trips them exactly", async () => {
    const json = workbookJson(20000);
    const encoded = await encodeSheetPayload(json, { compress: true });
    assert.equal(encoded.text, COMPRESSED_PLACEHOLDER);
    assert.ok(Buffer.isBuffer(encoded.gz));
    assert.ok(encoded.storedBytes < encoded.rawBytes / 4, "expected at least 4x smaller");
    assert.equal(await decodeSheetPayload(encoded.text, encoded.gz), json);
});

test("reads a legacy row: text column only", async () => {
    assert.equal(await decodeSheetPayload('{"a":1}', null), '{"a":1}');
    assert.equal(await decodeSheetPayload('{"a":1}', undefined), '{"a":1}');
    assert.equal(await decodeSheetPayload('{"a":1}', Buffer.alloc(0)), '{"a":1}');
    assert.equal(await decodeSheetPayload(null, null), null);
});

test("rejects a corrupt compressed column instead of returning the placeholder", async () => {
    const gz = zlib.gzipSync("x".repeat(100000));
    gz[20] ^= 0xff;
    await assert.rejects(() => decodeSheetPayload(COMPRESSED_PLACEHOLDER, gz));
});
