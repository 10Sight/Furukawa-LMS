import test from 'node:test';
import assert from 'node:assert/strict';

// Helper logic mimicking PDCASheet column width auto-adjustment
function computeImageColumnWidth(rows, field, imagesField, imageDimensions = {}) {
  const DEFAULT_IMAGE_COL_WIDTH = 140;
  const MIN_WIDTH = 180;
  const MAX_WIDTH = 280;

  const hasAnyImages = (rows || []).some(row => {
    const list = Array.isArray(row?.[imagesField])
      ? row[imagesField]
      : (row?.[field] ? [row[field]] : []);
    return list.length > 0;
  });

  if (!hasAnyImages) {
    return DEFAULT_IMAGE_COL_WIDTH;
  }

  let maxRatio = 1.33; // Default 4:3
  (rows || []).forEach(row => {
    const list = Array.isArray(row?.[imagesField])
      ? row[imagesField]
      : (row?.[field] ? [{ url: row[field] }] : []);
    list.forEach(img => {
      const url = typeof img === 'string' ? img : img?.url;
      const dims = url ? imageDimensions[url] : null;
      if (dims && dims.width > 0 && dims.height > 0) {
        const ratio = dims.width / dims.height;
        if (ratio > maxRatio) {
          maxRatio = ratio;
        }
      }
    });
  });

  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(135 * maxRatio)));
}

// Helper formatting the hover badge text
function formatHoverViewBadge(count) {
  const photoText = `${count} ${count === 1 ? 'Photo' : 'Photos'}`;
  return {
    action: 'View',
    countText: photoText,
    fullOverlayLabel: `View • ${photoText}`
  };
}

// Helper checking cell class
function getImageCellTdClass(hasImages) {
  return hasImages ? 'p-0 overflow-hidden' : 'p-1';
}

test('Image Column Width: returns compact 140px when no images uploaded in any row', () => {
  const rows = [
    { id: 1, imageBefore: '', imagesBefore: [] },
    { id: 2, imageBefore: null, imagesBefore: [] }
  ];
  const width = computeImageColumnWidth(rows, 'imageBefore', 'imagesBefore');
  assert.equal(width, 140);
});

test('Image Column Width: auto-adjusts width between 180px and 280px when images uploaded', () => {
  const rows = [
    { id: 1, imageBefore: 'http://example.com/img1.png', imagesBefore: [{ url: 'http://example.com/img1.png' }] }
  ];
  const dims = {
    'http://example.com/img1.png': { width: 1920, height: 1080 } // 16:9 ratio = 1.777
  };
  const width = computeImageColumnWidth(rows, 'imageBefore', 'imagesBefore', dims);
  // 135 * 1.777 ~ 240px
  assert.ok(width >= 180 && width <= 280);
  assert.equal(width, Math.round(135 * (1920 / 1080)));
});

test('Image Column Width: clamps ultra-wide aspect ratios to maximum 280px', () => {
  const rows = [
    { id: 1, imageBefore: 'http://example.com/panoramic.png', imagesBefore: [{ url: 'http://example.com/panoramic.png' }] }
  ];
  const dims = {
    'http://example.com/panoramic.png': { width: 3000, height: 600 } // ratio = 5.0
  };
  const width = computeImageColumnWidth(rows, 'imageBefore', 'imagesBefore', dims);
  assert.equal(width, 280);
});

test('Image Cell: renders borderless and edge-to-edge (p-0 overflow-hidden) when images exist', () => {
  const classWithImage = getImageCellTdClass(true);
  assert.equal(classWithImage, 'p-0 overflow-hidden');

  const classWithoutImage = getImageCellTdClass(false);
  assert.equal(classWithoutImage, 'p-1');
});

test('Hover Overlay: shows "View" and image count formatted correctly for single and multiple images', () => {
  const single = formatHoverViewBadge(1);
  assert.equal(single.action, 'View');
  assert.equal(single.countText, '1 Photo');
  assert.equal(single.fullOverlayLabel, 'View • 1 Photo');

  const multiple = formatHoverViewBadge(3);
  assert.equal(multiple.action, 'View');
  assert.equal(multiple.countText, '3 Photos');
  assert.equal(multiple.fullOverlayLabel, 'View • 3 Photos');
});
