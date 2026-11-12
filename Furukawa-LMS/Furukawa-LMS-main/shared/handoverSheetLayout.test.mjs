import test from "node:test";
import assert from "node:assert/strict";
import {
    HANDOVER_COLUMNS,
    resolveHandoverLayout,
    validateHandoverLayout,
    visibleHandoverColumns,
} from "./handoverSheetLayout.js";

const clone = (v) => JSON.parse(JSON.stringify(v));

test("no stored layout shows every built-in column in default order", () => {
    const layout = resolveHandoverLayout(null);
    assert.deepEqual(visibleHandoverColumns(layout).map((c) => c.field), HANDOVER_COLUMNS.map((c) => c.field));
    assert.equal(layout.statusHeader, "Approve / Reject");
});

test("existing stored layout keeps order, headers and visibility; drops custom fields", () => {
    const layout = resolveHandoverLayout({
        columns: [
            { header: "No.", field: "sn" },
            { header: "Name", field: "employeeName", className: "w-40" },
            { header: "Dept", field: "departmentId" },
            { header: "Shoe Size", field: "shoeSize" },
        ],
    });
    const visible = visibleHandoverColumns(layout);
    assert.deepEqual(visible.map((c) => c.field), ["sn", "employeeName", "department"]);
    assert.equal(visible[0].header, "No.");
    assert.equal(visible[1].className, "w-40");
    assert.ok(!layout.columns.some((c) => c.field === "shoeSize"));
    // left-out built-ins are kept but hidden
    assert.equal(layout.columns.find((c) => c.field === "mentor").hidden, true);
    assert.equal(layout.columns.length, HANDOVER_COLUMNS.length);
});

test("required columns can never resolve as hidden", () => {
    const layout = resolveHandoverLayout({ columns: [{ field: "sn", hidden: true }, { field: "employeeName", hidden: true }] });
    assert.equal(layout.columns.find((c) => c.field === "sn").hidden, false);
    assert.equal(layout.columns.find((c) => c.field === "employeeName").hidden, false);
});

test("validate allows rename/reorder/hide and rejects custom or removed columns", () => {
    const ok = resolveHandoverLayout(null);
    ok.columns.reverse();
    ok.columns.find((c) => c.field === "mentor").hidden = true;
    ok.columns.find((c) => c.field === "marks").header = "Induction Marks";
    assert.deepEqual(validateHandoverLayout(ok), []);

    const custom = clone(ok);
    custom.columns.push({ field: "shoeSize", header: "Shoe" });
    assert.ok(validateHandoverLayout(custom).length > 0);

    const removed = clone(ok);
    removed.columns = removed.columns.filter((c) => c.field !== "process");
    assert.ok(validateHandoverLayout(removed).length > 0);

    const hiddenName = clone(ok);
    hiddenName.columns.find((c) => c.field === "employeeName").hidden = true;
    assert.ok(validateHandoverLayout(hiddenName).length > 0);
});
