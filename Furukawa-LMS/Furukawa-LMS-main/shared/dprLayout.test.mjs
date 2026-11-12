import test from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_DPR_PRESENTATION,
    resolveDprPresentation,
    validateDprPresentation,
    mergeDprPresentation,
} from "./dprLayout.js";

const clone = (v) => JSON.parse(JSON.stringify(v));

test("resolve fills every presentation field from defaults", () => {
    const p = resolveDprPresentation(null);
    assert.equal(p.delivery.title, DEFAULT_DPR_PRESENTATION.delivery.title);
    assert.equal(p.delivery.rows, 6);
    assert.equal(p.shiftComm.rows, 3);
    assert.equal(p.footer.signatureTitle, "Approvals & Signatures");
    assert.equal(p.downTime.rows.length, DEFAULT_DPR_PRESENTATION.downTime.rows.length);
});

test("resolve keeps stored labels by key and ignores unknown rows", () => {
    const p = resolveDprPresentation({
        downTime: {
            rows: [
                { key: "tubeShortage", label: "Tube short" },
                { key: "bogus", label: "Should vanish" },
                { label: "Inspection delays", children: [{ key: "delayInInspectionDim", label: "Dimension" }] },
            ],
        },
        quality: { sections: [{ name: "internalDefect", label: "Inline Defect", fields: ["Qty", "NG"] }] },
    });
    const flat = p.downTime.rows.flatMap((r) => r.children || [r]);
    assert.equal(flat.find((r) => r.key === "tubeShortage").label, "Tube short");
    assert.equal(flat.find((r) => r.key === "delayInInspectionDim").label, "Dimension");
    assert.ok(!flat.some((r) => r.key === "bogus"));
    assert.equal(p.downTime.rows.find((r) => r.children?.[0]?.key === "delayInInspectionDim").label, "Inspection delays");
    const internal = p.quality.sections.find((s) => s.name === "internalDefect");
    assert.deepEqual(internal.fields, ["Qty", "NG", "PPM"]);
    assert.equal(internal.label, "Inline Defect");
});

test("validate accepts text-only edits and rejects shape changes", () => {
    const current = resolveDprPresentation(null);
    const textOnly = clone(current);
    textOnly.delivery.headers[1].text = "WH Code";
    textOnly.downTime.rows[0].label = "Charging shortage";
    textOnly.delivery.rows = 8;
    assert.deepEqual(validateDprPresentation(textOnly, current), []);

    const addedHeader = clone(current);
    addedHeader.delivery.headers.push({ text: "Extra" });
    assert.ok(validateDprPresentation(addedHeader, current).length > 0);

    const removedRow = clone(current);
    removedRow.downTime.rows.pop();
    assert.ok(validateDprPresentation(removedRow, current).length > 0);

    const badCount = clone(current);
    badCount.shiftComm.rows = 0;
    assert.ok(validateDprPresentation(badCount, current).length > 0);
});

test("merge writes presentation only and keeps manpower rows", () => {
    const stored = { moral: { title: "Old", rows: [{ process: "Leader" }] }, attendance: { rows: [{ stationId: 1 }] } };
    const presentation = resolveDprPresentation(null);
    presentation.moral.title = "New";
    const merged = mergeDprPresentation(stored, presentation);
    assert.equal(merged.moral.title, "New");
    assert.deepEqual(merged.moral.rows, [{ process: "Leader" }]);
    assert.deepEqual(merged.attendance, { rows: [{ stationId: 1 }] });
    assert.equal(stored.moral.title, "Old"); // input untouched
});
