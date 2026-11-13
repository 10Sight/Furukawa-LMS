import { test } from "node:test";
import assert from "node:assert/strict";
import {
    canEditLeftAssociateHeader,
    canEditLeftAssociateDates,
    resolveLeftAssociateSave,
} from "../utils/sixteenDayLeftAssociate.util.js";

const sheet = () => ({
    employeeName: "Ravi Kumar",
    employeeCode: "EMP001",
    dept: "Assembly - Line A",
    processName: "Crimping",
    handoverDate: "2026-10-01",
    trgResult: "OK",
    workingWith: "Suresh",
    lineLeaderName: "Line A - Mohan",
    startDate: "2026-10-02",
    checkedBy: "Approved By: Mohan",
    verifiedBy: "",
    approvedBy: "",
    verifiedByEduCell: "",
    gridData: { attendance_date_1: "2026-10-02", row1_1_d1_0: "3", comment: "old" },
});

const admin = { isAdmin: true };
const editSubmitted = { role: "CUSTOM", customRole: { permissions: ["sixteen_day:edit_submitted"] } };
const manage = { role: "CUSTOM", customRole: { permissions: ["sixteen_day:manage"] } };
const checker = { role: "CUSTOM", customRole: { permissions: ["sixteen_day:check"] } };
const trainer = { isTrainer: true, customRole: { permissions: [] } };

test("canEditLeftAssociateHeader: admins, edit_submitted and manage only", () => {
    assert.equal(canEditLeftAssociateHeader(admin), true);
    assert.equal(canEditLeftAssociateHeader({ role: "SUPERADMIN" }), true);
    assert.equal(canEditLeftAssociateHeader({ role: "ADMIN" }), true);
    assert.equal(canEditLeftAssociateHeader(editSubmitted), true);
    assert.equal(canEditLeftAssociateHeader(manage), true);
    assert.equal(canEditLeftAssociateHeader(checker), false);
    assert.equal(canEditLeftAssociateHeader(trainer), false);
    assert.equal(canEditLeftAssociateHeader(undefined), false);
});

test("refuses to create a new attempt for a LEFT associate", () => {
    assert.throws(() => resolveLeftAssociateSave({ sheet: null, body: {}, user: admin }), /has left/);
    assert.throws(() => resolveLeftAssociateSave({ sheet: sheet(), body: { isNewAttempt: true }, user: admin }), /has left/);
});

test("grid stays frozen except the comment, for every user", () => {
    for (const user of [admin, checker]) {
        const { gridData } = resolveLeftAssociateSave({
            sheet: sheet(),
            body: { gridData: { row1_1_d1_0: "1", row1_1_day_5: "2", comment: "new" } },
            user,
        });
        assert.deepEqual(gridData, { attendance_date_1: "2026-10-02", row1_1_d1_0: "3", comment: "new" });
    }
});

const editLeftDates = { role: "CUSTOM", customRole: { permissions: ["sixteen_day:check", "sixteen_day:edit_left_dates"] } };
const datedSheet = () => ({
    ...sheet(),
    gridData: { attendance_date_1: "02-Oct-26", attendance_date_3: "06-Oct-26", row1_1_d1_0: "3", comment: "old" },
});

test("canEditLeftAssociateDates: admins and edit_left_dates only", () => {
    assert.equal(canEditLeftAssociateDates(admin), true);
    assert.equal(canEditLeftAssociateDates({ role: "SUPERADMIN" }), true);
    assert.equal(canEditLeftAssociateDates(editLeftDates), true);
    assert.equal(canEditLeftAssociateDates(manage), false);
    assert.equal(canEditLeftAssociateDates(editSubmitted), false);
    assert.equal(canEditLeftAssociateDates(undefined), false);
});

test("authorized user can set Day-1..Day-16 dates; other grid values stay frozen", () => {
    const { gridData } = resolveLeftAssociateSave({
        sheet: datedSheet(),
        body: { gridData: { attendance_date_2: "04-Oct-26", attendance_date_16: "30-Oct-26", row1_1_d1_0: "9", comment: "c" } },
        user: editLeftDates,
    });
    assert.equal(gridData.attendance_date_2, "04-Oct-26");
    assert.equal(gridData.attendance_date_16, "30-Oct-26");
    assert.equal(gridData.row1_1_d1_0, "3");
    assert.equal(gridData.comment, "c");
});

test("unauthorized user's date changes are ignored", () => {
    for (const user of [checker, manage]) {
        const { gridData } = resolveLeftAssociateSave({
            sheet: datedSheet(),
            body: { gridData: { attendance_date_1: "01-Oct-26", attendance_date_2: "04-Oct-26" } },
            user,
        });
        assert.equal(gridData.attendance_date_1, "02-Oct-26");
        assert.equal(gridData.attendance_date_2, undefined);
    }
});

test("changing or clearing a saved date needs an audit remark; filling an empty one doesn't", () => {
    assert.throws(
        () => resolveLeftAssociateSave({ sheet: datedSheet(), body: { gridData: { attendance_date_1: "01-Oct-26" } }, user: editLeftDates }),
        /audit remark/
    );
    assert.throws(
        () => resolveLeftAssociateSave({ sheet: datedSheet(), body: { gridData: { attendance_date_3: "" } }, user: editLeftDates }),
        /audit remark/
    );
    const { gridData } = resolveLeftAssociateSave({
        sheet: datedSheet(),
        body: { gridData: { attendance_date_1: "01-Oct-26" }, adminRemark: "Wrong date" },
        user: editLeftDates,
    });
    assert.equal(gridData.attendance_date_1, "01-Oct-26");
    // Resending the saved value unchanged is not a change.
    resolveLeftAssociateSave({ sheet: datedSheet(), body: { gridData: { attendance_date_1: "02-Oct-26", attendance_date_2: "" } }, user: editLeftDates });
});

test("non-string day dates are rejected (format and order are checked by validateDayDates)", () => {
    assert.throws(
        () => resolveLeftAssociateSave({ sheet: datedSheet(), body: { gridData: { attendance_date_2: 5 } }, user: editLeftDates }),
        /Invalid date for Day-2/
    );
});

test("authorized user can change header details with a remark; code and start date stay pinned", () => {
    const { header } = resolveLeftAssociateSave({
        sheet: sheet(),
        body: {
            employeeName: "Ravi K.", dept: "Assembly - Line B", handoverDate: "2026-10-03",
            processName: "Taping", employeeCode: "HACK", startDate: "2020-01-01", adminRemark: "Fixing typo",
        },
        user: manage,
    });
    assert.equal(header.employeeName, "Ravi K.");
    assert.equal(header.dept, "Assembly - Line B");
    assert.equal(header.handoverDate, "2026-10-03");
    assert.equal(header.processName, "Taping");
    assert.equal(header.trgResult, "OK"); // not sent -> kept
    assert.equal(header.employeeCode, "EMP001");
    assert.equal(header.startDate, "2026-10-02");
});

test("changing a saved header value without a remark is rejected", () => {
    assert.throws(
        () => resolveLeftAssociateSave({ sheet: sheet(), body: { employeeName: "Other" }, user: admin }),
        /audit remark/
    );
    // Filling a previously empty value needs no remark.
    const s = { ...sheet(), workingWith: "" };
    const { header } = resolveLeftAssociateSave({ sheet: s, body: { workingWith: "Anil" }, user: admin });
    assert.equal(header.workingWith, "Anil");
});

test("unauthorized user's header changes are ignored, signatures still pass through", () => {
    const { header, signatures } = resolveLeftAssociateSave({
        sheet: sheet(),
        body: { employeeName: "Other", dept: "Other", verifiedBy: "Verified By: Area" },
        user: checker,
    });
    assert.equal(header.employeeName, "Ravi Kumar");
    assert.equal(header.dept, "Assembly - Line A");
    assert.equal(signatures.verifiedBy, "Verified By: Area");
    assert.equal(signatures.checkedBy, "Approved By: Mohan");
});

test("non-string header values are ignored", () => {
    const { header } = resolveLeftAssociateSave({
        sheet: sheet(),
        body: { dept: { name: "x" }, adminRemark: "r" },
        user: admin,
    });
    assert.equal(header.dept, "Assembly - Line A");
});
