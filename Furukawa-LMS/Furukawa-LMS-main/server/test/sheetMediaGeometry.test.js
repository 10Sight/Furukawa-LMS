// Run with: node --test test/sheetMediaGeometry.test.js
//
// Rotating floating pictures and shapes (portal/src/utils/spreadsheets/mediaGeometry.js):
// the angle a drag lands on, and that a rotated picture is resized without sliding.
import test from "node:test";
import assert from "node:assert/strict";
import {
    normalizeAngle, snapAngle, pointerAngle, toLocalDelta, resizeRotatedBox, rotatedBounds
} from "../../portal/src/utils/spreadsheets/mediaGeometry.js";

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message || ""} expected ${expected}, got ${actual}`);
const turn = (x, y, degrees) => {
    const t = (degrees * Math.PI) / 180;
    return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
};
// Where a corner of a rotated box is on screen; (-1, -1) is the top-left, (1, 1) the bottom-right.
const corner = (box, degrees, sx, sy) => {
    const [x, y] = turn((sx * box.width) / 2, (sy * box.height) / 2, degrees);
    return [box.left + box.width / 2 + x, box.top + box.height / 2 + y];
};

test("an angle is stored as whole degrees from 0 to 359", () => {
    for (const [given, stored] of [[0, 0], [360, 0], [-0, 0], [45.4, 45], [45.5, 46], [-90, 270], [725, 5], [-725, 355], [359.6, 0]]) {
        assert.equal(normalizeAngle(given), stored, `${given}`);
        assert.ok(Object.is(normalizeAngle(given), stored), `${given} must not be -0`);
    }
    for (const junk of [undefined, null, "", "abc", NaN, {}]) assert.equal(normalizeAngle(junk), 0);
    assert.equal(normalizeAngle("90"), 90);
});

test("a free rotation settles on a quarter turn when it is close to one", () => {
    assert.equal(snapAngle(2), 0);
    assert.equal(snapAngle(357), 0);
    assert.equal(snapAngle(-2), 0);
    assert.equal(snapAngle(88), 90);
    assert.equal(snapAngle(183), 180);
    assert.equal(snapAngle(267.2), 270);
    assert.equal(snapAngle(4), 4);
    assert.equal(snapAngle(86), 86);
    assert.equal(snapAngle(45), 45);
});

test("with Shift held a rotation moves in steps of 15 degrees", () => {
    assert.equal(snapAngle(7, { step: true }), 0);
    assert.equal(snapAngle(8, { step: true }), 15);
    assert.equal(snapAngle(50, { step: true }), 45);
    assert.equal(snapAngle(-20, { step: true }), 345);
    assert.equal(snapAngle(353, { step: true }), 0);
});

test("the pointer's angle is measured clockwise from straight up", () => {
    near(pointerAngle(100, 100, 100, 50), 0, "above");
    near(pointerAngle(100, 100, 150, 100), 90, "right");
    near(pointerAngle(100, 100, 50, 100), -90, "left");
    near(Math.abs(pointerAngle(100, 100, 100, 150)), 180, "below");
    near(pointerAngle(100, 100, 150, 50), 45, "up and right");
    // A gesture turns the picture by the difference, wherever the handle was grabbed.
    const grabbed = pointerAngle(0, 0, 3, -40), released = pointerAngle(0, 0, 40, 3);
    assert.equal(snapAngle(30 + released - grabbed), 120);
});

test("a drag is measured along the rotated picture's own sides", () => {
    for (const [degrees, dx, dy] of [[0, 10, 5], [90, 5, -10], [180, -10, -5], [270, -5, 10]]) {
        const local = toLocalDelta(10, 5, degrees);
        near(local.dx, dx, `${degrees} dx`);
        near(local.dy, dy, `${degrees} dy`);
    }
    // Turning a movement into the picture's axes and back gives the same movement.
    for (const degrees of [17, 133, 301]) {
        const local = toLocalDelta(12, -7, degrees);
        const [x, y] = turn(local.dx, local.dy, degrees);
        near(x, 12);
        near(y, -7);
    }
});

test("resizing a rotated picture keeps its top-left corner where it is", () => {
    const box = { left: 200, top: 120, width: 280, height: 200 };
    for (const degrees of [0, 30, 90, 137, 180, 270, 359]) {
        const before = corner(box, degrees, -1, -1);
        const resized = resizeRotatedBox(box, 400, 90, degrees);
        assert.equal(resized.width, 400);
        assert.equal(resized.height, 90);
        const after = corner(resized, degrees, -1, -1);
        near(after[0], before[0], `${degrees} x`);
        near(after[1], before[1], `${degrees} y`);
    }
    // Unrotated, that is simply the same left and top.
    assert.deepEqual(resizeRotatedBox(box, 400, 90, 0), { left: 200, top: 120, width: 400, height: 90 });
    // The corner being dragged ends up where the drag put it.
    const dragged = toLocalDelta(35, 20, 60);
    const grown = resizeRotatedBox(box, box.width + dragged.dx, box.height + dragged.dy, 60);
    const was = corner(box, 60, 1, 1), now = corner(grown, 60, 1, 1);
    near(now[0] - was[0], 35);
    near(now[1] - was[1], 20);
});

test("the upright rectangle around a rotated picture", () => {
    const check = (degrees, width, height) => {
        const bounds = rotatedBounds(280, 200, degrees);
        near(bounds.width, width, `${degrees} width`);
        near(bounds.height, height, `${degrees} height`);
    };
    check(0, 280, 200);
    check(90, 200, 280);
    check(180, 280, 200);
    check(270, 200, 280);
    const diagonal = (280 + 200) * Math.SQRT1_2;
    check(45, diagonal, diagonal);
});
