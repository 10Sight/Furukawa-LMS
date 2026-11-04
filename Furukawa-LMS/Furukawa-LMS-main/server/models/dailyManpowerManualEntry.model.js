import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import withTransaction from "../db/withTransaction.js";
import logger from "../logger/winston.logger.js";

// Manually entered rows of the Daily HR Meeting report (currently only "TRAINING"):
// - daily_manpower_training_monthly: Indent 01 / Indent 16 required headcount per month.
// - daily_manpower_manual_entries: present count and OT hours per date.

export const TRAINING_ROW_KEY = "TRAINING";

class DailyManpowerManualEntry {
    static _initPromise = null;

    static init() {
        if (!DailyManpowerManualEntry._initPromise) {
            DailyManpowerManualEntry._initPromise = DailyManpowerManualEntry._init().catch((error) => {
                DailyManpowerManualEntry._initPromise = null;
                throw error;
            });
        }
        return DailyManpowerManualEntry._initPromise;
    }

    static async _init() {
        if (!await migrationHelper.tableExists("daily_manpower_training_monthly")) {
            await executeQuery(`
                CREATE TABLE daily_manpower_training_monthly (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    [year] INT NOT NULL,
                    monthNumber INT NOT NULL,
                    rowKey NVARCHAR(100) NOT NULL DEFAULT 'TRAINING',
                    requiredFN01 INT NOT NULL DEFAULT 0,
                    requiredFN02 INT NOT NULL DEFAULT 0,
                    updatedBy INT NULL,
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UQ_DMR_Training_Month UNIQUE ([year], monthNumber, rowKey)
                )
            `);
            logger.info("Created daily_manpower_training_monthly table in MSSQL");
        }

        if (!await migrationHelper.tableExists("daily_manpower_manual_entries")) {
            await executeQuery(`
                CREATE TABLE daily_manpower_manual_entries (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    rowKey NVARCHAR(100) NOT NULL DEFAULT 'TRAINING',
                    entryDate DATE NOT NULL,
                    presentCount INT NOT NULL DEFAULT 0,
                    otHrs DECIMAL(6,2) NOT NULL DEFAULT 0,
                    remarks NVARCHAR(500) NULL,
                    updatedBy INT NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UQ_DMR_Manual_Entry UNIQUE (rowKey, entryDate)
                )
            `);
            logger.info("Created daily_manpower_manual_entries table in MSSQL");
        }
    }

    static async getTrainingMonth(year, monthNumber, rowKey = TRAINING_ROW_KEY) {
        await DailyManpowerManualEntry.init();
        const [rows] = await executeQuery(
            `SELECT requiredFN01, requiredFN02, updatedAt FROM daily_manpower_training_monthly
             WHERE [year] = ? AND monthNumber = ? AND rowKey = ?`,
            [year, monthNumber, rowKey]
        );
        const row = rows?.[0];
        return {
            requiredFN01: Number(row?.requiredFN01) || 0,
            requiredFN02: Number(row?.requiredFN02) || 0,
            updatedAt: row?.updatedAt || null,
        };
    }

    /** Map dateKey -> { presentCount, otHrs, remarks } for startDate..endDate inclusive. */
    static async getEntries(startDate, endDate, rowKey = TRAINING_ROW_KEY) {
        await DailyManpowerManualEntry.init();
        const [rows] = await executeQuery(
            `SELECT CONVERT(VARCHAR(10), entryDate, 23) AS entryDate, presentCount, otHrs, remarks
             FROM daily_manpower_manual_entries
             WHERE rowKey = ? AND entryDate >= CONVERT(DATE, ?, 23) AND entryDate <= CONVERT(DATE, ?, 23)`,
            [rowKey, startDate, endDate]
        );
        return new Map((rows || []).map((r) => [
            String(r.entryDate),
            {
                presentCount: Number(r.presentCount) || 0,
                otHrs: Number(r.otHrs) || 0,
                remarks: r.remarks || null,
            },
        ]));
    }

    /**
     * Saves the month's required headcount and the given daily entries in one transaction.
     * entries: [{ date, presentCount, otHrs, remarks }]
     */
    static async saveTrainingInputs({ year, monthNumber, requiredFN01, requiredFN02, entries, rowKey = TRAINING_ROW_KEY }, updatedBy) {
        await DailyManpowerManualEntry.init();
        await withTransaction(async (conn) => {
            if (requiredFN01 !== undefined || requiredFN02 !== undefined) {
                await conn.query(`
                    MERGE daily_manpower_training_monthly AS target
                    USING (SELECT ? AS [year], ? AS monthNumber, ? AS rowKey) AS source
                    ON target.[year] = source.[year] AND target.monthNumber = source.monthNumber AND target.rowKey = source.rowKey
                    WHEN MATCHED THEN UPDATE SET requiredFN01 = ?, requiredFN02 = ?, updatedBy = ?, updatedAt = GETDATE()
                    WHEN NOT MATCHED THEN INSERT ([year], monthNumber, rowKey, requiredFN01, requiredFN02, updatedBy, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, GETDATE());
                `, [
                    year, monthNumber, rowKey,
                    requiredFN01, requiredFN02, updatedBy ?? null,
                    year, monthNumber, rowKey, requiredFN01, requiredFN02, updatedBy ?? null,
                ]);
            }

            for (const entry of entries || []) {
                await conn.query(`
                    MERGE daily_manpower_manual_entries AS target
                    USING (SELECT ? AS rowKey, CONVERT(DATE, ?, 23) AS entryDate) AS source
                    ON target.rowKey = source.rowKey AND target.entryDate = source.entryDate
                    WHEN MATCHED THEN UPDATE SET presentCount = ?, otHrs = ?, remarks = ?, updatedBy = ?, updatedAt = GETDATE()
                    WHEN NOT MATCHED THEN INSERT (rowKey, entryDate, presentCount, otHrs, remarks, updatedBy, createdAt, updatedAt)
                        VALUES (?, CONVERT(DATE, ?, 23), ?, ?, ?, ?, GETDATE(), GETDATE());
                `, [
                    rowKey, entry.date,
                    entry.presentCount, entry.otHrs, entry.remarks ?? null, updatedBy ?? null,
                    rowKey, entry.date, entry.presentCount, entry.otHrs, entry.remarks ?? null, updatedBy ?? null,
                ]);
            }
        });
    }
}

export default DailyManpowerManualEntry;
