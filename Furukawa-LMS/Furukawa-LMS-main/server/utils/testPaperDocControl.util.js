import RevisionRecord from "../models/revisionRecord.model.js";
import { hasPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

// Test paper document control (Doc. No. / Rev. No. / Issue Date / Rev. Date).
//
// A paper is in one of two modes:
//  - hasOwnDocControl = true  -> prints its own four values (set by a user holding
//                                test_paper:doc_control on the Add/Edit Test Paper form)
//  - hasOwnDocControl = false -> prints the department-wise values from the Revision
//                                Table (sheet key "test-paper"), resolved by the candidate's
//                                department/section, then department, then global
//
// Each attempt stores the values it was actually printed with (attempted_quizzes.quizDocNo
// etc.), so later edits to the paper or the Revision Table never rewrite old result sheets.

import { TEST_PAPER_SHEET_KEY, LEGACY_DOC_CONTROL, DOC_CONTROL_FIELDS, SNAPSHOT_COLUMN } from "./testPaperDocControl.constants.js";

export { TEST_PAPER_SHEET_KEY, LEGACY_DOC_CONTROL, DOC_CONTROL_FIELDS, SNAPSHOT_COLUMN };

export const canManageDocControl = (user) =>
    hasPermission(user, SYSTEM_PERMISSIONS.TEST_PAPER_DOC_CONTROL);

// undefined -> undefined ("not sent": leave the stored value alone)
// null / "" / whitespace -> null
// anything else -> trimmed string, capped at the 255-char column size
export const normalizeDocField = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const s = String(value).trim().slice(0, 255);
    return s === "" ? null : s;
};

const toBit = (v) => (v === true || v === 1 || v === "1" || v === "true" ? 1 : 0);

// Doc-control fields from a create/update request body, normalized. Users without the
// permission get {} — callers then write nothing, so a paper's document control can only
// ever be changed by a permission holder (the request is not rejected, just ignored).
export const pickDocControl = (user, body = {}) => {
    if (!canManageDocControl(user)) return {};
    const out = {};
    if (body.hasOwnDocControl !== undefined) out.hasOwnDocControl = toBit(body.hasOwnDocControl);
    for (const f of DOC_CONTROL_FIELDS) {
        const v = normalizeDocField(body[f]);
        if (v !== undefined) out[f] = v;
    }
    return out;
};

// The four values a paper prints for a candidate in the given department/section.
export const resolveTestPaperDocControl = async (quiz, { departmentId = null, sectionId = null } = {}) => {
    if (quiz?.hasOwnDocControl) {
        return Object.fromEntries(DOC_CONTROL_FIELDS.map((f) => [f, quiz[f] ?? null]));
    }
    let record = null;
    try {
        record = await RevisionRecord.findLatestForScope(TEST_PAPER_SHEET_KEY, departmentId || null, sectionId || null);
    } catch {
        record = null;
    }
    return Object.fromEntries(DOC_CONTROL_FIELDS.map((f) => [f, record?.[f] || LEGACY_DOC_CONTROL[f]]));
};

// Snapshot columns to store on a new attempt. Blank values are stored as "" (not NULL) so
// "snapshot taken, field blank" stays distinguishable from "no snapshot" (all NULL).
export const toAttemptSnapshot = (doc) =>
    Object.fromEntries(DOC_CONTROL_FIELDS.map((f) => [SNAPSHOT_COLUMN[f], doc?.[f] ?? ""]));

// The values an attempt's result sheet prints: its own snapshot when it has one, otherwise
// resolved live (defensive — the attempted_quizzes migration backfills older rows).
export const resolveAttemptDocControl = async (attempt, quiz) => {
    const hasSnapshot = DOC_CONTROL_FIELDS.some((f) => attempt?.[SNAPSHOT_COLUMN[f]] != null);
    if (hasSnapshot) {
        return Object.fromEntries(DOC_CONTROL_FIELDS.map((f) => [f, attempt[SNAPSHOT_COLUMN[f]] || null]));
    }
    return resolveTestPaperDocControl(quiz, {
        departmentId: attempt?.studentDeptId ?? null,
        sectionId: attempt?.studentSectionId ?? null,
    });
};
