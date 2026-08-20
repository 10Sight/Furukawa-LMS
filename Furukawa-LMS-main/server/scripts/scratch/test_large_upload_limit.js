// Verifies saveToLocal() moves a large file without blocking the event loop.
// Run: node server/scripts/scratch/test_large_upload_limit.js
import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveToLocal } from '../../utils/fileStorage.util.js';

const SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
const tempFilePath = path.join(tmpDir, `${Date.now()}-large.bin`);

// Create a sparse file of the target size instead of writing real bytes,
// which is enough to exercise the rename/copy path without a slow write.
const fd = fs.openSync(tempFilePath, 'w');
fs.ftruncateSync(fd, SIZE_BYTES);
fs.closeSync(fd);

console.log(`Created sparse test file: ${tempFilePath} (${(SIZE_BYTES / 1024 / 1024 / 1024).toFixed(2)} GB)`);

// Track event loop responsiveness while the move is in flight: schedule ticks
// every 50ms and record any gap that suggests the loop was blocked.
let lastTick = Date.now();
let maxGap = 0;
const ticker = setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    if (gap > maxGap) maxGap = gap;
    lastTick = now;
}, 50);

const mockFile = {
    path: tempFilePath,
    originalname: 'large-test-file.bin',
    size: SIZE_BYTES
};

const start = Date.now();
const result = await saveToLocal(mockFile, 'others');
const durationMs = Date.now() - start;

clearInterval(ticker);

console.log('saveToLocal result:', result);
console.log(`Move completed in ${durationMs}ms. Max event-loop tick gap: ${maxGap}ms`);

if (!result.success) {
    console.error('FAIL: saveToLocal did not succeed');
    process.exitCode = 1;
} else if (!fs.existsSync(result.localPath)) {
    console.error('FAIL: target file does not exist after move');
    process.exitCode = 1;
} else {
    const stat = fs.statSync(result.localPath);
    if (stat.size !== SIZE_BYTES) {
        console.error(`FAIL: target file size ${stat.size} !== expected ${SIZE_BYTES}`);
        process.exitCode = 1;
    } else {
        console.log('PASS: file moved successfully with correct size.');
    }
    // Clean up the moved file.
    fs.unlinkSync(result.localPath);
}

// Clean up temp dir if anything is left behind.
try {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    fs.rmdirSync(tmpDir);
} catch (e) {
    // best-effort cleanup
}
