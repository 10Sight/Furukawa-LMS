// Single source of truth for Daily 5M approval routing, imported directly (no build step)
// by both server/controllers/daily5MRecord.controller.js and
// admin/src/pages/CMS/Daily5MRecording.jsx. Keeping the rule in one place means the client's
// approve/reject button visibility can never drift from what the server actually enforces.
// Pure and dependency-free so it works unmodified under both Node ESM and the Vite bundler.

// A section's own routing overrides its parent department's; department-level routing is the
// fallback when the section has none configured.
export function resolveDaily5MRouting(department, section) {
    if (section && section.daily5mApproverDeptId) {
        return {
            deptId: section.daily5mApproverDeptId,
            sectionId: section.daily5mApproverSectionId || null,
            lineId: section.daily5mApproverLineId || null,
        };
    }

    if (department && department.daily5mApproverDeptId) {
        return {
            deptId: department.daily5mApproverDeptId,
            sectionId: department.daily5mApproverSectionId || null,
            lineId: department.daily5mApproverLineId || null,
        };
    }

    return null;
}

// Segregation of Duties: can `actingUser` approve/reject a row filled by `rowSubmitterId`,
// sourced from `department` / `section`? Self-approval is never allowed, even for admins.
// Configured routing restricts approval to users in the resolved target dept/section/line,
// unless the acting user is an admin (emergency override for routing only, not for self-approval).
export function canActOnRow(actingUser, rowSubmitterId, department, section) {
    if (rowSubmitterId && String(actingUser.id) === String(rowSubmitterId)) {
        return { allowed: false, reason: "You cannot approve or reject your own submission" };
    }

    const routing = resolveDaily5MRouting(department, section);
    if (routing) {
        if (actingUser.isAdmin) return { allowed: true };

        const userDepts = [actingUser.departmentId, ...(Array.isArray(actingUser.departments) ? actingUser.departments : [])].map(String);
        if (!userDepts.includes(String(routing.deptId))) {
            return { allowed: false, reason: "You are not authorized to approve or reject records for this department" };
        }

        if (routing.sectionId) {
            const userSections = [actingUser.sectionId, ...(Array.isArray(actingUser.sections) ? actingUser.sections : [])].map(String);
            if (!userSections.includes(String(routing.sectionId))) {
                return { allowed: false, reason: "You are not authorized to approve or reject records for this section" };
            }
        }

        if (routing.lineId) {
            const userLines = [actingUser.lineId, ...(Array.isArray(actingUser.lines) ? actingUser.lines : [])].map(String);
            if (!userLines.includes(String(routing.lineId))) {
                return { allowed: false, reason: "You are not authorized to approve or reject records for this line" };
            }
        }
    }

    return { allowed: true };
}
