// Run with: node --test test/levelClassification.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { classifyOperatorLevel, normalizeLevel } from "../utils/levelClassification.js";

const LEVELS = [
    { name: "L1", order: 0 },
    { name: "L2", order: 1 },
    { name: "L3", order: 2 },
];

test("unevaluated operators are unskilled", () => {
    const r = classifyOperatorLevel({ currentSkill: null, currentLevel: null, subSectionId: 5 }, LEVELS);
    assert.deepEqual(r, { levelName: null, levelOrder: 0, isSkilled: false, unclassified: false });
});

test("order 0 is unskilled, higher orders are skilled", () => {
    assert.equal(classifyOperatorLevel({ currentLevel: "L1" }, LEVELS).isSkilled, false);
    assert.equal(classifyOperatorLevel({ currentLevel: "L2" }, LEVELS).isSkilled, true);
    assert.equal(classifyOperatorLevel({ currentLevel: "L3" }, LEVELS).levelOrder, 2);
});

test("a level beyond the config reads its number (L4 on an L1–L3 config)", () => {
    const r = classifyOperatorLevel({ currentLevel: "L4" }, LEVELS);
    assert.equal(r.isSkilled, true);
    assert.equal(r.levelOrder, 3);
    assert.equal(r.unclassified, false);
});

test("level names are normalized (case, spaces, every dash)", () => {
    assert.equal(normalizeLevel(" l-2 "), "L2");
    assert.equal(normalizeLevel("L--3"), "L3");
    assert.equal(classifyOperatorLevel({ currentLevel: "l-2 " }, LEVELS).isSkilled, true);
});

test("the assigned sub-section's level wins over other stations and currentLevel", () => {
    const op = { currentSkill: { "3": "L3", "7": "L1" }, currentLevel: "L2", subSectionId: 7 };
    assert.equal(classifyOperatorLevel(op, LEVELS).levelName, "L1");
    assert.equal(classifyOperatorLevel(op, LEVELS).isSkilled, false);
});

test("no entry for the assigned sub-section falls back to currentLevel, not another station", () => {
    const op = { currentSkill: { "3": "L3" }, currentLevel: "L1", subSectionId: 7 };
    assert.equal(classifyOperatorLevel(op, LEVELS).levelName, "L1");
    const noLevel = { currentSkill: { "3": "L3" }, currentLevel: null, subSectionId: 7 };
    assert.equal(classifyOperatorLevel(noLevel, LEVELS).isSkilled, false);
});

test("currentSkill may arrive as a JSON string or invalid JSON", () => {
    assert.equal(classifyOperatorLevel({ currentSkill: '{"7":"L2"}', subSectionId: 7 }, LEVELS).isSkilled, true);
    assert.equal(classifyOperatorLevel({ currentSkill: "{bad", currentLevel: "L3", subSectionId: 7 }, LEVELS).isSkilled, true);
});

test("an unrecognised level is unskilled and flagged", () => {
    const r = classifyOperatorLevel({ currentLevel: "Trainee" }, LEVELS);
    assert.equal(r.isSkilled, false);
    assert.equal(r.unclassified, true);
});

test("custom level names match the config by name and order", () => {
    const levels = [{ name: "Beginner", order: 0 }, { name: "Expert", order: 1 }];
    assert.equal(classifyOperatorLevel({ currentLevel: "expert" }, levels).isSkilled, true);
    assert.equal(classifyOperatorLevel({ currentLevel: "Beginner" }, levels).isSkilled, false);
});
