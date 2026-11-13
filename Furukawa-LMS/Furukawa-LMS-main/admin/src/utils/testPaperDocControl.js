// Test paper document control (Doc. No. / Rev. No. / Issue Date / Rev. Date).
// Mirrors server/utils/testPaperDocControl.util.js — keep the two in step.

export const TEST_PAPER_SHEET_KEY = "test-paper";

// What every test paper printed before document control existed; the fallback when the
// Revision Table has no value for a field.
export const LEGACY_DOC_CONTROL = Object.freeze({
    docNo: "TST-HR-02",
    revNo: "02",
    issueDate: "08.04.2021",
    revDate: "08.04.2021",
});

export const DOC_CONTROL_PERMISSION = "test_paper:doc_control";

// Same rule the server enforces (roleAuth hasPermission): SUPERADMIN and ADMIN always,
// otherwise only a custom role that includes the permission. Deliberately NOT the form's
// hasButtonPermission, which also passes every trainer — the server would ignore their values.
export const canManageTestPaperDocControl = (user) => {
    if (!user) return false;
    if (user.role === "SUPERADMIN" || user.role === "ADMIN") return true;
    return (user.customRole?.permissions || []).includes(DOC_CONTROL_PERMISSION);
};

// A paper's own four values, as stored on the quiz.
export const paperDocControl = (quiz) => ({
    docNo: quiz?.docNo ?? null,
    revNo: quiz?.revNo ?? null,
    issueDate: quiz?.issueDate ?? null,
    revDate: quiz?.revDate ?? null,
});
