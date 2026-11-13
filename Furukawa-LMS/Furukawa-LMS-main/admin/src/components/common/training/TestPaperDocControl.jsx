import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import useRevisionInfo from "@/hooks/useRevisionInfo.js";

// Same fallback TakeQuiz / AttemptReviewModal / QuizAttemptReviewPage use.
const TEST_PAPER_REVISION_FALLBACK = { docNo: "TST-HR-02", revNo: "02", revDate: "08.04.2021", issueDate: "08.04.2021" };

// Doc. No. / Rev. No. / Issue Date / Rev. Date for test papers are not stored per paper —
// they come live from the Revision Table (sheet key "test-paper"), resolved by the
// candidate's department. This panel shows the current values on the Add/Edit forms and
// links admins to where they are edited.
export default function TestPaperDocControl({ departmentIds = [] }) {
    const navigate = useNavigate();
    const authUser = useSelector((state) => state.auth.user);
    // The Revision Table lives under /admin (admin-only); only offer the link to those who can open it.
    const canOpenRevisionTable = !!(authUser?.isAdmin || authUser?.role === "ADMIN" || authUser?.role === "SUPERADMIN");

    // Preview a department's override only when the paper targets exactly one department.
    const singleDept = departmentIds.length === 1 ? departmentIds[0] : undefined;
    const info = useRevisionInfo("test-paper", TEST_PAPER_REVISION_FALLBACK, { departmentId: singleDept });

    const cells = [
        ["Doc. No.", info.docNo],
        ["Rev. No.", info.revNo],
        ["Issue Date", info.issueDate],
        ["Rev. Date", info.revDate],
    ];

    return (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-800">Document Control (ISO Information)</div>
                {canOpenRevisionTable && (
                    <button
                        type="button"
                        onClick={() => navigate("/admin/revision-table/test-paper")}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                        Edit in Revision Table →
                    </button>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {cells.map(([label, value]) => (
                    <div key={label} className="space-y-0.5">
                        <div className="text-[11px] font-medium text-gray-500">{label}</div>
                        <div className="text-sm font-mono text-gray-900">{value || "—"}</div>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
                Printed in the top-right header box of the test paper and result sheet. Managed centrally in the
                Revision Table (global default, with optional per-department overrides) — not stored per paper.
                {departmentIds.length > 1 && " Showing the global default; departments with an override will print their own values."}
            </p>
        </div>
    );
}
