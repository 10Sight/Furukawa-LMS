// Run with: node --test test/sheetShapeGeometry.test.js
//
// Line shapes drawn to the size of their box (portal/src/utils/spreadsheets/shapeGeometry.js):
// that an arrowhead is the same size on a long line as on a short one, and what a
// shape's colours may be.
import test from "node:test";
import assert from "node:assert/strict";
import {
    lineArrowGeometry, lineArrowSvg, shapeColor, shapeFillPatch, shapeOutlinePatch, shapeStrokeWidth, SHAPE_OUTLINE_WEIGHTS
} from "../../portal/src/utils/spreadsheets/shapeGeometry.js";

const headSize = ([tip, a, b]) => ({ length: Math.abs(tip[0] - a[0]), width: Math.abs(a[1] - b[1]) });

test("a plain line runs across the middle of its box", () => {
    assert.deepEqual(lineArrowGeometry(160, 40), { shaft: { x1: 2, x2: 158, y: 20 }, heads: [] });
});

test("an arrow's line stops at the base of its head, which points right", () => {
    const { shaft, heads } = lineArrowGeometry(160, 40, { end: true });
    assert.deepEqual(shaft, { x1: 2, x2: 144, y: 20 });
    assert.deepEqual(heads, [[[158, 20], [144, 14], [144, 26]]]);
});

test("a double arrow has a head at each end, pointing outwards", () => {
    const { shaft, heads } = lineArrowGeometry(160, 40, { start: true, end: true });
    assert.deepEqual(shaft, { x1: 16, x2: 144, y: 20 });
    assert.deepEqual(heads, [[[2, 20], [16, 14], [16, 26]], [[158, 20], [144, 14], [144, 26]]]);
});

test("the head is the same size however the box is stretched", () => {
    for (const [width, height] of [[160, 40], [900, 40], [160, 400], [61.5, 47.25]]) {
        const { heads } = lineArrowGeometry(width, height, { end: true });
        assert.deepEqual(headSize(heads[0]), { length: 14, width: 12 }, `${width}x${height}`);
    }
});

test("in a box too short for them the heads shrink, and nothing runs backwards", () => {
    for (const ends of [{ end: true }, { start: true, end: true }]) {
        for (const width of [40, 20, 6, 3, 1, 0]) {
            const { shaft, heads } = lineArrowGeometry(width, 40, ends);
            assert.ok(shaft.x2 >= shaft.x1, `${width}: the line`);
            for (const head of heads) {
                assert.ok(headSize(head).length <= 14 && headSize(head).width <= 12, `${width}: head size`);
                for (const [x] of head) assert.ok(x >= 0 && x <= Math.max(width, 0), `${width}: inside the box`);
            }
        }
    }
    // A box with no height has a line and flat heads, not NaN.
    assert.ok(JSON.stringify(lineArrowGeometry(160, 0, { end: true })).indexOf("null") === -1);
});

test("the markup is one line and a filled polygon per head, in the line's colour", () => {
    assert.equal(lineArrowSvg(160, 40, "#ff0000"), '<line x1="2" y1="20" x2="158" y2="20"/>');
    assert.equal(
        lineArrowSvg(160, 40, "#ff0000", { end: true }),
        '<line x1="2" y1="20" x2="144" y2="20"/><polygon points="158,20 144,14 144,26" fill="#ff0000" stroke-width="1"/>'
    );
    assert.equal(lineArrowSvg(160, 40, "#ff0000", { start: true, end: true }).match(/<polygon/g).length, 2);
});

test("a shape's colour is a hex colour or none, and anything else is the default", () => {
    for (const ok of ["#4472C4", "#abc", "#11223344", "none"]) assert.equal(shapeColor(ok, "#000000"), ok);
    for (const not of [undefined, null, "", "red", "#12", "#gggggg", 7, {}, 'red" onload="x', "url(#a)"]) {
        assert.equal(shapeColor(not, "#2F528F"), "#2F528F", String(not));
    }
});

// --- What the Shape Format tab changes ---

test("a fill or an outline colour is set on its own field", () => {
    const shape = { fill: "#4472C4", stroke: "#2F528F" };
    assert.deepEqual(shapeFillPatch(shape, "#ff0000", false), { fill: "#ff0000" });
    assert.deepEqual(shapeOutlinePatch(shape, "#00ff00", false), { stroke: "#00ff00" });
    assert.deepEqual(shapeFillPatch(shape, "none", false), { fill: "none" });
    assert.deepEqual(shapeOutlinePatch(shape, "none", false), { stroke: "none" });
    // A shape with nothing set yet is on its defaults, which are both there.
    assert.deepEqual(shapeFillPatch({}, "none", false), { fill: "none" });
    assert.deepEqual(shapeOutlinePatch(undefined, "none", false), { stroke: "none" });
});

test("a shape never ends up with neither fill nor outline", () => {
    for (const [before, patch] of [
        [{ fill: "none", stroke: "#111111" }, shapeOutlinePatch({ fill: "none", stroke: "#111111" }, "none", false)],
        [{ fill: "#222222", stroke: "none" }, shapeFillPatch({ fill: "#222222", stroke: "none" }, "none", false)],
    ]) {
        const after = { ...before, ...patch };
        assert.ok(after.fill !== "none" || after.stroke !== "none", JSON.stringify(after));
    }
    assert.deepEqual(shapeOutlinePatch({ fill: "none" }, "none", false), { stroke: "none", fill: undefined });
    assert.deepEqual(shapeFillPatch({ stroke: "none" }, "none", false), { fill: "none", stroke: undefined });
});

test("a line's outline is its one colour; it has no fill and can't lose its colour", () => {
    const line = { fill: "#4472C4" };
    assert.deepEqual(shapeOutlinePatch(line, "#ff0000", true), { fill: "#ff0000" });
    assert.equal(shapeOutlinePatch(line, "none", true), null);
    assert.equal(shapeFillPatch(line, "#ff0000", true), null);
    assert.equal(shapeFillPatch(line, "none", true), null);
});

test("an outline weight is a sensible number of pixels, or the default", () => {
    for (const { value } of SHAPE_OUTLINE_WEIGHTS) assert.equal(shapeStrokeWidth(value, 1.5), value);
    for (const not of [undefined, null, 0, -2, 25, "3", NaN, Infinity]) assert.equal(shapeStrokeWidth(not, 1.5), 1.5, String(not));
});

test("a thicker line gets a larger arrowhead, still inside its box", () => {
    const usual = lineArrowGeometry(160, 40, { end: true });
    assert.deepEqual(lineArrowGeometry(160, 40, { end: true, weight: 1 }), usual, "a thinner line keeps the usual head");
    const thick = lineArrowGeometry(160, 40, { end: true, weight: 6 });
    assert.ok(headSize(thick.heads[0]).length > headSize(usual.heads[0]).length);
    assert.ok(headSize(thick.heads[0]).width > headSize(usual.heads[0]).width);
    for (const [, y] of thick.heads[0]) assert.ok(y >= 0 && y <= 40);
    assert.match(lineArrowSvg(160, 40, "#ff0000", { end: true, weight: 6 }), /^<line [^>]*\/><polygon /);
});
