import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import useRevisionInfo from "@/hooks/useRevisionInfo.js";
import { Input } from "@/components/forms/primitives/input.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/forms/primitives/select.jsx";
import { LEGACY_DOC_CONTROL, TEST_PAPER_SHEET_KEY } from "@/utils/testPaperDocControl.js";

const FIELDS = [
    { key: "docNo", label: "Doc. No.", placeholder: "e.g. TST-HR-02" },
    { key: "revNo", label: "Rev. No.", placeholder: "e.g. 02" },
    { key: "issueDate", label: "Issue Date", placeholder: "DD.MM.YYYY" },
    { key: "revDate", label: "Rev. Date", placeholder: "DD.MM.YYYY" },
];

const ReadOnlyValues = ({ values }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-0.5">
                <div className="text-[11px] font-medium text-gray-500">{label}</div>
                <div className="text-sm font-mono text-gray-900 break-all">{values?.[key] || "—"}</div>
            </div>
        ))}
    </div>
);

// Document Control section of the Add/Edit Test Paper forms.
//
// value    = { hasOwnDocControl, docNo, revNo, issueDate, revDate } from the form state
// onChange = (patch) => void, merged into the form state
// canManage = user holds test_paper:doc_control (see canManageTestPaperDocControl)
//
// Own values ON  -> the paper prints the four values below.
// Own values OFF -> the paper prints the department-wise Revision Table values ("test-paper").
export default function TestPaperDocControl({ departmentIds = [], value, onChange, canManage }) {
    const navigate = useNavigate();
    const authUser = useSelector((state) => state.auth.user);
    // The Revision Table lives under /admin (admin-only); only offer the link to those who can open it.
    const canOpenRevisionTable = !!(authUser?.isAdmin || authUser?.role === "ADMIN" || authUser?.role === "SUPERADMIN");

    // Preview a department's override only when the paper targets exactly one department.
    const singleDept = departmentIds.length === 1 ? departmentIds[0] : undefined;
    const departmentWise = useRevisionInfo(TEST_PAPER_SHEET_KEY, LEGACY_DOC_CONTROL, { departmentId: singleDept });

    const ownOn = !!value?.hasOwnDocControl;

    return (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-800">Document Control (ISO Information)</div>
                {!ownOn && canOpenRevisionTable && (
                    <button
                        type="button"
                        onClick={() => navigate(`/admin/revision-table/${TEST_PAPER_SHEET_KEY}`)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                        Edit department-wise values in Revision Table →
                    </button>
                )}
            </div>

            {canManage && (
                <div className="grid gap-2 sm:max-w-xs">
                    <Label htmlFor="hasOwnDocControl">Use paper-specific document control?</Label>
                    <Select
                        value={ownOn ? "yes" : "no"}
                        onValueChange={(v) => onChange({ hasOwnDocControl: v === "yes" })}
                    >
                        <SelectTrigger id="hasOwnDocControl">
                            <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="no">No — use department-wise values</SelectItem>
                            <SelectItem value="yes">Yes — set values for this paper</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {ownOn && canManage && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {FIELDS.map(({ key, label, placeholder }) => (
                        <div key={key} className="grid gap-2">
                            <Label htmlFor={`doc-${key}`}>{label}</Label>
                            <Input
                                id={`doc-${key}`}
                                value={value?.[key] ?? ""}
                                maxLength={255}
                                placeholder={placeholder}
                                onChange={(e) => onChange({ [key]: e.target.value })}
                            />
                        </div>
                    ))}
                </div>
            )}

            {ownOn && !canManage && <ReadOnlyValues values={value} />}
            {!ownOn && <ReadOnlyValues values={departmentWise} />}

            <p className="text-[11px] text-muted-foreground">
                {ownOn
                    ? (canManage
                        ? "Printed in the top-right header box of this test paper and its result sheets. Leave a field blank to print “—”."
                        : "Set per paper by an authorised user. Printed in the top-right header box of this test paper and its result sheets.")
                    : "Department-wise values from the Revision Table, resolved by each candidate’s department."
                        + (departmentIds.length > 1 ? " Showing the global default; departments with an override print their own values." : "")}
                {" "}Result sheets keep the values they were printed with.
            </p>
        </div>
    );
}
