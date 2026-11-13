// Run with: node --test test/itAccessControlImport.test.js
//
// Excel import for the IT Access Control Register (admin/src/utils/itAccessControlImport.js), using
// the real server field definitions and a real export -> import round trip through exceljs.
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { FIELDS, GROUPS, buildRegisterRow } from "../utils/itAccessControlFields.js";
import {
    buildImportPlan, readImportWorkbook, parseImportDate, parseImportValue, normalizeEmpId, ImportError,
} from "../../admin/src/utils/itAccessControlImport.js";
import { buildItAccessControlWorkbook } from "../../admin/src/utils/itAccessControlExcelExport.js";

const register = { fields: FIELDS, groups: GROUPS };
const field = (key) => FIELDS.find((f) => f.key === key);

const registerRow = (over = {}) => buildRegisterRow({
    userId: 1, empId: "ST0001", fullName: "Asha Verma", designation: "Engineer", departmentName: "IT",
    status: "PRESENT", joiningDate: "2024-01-15", leavingDate: null, unit: "Bawal", version: 2,
    vpn: "No", usb: "Yes", ...over,
});

const ROWS = [
    registerRow(),
    registerRow({ userId: 2, empId: "ST0002", fullName: "Ravi Kumar", version: 0, vpn: null, usb: null }),
    registerRow({ userId: 3, empId: "st0003", fullName: "Left Person", status: "LEFT", leavingDate: "2026-10-31", vpn: null, usb: null }),
];

// A hand-made sheet: header in row 1.
const sheet = (header, ...dataRows) => [header, ...dataRows];

// ---------- values ----------

test("dates: real dates, Excel serials, day-first text and ISO; impossible dates rejected", () => {
    assert.equal(parseImportDate(new Date(Date.UTC(2026, 10, 13))), "2026-11-13");
    assert.equal(parseImportDate(46339), "2026-11-13");
    assert.equal(parseImportDate("13-11-2026"), "2026-11-13");
    assert.equal(parseImportDate("13/11/2026"), "2026-11-13");
    assert.equal(parseImportDate("3.2.2026"), "2026-02-03", "day first");
    assert.equal(parseImportDate("2026-11-13"), "2026-11-13");
    assert.equal(parseImportDate("30-02-2026"), null);
    assert.equal(parseImportDate("11/13/2026"), null, "month-first is not accepted");
    assert.equal(parseImportDate("soon"), null);
});

test("select values: any capitalisation, Y/N for Yes/No, blanks skipped, others rejected", () => {
    assert.deepEqual(parseImportValue(field("vpn"), "YES"), { value: "Yes" });
    assert.deepEqual(parseImportValue(field("vpn"), "n"), { value: "No" });
    assert.deepEqual(parseImportValue(field("desktopLaptop"), " laptop "), { value: "Laptop" });
    assert.deepEqual(parseImportValue(field("vpn"), "  "), { skip: true });
    assert.deepEqual(parseImportValue(field("vpn"), null), { skip: true });
    assert.ok(parseImportValue(field("vpn"), "Maybe").error);
    assert.ok(parseImportValue(field("desktopLaptop"), "y").error, "Y/N only applies to Yes/No columns");
});

test("employee ids are matched ignoring case and spaces", () => {
    assert.equal(normalizeEmpId(" st 0012 "), "ST0012");
});

// ---------- columns ----------

test("Name, Role, Department, joining and leaving dates are never imported", () => {
    const plan = buildImportPlan({
        fields: FIELDS,
        rows: ROWS,
        matrix: sheet(
            ["Employee Id", "Employee Name", "Role", "Department", "Date Of Joining", "Date Of Leaving", "VPN"],
            ["ST0001", "Someone Else", "CEO", "Finance", "01-01-2000", "01-01-2001", "Yes"],
        ),
    });
    assert.deepEqual(plan.importedColumns, ["VPN"]);
    assert.deepEqual(plan.changes.map((c) => c.key), ["vpn"]);
    assert.equal(plan.ignoredColumns.length, 5);
    assert.ok(plan.ignoredColumns.every((c) => /employee records/.test(c.reason)));
});

const IMPORTABLE = FIELDS.filter((f) => f.importable !== false);

test("every importable field is imported by its label; unknown headers are reported", () => {
    const header = ["Emp ID", ...IMPORTABLE.map((f) => f.label), "Remarks"];
    const plan = buildImportPlan({ fields: FIELDS, rows: ROWS, matrix: sheet(header, ["ST0002"]) });
    assert.equal(plan.importedColumns.length, IMPORTABLE.length);
    assert.deepEqual(plan.ignoredColumns, [{ header: "Remarks", reason: "unknown column" }]);
    assert.deepEqual(plan.missingFields, []);
});

test("the manual department is never imported", () => {
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS,
        matrix: sheet(["Employee Id", "Department (manual)", "VPN"], ["ST0002", "Tool Room", "Yes"]),
    });
    assert.deepEqual(plan.edits, { 2: { vpn: "Yes" } });
    assert.ok(!plan.missingFields.includes("Department (manual)"));
});

// ---------- the Physical / Microsoft Admin Portal / ITSM Support report ----------

test("the exact spec headers import Physical, Microsoft Admin Portal and ITSM Support", () => {
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS,
        matrix: sheet(["Employee Id", "Physical", "Microsoft Admin Portal", "ITSM Support"], ["ST0002", "Yes", "Yes", "No"]),
    });
    assert.deepEqual(plan.edits, { 2: { physicalAccess: "Yes", msAdminPortal: "Yes", itsmSupport: "No" } });
});

test("columns with no header in the file are listed as missing", () => {
    const plan = buildImportPlan({ fields: FIELDS, rows: ROWS, matrix: sheet(["Employee Id", "VPN"], ["ST0001", "Yes"]) });
    assert.ok(plan.missingFields.includes("Physical"));
    assert.ok(plan.missingFields.includes("Microsoft Admin Portal"));
    assert.ok(plan.missingFields.includes("ITSM Support"));
    assert.equal(plan.missingFields.length, IMPORTABLE.length - 1);
});

test("misspelled or shortened headers are suggested and imported, and shown as suggested", () => {
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS,
        matrix: sheet(["Employee Id", "Phyiscal", "Microsft Admin Portal", "ITSM"], ["ST0002", "Yes", "Yes", "Yes"]),
    });
    assert.deepEqual(plan.edits, { 2: { physicalAccess: "Yes", msAdminPortal: "Yes", itsmSupport: "Yes" } });
    assert.deepEqual(plan.columns.filter((c) => c.status === "suggested").map((c) => c.fieldKey), ["physicalAccess", "msAdminPortal", "itsmSupport"]);
});

test("ambiguous headers are not guessed", () => {
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS,
        matrix: sheet(["Employee Id", "Server", "SAP", "VPN"], ["ST0002", "Yes", "Yes", "Yes"]),
    });
    assert.deepEqual(plan.edits, { 2: { vpn: "Yes" } });
    assert.deepEqual(plan.columns.filter((c) => c.status === "unknown").map((c) => c.header), ["Server", "SAP"]);
});

test("a column mapped by the user is imported; one left out is not", () => {
    const matrix = sheet(["Employee Id", "Phys. Acc", "Admin portal (MS)", "Phyiscal"], ["ST0002", "Yes", "No", "No"]);
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS, matrix,
        mappings: { physacc: "physicalAccess", adminportalms: "msAdminPortal", phyiscal: "" },
    });
    assert.deepEqual(plan.edits, { 2: { physicalAccess: "Yes", msAdminPortal: "No" } });
    assert.deepEqual(plan.columns.map((c) => c.status), ["id", "manual", "manual", "skipped"]);
});

test("a mapping to a field another column already fills is reported as a duplicate", () => {
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS,
        matrix: sheet(["Employee Id", "VPN", "Remote"], ["ST0002", "Yes", "No"]),
        mappings: { remote: "vpn" },
    });
    assert.deepEqual(plan.edits, { 2: { vpn: "Yes" } });
    assert.equal(plan.columns[2].status, "duplicate");
});

test("TRUE/FALSE, 1/0 and ticks are read as Yes/No", () => {
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS,
        matrix: sheet(
            ["Employee Id", "Physical", "Microsoft Admin Portal", "ITSM Support", "VPN", "USB", "Amson"],
            ["ST0002", true, 1, "✓", false, "0", "✗"],
        ),
    });
    assert.deepEqual(plan.edits, { 2: { physicalAccess: "Yes", msAdminPortal: "Yes", itsmSupport: "Yes", vpn: "No", usb: "No", amson: "No" } });
    assert.deepEqual(plan.invalid, []);
});

test("invisible characters in headers, ids and values are ignored", () => {
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS,
        matrix: sheet(
            ["Employee​ Id", "Phys­ical", "﻿ITSM Support"],
            ["ST0002​", "Yes​", "​No"],
        ),
    });
    assert.deepEqual(plan.edits, { 2: { physicalAccess: "Yes", itsmSupport: "No" } });
    assert.deepEqual(plan.invalid, []);
});

test("a file whose headers all need mapping still opens (no access column matched yet)", () => {
    const plan = buildImportPlan({ fields: FIELDS, rows: ROWS, matrix: sheet(["Employee Id", "Col A"], ["ST0001", "Yes"]) });
    assert.deepEqual(plan.edits, {});
    assert.equal(plan.columns[1].status, "unknown");
});

test("a file without an Employee Id column, or with no access columns, is refused", () => {
    assert.throws(() => buildImportPlan({ fields: FIELDS, rows: ROWS, matrix: sheet(["Name", "VPN"]) }), ImportError);
    assert.throws(() => buildImportPlan({ fields: FIELDS, rows: ROWS, matrix: sheet(["Employee Id", "Employee Name"]) }), ImportError);
});

// ---------- matching ----------

test("matches by Employee Id, keeps blanks as-is, and only records real changes", () => {
    const plan = buildImportPlan({
        fields: FIELDS,
        rows: ROWS,
        matrix: sheet(
            ["Employee Id", "VPN", "USB", "Date of Email Deletion"],
            ["st 0001", "No", "", ""], // VPN unchanged, USB blank -> stays Yes
            ["ST0003", "Yes", "N", "01/11/2026"],
        ),
    });
    assert.equal(plan.matchedCount, 2);
    assert.equal(plan.unchangedCells, 1);
    assert.deepEqual(plan.edits, { 3: { vpn: "Yes", usb: "No", emailDeletionDate: "2026-11-01" } });
    assert.equal(plan.changes.find((c) => c.key === "vpn").from, null);
});

test("register employees missing from the file are listed (leavers tagged)", () => {
    const plan = buildImportPlan({
        fields: FIELDS, rows: ROWS, matrix: sheet(["Employee Id", "VPN"], ["ST0001", "Yes"]),
    });
    assert.deepEqual(plan.notInFile.map((r) => [r.empId, r.hasLeft]), [["ST0002", false], ["st0003", true]]);

    const all = buildImportPlan({
        fields: FIELDS, rows: ROWS, matrix: sheet(["Employee Id", "VPN"], ["ST0001"], ["ST0002"], ["ST0003"]),
    });
    assert.deepEqual(all.notInFile, []);
});

test("ids not on the register, duplicate ids and missing ids are reported, not imported", () => {
    const plan = buildImportPlan({
        fields: FIELDS,
        rows: ROWS,
        matrix: sheet(
            ["Employee Id", "VPN", "USB"],
            ["ST9999", "Yes", "Yes"], // row 2: not on the register
            ["ST0001", "Yes", ""], // rows 3+4: same values -> imported once
            ["ST0001", "yes", ""],
            ["ST0002", "Yes", ""], // rows 5+6: different values -> skipped
            ["ST0002", "No", ""],
            ["", "Yes", ""], // row 7: no id
            ["", "", ""], // row 8: empty row, ignored silently
        ),
    });
    assert.deepEqual(plan.notOnRegister, [{ rowNumber: 2, empId: "ST9999" }]);
    assert.deepEqual(plan.duplicates, [
        { empId: "ST0001", rowNumbers: [3, 4], conflicting: false },
        { empId: "ST0002", rowNumbers: [5, 6], conflicting: true },
    ]);
    assert.deepEqual(Object.keys(plan.edits), ["1"]);
    assert.deepEqual(plan.blankIdRows, [7]);
});

test("an invalid cell is reported and skipped while the rest of the row is imported", () => {
    const plan = buildImportPlan({
        fields: FIELDS,
        rows: ROWS,
        matrix: sheet(["Employee Id", "VPN", "Date of AD Deletion"], ["ST0002", "Yes", "31-04-2026"]),
    });
    assert.deepEqual(plan.edits, { 2: { vpn: "Yes" } });
    assert.equal(plan.invalid.length, 1);
    assert.equal(plan.invalid[0].rowNumber, 2);
    assert.equal(plan.invalid[0].column, "Date of AD Deletion");
});

test("a location equal to the employee's plant is not a change when none is recorded", () => {
    const plan = buildImportPlan({
        fields: FIELDS,
        rows: ROWS,
        matrix: sheet(["Employee Id", "Location"], ["ST0001", "Bawal"], ["ST0002", "Gurgaon"]),
    });
    assert.deepEqual(plan.edits, { 2: { location: "Gurgaon" } });
});

// ---------- round trip through a real .xlsx ----------

const roundTrip = async (rows) => {
    const workbook = buildItAccessControlWorkbook(ExcelJS, register, rows);
    const buffer = await workbook.xlsx.writeBuffer();
    return readImportWorkbook(ExcelJS, buffer);
};

test("Export to Excel and importing the same file back changes nothing", async () => {
    const rows = [
        registerRow({ vpn: "Yes", desktopLaptop: "Laptop", location: "Gurgaon", emailDeletionDate: "2026-11-01" }),
        ...ROWS.slice(1),
    ];
    const { sheetName, matrix } = await roundTrip(rows);
    assert.equal(sheetName, "Access Control Register");
    const plan = buildImportPlan({ matrix, fields: FIELDS, rows });
    assert.equal(plan.matchedCount, 3);
    assert.deepEqual(plan.changes, []);
    assert.deepEqual(plan.notInFile, []);
    assert.deepEqual(plan.invalid, []);
    assert.equal(plan.importedColumns.length, IMPORTABLE.length);
    assert.deepEqual(plan.missingFields, []);
});

test("an exported file edited in Excel imports the edits, including real date cells", async () => {
    const workbook = buildItAccessControlWorkbook(ExcelJS, register, ROWS);
    const ws = workbook.getWorksheet("Access Control Register");
    const headerRow = ws.getRow(3);
    const colOf = (label) => headerRow.values.findIndex((v) => v === label);
    ws.getCell(4, colOf("VPN")).value = "Yes"; // ST0001: No -> Yes
    ws.getCell(6, colOf("Date of AD Deletion")).value = new Date(Date.UTC(2026, 10, 2)); // st0003
    const { matrix } = await readImportWorkbook(ExcelJS, await workbook.xlsx.writeBuffer());

    const plan = buildImportPlan({ matrix, fields: FIELDS, rows: ROWS });
    assert.deepEqual(plan.edits, { 1: { vpn: "Yes" }, 3: { adDeletionDate: "2026-11-02" } });
});

test("a file that is not a workbook gives a readable error", async () => {
    await assert.rejects(readImportWorkbook(ExcelJS, Buffer.from("not excel")), ImportError);
});
