import { hasAnyPermission } from "../middlewares/roleAuth.middleware.js";

// Department/section scoping for Daily 5M records, stats and charts.
//
// Global admins (isAdmin / ADMIN / SUPERADMIN) see everything. Everyone else is
// limited to the departments/sections they are assigned to, using the same
// single-column + multi-assignment JSON array shape as dailyMeetingAccess.util.js.

const toIdSet = (single, many) => {
    const raw = [single, ...(Array.isArray(many) ? many : [])];
    return [...new Set(
        raw
            .map((v) => (v && typeof v === "object" ? (v.id ?? v._id) : v))
            .filter((v) => v !== null && v !== undefined && v !== "")
            .map(String)
    )];
};

export const resolveUser5MScope = (user) => {
    const isGlobalAdmin = !!(
        user?.isAdmin === true || user?.isAdmin === 1 ||
        user?.role === "ADMIN" || user?.role === "SUPERADMIN"
    );

    if (isGlobalAdmin) {
        return { isGlobalAdmin, allowedDepartmentIds: [], allowedSectionIds: [], isRestricted: false };
    }

    return {
        isGlobalAdmin,
        allowedDepartmentIds: toIdSet(user?.departmentId, user?.departments),
        allowedSectionIds: toIdSet(user?.sectionId, user?.sections),
        isRestricted: true
    };
};

// Validates the department/section a request asks for against the user's scope and
// returns the filters to hand to the Daily5MRecord model.
//
//   { forbidden: string }  -> caller should respond 403
//   { empty: true }        -> restricted user with no departments; caller returns an empty result
//   { departmentId, sectionId, allowedDepartmentIds, allowedSectionIds }
//
// `departmentParam` may be 'all', a single id, or a comma-separated list (chart endpoints).
// `allowedDepartmentIds` / `allowedSectionIds` are undefined for global admins (no scoping).
export const scope5MRequest = (user, departmentParam, sectionParam) => {
    const scope = resolveUser5MScope(user);
    const sectionId = sectionParam && sectionParam !== "all" ? String(sectionParam) : undefined;

    if (!scope.isRestricted) {
        return { departmentId: departmentParam, sectionId, allowedDepartmentIds: undefined, allowedSectionIds: undefined };
    }

    if (scope.allowedDepartmentIds.length === 0) {
        return { empty: true };
    }

    const requested = departmentParam && departmentParam !== "all"
        ? String(departmentParam).split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    if (requested.some((id) => !scope.allowedDepartmentIds.includes(id))) {
        return { forbidden: "You do not have access to the requested department" };
    }

    if (sectionId && scope.allowedSectionIds.length > 0 && !scope.allowedSectionIds.includes(sectionId)) {
        return { forbidden: "You do not have access to the requested section" };
    }

    return {
        departmentId: requested.length > 0 ? requested.join(",") : "all",
        sectionId,
        allowedDepartmentIds: scope.allowedDepartmentIds,
        allowedSectionIds: scope.allowedSectionIds.length > 0 ? scope.allowedSectionIds : undefined
    };
};

// True when the user may read 5M data of every department (global admins and daily5m:read holders).
// Read access only: it never grants edit, delete or approval rights.
export const canViewAll5MRecords = (user) =>
    resolveUser5MScope(user).isGlobalAdmin || hasAnyPermission(user, ["daily5m:read"]);

// Read-only "every department" scope used by the 5M dashboard (Records List and charts).
//   { forbidden: string } -> caller should respond 403
//   { departmentId, sectionId, allowedDepartmentIds: undefined, allowedSectionIds: undefined }
export const scope5MAllDepartmentsRequest = (user, departmentParam, sectionParam) => {
    if (!canViewAll5MRecords(user)) {
        return { forbidden: "You do not have permission to view all 5M records" };
    }
    return {
        departmentId: departmentParam,
        sectionId: sectionParam && sectionParam !== "all" ? String(sectionParam) : undefined,
        allowedDepartmentIds: undefined,
        allowedSectionIds: undefined
    };
};

// Picks the dashboard's all-departments scope when the request asks for it (?scope=all),
// otherwise the user's assignment scope.
export const scope5MRequestFor = (user, departmentParam, sectionParam, scopeParam) =>
    scopeParam === "all"
        ? scope5MAllDepartmentsRequest(user, departmentParam, sectionParam)
        : scope5MRequest(user, departmentParam, sectionParam);

// True when the user may see a record belonging to this department/section.
export const canView5MRecord = (user, record) => {
    const scope = resolveUser5MScope(user);
    if (!scope.isRestricted) return true;
    if (!scope.allowedDepartmentIds.includes(String(record?.departmentId))) return false;
    if (scope.allowedSectionIds.length > 0 && !scope.allowedSectionIds.includes(String(record?.sectionId))) return false;
    return true;
};
