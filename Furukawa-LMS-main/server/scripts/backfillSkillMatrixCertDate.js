import { executeQuery } from "../db/mssqlHelper.js";
import { formatCertDate } from "../utils/skillMatrix.util.js";

// One-time backfill for skill_matrices rows saved before syncStudentSkillProgress started
// writing entry.certDate from the student's evaluation sheet. Those rows still carry
// whatever certDate was baked in at save time (originally just the user's updatedAt), and
// SkillMatrix.jsx's mapping prefers that stored value over a freshly computed one
// (`savedUserEntry?.certDate || ...`), so they won't self-correct until the student's next
// evaluation sheet save. This walks every skill_matrices row once and rewrites each
// non-manual entry's certDate to match its student's latest active evaluation sheet.
//
// Usage:
//   node scripts/backfillSkillMatrixCertDate.js          (dry run, logs only)
//   node scripts/backfillSkillMatrixCertDate.js --apply  (writes changes)

const parseJSON = (data, fallback) => {
    if (typeof data === "string") {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

async function backfill() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "Running in APPLY mode — changes will be written." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

    const [sheets] = await executeQuery(
        `SELECT studentId, headerData FROM skill_matrix_evaluations WHERE isActive = 1`
    );

    // Latest-active-sheet-per-student -> formatted certDate ("DD.MM.YYYY"), skipping students
    // whose date doesn't parse (matches the live sync path, which also no-ops in that case).
    const certDateByStudentId = new Map();
    for (const sheet of sheets) {
        const headerData = parseJSON(sheet.headerData, {});
        const certDate = formatCertDate(headerData.dateOfEvaluation);
        if (certDate) certDateByStudentId.set(String(sheet.studentId), certDate);
    }
    console.log(`Found ${sheets.length} active evaluation sheet(s), ${certDateByStudentId.size} with a parsable date.`);

    const [matrices] = await executeQuery(
        `SELECT id, entries FROM skill_matrices WHERE ISJSON(entries) = 1`
    );
    console.log(`Scanning ${matrices.length} skill_matrices row(s).`);

    let rowsChanged = 0;
    let entriesChanged = 0;

    for (const matrix of matrices) {
        let entriesList = parseJSON(matrix.entries, []);
        if (!Array.isArray(entriesList)) continue;

        let matrixChanged = false;
        for (const entry of entriesList) {
            const entryUserId = String(entry.userId || entry._id || "");
            if (!entryUserId || entry.isManual) continue;

            const certDate = certDateByStudentId.get(entryUserId);
            if (certDate && entry.certDate !== certDate) {
                console.log(`[matrix ${matrix.id}] studentId=${entryUserId} certDate: "${entry.certDate || ""}" -> "${certDate}"`);
                entry.certDate = certDate;
                matrixChanged = true;
                entriesChanged++;
            }
        }

        if (matrixChanged) {
            rowsChanged++;
            if (apply) {
                await executeQuery(
                    "UPDATE skill_matrices SET entries = ?, updatedAt = GETDATE() WHERE id = ?",
                    [JSON.stringify(entriesList), matrix.id]
                );
            }
        }
    }

    console.log(`${apply ? "Updated" : "Would update"} ${entriesChanged} entr${entriesChanged === 1 ? "y" : "ies"} across ${rowsChanged} skill_matrices row(s).`);
    console.log("Done.");
    process.exit(0);
}

backfill().catch(err => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
