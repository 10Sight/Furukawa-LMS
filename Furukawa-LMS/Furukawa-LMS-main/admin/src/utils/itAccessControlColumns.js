// Column layout of the IT Access Control Register, shared by the page and the Excel export.
// `fields` and `groups` come from GET /api/v1/it-access-control (server/utils/itAccessControlFields.js).

export const IDENTITY_GROUP = {
    key: "identity",
    label: "Access Control",
    columns: [
        { key: "empId", label: "Employee Id", readOnly: true },
        { key: "fullName", label: "Employee Name", readOnly: true },
        { key: "designation", label: "Role", readOnly: true },
        // Shows row.department (users table, else the saved manual text). When the users table has
        // none, the page lets an editor type one into the `manualKey` field.
        { key: "department", label: "Department", readOnly: true, manualKey: "departmentManual" },
    ],
};

/** The manual department as currently edited (unsaved edit, else saved value). */
export function manualDepartmentValue(row, rowEdits) {
    if (rowEdits && Object.prototype.hasOwnProperty.call(rowEdits, "departmentManual")) return rowEdits.departmentManual;
    return row.values?.departmentManual ?? null;
}

/** True when the users table has no department for the row, so a manual one may be typed. */
export const canEnterManualDepartment = (row) => row.departmentSource !== "users";

/** [{ key, label, columns: [{ key, label, readOnly, type, options, accent }] }] */
export function buildColumnGroups(fields = [], groups = []) {
    return [
        IDENTITY_GROUP,
        ...groups.map((group) => ({
            key: group.key,
            label: group.label,
            columns: [
                ...(group.leading || []).map((c) => ({ ...c, readOnly: true })),
                ...fields.filter((f) => f.group === group.key && f.group !== IDENTITY_GROUP.key).map((f) => ({ ...f, readOnly: false })),
            ],
        })),
    ];
}

/** The value a cell shows: an unsaved edit, else the saved value; read-only columns read the row. */
export function cellValue(row, column, rowEdits) {
    if (column.readOnly) return row[column.key] ?? null;
    if (rowEdits && Object.prototype.hasOwnProperty.call(rowEdits, column.key)) return rowEdits[column.key];
    return row.values?.[column.key] ?? null;
}

/** Location with the plant fallback (users.unit) applied when none is recorded. */
export function effectiveLocation(row, rowEdits) {
    const recorded = cellValue(row, { key: "location" }, rowEdits);
    return recorded || row.defaultLocation || null;
}

/** "YYYY-MM-DD" -> "DD-MM-YYYY" for display; anything else unchanged. */
export function formatDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
    return `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
}
