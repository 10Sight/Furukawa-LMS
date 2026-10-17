// How the grid sits in the space it's given: the zoom that fits a sheet's data to
// the screen in full screen, and how a scroll over the grid is shared between the
// grid and a page that scrolls around it.

export const FIT_MIN_ZOOM = 0.4;
export const FIT_MAX_ZOOM = 2;
const FIT_STEP = 0.05;
// Room kept for the grid's own scrollbars.
const SCROLLBAR_ALLOWANCE = 18;

/**
 * The zoom at which `content` (the used part of the sheet with its headers, in
 * unzoomed pixels) fits `area` (the space for the grid, in screen pixels): the
 * whole of it where that leaves it readable (FIT_MIN_ZOOM or more), otherwise
 * its full width, scrolling down for the rest — a sheet of thousands of rows
 * can't be shown at once, but its columns can. Rounded down to 5%.
 * @param {{ width: number, height: number }} area
 * @param {{ width: number, height: number }} content
 * @returns {number|null} null when there's nothing to measure yet
 */
export const fitZoom = (area, content) => {
    if (!(area?.width > 0) || !(area?.height > 0) || !(content?.width > 0) || !(content?.height > 0)) return null;
    const byWidth = (area.width - SCROLLBAR_ALLOWANCE) / content.width;
    const byHeight = (area.height - SCROLLBAR_ALLOWANCE) / content.height;
    let zoom = Math.min(byWidth, byHeight);
    if (zoom < FIT_MIN_ZOOM) zoom = byWidth;
    zoom = Math.floor(zoom / FIT_STEP + 1e-9) * FIT_STEP;
    return Math.round(Math.min(FIT_MAX_ZOOM, Math.max(FIT_MIN_ZOOM, zoom)) * 100) / 100;
};

/**
 * How many pixels of a downward scroll over the grid the page around it takes
 * first: all of it while the page has that much left to scroll, what's left of
 * the page otherwise, and none once the page is at its end (the grid scrolls).
 * Scrolling up is left to the browser, which scrolls the grid back to its top
 * first and then the page.
 * @param {number} delta the scroll, in pixels (down is positive)
 * @param {number} pageRoom how far the page can still scroll down
 */
export const pageShareOfScroll = (delta, pageRoom) => {
    if (!(delta > 0) || !(pageRoom >= 1)) return 0;
    return Math.min(delta, pageRoom);
};

/** A wheel event's vertical scroll in pixels, whatever unit it came in. */
export const wheelPixels = (event, pageHeight) => {
    if (event.deltaMode === 1) return event.deltaY * 16; // lines
    if (event.deltaMode === 2) return event.deltaY * pageHeight; // pages
    return event.deltaY;
};

/** The nearest element around `el` that scrolls vertically, or the document's scroller. */
export const scrollParentOf = (el) => {
    for (let p = el?.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const overflowY = getComputedStyle(p).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return p;
    }
    return document.scrollingElement || document.documentElement;
};
