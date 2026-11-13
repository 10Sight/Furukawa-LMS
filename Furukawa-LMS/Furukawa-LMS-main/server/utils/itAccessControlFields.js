import { toDateOnlyString } from "./dateValidation.js";

// IT Access Control Register (MIS Portal) — the one definition of every editable column.
// The model creates/migrates its table columns from FIELDS, the save endpoint accepts only these
// keys and values, and GET /api/v1/it-access-control sends FIELDS and GROUPS to the page, which
// renders the table and the Excel export from them. Add a column here and it appears everywhere.
//
// Every value is nullable: blank means "not recorded yet", which is not the same as "No".

// Employees on the register: empId starting with this prefix (case-insensitive).
export const STAFF_EMP_ID_PREFIX = "ST";

const YES_NO = ["Yes", "No"];
export const DEVICE_OPTIONS = ["Desktop", "Laptop", "Tablet", "N/A"];
export const LOCATION_OPTIONS = ["Bawal", "Gujrat", "Gurgaon"];

// `leading`: read-only columns from the users table shown at the start of the group (the row
// carries them as top-level "YYYY-MM-DD" values).
export const GROUPS = [
    { key: "general", label: "General Access" },
    { key: "restricted", label: "Restricted Access" },
    { key: "privileged", label: "Privileged Access" },
    { key: "joining", label: "Joining", leading: [{ key: "joiningDate", label: "Date Of Joining", type: "date" }] },
    { key: "removal", label: "Access Removal", leading: [{ key: "leavingDate", label: "Date Of Leaving", type: "date" }] },
];

const yesNo = (key, label, group, extra = {}) => ({ key, label, group, type: "select", options: YES_NO, ...extra });

export const FIELDS = [
    yesNo("physicalAccess", "Physical", "general", { accent: "red" }),
    yesNo("adUser", "AD User", "general"),
    yesNo("msOffice", "MS Office", "general"),
    yesNo("inhouseApp", "Inhouse Application", "general"),
    { key: "desktopLaptop", label: "Desktop/Laptop", group: "general", type: "select", options: DEVICE_OPTIONS },
    yesNo("generalSoftware", "General Software", "general"),

    yesNo("deptFileServer", "Department File Server", "restricted"),
    yesNo("vpn", "VPN", "restricted"),
    yesNo("usb", "USB", "restricted"),

    yesNo("amson", "Amson", "privileged"),
    yesNo("serverRoom", "Server Room", "privileged"),
    yesNo("physicalServerAccess", "Physical Server Access", "privileged"),
    yesNo("msAdminPortal", "Microsoft Admin Portal", "privileged"),
    yesNo("itsmSupport", "ITSM Support", "privileged"),
    yesNo("itNetwork", "IT Network", "privileged"),
    yesNo("sapDev", "SAP Dev", "privileged"),
    yesNo("sapQas", "SAP QAS", "privileged"),
    yesNo("sapProd", "SAP Prod", "privileged"),
    yesNo("sapInfra", "SAP Infra", "privileged"),
    yesNo("mobileSim", "Mobile SIM", "privileged"),
    yesNo("emailAccessMobile", "Email Access on Mobile", "privileged"),
    yesNo("cloudInfra", "Cloud Infra", "privileged"),

    // Blank location falls back to the employee's plant (users.unit) when it is one of the options.
    { key: "location", label: "Location", group: "joining", type: "select", options: LOCATION_OPTIONS },

    { key: "emailDeletionDate", label: "Date of Email Deletion", group: "removal", type: "date" },
    { key: "adDeletionDate", label: "Date of AD Deletion", group: "removal", type: "date" },

    // Typed on the page only for employees with no department in the users table; shown inside the
    // Department column (group "identity"), never in its own column, and never imported from Excel.
    { key: "departmentManual", label: "Department (manual)", group: "identity", type: "text", maxLength: 100, importable: false },
];

export const FIELD_KEYS = FIELDS.map((f) => f.key);
const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));
export const getField = (key) => FIELD_BY_KEY.get(key) || null;

/** SQL type for a field's column. Keys are fixed identifiers from FIELDS, never request input. */
export const columnType = (field) => {
    if (field.type === "date") return "DATE NULL";
    if (field.type === "text") return `NVARCHAR(${field.maxLength || 100}) NULL`;
    return "NVARCHAR(50) NULL";
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const isRealDate = (iso) => {
    const m = iso.match(ISO_DATE);
    if (!m) return false;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};

/** Picks the option matching `value` (trimmed, case-insensitive), or null. */
export const matchOption = (options, value) => {
    if (value === null || value === undefined) return null;
    const wanted = String(value).trim().toLowerCase();
    return options.find((o) => o.toLowerCase() === wanted) || null;
};

/**
 * Validates one submitted value. Returns the canonical value (an option's spelling, a
 * "YYYY-MM-DD" date, or null for blank) or throws an Error naming the field.
 */
export const normalizeFieldValue = (key, value) => {
    const field = getField(key);
    if (!field) throw new Error(`Unknown field "${key}"`);
    if (value === null || value === undefined || String(value).trim() === "") return null;

    if (field.type === "text") {
        const text = String(value).replace(/\s+/g, " ").trim();
        const max = field.maxLength || 100;
        if (text.length > max) throw new Error(`${field.label}: at most ${max} characters`);
        return text;
    }
    if (field.type === "select") {
        const option = matchOption(field.options, value);
        if (!option) throw new Error(`${field.label}: "${value}" is not one of ${field.options.join(", ")}`);
        return option;
    }
    const iso = String(value).trim();
    if (!isRealDate(iso)) throw new Error(`${field.label}: "${value}" is not a valid date (YYYY-MM-DD)`);
    return iso;
};

/** Stored value -> the same canonical form normalizeFieldValue produces, for comparisons. */
export const storedFieldValue = (key, value) => {
    const field = getField(key);
    if (value === null || value === undefined || value === "") return null;
    if (field?.type === "date") return toDateOnlyString(value);
    return String(value);
};

const cleanName = (v) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());

/**
 * The employee's department(s) from the users table, in this order:
 *   1. users.departments — JSON array of department ids, every non-deleted one, by name;
 *   2. users.departmentId — resolved name (`departmentName` from the SQL join, or the map);
 *   3. users.department — legacy free text.
 * @param {object} r  users row: departments, departmentId, departmentName, departmentText
 * @param {Map<number,string>} deptNameById  non-deleted departments
 * @returns {string[]} distinct names, empty when the users table has none
 */
export const resolveUserDepartments = (r, deptNameById = new Map()) => {
    let ids = [];
    if (Array.isArray(r.departments)) ids = r.departments;
    else if (typeof r.departments === "string" && r.departments.trim()) {
        try {
            const parsed = JSON.parse(r.departments);
            ids = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            ids = [];
        }
    }
    const fromJson = [...new Set(ids
        .map((id) => deptNameById.get(Number.parseInt(id, 10)))
        .map(cleanName)
        .filter(Boolean))];
    if (fromJson.length) return fromJson;

    const byId = cleanName(r.departmentName) || cleanName(deptNameById.get(Number(r.departmentId)));
    if (byId) return [byId];

    const legacy = cleanName(r.departmentText);
    return legacy ? [legacy] : [];
};

/** True when a removal date was recorded on or after the current employment period began. */
const removedInCurrentPeriod = (removalDate, joiningDate) => !!removalDate && (!joiningDate || removalDate >= joiningDate);

/**
 * One register row from a joined users + it_access_control_records row.
 * - joiningDate/leavingDate are NVARCHAR on users, normalized here to "YYYY-MM-DD".
 * - pendingRemoval: the employee has LEFT but Email or AD deletion is not recorded for this
 *   employment period (a date from before a re-joining does not count).
 * - department: the users-table department(s) (see resolveUserDepartments) joined with ", ";
 *   only when there are none, the manual text typed on the register. departmentSource says which
 *   ("users" | "manual" | null) and departmentList holds each name separately for filtering.
 */
export const buildRegisterRow = (r, deptNameById = new Map()) => {
    const joiningDate = toDateOnlyString(r.joiningDate);
    const leavingDate = toDateOnlyString(r.leavingDate);
    const values = {};
    for (const key of FIELD_KEYS) values[key] = storedFieldValue(key, r[key]);

    const hasLeft = String(r.status || "").toUpperCase() === "LEFT";
    const pendingRemoval = hasLeft && !(
        removedInCurrentPeriod(values.emailDeletionDate, joiningDate)
        && removedInCurrentPeriod(values.adDeletionDate, joiningDate)
    );

    const userDepartments = resolveUserDepartments(r, deptNameById);
    const manualDepartment = values.departmentManual;
    const departmentList = userDepartments.length ? userDepartments : (manualDepartment ? [manualDepartment] : []);
    const departmentSource = userDepartments.length ? "users" : (manualDepartment ? "manual" : null);

    return {
        userId: Number(r.userId),
        empId: String(r.empId || "").trim(),
        fullName: r.fullName || "",
        designation: r.designation || "",
        department: departmentList.join(", "),
        departmentList,
        departmentSource,
        status: r.status || "",
        hasLeft,
        joiningDate,
        leavingDate,
        defaultLocation: matchOption(LOCATION_OPTIONS, r.unit),
        values,
        version: Number(r.version || 0),
        updatedAt: r.updatedAt || null,
        updatedByName: r.updatedByName || null,
        pendingRemoval,
    };
};
