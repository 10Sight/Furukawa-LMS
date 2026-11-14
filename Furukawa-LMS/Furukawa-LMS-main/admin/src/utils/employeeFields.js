/**
 * Client-side mirror of server/utils/employeeFields.js — the 12 mandatory employee fields for
 * operator / Dojo candidate creation. Keep the rules in sync with the server copy, which is the
 * one actually enforced.
 */

export const EMPLOYEE_FIELD_LABELS = {
    empId: "Employee Code",
    idCard: "Card No.",
    fullName: "Full Name",
    fatherHusbandName: "Father / Husband Name",
    gender: "Gender",
    designation: "Designation",
    contractorId: "Contractor",
    dob: "Date of Birth",
    joiningDate: "Date of Joining",
    education: "Education",
    phoneNumber: "Mobile Number",
    status: "Status",
};

const isBlank = (val) => val === null || val === undefined || String(val).trim() === "";

export const normalizePhoneNumber = (val) => {
    if (isBlank(val)) return "";
    let digits = String(val).replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits;
};

/** Same as the server's normalizeEmpId: trim, upper-case, "TRO81053" -> "TR081053"; "" when blank. */
export const normalizeEmpId = (val) => {
    if (isBlank(val)) return "";
    const code = String(val).trim().toUpperCase();
    const trTypo = code.match(/^TRO(\d{5})$/);
    return trTypo ? `TR0${trTypo[1]}` : code;
};

const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const addYears = (dateStr, years) => {
    const [y, m, d] = dateStr.split("-");
    return `${Number(y) + years}-${m}-${d}`;
};

/**
 * @param {object} formData  form state; contractor is read from contractorId (or contractor).
 * @param {object} [opts]
 * @param {boolean} [opts.requireStatus=true]
 * @returns {Record<string, string>} field key -> error message (empty when valid).
 */
export const getEmployeeFieldErrors = (formData = {}, { requireStatus = true } = {}) => {
    const errors = {};
    for (const [key, label] of Object.entries(EMPLOYEE_FIELD_LABELS)) {
        if (key === "status" && !requireStatus) continue;
        const value = key === "contractorId" ? (formData.contractorId || formData.contractor) : formData[key];
        if (isBlank(value)) errors[key] = `${label} is required`;
    }

    const empId = String(formData.empId ?? "").trim();
    if (!errors.empId && (/\s/.test(empId) || empId.length > 15)) {
        errors.empId = "Employee Code must not contain spaces and must be at most 15 characters";
    }
    if (!errors.fullName && String(formData.fullName).trim().length < 2) {
        errors.fullName = "Full Name must be at least 2 characters";
    }
    if (!errors.phoneNumber && !/^\d{10}$/.test(normalizePhoneNumber(formData.phoneNumber))) {
        errors.phoneNumber = "Mobile Number must be a 10-digit number";
    }

    const today = todayStr();
    const dob = String(formData.dob ?? "").slice(0, 10);
    const doj = String(formData.joiningDate ?? "").slice(0, 10);
    if (!errors.joiningDate && doj > today) {
        errors.joiningDate = "Date of Joining cannot be a future date";
    }
    if (!errors.dob && addYears(dob, 18) > (doj && doj <= today ? doj : today)) {
        errors.dob = "Employee must be at least 18 years old on the Date of Joining";
    }
    return errors;
};

/** "Please fill in: A, B, C and 2 more" style summary for a toast. */
export const summarizeEmployeeFieldErrors = (errors) => {
    const keys = Object.keys(errors);
    if (keys.length === 0) return null;
    if (keys.length === 1) return errors[keys[0]];
    const labels = keys.map((k) => EMPLOYEE_FIELD_LABELS[k] || k);
    const shown = labels.slice(0, 3).join(", ");
    return `Please fix: ${shown}${labels.length > 3 ? ` and ${labels.length - 3} more` : ""}`;
};
