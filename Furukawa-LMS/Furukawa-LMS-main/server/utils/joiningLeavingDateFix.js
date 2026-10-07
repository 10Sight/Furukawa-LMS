import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import { toDateOnlyString } from "./dateValidation.js";

// Auto-correction for rows that break the "joiningDate <= leavingDate" rule, which the write
// paths now enforce but which older data (or another DB server that was never validated) can
// still contain. Shared by User.init() (runs on every server start, so any DB this app is
// pointed at heals itself) and scripts/correctJoiningLeavingDates.js (manual dry run / apply).
//
// Correction rule: the leaving date is raised to the joining date. The joining date is left
// alone because the rest of the app treats it as the frozen original hire date. Dates that can't
// be parsed are never touched. The same rule is applied inside each statusHistory entry, against
// that entry's own joiningDate.
//
// Every corrected row's original values are saved to user_date_corrections first, so a
// correction can be reviewed or reverted by hand.

const CORRECTIONS_TABLE = "user_date_corrections";

const ensureCorrectionsTable = async () => {
    if (await migrationHelper.tableExists(CORRECTIONS_TABLE)) return;
    await executeQuery(`
        CREATE TABLE ${CORRECTIONS_TABLE} (
            id INT IDENTITY(1,1) PRIMARY KEY,
            userId INT NOT NULL,
            oldJoiningDate NVARCHAR(255),
            oldLeavingDate NVARCHAR(255),
            newLeavingDate NVARCHAR(255),
            oldStatusHistory NVARCHAR(MAX),
            correctedAt DATETIME DEFAULT GETDATE()
        )
    `);
};

const parseHistory = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
};

// Works out what (if anything) needs correcting on one users row. Returns null when the row is
// already consistent.
export const getJoiningLeavingCorrection = (row) => {
    const joining = toDateOnlyString(row.joiningDate);
    const leaving = toDateOnlyString(row.leavingDate);
    const columnIsBad = !!(joining && leaving && leaving < joining);
    const newLeavingDate = columnIsBad ? joining : null;

    let historyChanged = false;
    const history = parseHistory(row.statusHistory);
    if (history) {
        // The last entry mirrors the leavingDate column, so move it along with the column.
        const last = history[history.length - 1];
        if (columnIsBad && last && toDateOnlyString(last.leavingDate) === leaving) {
            last.leavingDate = newLeavingDate;
            historyChanged = true;
        }
        for (const entry of history) {
            if (!entry) continue;
            const entryJoining = toDateOnlyString(entry.joiningDate);
            const entryLeaving = toDateOnlyString(entry.leavingDate);
            if (entryJoining && entryLeaving && entryLeaving < entryJoining) {
                entry.leavingDate = entryJoining;
                historyChanged = true;
            }
        }
    }

    if (!columnIsBad && !historyChanged) return null;
    return {
        newLeavingDate,
        newStatusHistory: historyChanged ? JSON.stringify(history) : null,
    };
};

// Scans users and corrects every offending row. With apply=false nothing is written and the
// result only reports what would change.
export const fixJoiningAfterLeavingDates = async ({ apply = true, log = () => {} } = {}) => {
    const [rows] = await executeQuery(`
        SELECT id, empId, fullName, joiningDate, leavingDate, statusHistory
        FROM users
        WHERE (leavingDate IS NOT NULL AND LTRIM(RTRIM(CAST(leavingDate AS NVARCHAR(255)))) <> '')
           OR statusHistory LIKE '%"leavingDate":"%'
    `);

    const corrected = [];
    let tableReady = false;

    for (const row of rows) {
        const correction = getJoiningLeavingCorrection(row);
        if (!correction) continue;

        log(`[user ${row.id} (${row.empId || "-"} - ${row.fullName || "-"})] joiningDate=${row.joiningDate} leavingDate=${row.leavingDate}`
            + (correction.newLeavingDate ? ` -> leavingDate=${correction.newLeavingDate}` : "")
            + (correction.newStatusHistory ? " (statusHistory corrected)" : ""));

        if (apply) {
            if (!tableReady) {
                await ensureCorrectionsTable();
                tableReady = true;
            }
            await executeQuery(
                `INSERT INTO ${CORRECTIONS_TABLE} (userId, oldJoiningDate, oldLeavingDate, newLeavingDate, oldStatusHistory) VALUES (?, ?, ?, ?, ?)`,
                [
                    row.id,
                    row.joiningDate ?? null,
                    row.leavingDate ?? null,
                    correction.newLeavingDate ?? row.leavingDate ?? null,
                    typeof row.statusHistory === "string" ? row.statusHistory : JSON.stringify(row.statusHistory ?? null),
                ]
            );

            const updates = [];
            const params = [];
            if (correction.newLeavingDate) {
                updates.push("leavingDate = ?");
                params.push(correction.newLeavingDate);
            }
            if (correction.newStatusHistory) {
                updates.push("statusHistory = ?");
                params.push(correction.newStatusHistory);
            }
            params.push(row.id);
            await executeQuery(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
        }

        corrected.push({ userId: row.id, empId: row.empId, ...correction });
    }

    return { scanned: rows.length, corrected };
};
