// Dependency-free constants for test paper document control, importable from models
// without pulling in controllers/middleware (see testPaperDocControl.util.js).

export const TEST_PAPER_SHEET_KEY = "test-paper";

// What every test paper printed before document control existed. Used when the Revision
// Table has no value for a field (same rule as the frontend's useRevisionInfo fallback).
export const LEGACY_DOC_CONTROL = Object.freeze({
    docNo: "TST-HR-02",
    revNo: "02",
    issueDate: "08.04.2021",
    revDate: "08.04.2021",
});

export const DOC_CONTROL_FIELDS = ["docNo", "revNo", "issueDate", "revDate"];

// Attempt snapshot column for each field: docNo -> quizDocNo, etc.
export const SNAPSHOT_COLUMN = Object.freeze({
    docNo: "quizDocNo",
    revNo: "quizRevNo",
    issueDate: "quizIssueDate",
    revDate: "quizRevDate",
});
