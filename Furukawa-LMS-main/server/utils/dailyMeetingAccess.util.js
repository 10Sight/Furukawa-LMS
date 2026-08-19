import { executeQuery } from "../db/mssqlHelper.js";

// Mirrors the admin check the Daily Meeting frontend uses to decide whether to
// show the AdminConfigPanel / bypass department-section scoping — kept in sync
// so the server enforces exactly what the UI implies is already unrestricted.
export const isDailyMeetingAdmin = (user) => (
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true
);

// Reads (`daily_meeting:read`) are intentionally NOT scoped by this check — any
// user holding that permission can view meetings across every department and
// section. Only the write actions (create/update/delete/save-sheet) are scoped
// to the department(s)/section(s) a non-admin user is actually assigned to,
// via their `departmentId`/`departments` and `sectionId`/`sections` fields
// (single-assignment column + multi-assignment JSON array, same shape used
// elsewhere in the app, e.g. admin/src/pages/Admin/Students.jsx's
// `isRestrictedUser`). SuperAdmins/Admins bypass this scoping entirely.
export const canModifyDailyMeetingSection = async (user, sectionId) => {
    if (isDailyMeetingAdmin(user)) return true;
    if (!sectionId) return false;

    const [rows] = await executeQuery("SELECT departmentId FROM [sections] WHERE id = ?", [sectionId]);
    if (!rows || rows.length === 0) return false;
    const deptId = rows[0].departmentId;

    const userSectionIds = new Set([
        user?.sectionId != null ? String(user.sectionId) : null,
        ...(Array.isArray(user?.sections) ? user.sections.map(String) : [])
    ].filter(Boolean));

    const userDeptIds = new Set([
        user?.departmentId != null ? String(user.departmentId) : null,
        ...(Array.isArray(user?.departments) ? user.departments.map(String) : [])
    ].filter(Boolean));

    return userSectionIds.has(String(sectionId)) && userDeptIds.has(String(deptId));
};
