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

        const reason = routingMismatchReason(actingUser, routing);
        if (reason) return { allowed: false, reason };
    }

    return { allowed: true };
}

// Why `user` is outside the resolved routing target (dept, then optional section/line), or null
// when they belong to it.
function routingMismatchReason(user, routing) {
    const userDepts = [user.departmentId, ...(Array.isArray(user.departments) ? user.departments : [])].map(String);
    if (!userDepts.includes(String(routing.deptId))) {
        return "You are not authorized to approve or reject records for this department";
    }

    if (routing.sectionId) {
        const userSections = [user.sectionId, ...(Array.isArray(user.sections) ? user.sections : [])].map(String);
        if (!userSections.includes(String(routing.sectionId))) {
            return "You are not authorized to approve or reject records for this section";
        }
    }

    if (routing.lineId) {
        const userLines = [user.lineId, ...(Array.isArray(user.lines) ? user.lines : [])].map(String);
        if (!userLines.includes(String(routing.lineId))) {
            return "You are not authorized to approve or reject records for this line";
        }
    }

    return null;
}

// True only when `department` / `section` has approval routing configured AND `user` belongs to
// the routed dept/section/line. Unlike canActOnRow (which allows everyone when nothing is
// configured), this is safe to use for granting a routed approver read access to a source
// department's records they could not otherwise see.
export function matchesDaily5MRouting(user, department, section) {
    const routing = resolveDaily5MRouting(department, section);
    return Boolean(user && routing) && routingMismatchReason(user, routing) === null;
}
