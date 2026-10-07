// Geometry for rotating the pictures and shapes that float over a sheet.
//
// A media item's `rotation` is whole degrees clockwise, 0-359, about the centre of its
// box; the box itself (anchor cell, offset, width, height) is stored unrotated. Screen
// coordinates have y pointing down, so a clockwise turn by t takes a point (x, y)
// measured from the centre to (x cos t - y sin t, x sin t + y cos t) — the same
// convention as CSS `rotate()` and a canvas's `rotate()`.

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Any angle as whole degrees in 0-359. Anything that isn't a number is 0. */
export const normalizeAngle = (degrees) => {
    const whole = Math.round(Number(degrees) || 0) % 360;
    return whole < 0 ? whole + 360 : whole + 0; // + 0: never -0
};

const QUARTER_TURN_PULL = 3; // degrees within which a free rotation settles on 0/90/180/270
const STEP = 15; // with Shift held

/**
 * The angle a rotation gesture lands on: a multiple of 15 degrees when `step` is set
 * (Shift held), otherwise the angle as dragged, pulled onto a quarter turn when it is
 * within a few degrees of one.
 */
export const snapAngle = (degrees, { step = false } = {}) => {
    if (step) return normalizeAngle(Math.round(degrees / STEP) * STEP);
    const angle = normalizeAngle(degrees);
    const quarter = Math.round(angle / 90) * 90;
    return Math.abs(angle - quarter) <= QUARTER_TURN_PULL ? normalizeAngle(quarter) : angle;
};

/**
 * Where a pointer is around a centre, in degrees clockwise from straight up. Only
 * differences between two of these are meaningful to a gesture: the turn made since it
 * began.
 */
export const pointerAngle = (centerX, centerY, pointerX, pointerY) =>
    (Math.atan2(pointerX - centerX, centerY - pointerY) * 180) / Math.PI;

/**
 * A movement on screen as the rotated item sees it: along its own width (dx) and
 * height (dy). Dragging an edge or corner of a rotated box has to be measured this way.
 */
export const toLocalDelta = (dx, dy, degrees) => {
    const t = toRadians(degrees);
    const cos = Math.cos(t), sin = Math.sin(t);
    return { dx: dx * cos + dy * sin, dy: -dx * sin + dy * cos };
};

/**
 * A rotated box given a new size with its top-left corner held where it is on screen.
 * The box turns about its centre, and a new size moves the centre, so the unrotated
 * `left`/`top` it is stored with have to move too or the whole picture would slide
 * as it is resized.
 * @param {{ left: number, top: number, width: number, height: number }} box unrotated
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export const resizeRotatedBox = (box, width, height, degrees) => {
    const t = toRadians(degrees);
    const cos = Math.cos(t), sin = Math.sin(t);
    const turn = (x, y) => [x * cos - y * sin, x * sin + y * cos];
    const [cornerX, cornerY] = turn(-box.width / 2, -box.height / 2);
    const pinnedX = box.left + box.width / 2 + cornerX;
    const pinnedY = box.top + box.height / 2 + cornerY;
    const [toCenterX, toCenterY] = turn(width / 2, height / 2);
    return { left: pinnedX + toCenterX - width / 2, top: pinnedY + toCenterY - height / 2, width, height };
};

/** The size of the upright rectangle a rotated width x height box fits in. */
export const rotatedBounds = (width, height, degrees) => {
    const t = toRadians(degrees);
    const cos = Math.abs(Math.cos(t)), sin = Math.abs(Math.sin(t));
    return { width: width * cos + height * sin, height: width * sin + height * cos };
};
