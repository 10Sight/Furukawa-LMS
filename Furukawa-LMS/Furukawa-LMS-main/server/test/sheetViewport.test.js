// Run with: node --test test/sheetViewport.test.js
//
// How the grid sits in its space (admin/src/utils/spreadsheets/gridViewport.js): the
// zoom full screen fits a sheet's data to the screen at, and how a scroll over the
// grid is shared with the page around it on a meeting's page.
import test from "node:test";
import assert from "node:assert/strict";
import { fitZoom, pageShareOfScroll, wheelPixels, FIT_MIN_ZOOM, FIT_MAX_ZOOM } from "../../admin/src/utils/spreadsheets/gridViewport.js";

test("a small table is enlarged to fill a big screen, up to the most zoom allows", () => {
    // 10 columns x 20 rows of the grid's default size, headers included.
    const content = { width: 40 + 10 * 96, height: 24 + 20 * 28 };
    assert.equal(fitZoom({ width: 1920, height: 900 }, content), 1.5);
    assert.equal(fitZoom({ width: 3840, height: 2000 }, content), FIT_MAX_ZOOM);
});

test("a wide table is shrunk to fit a laptop or phone, rounded down to 5%", () => {
    const content = { width: 40 + 30 * 96, height: 24 + 15 * 28 };
    assert.equal(fitZoom({ width: 1366, height: 600 }, content), 0.45);
    // Too wide to fit a phone at a readable size: shown at the smallest fit zoom.
    assert.equal(fitZoom({ width: 390, height: 700 }, content), FIT_MIN_ZOOM);
});

test("a sheet of thousands of rows is fitted to its width and scrolls down", () => {
    const content = { width: 40 + 8 * 96, height: 24 + 5000 * 28 };
    // Fitting all of it would need far less than FIT_MIN_ZOOM; its 8 columns fit instead.
    assert.equal(fitZoom({ width: 1600, height: 900 }, content), 1.95);
});

test("nothing to fit until both the space and the data have been measured", () => {
    assert.equal(fitZoom({ width: 0, height: 900 }, { width: 500, height: 500 }), null);
    assert.equal(fitZoom({ width: 900, height: 900 }, null), null);
});

test("scrolling down moves the page until it's at its end, then the grid", () => {
    assert.equal(pageShareOfScroll(100, 500), 100, "the page takes all of it");
    assert.equal(pageShareOfScroll(100, 30), 30, "the page takes what it has left");
    assert.equal(pageShareOfScroll(100, 0), 0, "the page is at its end: the grid scrolls");
    assert.equal(pageShareOfScroll(100, 0.4), 0, "a fraction of a pixel left counts as the end");
    assert.equal(pageShareOfScroll(-100, 500), 0, "scrolling up is the browser's own");
});

test("a wheel's lines and pages are counted in pixels", () => {
    assert.equal(wheelPixels({ deltaMode: 0, deltaY: 53 }, 800), 53);
    assert.equal(wheelPixels({ deltaMode: 1, deltaY: 3 }, 800), 48);
    assert.equal(wheelPixels({ deltaMode: 2, deltaY: 1 }, 800), 800);
});
