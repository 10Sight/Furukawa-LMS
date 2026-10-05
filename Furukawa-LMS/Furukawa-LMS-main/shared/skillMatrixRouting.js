// Single source of truth for Skill Matrix signature approval routing, imported directly (no build
// step) by both server/controllers/skillMatrix.controller.js and admin/src/pages/Admin/SkillMatrix.jsx.
// Keeping the rule in one place means the client's approve/reject button visibility can never drift
// from what the server actually enforces. Pure and dependency-free so it works unmodified under both
// Node ESM and the Vite bundler.
//
// Unlike Daily 5M (one approval action per row), the Skill Matrix footer has three independently
// signed-off roles — qa, safety, process — each typically owned by a different team, so routing is
// resolved and enforced per role rather than once per department/section.

export const SKILL_MATRIX_SIGNATURE_ROLES = ["qa", "safety", "process"];

const cap = (role) => role.charAt(0).toUpperCase() + role.slice(1);

// A section's own routing for `role` overrides its parent department's; department-level routing is
// the fallback when the section has none configured for that role.
export function resolveSkillMatrixRouting(department, section, role) {
    const deptField = `skillMatrixApprover${cap(role)}DeptId`;
    const sectionField = `skillMatrixApprover${cap(role)}SectionId`;
    const lineField = `skillMatrixApprover${cap(role)}LineId`;

    if (section && section[deptField]) {
        return {
            deptId: section[deptField],
            sectionId: section[sectionField] || null,
            lineId: section[lineField] || null,
        };
    }

    if (department && department[deptField]) {
        return {
            deptId: department[deptField],
            sectionId: department[sectionField] || null,
            lineId: department[lineField] || null,
        };
    }

    return null;
}

// Segregation of Duties: can `actingUser` approve/reject the `role` signature (qa/safety/process) on
// a Skill Matrix sourced from `department` / `section`? If no routing is configured for that role,
// anyone with access to the sheet may sign. Admins bypass configured routing (emergency override).
export function canActOnSkillMatrix(actingUser, department, section, role) {
    const routing = resolveSkillMatrixRouting(department, section, role);
    if (!routing) return { allowed: true };

    if (actingUser.isAdmin) return { allowed: true };

    const userDepts = [actingUser.departmentId, ...(Array.isArray(actingUser.departments) ? actingUser.departments : [])].map(String);
    if (!userDepts.includes(String(routing.deptId))) {
        return { allowed: false, reason: `You are not authorized to sign the ${role} approval for this department` };
    }

    if (routing.sectionId) {
        const userSections = [actingUser.sectionId, ...(Array.isArray(actingUser.sections) ? actingUser.sections : [])].map(String);
        if (!userSections.includes(String(routing.sectionId))) {
            return { allowed: false, reason: `You are not authorized to sign the ${role} approval for this section` };
        }
    }

    if (routing.lineId) {
        const userLines = [actingUser.lineId, ...(Array.isArray(actingUser.lines) ? actingUser.lines : [])].map(String);
        if (!userLines.includes(String(routing.lineId))) {
            return { allowed: false, reason: `You are not authorized to sign the ${role} approval for this line` };
        }
    }

    return { allowed: true };
}
