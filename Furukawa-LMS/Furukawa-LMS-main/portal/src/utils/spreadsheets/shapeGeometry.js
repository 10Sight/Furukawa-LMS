// Line shapes that are drawn to the size of their box.
//
// Most shapes are one drawing on a 100x100 canvas, stretched to whatever box the
// shape is given. That won't do for a line with an arrowhead: stretched, the head
// of a long flat arrow would come out long and flat too. So these are worked out
// in the box's own pixels — a straight line through its middle, left to right,
// with a head of the same size however long the line is. (To point it anywhere
// else the shape is turned, like any other.)

// The width of the line itself, and of a closed shape's outline, unless the shape
// was given one of its own (`item.strokeWidth`).
export const LINE_STROKE_WIDTH = 2.5;
export const OUTLINE_STROKE_WIDTH = 1.5;
const HEAD_LENGTH = 14;
const HEAD_HALF_WIDTH = 6;
// Kept clear at each end, so the line's round cap and the head's tip stay inside the box.
const END_MARGIN = 2;

const round = (n) => Math.round(n * 100) / 100;

/**
 * A straight line across a `width` x `height` box, with an arrowhead at its right
 * end (`end`), its left end (`start`), both or neither.
 * @returns {{ shaft: { x1, x2, y }, heads: number[][][] }} the line to draw, which
 *   stops at the base of each head, and each head as its three [x, y] corners, tip
 *   first. In a box too short for them the heads shrink, down to nothing. A line
 *   thicker than the usual one (`weight`) gets heads that much larger.
 */
export const lineArrowGeometry = (width, height, { start = false, end = false, weight = LINE_STROKE_WIDTH } = {}) => {
    const y = round(Math.max(0, height) / 2);
    const left = Math.min(END_MARGIN, Math.max(0, width) / 2);
    const right = Math.max(left, width - END_MARGIN);
    const count = (start ? 1 : 0) + (end ? 1 : 0);
    // The heads never take more than two thirds of the line between them.
    const scale = Math.max(1, weight / LINE_STROKE_WIDTH);
    const headLength = count ? Math.min(HEAD_LENGTH * scale, ((right - left) * 2) / 3 / count) : 0;
    const halfWidth = Math.min(HEAD_HALF_WIDTH * (headLength / HEAD_LENGTH), y);
    const headAt = (tip, direction) => [
        [round(tip), y],
        [round(tip - direction * headLength), round(y - halfWidth)],
        [round(tip - direction * headLength), round(y + halfWidth)],
    ];
    const heads = [];
    if (headLength > 0 && start) heads.push(headAt(left, -1));
    if (headLength > 0 && end) heads.push(headAt(right, 1));
    return {
        shaft: { x1: round(start ? left + headLength : left), x2: round(end ? right - headLength : right), y },
        heads,
    };
};

/** lineArrowGeometry as SVG markup, in `color`. */
export const lineArrowSvg = (width, height, color, ends) => {
    const { shaft, heads } = lineArrowGeometry(width, height, ends);
    return `<line x1="${shaft.x1}" y1="${shaft.y}" x2="${shaft.x2}" y2="${shaft.y}"/>`
        + heads.map((head) => `<polygon points="${head.map((point) => point.join(",")).join(" ")}" fill="${color}" stroke-width="1"/>`).join("");
};

const SHAPE_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * A colour a shape was given, as it can be written into the shape's drawing: a hex
 * colour or "none". Anything else — nothing at all, or something that isn't a
 * colour — is `fallback`.
 */
export const shapeColor = (value, fallback) => (value === "none" || SHAPE_COLOR_RE.test(String(value ?? "")) ? value : fallback);

// --- What the Shape Format tab changes ---

// The outline weights on offer: Excel's points, and the pixels each is drawn at.
export const SHAPE_OUTLINE_WEIGHTS = [
    { label: "\u00be pt", value: 1 },
    { label: "1\u00bd pt", value: 2 },
    { label: "2\u00bc pt", value: 3 },
    { label: "3 pt", value: 4 },
    { label: "4\u00bd pt", value: 6 },
];

/** A shape's outline width in pixels, or `fallback` when it has none of its own. */
export const shapeStrokeWidth = (value, fallback) => (typeof value === "number" && value > 0 && value <= 24 ? value : fallback);

// A shape is never left with neither fill nor outline — there would be nothing of it
// to see or to click — so taking one away gives the other back. A line has no inside:
// its one colour is kept in `fill`, and is what its "outline" means.

/**
 * The change that gives a shape the fill `color` (a hex colour, or "none").
 * null when it can't be done: a line has nothing to fill.
 */
export const shapeFillPatch = (item, color, isLine) => {
    if (isLine) return null;
    if (color !== "none") return { fill: color };
    return item?.stroke === "none" ? { fill: "none", stroke: undefined } : { fill: "none" };
};

/**
 * The change that gives a shape the outline `color` (a hex colour, or "none").
 * null when it can't be done: a line without its colour would be no line at all.
 */
export const shapeOutlinePatch = (item, color, isLine) => {
    if (isLine) return color === "none" ? null : { fill: color };
    if (color !== "none") return { stroke: color };
    return item?.fill === "none" ? { stroke: "none", fill: undefined } : { stroke: "none" };
};
