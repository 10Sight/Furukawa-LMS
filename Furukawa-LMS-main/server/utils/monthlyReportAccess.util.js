import { executeQuery } from "../db/mssqlHelper.js";

// Mirrors dailyMeetingAccess.util.js's shape for the Monthly Meeting Report
// feature — kept as its own file (not shared) the same way daily5mScope.util.js
// is feature-owned rather than generalized across features.
export const isMonthlyReportAdmin = (user) => (
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true
);

// Reads (`monthly_report:read`) are intentionally NOT scoped by this check — any
// user holding that permission can view folders/records across every department
// and section. Only write actions (create/delete folder, upload/delete record)
// are scoped to the department(s)/section(s) a non-admin user is actually
// assigned to. SuperAdmins/Admins bypass this scoping entirely.
export const canModifyMonthlyReportSection = async (user, sectionId) => {
    if (isMonthlyReportAdmin(user)) return true;
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
