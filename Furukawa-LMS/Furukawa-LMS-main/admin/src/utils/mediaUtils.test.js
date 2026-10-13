import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMediaUrl } from './mediaUtils.js';

test('getMediaUrl handles empty or falsy values', () => {
  assert.equal(getMediaUrl(''), '');
  assert.equal(getMediaUrl(null), '');
  assert.equal(getMediaUrl(undefined), '');
});

test('getMediaUrl preserves absolute HTTP/HTTPS URLs', () => {
  assert.equal(getMediaUrl('https://example.com/image.png'), 'https://example.com/image.png');
  assert.equal(getMediaUrl('http://cdn.com/photo.jpg'), 'http://cdn.com/photo.jpg');
});

test('getMediaUrl preserves base64 data URLs and blob URLs', () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal(getMediaUrl(dataUrl), dataUrl);

  const blobUrl = 'blob:http://localhost:5173/1234-5678';
  assert.equal(getMediaUrl(blobUrl), blobUrl);
});

test('getMediaUrl resolves relative /uploads paths to backend URL', () => {
  const resolved = getMediaUrl('/uploads/1791881247892-739704432.png');
  assert.ok(resolved.endsWith('/uploads/1791881247892-739704432.png'));
  assert.ok(resolved.startsWith('http'));
});

test('getMediaUrl resolves relative uploads/ without leading slash', () => {
  const resolved = getMediaUrl('uploads/1791881247892-739704432.png');
  assert.ok(resolved.endsWith('/uploads/1791881247892-739704432.png'));
  assert.ok(resolved.startsWith('http'));
});
