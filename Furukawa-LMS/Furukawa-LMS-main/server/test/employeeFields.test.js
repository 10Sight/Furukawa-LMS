import { test } from "node:test";
import assert from "node:assert/strict";
import {
    validateEmployeeFields,
    formatEmployeeValidation,
    normalizePhoneNumber,
    normalizeGender,
    parseEmployeeStatus,
    getEmployeeUpdateError,
    assertEmployeeFields,
} from "../utils/employeeFields.js";

const NOW = new Date(2026, 10, 4); // 2026-11-04

const complete = () => ({
    empId: "FME1001",
    idCard: "C-55",
    fullName: "Ravi Kumar",
    fatherHusbandName: "Mohan Kumar",
    gender: "MALE",
    designation: "Operator",
    contractor: "ABC Manpower",
    dob: "2000-05-10",
    joiningDate: "2024-01-15",
    education: "12th",
    phoneNumber: "9876543210",
    status: "PRESENT",
});

test("complete record passes", () => {
    assert.deepEqual(validateEmployeeFields(complete(), { now: NOW }), { missing: [], errors: [] });
});

test("blank fields are all listed as missing", () => {
    const { missing } = validateEmployeeFields({ ...complete(), idCard: " ", fatherHusbandName: null, status: "" }, { now: NOW });
    assert.deepEqual(missing, ["Card No.", "Father / Husband Name", "Status"]);
});

test("status is skipped when requireStatus is false", () => {
    const { missing, errors } = validateEmployeeFields({ ...complete(), status: "" }, { requireStatus: false, now: NOW });
    assert.deepEqual(missing, []);
    assert.deepEqual(errors, []);
});

test("phone normalisation strips country code and trunk zero", () => {
    assert.equal(normalizePhoneNumber("+91 98765 43210"), "9876543210");
    assert.equal(normalizePhoneNumber("098765-43210"), "9876543210");
    assert.equal(normalizePhoneNumber(9876543210), "9876543210");
    const { errors } = validateEmployeeFields({ ...complete(), phoneNumber: "98765" }, { now: NOW });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /10-digit/);
});

test("employee code with spaces or over 15 chars is rejected", () => {
    assert.equal(validateEmployeeFields({ ...complete(), empId: "FME 1" }, { now: NOW }).errors.length, 1);
    assert.equal(validateEmployeeFields({ ...complete(), empId: "A".repeat(16) }, { now: NOW }).errors.length, 1);
});

test("gender and status values", () => {
    assert.equal(normalizeGender("f"), "FEMALE");
    assert.equal(normalizeGender("Male"), "MALE");
    assert.equal(parseEmployeeStatus("On Leave"), "ON_LEAVE");
    assert.equal(parseEmployeeStatus("resigned"), "LEFT");
    assert.equal(parseEmployeeStatus("maybe"), null);
    assert.match(validateEmployeeFields({ ...complete(), gender: "X" }, { now: NOW }).errors[0], /Gender/);
    assert.match(validateEmployeeFields({ ...complete(), status: "maybe" }, { now: NOW }).errors[0], /Status/);
});

test("age must be 18 on the joining date; joining date cannot be in the future", () => {
    // Turned 18 on 2024-01-15 exactly -> allowed
    assert.deepEqual(validateEmployeeFields({ ...complete(), dob: "2006-01-15" }, { now: NOW }).errors, []);
    // One day short of 18 on joining
    assert.match(validateEmployeeFields({ ...complete(), dob: "2006-01-16" }, { now: NOW }).errors[0], /18 years/);
    assert.match(validateEmployeeFields({ ...complete(), joiningDate: "2026-11-05" }, { now: NOW }).errors[0], /future/);
    assert.match(validateEmployeeFields({ ...complete(), dob: "2001-02-30" }, { now: NOW }).errors[0], /not a valid date/);
});

test("formatEmployeeValidation and assertEmployeeFields", () => {
    assert.equal(formatEmployeeValidation({ missing: [], errors: [] }), null);
    assert.equal(
        formatEmployeeValidation({ missing: ["Card No.", "Gender"], errors: ["bad phone"] }),
        "Missing required fields: Card No., Gender. bad phone"
    );
    assert.throws(() => assertEmployeeFields({ ...complete(), education: "" }), (err) => err.statuscode === 400 && /Education/.test(err.message));
});

test("update guard: cannot clear a filled mandatory field, but legacy blanks may stay blank", () => {
    const oldUser = { ...complete(), contractorId: 3, education: null, phoneNumber: "+91 98765 43210" };
    assert.match(getEmployeeUpdateError(oldUser, { idCard: "" }), /cannot be cleared: Card No\./);
    assert.match(getEmployeeUpdateError(oldUser, { contractorId: null }), /Contractor/);
    // Legacy record missing Education + old-format phone: an unrelated edit re-sending them passes
    assert.equal(getEmployeeUpdateError(oldUser, { education: null, phoneNumber: "+91 98765 43210", designation: "Leader" }), null);
    // Changed values are format-checked
    assert.match(getEmployeeUpdateError(oldUser, { phoneNumber: "12345" }), /10-digit/);
    // Unchanged date in a different representation is not treated as a change
    assert.equal(getEmployeeUpdateError({ ...oldUser, dob: new Date(2000, 4, 10) }, { dob: "2000-05-10" }), null);
});
