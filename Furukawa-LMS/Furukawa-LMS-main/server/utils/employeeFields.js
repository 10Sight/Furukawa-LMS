/**
 * Shared validation for the 12 mandatory employee / operator fields, used by every entry point
 * that creates an employee: Excel import (/employees, /employees-full, /dojo-candidates),
 * POST /api/users (createUser) and POST /api/v1/auth/dojo-register (dojoRegister).
 *
 * The admin app mirrors these rules in admin/src/utils/employeeFields.js — keep the two in sync.
 */

import { ApiError } from "./ApiError.js";

export const EMPLOYEE_GENDERS = ["MALE", "FEMALE", "OTHER"];
export const EMPLOYEE_STATUSES = ["PRESENT", "LEFT", "ON_LEAVE"];

export const EMPLOYEE_FIELD_LABELS = {
    empId: "Employee Code",
    idCard: "Card No.",
    fullName: "Full Name",
    fatherHusbandName: "Father / Husband Name",
    gender: "Gender",
    designation: "Designation",
    contractor: "Contractor",
    dob: "Date of Birth",
    joiningDate: "Date of Joining",
    education: "Education",
    phoneNumber: "Mobile Number",
    status: "Status",
};

export const MANDATORY_EMPLOYEE_FIELDS = Object.keys(EMPLOYEE_FIELD_LABELS);

const MIN_AGE_YEARS = 18;

export const isBlankValue = (val) =>
    val === null || val === undefined || String(val).trim() === "";

/**
 * Reduces a phone number to its digits, dropping a leading +91 / 91 country code or a leading
 * trunk 0 so "+91 98765 43210" and "098765 43210" both become "9876543210".
 */
export const normalizePhoneNumber = (val) => {
    if (isBlankValue(val)) return "";
    let digits = String(val).replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits;
};

export const isValidPhoneNumber = (val) => /^\d{10}$/.test(normalizePhoneNumber(val));

/** M/Male/MALE -> MALE etc. Unknown values are returned upper-cased so validation can reject them. */
export const normalizeGender = (val) => {
    if (isBlankValue(val)) return null;
    const v = String(val).trim().toUpperCase();
    if (v === "M" || v === "MALE") return "MALE";
    if (v === "F" || v === "FEMALE") return "FEMALE";
    if (v === "O" || v === "OTHER") return "OTHER";
    return v;
};

/**
 * Strict status parser: returns PRESENT / LEFT / ON_LEAVE, or null when the value is blank or
 * not recognised (unlike the import's lenient normalizeStatus, which maps anything to PRESENT).
 */
export const parseEmployeeStatus = (val) => {
    if (isBlankValue(val)) return null;
    const v = String(val).trim().toUpperCase().replace(/[\s\-_]+/g, "");
    if (["PRESENT", "ACTIVE", "P", "WORKING"].includes(v)) return "PRESENT";
    if (["LEFT", "LEAVING", "RESIGNED", "TERMINATED"].includes(v)) return "LEFT";
    if (["ONLEAVE", "LEAVE"].includes(v)) return "ON_LEAVE";
    return null;
};

const pad2 = (n) => String(n).padStart(2, "0");

const localDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Returns YYYY-MM-DD for a YYYY-MM-DD(...) string or a valid Date, otherwise null. */
export const toDateOnlyString = (val) => {
    if (isBlankValue(val)) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : localDateStr(val);
    const s = String(val).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        const [, y, mo, d] = m;
        const check = new Date(Number(y), Number(mo) - 1, Number(d));
        if (check.getFullYear() !== Number(y) || check.getMonth() !== Number(mo) - 1 || check.getDate() !== Number(d)) {
            return null;
        }
        return `${y}-${mo}-${d}`;
    }
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : localDateStr(parsed);
};

const addYears = (dateStr, years) => {
    const [y, m, d] = dateStr.split("-");
    // 29-Feb birthdays turn 18 on 01-Mar in non-leap years; string compare treats "02-29" as
    // after "02-28", which gives the same result.
    return `${Number(y) + years}-${m}-${d}`;
};

/**
 * Validates the 12 mandatory employee fields.
 *
 * @param {object} data  { empId, idCard, fullName, fatherHusbandName, gender, designation,
 *                         contractor (name or id), dob, joiningDate, education, phoneNumber, status }
 * @param {object} [opts]
 * @param {boolean} [opts.requireStatus=true]  Dojo candidates are always created PRESENT, so the
 *                                             Dojo flows pass false.
 * @param {Date}    [opts.now]                 Injected "today" for tests.
 * @returns {{ missing: string[], errors: string[] }}  labels of blank fields + format errors.
 */
export const validateEmployeeFields = (data = {}, { requireStatus = true, now = new Date() } = {}) => {
    const missing = [];
    const errors = [];

    for (const key of MANDATORY_EMPLOYEE_FIELDS) {
        if (key === "status" && !requireStatus) continue;
        if (isBlankValue(data[key])) missing.push(EMPLOYEE_FIELD_LABELS[key]);
    }

    const empId = isBlankValue(data.empId) ? null : String(data.empId).trim();
    if (empId && (/\s/.test(empId) || empId.length > 15)) {
        errors.push("Employee Code must not contain spaces and must be at most 15 characters.");
    }

    if (!isBlankValue(data.fullName) && String(data.fullName).trim().length < 2) {
        errors.push("Full Name must be at least 2 characters.");
    }

    if (!isBlankValue(data.gender) && !EMPLOYEE_GENDERS.includes(normalizeGender(data.gender))) {
        errors.push(`Gender '${data.gender}' is invalid; use MALE, FEMALE or OTHER.`);
    }

    if (!isBlankValue(data.phoneNumber) && !isValidPhoneNumber(data.phoneNumber)) {
        errors.push(`Mobile Number '${data.phoneNumber}' must be a 10-digit number.`);
    }

    const today = localDateStr(now);
    const dob = toDateOnlyString(data.dob);
    const joiningDate = toDateOnlyString(data.joiningDate);

    if (!isBlankValue(data.dob) && !dob) errors.push(`Date of Birth '${data.dob}' is not a valid date.`);
    if (!isBlankValue(data.joiningDate) && !joiningDate) errors.push(`Date of Joining '${data.joiningDate}' is not a valid date.`);

    if (joiningDate && joiningDate > today) {
        errors.push(`Date of Joining (${joiningDate}) cannot be a future date.`);
    }
    if (dob) {
        const ageReference = joiningDate && joiningDate <= today ? joiningDate : today;
        if (addYears(dob, MIN_AGE_YEARS) > ageReference) {
            errors.push(`Employee must be at least ${MIN_AGE_YEARS} years old on the Date of Joining (DOB ${dob}).`);
        }
    }

    if (requireStatus && !isBlankValue(data.status) && !parseEmployeeStatus(data.status)) {
        errors.push(`Status '${data.status}' is invalid; use PRESENT, LEFT or ON_LEAVE.`);
    }

    return { missing, errors };
};

/** Joins a validateEmployeeFields() result into one message, or null when valid. */
export const formatEmployeeValidation = ({ missing = [], errors = [] } = {}) => {
    const parts = [];
    if (missing.length > 0) parts.push(`Missing required fields: ${missing.join(", ")}.`);
    parts.push(...errors);
    return parts.length > 0 ? parts.join(" ") : null;
};

/** API-controller form of validateEmployeeFields: throws a 400 ApiError listing every problem. */
export const assertEmployeeFields = (data, opts) => {
    const message = formatEmployeeValidation(validateEmployeeFields(data, opts));
    if (message) throw new ApiError(message, 400);
};

// Keys checked by updateUser's "don't clear a mandatory field" guard. Contractor is tracked by
// contractorId there, since edit forms send a (possibly stale) contractor name alongside it.
const UPDATE_GUARD_KEYS = MANDATORY_EMPLOYEE_FIELDS.map((key) => (key === "contractor" ? "contractorId" : key));

const sameValue = (key, a, b) => {
    if (key === "dob" || key === "joiningDate") return toDateOnlyString(a) === toDateOnlyString(b);
    if (isBlankValue(a) && isBlankValue(b)) return true;
    return String(a ?? "").trim() === String(b ?? "").trim();
};

/**
 * Validates an employee profile update. Rejects clearing a mandatory field that currently has a
 * value, and format-checks only the mandatory values the update actually changes, so legacy
 * records with incomplete or old-format data can still receive unrelated edits.
 *
 * @returns {string|null} error message, or null when the update is acceptable.
 */
export const getEmployeeUpdateError = (oldUser = {}, data = {}) => {
    const cleared = [];
    const changed = {};
    for (const key of UPDATE_GUARD_KEYS) {
        if (data[key] === undefined) continue;
        if (isBlankValue(data[key])) {
            if (!isBlankValue(oldUser[key])) {
                cleared.push(EMPLOYEE_FIELD_LABELS[key === "contractorId" ? "contractor" : key]);
            }
            continue;
        }
        if (!sameValue(key, data[key], oldUser[key])) changed[key] = data[key];
    }

    const parts = [];
    if (cleared.length > 0) parts.push(`Mandatory fields cannot be cleared: ${cleared.join(", ")}.`);
    if (Object.keys(changed).length > 0) {
        // Pair a changed DOB/DOJ with the other date on file so the age check uses the real DOJ.
        if (changed.dob !== undefined && changed.joiningDate === undefined) {
            changed.joiningDate = data.joiningDate ?? oldUser.joiningDate;
        }
        parts.push(...validateEmployeeFields(changed).errors);
    }
    return parts.length > 0 ? parts.join(" ") : null;
};
