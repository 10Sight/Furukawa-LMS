import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";
import { getEligibleUserSql } from "../utils/userEligibility.js";
import logger from "../logger/winston.logger.js";

/*
|--------------------------------------------------------------------------
| Dashboard Holiday Model (embedded here to avoid separate Holiday.js file)
|--------------------------------------------------------------------------
*/
class Holiday {
    static async init() {
        const createTable = `
            IF OBJECT_ID('dbo.dashboard_holidays', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.dashboard_holidays (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    holidayDate DATE NOT NULL,
                    holidayName NVARCHAR(100) NOT NULL,
                    shortCode NVARCHAR(10) NOT NULL,
                    holidayType NVARCHAR(30) NOT NULL
                        CONSTRAINT DF_dashboard_holidays_holidayType DEFAULT 'CUSTOM',
                    description NVARCHAR(255) NULL,
                    isActive BIT NOT NULL
                        CONSTRAINT DF_dashboard_holidays_isActive DEFAULT 1,
                    createdBy INT NULL,
                    createdAt DATETIME2 NOT NULL
                        CONSTRAINT DF_dashboard_holidays_createdAt DEFAULT SYSDATETIME(),
                    updatedAt DATETIME2 NOT NULL
                        CONSTRAINT DF_dashboard_holidays_updatedAt DEFAULT SYSDATETIME()
                );
            END;

            IF NOT EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE name = 'IX_dashboard_holidays_holidayDate'
                  AND object_id = OBJECT_ID('dbo.dashboard_holidays')
            )
            BEGIN
                CREATE INDEX IX_dashboard_holidays_holidayDate
                ON dbo.dashboard_holidays(holidayDate);
            END;
        `;

        try {
            await executeQuery(createTable);
            logger.info("[Holiday Model] Checked/Created dashboard_holidays table");
            return true;
        } catch (error) {
            logger.error(
                "[Holiday Model] Failed to initialize dashboard_holidays table",
                error
            );
            throw error;
        }
    }

    static async getAll({ startDate, endDate } = {}) {
        await this.init();

        let query = `
            SELECT TOP (500)
                id,
                CONVERT(VARCHAR(10), holidayDate, 23) AS holidayDate,
                holidayName,
                shortCode,
                holidayType,
                description,
                isActive,
                createdBy,
                createdAt,
                updatedAt
            FROM dbo.dashboard_holidays
            WHERE ISNULL(isActive, 1) = 1
        `;

        const params = [];

        if (startDate) {
            query += ` AND holidayDate >= CONVERT(DATE, ?, 23)`;
            params.push(String(startDate).slice(0, 10));
        }

        if (endDate) {
            query += ` AND holidayDate <= CONVERT(DATE, ?, 23)`;
            params.push(String(endDate).slice(0, 10));
        }

        query += ` ORDER BY holidayDate DESC`;

        const [rows] = await executeQuery(query, params);

        return rows || [];
    }

    static async getForRange(startDate, endDate) {
        if (!startDate || !endDate) {
            return [];
        }

        await this.init();

        const query = `
            SELECT
                id,
                CONVERT(VARCHAR(10), holidayDate, 23) AS holidayDate,
                holidayName,
                shortCode,
                holidayType,
                description,
                isActive,
                createdBy,
                createdAt,
                updatedAt
            FROM dbo.dashboard_holidays
            WHERE ISNULL(isActive, 1) = 1
              AND holidayDate >= CONVERT(DATE, ?, 23)
              AND holidayDate <= CONVERT(DATE, ?, 23)
            ORDER BY holidayDate ASC
        `;

        const [rows] = await executeQuery(
            query,
            [startDate, endDate]
        );

        return rows || [];
    }

    static async create({
        holidayDate,
        holidayName,
        shortCode,
        holidayType = "CUSTOM",
        description = "",
        createdBy = null,
    }) {
        await this.init();

        const query = `
            MERGE dbo.dashboard_holidays AS target

            USING (
                SELECT
                    CONVERT(DATE, ?, 23) AS holidayDate,
                    CAST(? AS NVARCHAR(100)) AS holidayName,
                    CAST(? AS NVARCHAR(10)) AS shortCode,
                    CAST(? AS NVARCHAR(30)) AS holidayType,
                    CAST(? AS NVARCHAR(255)) AS description,
                    CAST(? AS INT) AS createdBy
            ) AS source

            ON target.holidayDate = source.holidayDate

            WHEN MATCHED THEN
                UPDATE SET
                    target.holidayName = source.holidayName,
                    target.shortCode = source.shortCode,
                    target.holidayType = source.holidayType,
                    target.description = NULLIF(source.description, ''),
                    target.isActive = 1,
                    target.updatedAt = SYSDATETIME()

            WHEN NOT MATCHED THEN
                INSERT (
                    holidayDate,
                    holidayName,
                    shortCode,
                    holidayType,
                    description,
                    isActive,
                    createdBy,
                    createdAt,
                    updatedAt
                )
                VALUES (
                    source.holidayDate,
                    source.holidayName,
                    source.shortCode,
                    source.holidayType,
                    NULLIF(source.description, ''),
                    1,
                    source.createdBy,
                    SYSDATETIME(),
                    SYSDATETIME()
                )

            OUTPUT
                inserted.id,
                CONVERT(VARCHAR(10), inserted.holidayDate, 23) AS holidayDate,
                inserted.holidayName,
                inserted.shortCode,
                inserted.holidayType,
                inserted.description,
                inserted.isActive,
                inserted.createdBy,
                inserted.createdAt,
                inserted.updatedAt;
        `;

        const [rows] = await executeQuery(query, [
            holidayDate,
            holidayName,
            shortCode,
            holidayType,
            description || "",
            createdBy ? Number(createdBy) : null,
        ]);

        return rows?.[0] || null;
    }

    static async delete(id) {
        await this.init();

        const holidayId = Number(id);

        if (!Number.isInteger(holidayId) || holidayId <= 0) {
            return null;
        }

        const query = `
            UPDATE dbo.dashboard_holidays

            SET
                isActive = 0,
                updatedAt = SYSDATETIME()

            OUTPUT
                inserted.id,
                CONVERT(VARCHAR(10), inserted.holidayDate, 23) AS holidayDate,
                inserted.holidayName,
                inserted.shortCode,
                inserted.holidayType,
                inserted.description,
                inserted.isActive,
                inserted.createdBy,
                inserted.createdAt,
                inserted.updatedAt

            WHERE id = ?
        `;

        const [rows] = await executeQuery(
            query,
            [holidayId]
        );

        return rows?.[0] || null;
    }
}

Holiday.init().catch((error) => {
    console.error(
        "[Holiday Model] Initialization error:",
        error
    );
});


const parseMultiParam = (value) => {
    if (!value) return [];
    const strVal = String(value).trim();
    const upperVal = strVal.toUpperCase();
    if (upperVal === "ALL" || upperVal === "UNDEFINED" || upperVal === "NULL" || strVal === "") return [];
    return strVal
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .filter(item => {
            const upper = item.toUpperCase();
            return upper !== "ALL" && upper !== "UNDEFINED" && upper !== "NULL" && item !== "";
        });
};


// Dynamic designation shutter rule used by every dashboard/report employee population.
// A shutter may be stored by designation name (for example Supervisor) or by its
// designation id (for example 1090), so both values are compared safely.
const getDashboardDesignationShutterExclusionSql = (alias = "u") => `
    AND NOT EXISTS (
        SELECT 1
        FROM designation_shutters ds
        WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${alias}.designation))), '') IS NOT NULL
          AND (
                UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ds.designation))))
                    = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${alias}.designation))))
                OR UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ds.id))))
                    = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${alias}.designation))))
              )
    )
`;

// Base population shared by every Dashboard Total Manpower / Users Total query.
// Keep this aligned with the SDP employee population before applying date-wise statusHistory.
// Historical reconstruction needs PRESENT and LEFT users, but every other current status is excluded.
const getTotalManpowerBaseEligibilitySql = (alias = "u") => `
    AND ISNULL(${alias}.isDeleted, 0) = 0
    AND ISNULL(${alias}.isTemporary, 0) = 0
    AND ISNULL(${alias}.isEmployee, 0) = 1
    AND ${alias}.empId IS NOT NULL
    AND LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${alias}.empId))) <> ''
    AND UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(${alias}.status, ''))))) IN ('PRESENT', 'LEFT')
    AND ISNULL(${alias}.designation, '') NOT IN (
        '1076',
        '1077',
        '1081',
        'DRIVER',
        'Supervisor',
        'Staff'
    )
    ${getDashboardDesignationShutterExclusionSql(alias)}
`;

// Rejoining Trend uses the same employee/master exclusions as Total Manpower,
// but current status is intentionally not restricted. Rejoin events are historical
// statusHistory events and must remain visible even if the employee later became
// LEFT, ON_LEAVE, or another employment status.
const getRejoiningTrendBaseEligibilitySql = (alias = "u") => `
    AND ISNULL(${alias}.isDeleted, 0) = 0
    AND ISNULL(${alias}.isTemporary, 0) = 0
    AND ISNULL(${alias}.isEmployee, 0) = 1
    AND ${alias}.empId IS NOT NULL
    AND LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${alias}.empId))) <> ''
    AND ISNULL(${alias}.designation, '') NOT IN (
        '1076',
        '1077',
        '1081',
        'DRIVER',
        'Supervisor',
        'Staff'
    )
    ${getDashboardDesignationShutterExclusionSql(alias)}
`;

// TENURE GRAPHS ONLY:
// Keep their existing current-status population unchanged. Tenure calculations continue
// to use the dedicated users.joiningDate and users.leavingDate columns as requested.
const getFirstGraphTotalManpowerEligibilitySql = (alias = "u") => `
    AND ${alias}.isDeleted = 0
    AND ${alias}.isTemporary = 0
    AND ISNULL(${alias}.designation, '') NOT IN (
        '1076',
        '1077',
        '1081',
        'DRIVER',
        'Supervisor',
        'Staff'
    )
    ${getDashboardDesignationShutterExclusionSql(alias)}
    AND ${alias}.status = 'PRESENT'
`;


const normalizeDashboardHolidayRow = (row = {}) => ({
    id: Number(row.id || 0),
    holidayDate: row.holidayDate
        ? String(row.holidayDate).slice(0, 10)
        : row.fullDate
            ? String(row.fullDate).slice(0, 10)
            : null,
    holidayName: String(row.holidayName || "Holiday").trim(),
    shortCode: String(row.shortCode || "H").trim().toUpperCase(),
    holidayType: String(row.holidayType || "CUSTOM").trim().toUpperCase(),
    description: row.description ? String(row.description).trim() : "",
    isActive: row.isActive === undefined ? true : Boolean(row.isActive),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
});

const getDashboardHolidaysForRange = async (startDate, endDate) => {
    if (!startDate || !endDate) return [];

    // Ensure holiday table exists before dashboard holiday lookup.
    await Holiday.init();

    try {
        const [rows] = await executeQuery(
            `
                SELECT
                    id,
                    CONVERT(VARCHAR(10), holidayDate, 23) AS holidayDate,
                    holidayName,
                    shortCode,
                    holidayType,
                    description,
                    isActive,
                    createdAt,
                    updatedAt
                FROM dashboard_holidays
                WHERE ISNULL(isActive, 1) = 1
                  AND holidayDate >= CONVERT(DATE, ?, 23)
                  AND holidayDate <= CONVERT(DATE, ?, 23)
                ORDER BY holidayDate ASC
            `,
            [startDate, endDate]
        );

        return (rows || []).map(normalizeDashboardHolidayRow);
    } catch (error) {
        // Dashboard must continue working even before the migration is run.
        console.warn("[DASHBOARD] Holiday lookup skipped:", error.message);
        return [];
    }
};

export const getDashboardHolidays = asyncHandler(async (req, res) => {
    // Ensure holiday table exists before reading holidays.
    await Holiday.init();

    const { startDate, endDate } = req.query;
    const conditions = ["ISNULL(isActive, 1) = 1"];
    const params = [];

    if (startDate) {
        conditions.push("holidayDate >= CONVERT(DATE, ?, 23)");
        params.push(String(startDate).slice(0, 10));
    }

    if (endDate) {
        conditions.push("holidayDate <= CONVERT(DATE, ?, 23)");
        params.push(String(endDate).slice(0, 10));
    }

    const [rows] = await executeQuery(
        `
            SELECT TOP (500)
                id,
                CONVERT(VARCHAR(10), holidayDate, 23) AS holidayDate,
                holidayName,
                shortCode,
                holidayType,
                description,
                isActive,
                createdAt,
                updatedAt
            FROM dashboard_holidays
            WHERE ${conditions.join(" AND ")}
            ORDER BY holidayDate DESC
        `,
        params
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { holidays: (rows || []).map(normalizeDashboardHolidayRow) },
            "Dashboard holidays fetched successfully"
        )
    );
});

export const saveDashboardHoliday = asyncHandler(async (req, res) => {
    // Ensure holiday table exists before saving.
    await Holiday.init();

    const holidayDate = String(req.body?.holidayDate || "").trim();
    const holidayName = String(req.body?.holidayName || "").trim();
    const shortCode = String(req.body?.shortCode || "").trim().toUpperCase();
    const holidayType = String(req.body?.holidayType || "CUSTOM").trim().toUpperCase();
    const description = String(req.body?.description || "").trim();
    const createdBy = Number(req.user?.id || req.user?.userId || 0) || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
        return res.status(400).json(
            new ApiResponse(400, null, "holidayDate must be in YYYY-MM-DD format")
        );
    }

    if (!holidayName) {
        return res.status(400).json(
            new ApiResponse(400, null, "Holiday name is required")
        );
    }

    if (!shortCode || shortCode.length > 10) {
        return res.status(400).json(
            new ApiResponse(400, null, "Short code is required and must be 10 characters or fewer")
        );
    }

    const [rows] = await executeQuery(
        `
            MERGE dashboard_holidays AS target
            USING (
                SELECT
                    CONVERT(DATE, ?, 23) AS holidayDate,
                    CAST(? AS NVARCHAR(100)) AS holidayName,
                    CAST(? AS NVARCHAR(10)) AS shortCode,
                    CAST(? AS NVARCHAR(30)) AS holidayType,
                    CAST(? AS NVARCHAR(255)) AS description,
                    CAST(? AS INT) AS createdBy
            ) AS source
            ON target.holidayDate = source.holidayDate
            WHEN MATCHED THEN
                UPDATE SET
                    target.holidayName = source.holidayName,
                    target.shortCode = source.shortCode,
                    target.holidayType = source.holidayType,
                    target.description = NULLIF(source.description, ''),
                    target.isActive = 1,
                    target.updatedAt = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (
                    holidayDate,
                    holidayName,
                    shortCode,
                    holidayType,
                    description,
                    isActive,
                    createdBy,
                    createdAt,
                    updatedAt
                )
                VALUES (
                    source.holidayDate,
                    source.holidayName,
                    source.shortCode,
                    source.holidayType,
                    NULLIF(source.description, ''),
                    1,
                    source.createdBy,
                    SYSDATETIME(),
                    SYSDATETIME()
                )
            OUTPUT
                inserted.id,
                CONVERT(VARCHAR(10), inserted.holidayDate, 23) AS holidayDate,
                inserted.holidayName,
                inserted.shortCode,
                inserted.holidayType,
                inserted.description,
                inserted.isActive,
                inserted.createdAt,
                inserted.updatedAt;
        `,
        [holidayDate, holidayName, shortCode, holidayType, description, createdBy]
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { holiday: normalizeDashboardHolidayRow(rows?.[0] || {}) },
            "Dashboard holiday saved successfully"
        )
    );
});

export const deleteDashboardHoliday = asyncHandler(async (req, res) => {
    // Ensure holiday table exists before deleting.
    await Holiday.init();

    const holidayId = Number(req.params?.id);

    if (!Number.isInteger(holidayId) || holidayId <= 0) {
        return res.status(400).json(
            new ApiResponse(400, null, "Valid holiday id is required")
        );
    }

    const [rows] = await executeQuery(
        `
            UPDATE dashboard_holidays
            SET isActive = 0,
                updatedAt = SYSDATETIME()
            OUTPUT
                inserted.id,
                CONVERT(VARCHAR(10), inserted.holidayDate, 23) AS holidayDate,
                inserted.holidayName,
                inserted.shortCode,
                inserted.holidayType,
                inserted.description,
                inserted.isActive,
                inserted.createdAt,
                inserted.updatedAt
            WHERE id = ?
        `,
        [holidayId]
    );

    if (!rows?.length) {
        return res.status(404).json(
            new ApiResponse(404, null, "Holiday not found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, { id: holidayId }, "Dashboard holiday deleted successfully")
    );
});


export const getDashboardStats = asyncHandler(async (req, res) => {
    const {
        department,
        section,
        line,
        startDate,
        endDate,
        stateFilter,
        districtFilter,
        masterAttendanceMode,
        shift,
    } = req.query;

    const selectedShiftValue = shift && String(shift).trim().toUpperCase() !== 'ALL' ? String(shift).trim() : null;


    function addShiftFilter(sqlText, params, alias = "al") {
        if (!selectedShiftValue) return sqlText;

        const shiftColumn = `UPPER(LTRIM(RTRIM(CAST(${alias}.shift AS NVARCHAR(100)))))`;
        const shiftColumnCompact = `REPLACE(REPLACE(REPLACE(${shiftColumn}, ' ', ''), '-', ''), '_', '')`;

        sqlText += `
            AND (
                ${shiftColumn} = UPPER(LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = 'SHIFT' + REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '') + 'SHIFT'
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND ${shiftColumnCompact} IN ('G', 'GEN', 'GENERAL', 'GENERALSHIFT', 'SHIFTG', 'GSHIFT')
                )
            )
        `;

        params.push(
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue
        );

        return sqlText;
    }

    // Same shift matching logic, but for users table.
    // This is used for Users Total/master bars so they are fetched from users table,
    // not from attendance_logs. It fixes missing employees in Contractor and other master graphs.
    function addUserShiftFilter(sqlText, params, alias = "u") {
        if (!selectedShiftValue) return sqlText;

        const shiftColumn = `UPPER(LTRIM(RTRIM(CAST(${alias}.shift AS NVARCHAR(100)))))`;
        const shiftColumnCompact = `REPLACE(REPLACE(REPLACE(${shiftColumn}, ' ', ''), '-', ''), '_', '')`;

        sqlText += `
            AND (
                ${shiftColumn} = UPPER(LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = 'SHIFT' + REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '') + 'SHIFT'
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND ${shiftColumnCompact} IN ('G', 'GEN', 'GENERAL', 'GENERALSHIFT', 'SHIFTG', 'GSHIFT')
                )
            )
        `;

        params.push(
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue
        );

        return sqlText;
    }

    const isMasterAttendanceMode =
        String(masterAttendanceMode || "").toUpperCase() === "YES";

    // Jab user date/date-range select kare, to selected attendance date available hai ya nahi check hoga.
    // Agar attendance upload nahi hai, to dashboard me old/master/snapshot data show nahi hoga.
    const hasSelectedDateForDashboard = Boolean(startDate);

    const safeName = (s) => String(s || "").replace(/'/g, "''");

    const departmentIds = parseMultiParam(department);
    const sectionIds = parseMultiParam(section);
    const lineIds = parseMultiParam(line);

    const getNamesByIds = async (table, ids) => {
        if (!ids.length) return [];

        const numericIds = ids
            .map(id => parseInt(id, 10))
            .filter(id => !Number.isNaN(id));

        if (!numericIds.length) return [];

        try {
            const placeholders = numericIds.map(() => "?").join(",");
            const [rows] = await executeQuery(
                `SELECT name FROM [${table}] WHERE id IN (${placeholders})`,
                numericIds
            );
            return rows.map(row => String(row.name || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn(`[DASHBOARD] ${table} lookup failed:`, e.message);
            return [];
        }
    };



    const departmentNames = await getNamesByIds("departments", departmentIds);
    const sectionNames = await getNamesByIds("sections", sectionIds);
    const lineNames = await getNamesByIds("lines", lineIds);

    const departmentName = departmentNames[0] || null;
    const sectionName = sectionNames[0] || null;
    const lineName = lineNames[0] || null;

    const buildNameInCondition = (columnSql, names) => {
        if (!names || names.length === 0) return "";
        const safeValues = names.map(name => `'${safeName(name)}'`).join(",");
        return ` AND UPPER(LTRIM(RTRIM(${columnSql}))) IN (${safeValues.split(",").map(v => `UPPER(${v})`).join(",")})`;
    };

    const numericDepartmentIds = departmentIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));

    const numericSectionIds = sectionIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));

    const numericLineIds = lineIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));


    // SECTION HIERARCHY FIX:
    // A user belongs to a selected section when any one of these is true:
    // 1) users.sectionId directly matches the selected section,
    // 2) users.sectionId is blank and the user's line/sub-section resolves to it,
    // 3) the user's id exists in sections.users JSON for the selected section.
    // This matches the SDP section assignment rule and prevents section-wise
    // Total Manpower/Attendance mismatches without changing other filters.
    const getSectionHierarchyMatchSql = (alias = "u") => {
        if (!numericSectionIds.length && !sectionNames.length) return "";

        const selectedDirectSectionSql = numericSectionIds.length
            ? `directSection.id IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(directSection.name AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        const selectedResolvedSectionSql = numericSectionIds.length
            ? `resolvedSection.id IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(resolvedSection.name AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        const selectedJsonSectionSql = numericSectionIds.length
            ? `jsonSection.id IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(jsonSection.name AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        return `(
            /*
             * CANONICAL ONE-SECTION RULE — used by Dashboard first graph and reports.
             *
             * Priority 1: a valid users.sectionId is the employee's section.
             * Priority 2: only when no valid direct section exists, resolve section from line/sub-section.
             * Priority 3: only when neither direct nor line-resolved section exists, use sections.users JSON.
             *             If stale JSON contains the same employee in multiple sections, the lowest
             *             active section id in the employee's department wins.
             *
             * Result: one employee can belong to at most one section, so section totals do not
             * duplicate the same employee across Direct / Indirect rows.
             */
            (
                EXISTS (
                    SELECT 1
                    FROM sections directSection
                    WHERE directSection.id = ${alias}.sectionId
                      AND directSection.departmentId = ${alias}.departmentId
                      AND ISNULL(directSection.isActive, 1) = 1
                      AND ${selectedDirectSectionSql}
                )
            )

            OR (
                NOT EXISTS (
                    SELECT 1
                    FROM sections directSection
                    WHERE directSection.id = ${alias}.sectionId
                      AND directSection.departmentId = ${alias}.departmentId
                      AND ISNULL(directSection.isActive, 1) = 1
                )
                AND EXISTS (
                    SELECT 1
                    FROM [lines] resolvedLine
                    LEFT JOIN sub_sections resolvedSubSection
                        ON resolvedSubSection.id = ${alias}.subSectionId
                    INNER JOIN sections resolvedSection
                        ON resolvedSection.id = resolvedLine.sectionId
                       AND resolvedSection.departmentId = ${alias}.departmentId
                       AND ISNULL(resolvedSection.isActive, 1) = 1
                    WHERE resolvedLine.id = COALESCE(${alias}.lineId, resolvedSubSection.lineId)
                      AND ISNULL(resolvedLine.isActive, 1) = 1
                      AND ${selectedResolvedSectionSql}
                )
            )

            OR (
                NOT EXISTS (
                    SELECT 1
                    FROM sections directSection
                    WHERE directSection.id = ${alias}.sectionId
                      AND directSection.departmentId = ${alias}.departmentId
                      AND ISNULL(directSection.isActive, 1) = 1
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM [lines] anyResolvedLine
                    LEFT JOIN sub_sections anyResolvedSubSection
                        ON anyResolvedSubSection.id = ${alias}.subSectionId
                    INNER JOIN sections anyResolvedSection
                        ON anyResolvedSection.id = anyResolvedLine.sectionId
                       AND anyResolvedSection.departmentId = ${alias}.departmentId
                       AND ISNULL(anyResolvedSection.isActive, 1) = 1
                    WHERE anyResolvedLine.id = COALESCE(${alias}.lineId, anyResolvedSubSection.lineId)
                      AND ISNULL(anyResolvedLine.isActive, 1) = 1
                )
                AND EXISTS (
                    SELECT 1
                    FROM sections jsonSection
                    CROSS APPLY OPENJSON(
                        CASE
                            WHEN ISJSON(CAST(jsonSection.[users] AS NVARCHAR(MAX))) = 1
                            THEN CAST(jsonSection.[users] AS NVARCHAR(MAX))
                            ELSE N'[]'
                        END
                    ) jsonSectionUser
                    WHERE jsonSection.departmentId = ${alias}.departmentId
                      AND ISNULL(jsonSection.isActive, 1) = 1
                      AND ${selectedJsonSectionSql}
                      AND TRY_CAST(jsonSectionUser.[value] AS INT) = ${alias}.id
                      AND NOT EXISTS (
                          SELECT 1
                          FROM sections earlierJsonSection
                          CROSS APPLY OPENJSON(
                              CASE
                                  WHEN ISJSON(CAST(earlierJsonSection.[users] AS NVARCHAR(MAX))) = 1
                                  THEN CAST(earlierJsonSection.[users] AS NVARCHAR(MAX))
                                  ELSE N'[]'
                              END
                          ) earlierJsonUser
                          WHERE earlierJsonSection.departmentId = ${alias}.departmentId
                            AND ISNULL(earlierJsonSection.isActive, 1) = 1
                            AND earlierJsonSection.id < jsonSection.id
                            AND TRY_CAST(earlierJsonUser.[value] AS INT) = ${alias}.id
                      )
                )
            )
        )`;
    };

    // IMPORTANT FIX:
    // Attendance/present graphs must use the same hierarchy source as Current Headcount.
    // Current Headcount users.departmentId/users.sectionId se count hota hai.
    // Pehle attendance snapshot hierarchy se filter ho raha tha,
    // jiski wajah se department + shift select karne par attendance extra employees count kar sakta tha.
    let hierCondition = "";

    if (numericDepartmentIds.length) {
        hierCondition += ` AND u.departmentId IN (${numericDepartmentIds.join(",")})`;
    } else {
        hierCondition += buildNameInCondition("u.[department]", departmentNames);
    }

    const sectionHierarchyMatchSql = getSectionHierarchyMatchSql("u");
    if (sectionHierarchyMatchSql) {
        hierCondition += ` AND ${sectionHierarchyMatchSql}`;
    }

    if (numericLineIds.length) {
        hierCondition += ` AND u.lineId IN (${numericLineIds.join(",")})`;
    } else {
        hierCondition += buildNameInCondition("u.[line]", lineNames);
    }

    // ATTRITION ONLY:
    // Attrition hierarchy filters now come directly from users table.
    // The legacy snapshot table is no longer required anywhere in dashboard logic.
    // isTemporary / isDeleted / designation filters remain intentionally unchanged for attrition.
    const attritionHierCondition = hierCondition;

    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    // Dashboard day must follow India timezone even when Node/VPS runs in UTC.
    const today = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    today.setHours(0, 0, 0, 0);

    // ⚠️ TIMEZONE FIX:
    // new Date("2026-05-17") parses as UTC midnight (2026-05-17T00:00:00Z).
    // In IST (UTC+5:30), setHours(0,0,0,0) then resets to IST midnight
    // which is 2026-05-16T18:30:00Z — so formatDateLocal returns "2026-05-16"!
    // Fix: parse date strings manually so date is created in LOCAL timezone.
    const parseDateLocal = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = String(dateStr).split("-").map(Number);
        if (!y || !m || !d) return null;
        const date = new Date(y, m - 1, d, 0, 0, 0, 0); // local timezone
        return date;
    };

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = formatDateLocal(today);
    const yesterdayStr = formatDateLocal(yesterday);

    let todayHasAttendance = false;
    try {
        // TODAY DATE FIX (top three graphs only):
        // Previously this gate checked only Shift A. If today's attendance existed in
        // another selected shift, General shift, or with Shift = ALL, the dashboard
        // incorrectly fell back to yesterday and today's date disappeared.
        // Reuse the existing shift matcher: selected shift checks that shift; ALL checks
        // any attendance row for today. No graph calculation/filter logic is changed.
        let checkTodaySql = `
            SELECT TOP 1 1
            FROM attendance_logs al
            WHERE CONVERT(DATE, al.[date]) = CONVERT(DATE, ?, 23)
        `;
        const todayCheckParams = [todayStr];
        checkTodaySql = addShiftFilter(checkTodaySql, todayCheckParams, "al");

        const [todayCheckRows] = await executeQuery(checkTodaySql, todayCheckParams);
        todayHasAttendance = todayCheckRows && todayCheckRows.length > 0;
    } catch (checkErr) {
        console.warn("[DASHBOARD] Today attendance check failed:", checkErr.message);
    }

    const effectiveDateStr = todayHasAttendance ? todayStr : yesterdayStr;

    // AUGUST 1 / TODAY FIX — FIRST THREE GRAPHS ONLY:
    // The top graph range must always end on the actual India date. Previously,
    // when the attendance availability gate returned false for any reason, the
    // requested/current date was silently replaced with yesterday. That removed
    // today's date from Manpower, Attrition and Absenteeism even though the date
    // and attendance rows existed. Keep effectiveDateStr unchanged for the lower
    // graph/master logic; only the first-three-graph range is made independent.
    const topGraphEffectiveDateStr = todayStr;

    let rangeStart;
    let rangeEnd;

    if (startDate) {
        // Never replace an explicitly selected today date with yesterday.
        rangeStart = parseDateLocal(startDate) || parseDateLocal(topGraphEffectiveDateStr);
        rangeEnd = parseDateLocal(endDate || startDate) || parseDateLocal(topGraphEffectiveDateStr);
    } else {
        // Default 30-day top graph range always includes the actual current date.
        rangeEnd = parseDateLocal(topGraphEffectiveDateStr);
        rangeStart = parseDateLocal(topGraphEffectiveDateStr);
        rangeStart.setDate(rangeStart.getDate() - 29);
    }

    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const sqlStartDate = formatDateLocal(rangeStart);
    const sqlEndDate = formatDateLocal(rangeEnd);

    let loopDates = [];
    let currDate = new Date(rangeStart);

    while (currDate <= rangeEnd) {
        loopDates.push(new Date(currDate));
        currDate.setDate(currDate.getDate() + 1);
    }

    const yearsInRange = [...new Set(loopDates.map((d) => d.getFullYear()))];


    // Holiday calendar is checked before attendance values are used.
    // Other dashboard calculations remain unchanged.
    const topHolidayRows = await getDashboardHolidaysForRange(sqlStartDate, sqlEndDate);
    const holidayByDate = new Map(
        topHolidayRows
            .filter(item => item.holidayDate)
            .map(item => [item.holidayDate, item])
    );
    const topHolidayDateSqlList = topHolidayRows
        .map(item => item.holidayDate)
        .filter(Boolean)
        .map(date => `'${String(date).replace(/'/g, "''")}'`)
        .join(",");

    // Attrition date parser for users table nvarchar date columns.
    // leavingDate/joiningDate users table me nvarchar hai, isliye safe TRY_CONVERT multiple formats ke saath use karna zaroori hai.
    const userDateToDateSql = (columnSql) => `
        COALESCE(
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 23),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 103),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 105),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 120),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 121),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 101),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 110),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 106),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 107)
        )
    `;

    // Total Manpower lifecycle rule:
    // 1) statusHistory is authoritative when it contains at least one valid joiningDate.
    // 2) Only PRESENT employment periods are active/open. A closed LEFT period is counted
    //    only for its historical worked dates: joiningDate <= date < leavingDate.
    // 3) An open history period is counted only when both history status and users.status
    //    are PRESENT. Other statuses cannot enter Total Manpower.
    // 4) leavingDate is exclusive, so an employee LEFT on 23-Jul is removed on 23-Jul itself.
    // 5) A rejoined employee starts counting again from the new joiningDate.
    // 6) Old users without usable history retain the PRESENT/LEFT legacy-column fallback.
    // 7) Tenure graphs do not call this helper; they keep users.joiningDate/leavingDate directly.
    const getStatusHistoryActiveConditionSql = (alias = "u", asOfDateSql) => {
        const historyJsonSql = `CASE
            WHEN ISJSON(CAST(${alias}.statusHistory AS NVARCHAR(MAX))) = 1
            THEN CAST(${alias}.statusHistory AS NVARCHAR(MAX))
            ELSE N'[]'
        END`;

        const historyJoiningDateSql = userDateToDateSql(
            `JSON_VALUE(historyRow.[value], '$.joiningDate')`
        );
        const historyLeavingDateSql = userDateToDateSql(
            `JSON_VALUE(historyRow.[value], '$.leavingDate')`
        );
        const historyStatusSql = `UPPER(LTRIM(RTRIM(CONVERT(
            NVARCHAR(100),
            ISNULL(JSON_VALUE(historyRow.[value], '$.status'), '')
        ))))`;

        const legacyJoiningDateSql = userDateToDateSql(`${alias}.joiningDate`);
        const legacyLeavingDateSql = userDateToDateSql(`${alias}.leavingDate`);
        const legacyStatusSql = `UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(${alias}.status, '')))))`;

        return `(
            EXISTS (
                SELECT 1
                FROM OPENJSON(${historyJsonSql}) historyRow
                CROSS APPLY (
                    SELECT
                        ${historyStatusSql} AS employmentStatus,
                        ${historyJoiningDateSql} AS joiningDate,
                        ${historyLeavingDateSql} AS leavingDate
                ) historyPeriod
                WHERE historyPeriod.joiningDate IS NOT NULL
                  AND historyPeriod.joiningDate <= ${asOfDateSql}
                  AND (
                        (
                            historyPeriod.employmentStatus = 'PRESENT'
                            AND (
                                historyPeriod.leavingDate IS NULL
                                OR historyPeriod.leavingDate > ${asOfDateSql}
                            )
                            AND (
                                historyPeriod.leavingDate IS NOT NULL
                                OR ${legacyStatusSql} = 'PRESENT'
                            )
                        )
                        OR (
                            historyPeriod.employmentStatus = 'LEFT'
                            AND historyPeriod.leavingDate IS NOT NULL
                            AND historyPeriod.leavingDate > ${asOfDateSql}
                        )
                      )
            )
            OR (
                NOT EXISTS (
                    SELECT 1
                    FROM OPENJSON(${historyJsonSql}) historyRow
                    CROSS APPLY (
                        SELECT ${historyJoiningDateSql} AS joiningDate
                    ) validHistoryPeriod
                    WHERE validHistoryPeriod.joiningDate IS NOT NULL
                )
                AND (
                    (
                        ${legacyStatusSql} = 'PRESENT'
                        AND (
                            ${legacyJoiningDateSql} IS NULL
                            OR ${legacyJoiningDateSql} <= ${asOfDateSql}
                        )
                    )
                    OR (
                        ${legacyStatusSql} = 'LEFT'
                        AND ${legacyLeavingDateSql} IS NOT NULL
                        AND ${legacyLeavingDateSql} > ${asOfDateSql}
                        AND (
                            ${legacyJoiningDateSql} IS NULL
                            OR ${legacyJoiningDateSql} <= ${asOfDateSql}
                        )
                    )
                )
            )
        )`;
    };

    const getActiveUserAsOfDateSql = (alias = "u", asOfDate) => {
        const safeAsOfDate = String(asOfDate || sqlEndDate).replace(/'/g, "''");
        return `
            AND ${getStatusHistoryActiveConditionSql(
                alias,
                `CONVERT(DATE, '${safeAsOfDate}', 23)`
            )}
        `;
    };

    // PERFORMANCE FIX:
    // SQL Server only fetches the eligible employee rows. statusHistory is parsed once
    // in Node.js, which avoids correlated OPENJSON calls for every graph date and avoids
    // SQL Server aggregate/subquery errors.
    const parseManpowerDateKey = (value) => {
        if (value === null || value === undefined) return null;

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return (
                value.getFullYear() * 10000
                + (value.getMonth() + 1) * 100
                + value.getDate()
            );
        }

        const raw = String(value).trim();
        const upper = raw.toUpperCase();
        if (!raw || upper === 'NULL' || upper === 'UNDEFINED' || upper === 'INVALID DATE') {
            return null;
        }

        let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return year * 10000 + month * 100 + day;
            }
        }

        // Match the SQL helper priority: DD/MM/YYYY and DD-MM-YYYY before US formats.
        match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (match) {
            const day = Number(match[1]);
            const month = Number(match[2]);
            const year = Number(match[3]);
            if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return year * 10000 + month * 100 + day;
            }
        }

        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return (
                parsed.getFullYear() * 10000
                + (parsed.getMonth() + 1) * 100
                + parsed.getDate()
            );
        }

        return null;
    };

    const getValidStatusHistoryPeriods = (userRow = {}) => {
        let history = userRow.statusHistory;

        if (typeof history === 'string') {
            const trimmed = history.trim();
            if (!trimmed) return [];
            try {
                history = JSON.parse(trimmed);
            } catch (_) {
                return [];
            }
        }

        if (!Array.isArray(history)) return [];

        return history
            .map((item) => ({
                status: String(item?.status || '').trim().toUpperCase(),
                joiningDateKey: parseManpowerDateKey(item?.joiningDate),
                leavingDateKey: parseManpowerDateKey(item?.leavingDate),
            }))
            .filter((item) => item.joiningDateKey !== null);
    };

    // REJOINING TREND ONLY:
    // statusHistory ka first valid joiningDate original joining hai and graph me show nahi hoga.
    // Second, third, fourth... every valid joiningDate is a separate rejoin event and is shown
    // on its own date. users.joiningDate fallback intentionally use nahi hota.
    const getStatusHistoryRejoiningDateKeys = (userRow = {}) => {
        let history = userRow.statusHistory;

        if (typeof history === 'string') {
            const trimmed = history.trim();
            if (!trimmed) return [];
            try {
                history = JSON.parse(trimmed);
            } catch (_) {
                return [];
            }
        }

        if (!Array.isArray(history) || history.length < 2) return [];

        const validJoiningDateKeys = history
            .map((item) => parseManpowerDateKey(item?.joiningDate))
            .filter((dateKey) => dateKey !== null);

        // First valid joiningDate = original joining. Remaining dates = rejoining events.
        return validJoiningDateKeys.slice(1);
    };

    const prepareManpowerUser = (userRow = {}) => ({
        id: userRow.id,
        currentStatus: String(userRow.status || '').trim().toUpperCase(),
        historyPeriods: getValidStatusHistoryPeriods(userRow),
        legacyJoiningDateKey: parseManpowerDateKey(userRow.joiningDate),
        legacyLeavingDateKey: parseManpowerDateKey(userRow.leavingDate),
    });

    const isUserActiveForManpowerDate = (preparedUser, asOfDateValue) => {
        const asOfDateKey = parseManpowerDateKey(asOfDateValue);
        if (asOfDateKey === null) return false;

        const currentStatus = preparedUser?.currentStatus || '';
        const historyPeriods = preparedUser?.historyPeriods || [];

        if (historyPeriods.length > 0) {
            return historyPeriods.some((period) => {
                if (period.joiningDateKey > asOfDateKey) return false;

                // Closed LEFT period reconstructs only dates actually worked.
                if (period.status === 'LEFT') {
                    return (
                        period.leavingDateKey !== null
                        && asOfDateKey < period.leavingDateKey
                    );
                }

                if (period.status !== 'PRESENT') return false;

                // Closed PRESENT period is historical and uses the same exclusive leaving date.
                if (period.leavingDateKey !== null) {
                    return asOfDateKey < period.leavingDateKey;
                }

                // Open/current period is valid only when the current users.status is PRESENT.
                return currentStatus === 'PRESENT';
            });
        }

        // Legacy fallback for users without any valid statusHistory joiningDate.
        const joinedByDate = (
            preparedUser.legacyJoiningDateKey === null
            || preparedUser.legacyJoiningDateKey <= asOfDateKey
        );

        if (currentStatus === 'PRESENT') {
            return joinedByDate;
        }

        if (currentStatus === 'LEFT') {
            return (
                joinedByDate
                && preparedUser.legacyLeavingDateKey !== null
                && asOfDateKey < preparedUser.legacyLeavingDateKey
            );
        }

        return false;
    };

    let dailyHeadcountByDate = {};

    const buildDailyAttritionDataFromUsers = async () => {
        const leaveDateSql = userDateToDateSql("u.leavingDate");

        // NORMAL ATTRITION:
        // Use the same dashboard date range as the upper graphs.
        // Default = last 30 days; selected startDate/endDate = selected range.
        let attritionHeadcountTotal = 0;

        try {
            let totalSql = `
                SELECT COUNT(DISTINCT u.id) AS total
                FROM users u
                WHERE UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) = 'LEFT'
                  AND u.leavingDate IS NOT NULL
                  AND LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))) != ''
                  AND UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate)))) != 'NULL'
                  AND ${leaveDateSql} IS NOT NULL
                  ${attritionHierCondition}
                  ${getEligibleUserSql("u")}
                  ${getDashboardDesignationShutterExclusionSql("u")}
                  -- NOTE: Attrition me employee tabhi count hoga jab users.status = LEFT ho.
                  -- leavingDate sirf employee ke exact left date ko determine karegi.
                  -- PRESENT status employee leavingDate filled hone par bhi attrition me count nahi hoga.
                  -- Hierarchy filters are applied directly from users table.
                  -- Same common dashboard eligibility applies here:
                  -- isTemporary = 0, isDeleted = 0, valid empId, and shutter designation exclusion.
            `;

            const [totalRows] = await executeQuery(totalSql, []);
            attritionHeadcountTotal = Number(totalRows?.[0]?.total || 0);
        } catch (e) {
            console.warn("[DASHBOARD] Attrition total headcount query failed:", e.message);
            attritionHeadcountTotal = 0;
        }

        let attrSql = `
            SELECT
                CONVERT(VARCHAR, parsed.leaving_date, 23) AS fullDate,
                COUNT(DISTINCT parsed.userId) AS leftCount
            FROM (
                SELECT
                    u.id AS userId,
                    ${leaveDateSql} AS leaving_date
                FROM users u
                WHERE UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) = 'LEFT'
                  AND u.leavingDate IS NOT NULL
                  AND LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))) != ''
                  AND UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate)))) != 'NULL'
                  ${attritionHierCondition}
                  ${getEligibleUserSql("u")}
                  ${getDashboardDesignationShutterExclusionSql("u")}
                  -- NOTE: Attrition me pehle users.status = LEFT check hoga.
                  -- leavingDate employee ko uske exact left date par show karegi.
                  -- PRESENT status employee attrition graph me count nahi hoga.
                  -- Same common dashboard eligibility applies here:
                  -- isTemporary = 0, isDeleted = 0, valid empId, and shutter designation exclusion.
                  -- Shift behavior remains unchanged.
        `;

        const attrParams = [];

        // NORMAL ATTRITION:
        // Follow the dashboard date range filter.
        attrSql += `
                  AND ${leaveDateSql} >= ?
                  AND ${leaveDateSql} <= ?
        `;
        attrParams.push(sqlStartDate, sqlEndDate);

        attrSql += `
            ) parsed
            WHERE parsed.leaving_date IS NOT NULL
            GROUP BY parsed.leaving_date
            ORDER BY parsed.leaving_date
        `;

        const [attrRows] = await executeQuery(attrSql, attrParams);

        // NORMAL ATTRITION:
        // Return one point for every date in the dashboard date range.
        return loopDates
            .map((iterDateRaw) => {
                const iterDate = new Date(iterDateRaw);
                const day = iterDate.getDate();
                const monthShort = iterDate.toLocaleString("en-US", { month: "short" });
                const dateStr = formatDateLocal(iterDate);

                iterDate.setHours(0, 0, 0, 0);
                const isFuture = iterDate > today;

                if (isFuture) return null;

                const row = attrRows.find((r) => r.fullDate === dateStr);
                const leftCount = row ? Number(row.leftCount) || 0 : 0;
                const totalHeadcount = Number(
                    dailyHeadcountByDate[dateStr] ?? snapshotTotal ?? attritionHeadcountTotal
                ) || 0;
                const rate = totalHeadcount > 0
                    ? Number(((leftCount / totalHeadcount) * 100).toFixed(2))
                    : 0;

                return {
                    day: `${day} ${monthShort}`,
                    actual: rate,
                    leftCount,
                    totalHeadcount,
                    target: 2.0,
                };
            })
            .filter(Boolean);
    };

    // Attendance availability check must never hide Total Manpower or Attrition.
    // When selected/current date attendance is not uploaded, attendance bars remain zero,
    // but users-table manpower and users.leavingDate attrition still return normally.
    let attendanceDateAvailable = !hasSelectedDateForDashboard;

    if (hasSelectedDateForDashboard) {
        try {
            let attendanceGateSql = `
                SELECT COUNT(DISTINCT u.id) AS cnt
                FROM attendance_logs al
                INNER JOIN users u ON al.userId = u.id
                WHERE CONVERT(DATE, al.[date]) >= CONVERT(DATE, '${sqlStartDate}', 23)
                  AND CONVERT(DATE, al.[date]) <= CONVERT(DATE, '${sqlEndDate}', 23)
                  ${topHolidayDateSqlList ? `AND CONVERT(DATE, al.[date]) NOT IN (${topHolidayDateSqlList})` : ""}
                  AND ISNULL(u.isTemporary, 0) = 0
                  ${hierCondition}
                  ${getEligibleUserSql("u")}
                  ${getDashboardDesignationShutterExclusionSql("u")}
            `;
            const gateParams = [];
            attendanceGateSql = addShiftFilter(attendanceGateSql, gateParams, "al");

            const [gateRows] = await executeQuery(attendanceGateSql, gateParams);
            attendanceDateAvailable = Number(gateRows?.[0]?.cnt || 0) > 0;
        } catch (e) {
            console.warn("[DASHBOARD] Attendance availability check failed:", e.message);
            attendanceDateAvailable = false;
        }
    }

    if (!attendanceDateAvailable && topHolidayRows.length > 0) {
        attendanceDateAvailable = true;
    }

    let reqResults = [];

    const numericYearsInRange = yearsInRange
        .map(y => parseInt(y, 10))
        .filter(y => !Number.isNaN(y));

    const makePlaceholders = (count) => Array.from({ length: count }, () => "?").join(",");

    const addTextInFilter = (conditions, params, columnSql, values = []) => {
        const cleanValues = (values || [])
            .map(v => String(v || "").trim())
            .filter(Boolean);

        if (!cleanValues.length) return;

        conditions.push(`UPPER(LTRIM(RTRIM(CAST(${columnSql} AS NVARCHAR(510))))) IN (${cleanValues.map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))").join(",")})`);
        params.push(...cleanValues);
    };

    const approvalCondition = `
        AND (
            (
                ISNULL(r.is_active, 0) = 1
                AND LOWER(LTRIM(RTRIM(ISNULL(r.approvalStatus, 'approved')))) IN (
                    'approved',
                    'system_approved',
                    'system approved',
                    'system-approved',
                    'systemapproved'
                )
            )
            OR LOWER(LTRIM(RTRIM(ISNULL(r.approvalStatus, '')))) IN (
                'system_approved',
                'system approved',
                'system-approved',
                'systemapproved'
            )
        )
    `;

    try {
        if (!numericYearsInRange.length) {
            reqResults = [];
        } else if (numericLineIds.length || lineNames.length) {
            // Line filter selected: requirement must come from line_requirements table.
            // Day 1-15 = fn01, Day 16-end = fn02.
            const params = [];
            const conditions = [
                `lr.requirementYear IN (${makePlaceholders(numericYearsInRange.length)})`,
                `(lr.type IS NULL OR UPPER(LTRIM(RTRIM(lr.type))) = 'MONTHLY')`,
            ];
            params.push(...numericYearsInRange);

            if (numericLineIds.length) {
                conditions.push(`lr.lineId IN (${makePlaceholders(numericLineIds.length)})`);
                params.push(...numericLineIds);
            } else if (lineNames.length) {
                const lineNamePlaceholders = lineNames.map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))").join(",");
                conditions.push(`(
                    UPPER(LTRIM(RTRIM(CAST(l.name AS NVARCHAR(510))))) IN (${lineNamePlaceholders})
                    OR UPPER(LTRIM(RTRIM(CAST(l.description AS NVARCHAR(510))))) IN (${lineNamePlaceholders})
                )`);
                params.push(...lineNames, ...lineNames);
            }

            const lineReqSql = `
                SELECT
                    lr.requirementYear AS yearVal,
                    lr.requirementMonth AS monthNumber,
                    CAST(SUM(ISNULL(lr.fn01, 0)) AS BIGINT) AS required_fn01,
                    CAST(SUM(ISNULL(lr.fn02, 0)) AS BIGINT) AS required_fn02
                FROM line_requirements lr
                LEFT JOIN [lines] l ON l.id = lr.lineId
                WHERE ${conditions.join(" AND ")}
                GROUP BY lr.requirementYear, lr.requirementMonth
            `;

            const [rows] = await executeQuery(lineReqSql, params);
            reqResults = rows;
        } else {
            // Department / section / all filters: requirement must come from requirements table.
            // requirements table does not have departmentId, so department filter is applied by joining
            // requirements.sectionCode / sectionName with sections and then departments.
            const params = [];
            const conditions = [
                `r.[year] IN (${makePlaceholders(numericYearsInRange.length)})`,
            ];
            params.push(...numericYearsInRange);

            if (numericDepartmentIds.length) {
                conditions.push(`d.id IN (${makePlaceholders(numericDepartmentIds.length)})`);
                params.push(...numericDepartmentIds);
            } else if (departmentNames.length) {
                addTextInFilter(conditions, params, "d.name", departmentNames);
            }

            if (numericSectionIds.length) {
                conditions.push(`s.id IN (${makePlaceholders(numericSectionIds.length)})`);
                params.push(...numericSectionIds);
            } else if (sectionNames.length) {
                const sectionNamePlaceholders = sectionNames.map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))").join(",");
                conditions.push(`(
                    UPPER(LTRIM(RTRIM(CAST(r.sectionName AS NVARCHAR(510))))) IN (${sectionNamePlaceholders})
                    OR UPPER(LTRIM(RTRIM(CAST(s.name AS NVARCHAR(510))))) IN (${sectionNamePlaceholders})
                )`);
                params.push(...sectionNames, ...sectionNames);
            }

            const reqSql = `
                SELECT
                    r.[year] AS yearVal,
                    r.monthNumber AS monthNumber,
                    MAX(r.monthName) AS month,
                    CAST(SUM(ISNULL(r.prodPlanFN01, 0)) AS BIGINT) AS required_fn01,
                    CAST(SUM(ISNULL(r.prodPlanFN02, 0)) AS BIGINT) AS required_fn02
                FROM requirements r
                LEFT JOIN sections s
                    ON (
                        UPPER(LTRIM(RTRIM(CAST(r.sectionCode AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.uniCode AS NVARCHAR(510)))))
                        OR UPPER(LTRIM(RTRIM(CAST(r.sectionName AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.name AS NVARCHAR(510)))))
                    )
                    AND ISNULL(s.isActive, 1) = 1
                LEFT JOIN departments d ON d.id = s.departmentId
                WHERE ${conditions.join(" AND ")}
                ${approvalCondition}
                GROUP BY r.[year], r.monthNumber
            `;

            const [rows] = await executeQuery(reqSql, params);
            reqResults = rows;
        }
    } catch (e) {
        console.warn("[DASHBOARD] requirement query failed:", e.message);
        reqResults = [];
    }

    // ============================================================
    // SHIFT-WISE REQUIREMENT FIX (Manpower graph required bar only)
    // ============================================================
    // Existing requirement logic is kept as-is only when Shift = ALL:
    // - Department/Section: requirements table FN01/FN02
    // - Line: line_requirements table FN01/FN02
    // When dashboard Shift filter is selected, Requirement bar must come only
    // from users.shiftSchedule for the selected date.
    // Example users.shiftSchedule:
    // {"2026-06-24":"C","2026-06-25":"C","2026-06-26":"C"}
    const shiftRequirementByDate = {};

    try {
        if (selectedShiftValue && loopDates.length) {
            const scheduleHierConditions = [];
            const scheduleHierParams = [];

            // IMPORTANT:
            // Shift-wise requirement must be calculated from users table only.
            // Department / Section / Line filters are applied through users.departmentId,
            // users.sectionId and users.lineId, as requested.
            if (numericDepartmentIds.length) {
                scheduleHierConditions.push(`u.departmentId IN (${makePlaceholders(numericDepartmentIds.length)})`);
                scheduleHierParams.push(...numericDepartmentIds);
            } else if (departmentNames.length) {
                addTextInFilter(scheduleHierConditions, scheduleHierParams, "u.[department]", departmentNames);
            }

            const scheduleSectionHierarchyMatchSql = getSectionHierarchyMatchSql("u");
            if (scheduleSectionHierarchyMatchSql) {
                scheduleHierConditions.push(scheduleSectionHierarchyMatchSql);
            }

            if (numericLineIds.length) {
                scheduleHierConditions.push(`u.lineId IN (${makePlaceholders(numericLineIds.length)})`);
                scheduleHierParams.push(...numericLineIds);
            } else if (lineNames.length) {
                addTextInFilter(scheduleHierConditions, scheduleHierParams, "u.[line]", lineNames);
            }

            const scheduleHierCondition = scheduleHierConditions.length
                ? ` AND ${scheduleHierConditions.join(" AND ")}`
                : "";

            const dateUnionSql = loopDates.map(() => "SELECT CAST(? AS DATE) AS fullDate").join(" UNION ALL ");
            const dateParams = loopDates.map((d) => formatDateLocal(d));

            const scheduledShiftSql = `UPPER(LTRIM(RTRIM(CAST(JSON_VALUE(CAST(u.shiftSchedule AS NVARCHAR(MAX)), '$."' + CONVERT(VARCHAR(10), d.fullDate, 23) + '"') AS NVARCHAR(100)))))`;
            const scheduledShiftCompactSql = `REPLACE(REPLACE(REPLACE(${scheduledShiftSql}, ' ', ''), '-', ''), '_', '')`;

            const selectedShiftMatchSql = `
                (
                    ${scheduledShiftSql} = UPPER(LTRIM(RTRIM(?)))
                    OR ${scheduledShiftSql} = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                    OR ${scheduledShiftSql} = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                    OR ${scheduledShiftCompactSql} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                    OR ${scheduledShiftCompactSql} = 'SHIFT' + REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                    OR ${scheduledShiftCompactSql} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '') + 'SHIFT'
                    OR (
                        UPPER(LTRIM(RTRIM(?))) = 'G'
                        AND ${scheduledShiftCompactSql} IN ('G', 'GEN', 'GENERAL', 'GENERALSHIFT', 'SHIFTG', 'GSHIFT')
                    )
                )
            `;

            const shiftReqSql = `
                WITH selectedDates AS (
                    ${dateUnionSql}
                )
                SELECT
                    CONVERT(VARCHAR(10), d.fullDate, 23) AS fullDate,
                    COUNT(DISTINCT CASE
                        WHEN ${scheduledShiftSql} IS NOT NULL AND ${scheduledShiftSql} <> ''
                        THEN LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100))))
                    END) AS totalScheduledEmployees,
                    COUNT(DISTINCT CASE
                        WHEN ${selectedShiftMatchSql}
                        THEN LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100))))
                    END) AS selectedShiftEmployees
                FROM selectedDates d
                INNER JOIN users u ON 1 = 1
                WHERE ISNULL(ISJSON(CAST(u.shiftSchedule AS NVARCHAR(MAX))), 0) = 1
                  AND u.shiftSchedule IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.shiftSchedule AS NVARCHAR(MAX)))) != ''
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND ISNULL(u.isTemporary, 0) = 0
                  ${getDashboardDesignationShutterExclusionSql("u")}
                  ${scheduleHierCondition}
                GROUP BY d.fullDate
            `;

            const shiftParams = [
                ...dateParams,
                selectedShiftValue,
                selectedShiftValue,
                selectedShiftValue,
                selectedShiftValue,
                selectedShiftValue,
                selectedShiftValue,
                selectedShiftValue,
                ...scheduleHierParams,
            ];

            const [shiftRows] = await executeQuery(shiftReqSql, shiftParams);

            (shiftRows || []).forEach((row) => {
                const totalScheduledEmployees = Number(row.totalScheduledEmployees || 0);
                const selectedShiftEmployees = Number(row.selectedShiftEmployees || 0);

                shiftRequirementByDate[String(row.fullDate)] = {
                    totalScheduledEmployees,
                    selectedShiftEmployees,
                };
            });
        }
    } catch (e) {
        console.warn("[DASHBOARD] Shift-wise requirement calculation from users.shiftSchedule failed:", e.message);
    }

    const getRequirementForDate = (dateObj) => {
        // If shift is selected, requirement must come ONLY from users.shiftSchedule.
        // Do not depend on requirements / line_requirements table in selected shift mode.
        if (selectedShiftValue) {
            const dateStr = formatDateLocal(dateObj);
            const shiftRequirementItem = shiftRequirementByDate[dateStr];

            if (!shiftRequirementItem) {
                return 0;
            }

            return Number(shiftRequirementItem.selectedShiftEmployees || 0);
        }

        // If no shift is selected, keep old requirement logic exactly same.
        const yearVal = dateObj.getFullYear();
        const monthNumber = dateObj.getMonth() + 1;

        const currentReqItem = reqResults.find(
            (r) =>
                Number(r.yearVal) === Number(yearVal) &&
                Number(r.monthNumber) === Number(monthNumber)
        );

        if (!currentReqItem) return 0;

        const day = dateObj.getDate();
        return day <= 15
            ? Number(currentReqItem.required_fn01) || 0
            : Number(currentReqItem.required_fn02) || 0;
    };

    let snapshotTotal = 0;
    let rejoiningData = [];

    // TOTAL MANPOWER — statusHistory DATE-WISE EMPLOYMENT INTERVAL LOGIC.
    // Open/current periods count only when status is PRESENT.
    // A closed LEFT period still counts its actual historical worked dates.
    // Example: LEFT interval ends 20-Jul and PRESENT interval starts 04-Aug:
    // count through 19-Jul, exclude 20-Jul to 03-Aug, count again from 04-Aug.
    // Every date is calculated independently; no end-date snapshot is copied across the range.
    // Users without valid statusHistory continue through the legacy column fallback.
    const userHierConditions = [];
    const userHierParams = [];

    if (numericDepartmentIds.length) {
        userHierConditions.push(`u.departmentId IN (${makePlaceholders(numericDepartmentIds.length)})`);
        userHierParams.push(...numericDepartmentIds);
    } else {
        addTextInFilter(userHierConditions, userHierParams, "u.[department]", departmentNames);
    }

    const userSectionHierarchyMatchSql = getSectionHierarchyMatchSql("u");
    if (userSectionHierarchyMatchSql) {
        userHierConditions.push(userSectionHierarchyMatchSql);
    }

    if (numericLineIds.length) {
        userHierConditions.push(`u.lineId IN (${makePlaceholders(numericLineIds.length)})`);
        userHierParams.push(...numericLineIds);
    } else {
        addTextInFilter(userHierConditions, userHierParams, "u.[line]", lineNames);
    }

    const userHierCondition = userHierConditions.length
        ? ` AND ${userHierConditions.join(" AND ")}`
        : "";

    try {
        // Fetch the eligible employee population once. Date-wise active counts are then
        // calculated in memory, so there is no OPENJSON x date cross-product in SQL Server.
        const eligibleManpowerSql = `
            SELECT
                u.id,
                u.status,
                u.joiningDate,
                u.leavingDate,
                u.statusHistory
            FROM users u
            WHERE 1=1
              ${getTotalManpowerBaseEligibilitySql("u")}
              ${userHierCondition}
        `;

        const [eligibleManpowerRows] = await executeQuery(
            eligibleManpowerSql,
            [...userHierParams]
        );

        const manpowerUsers = (eligibleManpowerRows || []).map(prepareManpowerUser);
        const headcountEntries = loopDates.map((dateObj) => {
            const dateStr = formatDateLocal(dateObj);
            let total = 0;

            for (const userRow of manpowerUsers) {
                if (isUserActiveForManpowerDate(userRow, dateStr)) {
                    total += 1;
                }
            }

            return [dateStr, total];
        });

        dailyHeadcountByDate = Object.fromEntries(headcountEntries);
        snapshotTotal = Number(dailyHeadcountByDate[sqlEndDate] || 0);
    } catch (e) {
        // Do not launch one heavy fallback query per date. That old fallback caused
        // 30 x ~2-second queries and blocked every dashboard graph for minutes.
        console.warn(
            "[DASHBOARD] Total Manpower employee fetch failed; no per-date SQL fallback executed:",
            e.message
        );
        snapshotTotal = 0;
        dailyHeadcountByDate = Object.fromEntries(
            loopDates.map((dateObj) => [formatDateLocal(dateObj), 0])
        );
    }

    // DAILY REJOINING TREND — second and every later statusHistory joiningDate.
    // Each unique employee is counted at most once on one date, so duplicate users rows
    // with the same empId cannot inflate the graph. Third/fourth rejoin dates still appear
    // independently on their respective dates.
    try {
        const rejoiningTrendSql = `
            SELECT
                u.id,
                u.empId,
                u.statusHistory
            FROM users u
            WHERE 1=1
              ${getRejoiningTrendBaseEligibilitySql("u")}
              ${userHierCondition}
        `;

        const [rejoiningCandidateRows] = await executeQuery(
            rejoiningTrendSql,
            [...userHierParams]
        );

        const rejoiningCountByDateKey = new Map();
        const seenEmployeeDateEvents = new Set();

        for (const userRow of rejoiningCandidateRows || []) {
            const employeeKey = String(userRow?.empId || '').trim().toUpperCase();
            if (!employeeKey) continue;

            const rejoiningDateKeys = getStatusHistoryRejoiningDateKeys(userRow);

            for (const rejoiningDateKey of rejoiningDateKeys) {
                // One employee can rejoin on multiple different dates, but duplicate user rows
                // must not count the same employee again on the same date.
                const eventKey = `${employeeKey}::${rejoiningDateKey}`;
                if (seenEmployeeDateEvents.has(eventKey)) continue;

                seenEmployeeDateEvents.add(eventKey);
                rejoiningCountByDateKey.set(
                    rejoiningDateKey,
                    Number(rejoiningCountByDateKey.get(rejoiningDateKey) || 0) + 1
                );
            }
        }

        rejoiningData = loopDates.map((dateObj) => {
            const fullDate = formatDateLocal(dateObj);
            const dateKey = parseManpowerDateKey(fullDate);
            const day = dateObj.getDate();
            const monthShort = dateObj.toLocaleString("en-US", { month: "short" });

            return {
                fullDate,
                day: `${day} ${monthShort}`,
                rejoinedCount: Number(rejoiningCountByDateKey.get(dateKey) || 0),
            };
        });
    } catch (rejoiningTrendError) {
        console.warn(
            "[DASHBOARD] Rejoining trend employee fetch failed:",
            rejoiningTrendError.message
        );

        rejoiningData = loopDates.map((dateObj) => ({
            fullDate: formatDateLocal(dateObj),
            day: `${dateObj.getDate()} ${dateObj.toLocaleString("en-US", { month: "short" })}`,
            rejoinedCount: 0,
        }));
    }

    let dailyAttendance = [];

    try {
        let attSql = `
            SELECT
                CONVERT(VARCHAR(10), CONVERT(DATE, al.[date]), 23) AS fullDate,
                DAY(CONVERT(DATE, al.[date])) AS dayNum,
                -- Manpower present count rule:
                -- Match final dashboard eligibility logic:
                -- attendance_logs.payCode = users.empId, employee is matched directly with users,
                -- users.isTemporary = 0, not deleted, and designation is not shuttered/off.
                COUNT(DISTINCT CASE WHEN al.status IN ('P','PRESENT','Present') THEN u.id END) AS mappedPresentCount,
                CAST(0 AS INT) AS unmappedPresentCount,
                COUNT(DISTINCT CASE WHEN al.status IN ('P','PRESENT','Present') THEN u.id END) AS totalPresentCount,
                COUNT(DISTINCT CASE WHEN al.status IN ('ABSENT','LEAVE','HALF DAY','Absent','Leave','Half Day') THEN u.id END) AS absentCount,
                COUNT(DISTINCT u.id) AS totalCount
            FROM attendance_logs al
            INNER JOIN users u ON al.userId = u.id
            WHERE 1=1
              AND CONVERT(DATE, al.[date]) >= CONVERT(DATE, '${sqlStartDate}', 23)
              AND CONVERT(DATE, al.[date]) <= CONVERT(DATE, '${sqlEndDate}', 23)
              ${topHolidayDateSqlList ? `AND CONVERT(DATE, al.[date]) NOT IN (${topHolidayDateSqlList})` : ""}
              ${hierCondition}
              ${getEligibleUserSql("u")}
                  ${getDashboardDesignationShutterExclusionSql("u")}
        `;
        const attParams = [];
        attSql = addShiftFilter(attSql, attParams, "al");
        attSql += `
            GROUP BY CONVERT(DATE, al.[date])
            ORDER BY CONVERT(DATE, al.[date])
        `;

        const [attRows] = await executeQuery(attSql, attParams);
        dailyAttendance = attRows;
    } catch (e) {
        console.warn("[DASHBOARD] Daily attendance query failed:", e.message);
    }

    let dailyUnmapped = [];
    try {
        let unmappedSql = `
            SELECT
                CONVERT(VARCHAR(10), CONVERT(DATE, unm.[date]), 23) AS fullDate,
                COUNT(DISTINCT unm.payCode) AS unmappedCount
            FROM attendance_unmapped_logs unm
            WHERE UPPER(LTRIM(RTRIM(unm.status))) IN ('P','PRESENT')
              AND CONVERT(DATE, unm.[date]) >= '${sqlStartDate}'
              AND CONVERT(DATE, unm.[date]) <= '${sqlEndDate}'
              ${topHolidayDateSqlList ? `AND CONVERT(DATE, unm.[date]) NOT IN (${topHolidayDateSqlList})` : ""}
        `;
        const unmappedParams = [];
        unmappedSql = addShiftFilter(unmappedSql, unmappedParams, "unm");
        unmappedSql += `
            GROUP BY CONVERT(DATE, unm.[date])
        `;
        const [unmappedRows] = await executeQuery(unmappedSql, unmappedParams);
        dailyUnmapped = unmappedRows;
    } catch (e) {
        console.warn("[DASHBOARD] Daily unmapped query failed:", e.message);
    }

    const manpowerData = loopDates.map((iterDateRaw) => {
        const iterDate = new Date(iterDateRaw);
        const day = iterDate.getDate();
        const monthShort = iterDate.toLocaleString("en-US", { month: "short" });
        const dateStr = formatDateLocal(iterDate);
        const holiday = holidayByDate.get(dateStr) || null;
        const isHoliday = Boolean(holiday);

        const attItem = dailyAttendance.find((a) => a.fullDate === dateStr);
        const unmappedItem = dailyUnmapped.find((u) => u.fullDate === dateStr);

        const hasHierFilter = departmentNames.length > 0 || sectionNames.length > 0 || lineNames.length > 0;
        const unmappedCount = (!hasHierFilter && unmappedItem) ? Number(unmappedItem.unmappedCount) || 0 : 0;

        iterDate.setHours(0, 0, 0, 0);
        const isFuture = iterDate > today;

        const mappedPresent = attItem ? Number(attItem.mappedPresentCount) || 0 : 0;
        const totalManpower = Number(dailyHeadcountByDate[dateStr] ?? snapshotTotal) || 0;
        const explicitAbsent = attItem ? Number(attItem.absentCount) || 0 : 0;

        // When Shift = ALL, every eligible active employee who is not Present
        // must be counted in Absenteeism. This includes employees whose attendance
        // row is missing for the selected date.
        // Selected-shift mode keeps the existing explicit absent logic because
        // Total Manpower intentionally remains an all-shift users-table count.
        const correctedAbsent = isFuture
            ? null
            : isHoliday
                ? 0
                : selectedShiftValue
                    ? explicitAbsent
                    : Math.max(totalManpower - mappedPresent, 0);

        return {
            month: `${day} ${monthShort}`,
            day,
            required: getRequirementForDate(iterDate),

            // Current Headcount = total active employees from users table
            current: isFuture ? null : totalManpower,

            // Holiday date: attendance value is suppressed and frontend shows shortCode.
            // Non-holiday dates keep the original attendance calculation.
            present: isFuture ? null : (isHoliday ? 0 : mappedPresent),
            rawPresent: isFuture ? null : mappedPresent,
            unmappedPresent: isFuture ? null : (isHoliday ? 0 : unmappedCount),
            totalPresent: isFuture ? null : (isHoliday ? 0 : (mappedPresent + unmappedCount)),

            // Holiday must never be treated as full-day absenteeism.
            absent: correctedAbsent,
            isHoliday,
            holidayName: holiday?.holidayName || null,
            holidayShortCode: holiday?.shortCode || null,
            holidayType: holiday?.holidayType || null,
        };
    });

    let attritionData = [];

    try {
        // Attrition graph me pehle users.status = LEFT check hoga.
        // leavingDate employee ke exact left date ko determine karegi.
        // PRESENT status employee attrition graph me count nahi hoga.
        // Same common dashboard employee eligibility attrition graph par bhi apply hogi:
        // isTemporary = 0, isDeleted = 0, valid empId, and shutter designation exclusion.
        // Department/Section/Line filters users table se apply honge; shift behavior unchanged rahega.
        attritionData = await buildDailyAttritionDataFromUsers();
    } catch (e) {
        console.warn("[DASHBOARD] Attrition daily query failed:", e.message);
        attritionData = [];
    }

    let absenteeismData = [];

    try {
        // Use the same corrected absent count as the Manpower graph so both graphs
        // always follow one rule: eligible Total Manpower = Present + Absent.
        // In Shift = ALL mode, employees with no attendance row are included in Absent.
        // In selected-shift mode, manpowerData retains the existing explicit absent rule.
        absenteeismData = manpowerData
            .map((manpowerItem) => {
                if (manpowerItem?.current === null) return null;

                const total = Number(manpowerItem?.current || 0);
                const absent = Number(manpowerItem?.absent || 0);

                const absenteeismPercentage =
                    total > 0 ? Math.round((absent / total) * 1000) / 10 : 0;

                return {
                    day: manpowerItem.month,
                    actual: manpowerItem?.isHoliday ? 0 : absenteeismPercentage,
                    absent: manpowerItem?.isHoliday ? 0 : absent,
                    total,
                    limit: 10,
                    isHoliday: Boolean(manpowerItem?.isHoliday),
                    holidayName: manpowerItem?.holidayName || null,
                    holidayShortCode: manpowerItem?.holidayShortCode || null,
                    holidayType: manpowerItem?.holidayType || null,
                };
            })
            .filter(Boolean);
    } catch (e) {
        console.warn("[DASHBOARD] Daily absenteeism calculation failed:", e.message);
        absenteeismData = [];
    }

    const indiaNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    indiaNow.setHours(0, 0, 0, 0);

    const yesterdayVal = new Date(indiaNow);
    yesterdayVal.setDate(yesterdayVal.getDate() - 1);

    const yesterdaySqlDate = formatDateLocal(yesterdayVal);

    // Dynamic single-day active date selection based on today's attendance availability.
    let masterRangeStart = parseDateLocal(effectiveDateStr);
    let masterRangeEnd = parseDateLocal(effectiveDateStr);

    if (startDate && startDate === (endDate || startDate)) {
        const requestedDate = parseDateLocal(startDate);
        if (startDate === todayStr && !todayHasAttendance) {
            masterRangeStart = parseDateLocal(effectiveDateStr);
            masterRangeEnd = parseDateLocal(effectiveDateStr);
        } else {
            masterRangeStart = requestedDate;
            masterRangeEnd = requestedDate;
        }
    }

    masterRangeStart.setHours(0, 0, 0, 0);
    masterRangeEnd.setHours(0, 0, 0, 0);

    const masterSqlStartDate = formatDateLocal(masterRangeStart);
    const masterSqlEndDate = formatDateLocal(masterRangeEnd);


    const masterHolidayRows = await getDashboardHolidaysForRange(
        masterSqlStartDate,
        masterSqlEndDate
    );
    const masterHoliday = masterSqlStartDate === masterSqlEndDate
        ? (masterHolidayRows.find(item => item.holidayDate === masterSqlStartDate) || null)
        : null;

    // Attendance bars continue to use the selected date/range.
    // Every Users Total / Total Manpower comparison bar must always use
    // the current India date, independent of the selected attendance date.
    const usersTotalAsOfDate = masterSqlEndDate;

    function appendMultiHierarchyFilter({
        sqlText,
        params,
        nameColumn,
        idColumn,
        ids,
        names,
        alias,
    }) {
        const numericIds = (ids || [])
            .map(id => parseInt(id, 10))
            .filter(id => !Number.isNaN(id));

        // IDs are authoritative because departmentId/sectionId/lineId now exist in users.
        if (numericIds.length) {
            const placeholders = numericIds.map(() => "?").join(",");
            params.push(...numericIds);
            return `${sqlText} AND ${alias}.${idColumn} IN (${placeholders})`;
        }

        const cleanNames = (names || [])
            .map(name => String(name || "").trim())
            .filter(Boolean);

        if (!cleanNames.length) return sqlText;

        const resolvedNameColumn = nameColumn === "lines" ? "line" : nameColumn;
        const placeholders = cleanNames
            .map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))")
            .join(",");

        params.push(...cleanNames);
        return `${sqlText} AND UPPER(LTRIM(RTRIM(CAST(${alias}.[${resolvedNameColumn}] AS NVARCHAR(510))))) IN (${placeholders})`;
    }

    function addUserMasterHierarchyFilters(baseSql, params, alias = "u") {
        let sqlText = baseSql;

        sqlText = appendMultiHierarchyFilter({
            sqlText,
            params,
            nameColumn: "department",
            idColumn: "departmentId",
            ids: departmentIds,
            names: departmentNames,
            alias,
        });

        const masterSectionHierarchyMatchSql = getSectionHierarchyMatchSql(alias);
        if (masterSectionHierarchyMatchSql) {
            sqlText += ` AND ${masterSectionHierarchyMatchSql}`;
        }

        sqlText = appendMultiHierarchyFilter({
            sqlText,
            params,
            nameColumn: "line",
            idColumn: "lineId",
            ids: lineIds,
            names: lineNames,
            alias,
        });

        return sqlText;
    }

    function addUserMasterFilters(baseSql, params, alias = "u") {
        let sqlText = addUserMasterHierarchyFilters(baseSql, params, alias);

        // Common dashboard employee eligibility:
        // users.empId must be valid, isTemporary = 0, not deleted,
        // designation must not be shuttered/off. No snapshot match is required.
        sqlText += getEligibleUserSql(alias);
        sqlText += getDashboardDesignationShutterExclusionSql(alias);

        return sqlText;
    }

    function addStateDistrictFilters(baseSql, params, options = {}) {
        let sqlText = baseSql;
        const { includeState = true, includeDistrict = true, alias = "u" } = options;

        const stateValues = parseMultiParam(stateFilter);
        const districtValues = parseMultiParam(districtFilter);

        if (includeState && stateValues.length > 0) {
            const placeholders = stateValues
                .map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))")
                .join(",");

            sqlText += `
                    AND UPPER(LTRIM(RTRIM(CAST(ISNULL(${alias}.state, '') AS NVARCHAR(510))))) IN (${placeholders})
                `;
            params.push(...stateValues);
        }

        if (includeDistrict && districtValues.length > 0) {
            const placeholders = districtValues
                .map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))")
                .join(",");

            sqlText += `
                    AND UPPER(LTRIM(RTRIM(CAST(ISNULL(${alias}.district, '') AS NVARCHAR(510))))) IN (${placeholders})
                `;
            params.push(...districtValues);
        }

        return sqlText;
    }


    // ============================================================
    // PERFORMANCE: Resolve the active Total Manpower population once.
    // ============================================================
    // Previously every Skill/Gender/State/District/Designation/Education/Contractor
    // master query re-ran the same correlated OPENJSON(statusHistory) condition.
    // Build the filtered active-user id set once for usersTotalAsOfDate and reuse it.
    let activeUserSetReady = false;
    let activeUserIds = [];

    try {
        const activeUserParams = [];

        let activeUserSql = `
            SELECT
                u.id,
                u.status,
                u.joiningDate,
                u.leavingDate,
                u.statusHistory
            FROM users u
            WHERE 1=1
              ${getTotalManpowerBaseEligibilitySql("u")}
        `;

        activeUserSql = addUserMasterHierarchyFilters(
            activeUserSql,
            activeUserParams,
            "u"
        );
        activeUserSql = addStateDistrictFilters(
            activeUserSql,
            activeUserParams,
            {
                includeState: true,
                includeDistrict: true,
                alias: "u",
            }
        );

        const [activeCandidateRows] = await executeQuery(
            activeUserSql,
            activeUserParams
        );

        activeUserIds = (activeCandidateRows || [])
            .map(prepareManpowerUser)
            .filter((userRow) => (
                isUserActiveForManpowerDate(userRow, usersTotalAsOfDate)
            ))
            .map((userRow) => Number(userRow.id))
            .filter((id) => Number.isInteger(id) && id > 0);

        activeUserSetReady = true;
    } catch (activeUserError) {
        console.warn(
            "[DASHBOARD] Active-user employee fetch failed; lifecycle SQL fallback will be used:",
            activeUserError.message
        );
        activeUserIds = [];
        activeUserSetReady = false;
    }

    // Never fall back to the old correlated statusHistory SQL for every lower graph.
    // If the one-time employee fetch fails, return an empty Total Manpower population
    // instead of blocking the whole dashboard with repeated 30-second queries.
    const activeUserIdFilterSql = activeUserSetReady
        ? (
            activeUserIds.length
                ? ` AND u.id IN (${activeUserIds.join(",")})`
                : " AND 1 = 0"
        )
        : " AND 1 = 0";

    const activeUsersTotal = activeUserSetReady
        ? activeUserIds.length
        : null;

    const attendanceMasterBaseFrom = `
        FROM attendance_logs al
        INNER JOIN users u
            ON al.userId = u.id
            AND ISNULL(u.isTemporary, 0) = 0
        WHERE al.[date] >= '${masterSqlStartDate}'
          AND al.[date] <= '${masterSqlEndDate}'
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          AND ISNULL(u.isTemporary, 0) = 0
          AND al.status IN ('P', 'PRESENT', 'Present')
          ${masterHoliday ? "AND 1 = 0 /* declared dashboard holiday */" : ""}
    `;

    // IMPORTANT SHIFT/ALL FIX:
    // All comparison/pie charts (Skill Level, Gender, State, District, Designation, Leader/Expert)
    // now count only PRESENT attendance rows. Without this, ALL shift included rows whose shift/status
    // came as Absent/other values, so ALL count became different from A+B+C+G selected one by one.

    const shouldUseAttendanceMaster = true;

    const getAttendanceMasterTotal = async () => {
        try {
            let sqlText = `
                SELECT COUNT(DISTINCT u.id) AS total
                ${attendanceMasterBaseFrom}
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params);
            sqlText = addShiftFilter(sqlText, params, "al");

            const [rows] = await executeQuery(sqlText, params);
            return Number(rows?.[0]?.total || 0);
        } catch (e) {
            console.warn("[DASHBOARD] Attendance master total failed:", e.message);
            return 0;
        }
    };

    let attendanceMasterTotal = 0;
    if (shouldUseAttendanceMaster) {
        attendanceMasterTotal = await getAttendanceMasterTotal();
    }

    const makeEmptyPieData = () => ({
        skillLevels: [],
        gender: [],
        state: [],
        district: [],
        designation: [],
        leaderExpert: [],
        leaderExpertTotalEmployees: 0,
        contractorPrefix: [],
        stateOptions: [],
        districtOptions: [],
        education: [],
    });

    let pieCharts = makeEmptyPieData();

    const normalizeChartName = (value) => {
        const text = String(value || "").trim();
        if (!text) return "Not Provided";
        if (["NULL", "UNDEFINED", "UNKNOWN", "NOT PROVIDED", "N/A", "NA", "-"].includes(text.toUpperCase())) return "Not Provided";
        return text;
    };

    // IMPORTANT BLANK FIX:
    // State/District/Role graph me blank values DB me multiple formats me aa sakti hain:
    // NULL, empty string, 'NULL', 'UNKNOWN', 'Not Provided', etc.
    // Agar SQL GROUP BY raw value par hota hai to ye alag rows ban jaati hain aur frontend me Blank category
    // wrong/misleading total dikha sakti hai. Is helper se grouping SQL level par hi single 'Not Provided' bucket me hoti hai.
    const getCleanTextColumnSql = (columnSql) => `
        CASE
            WHEN NULLIF(LTRIM(RTRIM(CAST(${columnSql} AS NVARCHAR(510)))), '') IS NULL
                THEN 'Not Provided'
            WHEN UPPER(LTRIM(RTRIM(CAST(${columnSql} AS NVARCHAR(510))))) IN ('NULL', 'UNDEFINED', 'UNKNOWN', 'NOT PROVIDED', 'N/A', 'NA', '-')
                THEN 'Not Provided'
            ELSE LTRIM(RTRIM(CAST(${columnSql} AS NVARCHAR(510))))
        END
    `;

    const getGroupedAttendanceChart = async ({ columnSql, labelKey = "name", valueKey = "value", includeState = true, includeDistrict = true }) => {
        try {
            let sqlText = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT u.id) AS total
                ${attendanceMasterBaseFrom}
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params, { includeState, includeDistrict });
            sqlText = addShiftFilter(sqlText, params, "al");
            sqlText += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [rows] = await executeQuery(sqlText, params);
            return rows.map(row => ({
                [labelKey]: normalizeChartName(row.rawName),
                [valueKey]: Number(row.total || 0),
            })).filter(item => Number(item[valueKey] || 0) > 0);
        } catch (e) {
            console.warn("[DASHBOARD] Attendance grouped chart failed:", e.message);
            return [];
        }
    };

    const getGroupedUsersChart = async ({ columnSql, labelKey = "name", valueKey = "value", includeState = true, includeDistrict = true }) => {
        try {
            let sqlText = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT u.id) AS total
                FROM users u
                WHERE 1=1
                  ${activeUserIdFilterSql}
            `;
            const params = [];
            sqlText = addUserMasterHierarchyFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params, { includeState, includeDistrict });
            // Total Manpower ignores shift, but uses statusHistory as of the active graph date.
            sqlText += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [rows] = await executeQuery(sqlText, params);
            return rows.map(row => ({
                [labelKey]: normalizeChartName(row.rawName),
                [valueKey]: Number(row.total || 0),
            })).filter(item => Number(item[valueKey] || 0) > 0);
        } catch (e) {
            console.warn("[DASHBOARD] Users grouped chart failed:", e.message);
            return [];
        }
    };

    async function getStateOptions() {
        try {
            let sqlText = `
                SELECT DISTINCT
                    LTRIM(RTRIM(u.state)) AS stateName
                FROM users u
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND ISNULL(u.isTemporary, 0) = 0
                  AND u.empId IS NOT NULL
                  AND u.empId != ''
                  AND u.state IS NOT NULL
                  AND u.state != ''
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addUserShiftFilter(sqlText, params, "u");
            sqlText += ` ORDER BY stateName`;
            const [rows] = await executeQuery(sqlText, params);
            return rows.map(row => String(row.stateName || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn("[DASHBOARD] state options failed:", e.message);
            return [];
        }
    }

    async function getDistrictOptions() {
        try {
            let sqlText = `
                SELECT DISTINCT
                    LTRIM(RTRIM(u.district)) AS districtName
                FROM users u
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND ISNULL(u.isTemporary, 0) = 0
                  AND u.empId IS NOT NULL
                  AND u.empId != ''
                  AND u.district IS NOT NULL
                  AND u.district != ''
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params, { includeState: true, includeDistrict: false });
            sqlText = addUserShiftFilter(sqlText, params, "u");
            sqlText += ` ORDER BY districtName`;
            const [rows] = await executeQuery(sqlText, params);
            return rows.map(row => String(row.districtName || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn("[DASHBOARD] district options failed:", e.message);
            return [];
        }
    }

    const getUsersTotalDenominator = async ({ includeState = true, includeDistrict = true } = {}) => {
        // All current dashboard callers use the same hierarchy + state + district filter set.
        // Return the already-resolved active-user count instead of re-running the same query
        // once for every graph.
        if (activeUserSetReady && includeState && includeDistrict) {
            return Number(activeUsersTotal || 0);
        }

        try {
            let sqlText = `
                SELECT COUNT(DISTINCT u.id) AS total
                FROM users u
                WHERE 1=1
                  ${activeUserIdFilterSql}
            `;

            const params = [];
            sqlText = addUserMasterHierarchyFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params, { includeState, includeDistrict });

            // Same denominator as the first graph Total Manpower bar. Shift is ignored;
            // statusHistory lifecycle is evaluated for usersTotalAsOfDate.
            const [rows] = await executeQuery(sqlText, params);
            return Number(rows?.[0]?.total || 0);
        } catch (e) {
            console.warn("[DASHBOARD] Users total denominator failed:", e.message);
            return Number(snapshotTotal) || 0;
        }
    };

    const getGroupedComparisonChart = async ({
        columnSql,
        labelKey = "name",
        includeState = true,
        includeDistrict = true,
        extraWhere = "",
        masterColumnSql = null,
        masterExtraWhere = null,
        alignBlankMasterWithAttendance = false,
        ensureMasterAtLeastAttendance = false,
        masterUsePresentUsersOnly = false,
        caseInsensitiveNameMerge = false,
        preserveMergedDisplayName = false,
    }) => {
        const mapByName = {};
        const resolvedMasterColumnSql = masterColumnSql || columnSql;
        const resolvedMasterExtraWhere = masterExtraWhere === null ? extraWhere : masterExtraWhere;

        const addToMap = (name, key, value) => {
            const cleanName = normalizeChartName(name);

            // State values can be returned with different casing/spacing by the
            // attendance and master queries, for example BIHAR / Bihar / " BIHAR ".
            // When explicitly enabled, use one canonical map key so both values
            // are placed on the same graph category.
            const mapKey = caseInsensitiveNameMerge
                ? cleanName.replace(/\s+/g, " ").trim().toUpperCase()
                : cleanName;

            const displayName = caseInsensitiveNameMerge && !preserveMergedDisplayName
                ? mapKey
                : cleanName;

            if (!mapByName[mapKey]) {
                mapByName[mapKey] = {
                    [labelKey]: displayName,
                    name: displayName,
                    value: 0,
                    attendanceValue: 0,
                    masterValue: 0,
                    rawValue: 0,
                    percentage: 0,
                };
            }

            // Add instead of overwrite so category variants never lose counts.
            mapByName[mapKey][key] += Number(value || 0);
        };

        try {
            let attendanceSql = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT u.id) AS total
                ${attendanceMasterBaseFrom}
                ${extraWhere}
            `;

            const attendanceParams = [];
            attendanceSql = addUserMasterFilters(attendanceSql, attendanceParams, "u");
            attendanceSql = addStateDistrictFilters(attendanceSql, attendanceParams, { includeState, includeDistrict });
            attendanceSql = addShiftFilter(attendanceSql, attendanceParams, "al");
            attendanceSql += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [attendanceRows] = await executeQuery(attendanceSql, attendanceParams);
            attendanceRows.forEach(row => addToMap(row.rawName, "attendanceValue", row.total));
        } catch (e) {
            console.warn("[DASHBOARD] Attendance comparison chart failed:", e.message);
        }

        try {
            const masterParams = [];
            let masterSql = `
                SELECT
                    ${resolvedMasterColumnSql} AS rawName,
                    COUNT(DISTINCT u.id) AS total
                FROM users u
                WHERE 1=1
                  ${activeUserIdFilterSql}
                  ${resolvedMasterExtraWhere}
            `;

            masterSql = addUserMasterHierarchyFilters(masterSql, masterParams, "u");
            masterSql = addStateDistrictFilters(masterSql, masterParams, { includeState, includeDistrict });

            // IMPORTANT:
            // Users Total / dark yellow bar par shift filter apply nahi hoga.
            // Baaki filters (department, section, line, state, district) apply rahenge.
            // Shift filter sirf Attendance / purple bar par apply hoga.
            masterSql += `
                GROUP BY ${resolvedMasterColumnSql}
                ORDER BY total DESC
            `;

            const [masterRows] = await executeQuery(masterSql, masterParams);
            masterRows.forEach(row => addToMap(row.rawName, "masterValue", row.total));
        } catch (e) {
            console.warn("[DASHBOARD] Master comparison chart failed:", e.message);
        }

        const totalEmployeesDenominator = await getUsersTotalDenominator({ includeState, includeDistrict });

        return Object.values(mapByName)
            .map(item => {
                const attendanceCount = Number(item.attendanceValue || 0);
                const masterCount = Number(item.masterValue || 0);

                return {
                    ...item,
                    masterValue: masterCount,
                    totalValue: masterCount,
                    masterCount,
                    value: attendanceCount,
                    rawValue: attendanceCount,

                    // IMPORTANT:
                    // Percentage category ke available records se nahi, total active employees se calculate hoga.
                    // Example: L1+L2+L3+L4 me sirf 21 employees hain aur total employees 2900 hain,
                    // to denominator 2900 rahega, 21 nahi.
                    percentage:
                        totalEmployeesDenominator > 0
                            ? Number(((attendanceCount / totalEmployeesDenominator) * 100).toFixed(1))
                            : 0,
                    attendancePercentage:
                        totalEmployeesDenominator > 0
                            ? Number(((attendanceCount / totalEmployeesDenominator) * 100).toFixed(1))
                            : 0,
                    masterPercentage:
                        totalEmployeesDenominator > 0
                            ? Number(((masterCount / totalEmployeesDenominator) * 100).toFixed(1))
                            : 0,
                    totalEmployees: totalEmployeesDenominator,
                    denominatorTotal: totalEmployeesDenominator,
                };
            })
            .filter(item => Number(item.attendanceValue || 0) > 0 || Number(item.masterValue || 0) > 0)
            .sort((a, b) => Number(b.attendanceValue || 0) - Number(a.attendanceValue || 0));
    };


    // EDUCATION GRAPH ALIGNMENT:
    // Every education category uses the exact first-graph Total Manpower population,
    // while its Attendance category uses the exact first-graph present population.
    // Blank/unknown education values remain in one visible category so no employee is dropped.
    const getEducationComparisonChart = async ({ columnSql, labelKey = "name", includeState = true, includeDistrict = true }) => {
        const mapByName = {};

        const addToMap = (name, key, value) => {
            const cleanName = normalizeChartName(name);
            if (!mapByName[cleanName]) {
                mapByName[cleanName] = {
                    [labelKey]: cleanName,
                    name: cleanName,
                    value: 0,
                    attendanceValue: 0,
                    masterValue: 0,
                    rawValue: 0,
                    percentage: 0,
                };
            }
            // Same cleanName may come from multiple raw DB values (NULL, empty, UNKNOWN, Not Provided).
            // Add values instead of overwriting so Blank/Not Provided totals stay correct.
            mapByName[cleanName][key] += Number(value || 0);
        };

        const addRawUserHierarchyFilters = (baseSql, params, alias = "u") => {
            let sqlText = baseSql;

            if (numericDepartmentIds.length) {
                sqlText += ` AND ${alias}.departmentId IN (${makePlaceholders(numericDepartmentIds.length)})`;
                params.push(...numericDepartmentIds);
            } else if (departmentNames.length) {
                const placeholders = departmentNames.map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))").join(",");
                sqlText += ` AND UPPER(LTRIM(RTRIM(CAST(${alias}.[department] AS NVARCHAR(510))))) IN (${placeholders})`;
                params.push(...departmentNames);
            }

            const rawSectionHierarchyMatchSql = getSectionHierarchyMatchSql(alias);
            if (rawSectionHierarchyMatchSql) {
                sqlText += ` AND ${rawSectionHierarchyMatchSql}`;
            }

            if (numericLineIds.length) {
                sqlText += ` AND ${alias}.lineId IN (${makePlaceholders(numericLineIds.length)})`;
                params.push(...numericLineIds);
            } else if (lineNames.length) {
                const placeholders = lineNames.map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))").join(",");
                sqlText += ` AND UPPER(LTRIM(RTRIM(CAST(${alias}.[line] AS NVARCHAR(510))))) IN (${placeholders})`;
                params.push(...lineNames);
            }

            return sqlText;
        };

        try {
            // Education graph attendance count follows the same common dashboard eligibility:
            // attendance_logs.userId = users.id, isTemporary = 0,
            // not deleted, and designation is not shuttered/off.
            // PRESENT/P status is used so ALL shift does not include absent rows.
            let attendanceSql = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT u.id) AS total
                FROM attendance_logs al
                INNER JOIN users u ON al.userId = u.id
                WHERE al.[date] >= '${masterSqlStartDate}'
                  AND al.[date] <= '${masterSqlEndDate}'
                  AND al.status IN ('P','PRESENT','Present')
                  ${masterHoliday ? "AND 1 = 0 /* declared dashboard holiday */" : ""}
                  ${getEligibleUserSql("u")}
                  ${getDashboardDesignationShutterExclusionSql("u")}
            `;

            const attendanceParams = [];
            attendanceSql = addRawUserHierarchyFilters(attendanceSql, attendanceParams, "u");
            attendanceSql = addStateDistrictFilters(attendanceSql, attendanceParams, { includeState, includeDistrict });
            attendanceSql = addShiftFilter(attendanceSql, attendanceParams, "al");
            attendanceSql += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [attendanceRows] = await executeQuery(attendanceSql, attendanceParams);
            attendanceRows.forEach(row => addToMap(row.rawName, "attendanceValue", row.total));
        } catch (e) {
            console.warn("[DASHBOARD] Education attendance chart failed:", e.message);
        }

        try {
            let masterSql = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT u.id) AS total
                FROM users u
                WHERE 1=1
                  ${activeUserIdFilterSql}
            `;

            const masterParams = [];
            masterSql = addRawUserHierarchyFilters(masterSql, masterParams, "u");
            masterSql = addStateDistrictFilters(masterSql, masterParams, { includeState, includeDistrict });
            masterSql += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [masterRows] = await executeQuery(masterSql, masterParams);
            masterRows.forEach(row => addToMap(row.rawName, "masterValue", row.total));
        } catch (e) {
            console.warn("[DASHBOARD] Education raw master chart failed:", e.message);
        }

        let rawEducationDenominator = 0;
        try {
            let denominatorSql = `
                SELECT COUNT(DISTINCT u.id) AS total
                FROM users u
                WHERE 1=1
                  ${activeUserIdFilterSql}
            `;
            const denominatorParams = [];
            denominatorSql = addRawUserHierarchyFilters(denominatorSql, denominatorParams, "u");
            denominatorSql = addStateDistrictFilters(denominatorSql, denominatorParams, { includeState, includeDistrict });

            const [rows] = await executeQuery(denominatorSql, denominatorParams);
            rawEducationDenominator = Number(rows?.[0]?.total || 0);
        } catch (e) {
            console.warn("[DASHBOARD] Education raw denominator failed:", e.message);
        }

        return Object.values(mapByName)
            .map(item => {
                const attendanceCount = Number(item.attendanceValue || 0);
                const masterCount = Number(item.masterValue || 0);

                return {
                    ...item,
                    value: attendanceCount,
                    rawValue: attendanceCount,
                    percentage:
                        rawEducationDenominator > 0
                            ? Number(((attendanceCount / rawEducationDenominator) * 100).toFixed(1))
                            : 0,
                    attendancePercentage:
                        rawEducationDenominator > 0
                            ? Number(((attendanceCount / rawEducationDenominator) * 100).toFixed(1))
                            : 0,
                    masterPercentage:
                        rawEducationDenominator > 0
                            ? Number(((masterCount / rawEducationDenominator) * 100).toFixed(1))
                            : 0,
                    totalEmployees: rawEducationDenominator,
                    denominatorTotal: rawEducationDenominator,
                };
            })
            .filter(item => Number(item.attendanceValue || 0) > 0 || Number(item.masterValue || 0) > 0)
            .sort((a, b) => Number(b.masterValue || 0) - Number(a.masterValue || 0));
    };

    try {
        const skillColumnSql = `
            CASE
                WHEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.currentLevel)))) IN ('L1','L2','L3','L4')
                    THEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.currentLevel))))
                ELSE 'Not Provided'
            END
        `;

        const leaderExpertColumnSql = `
            CASE
                WHEN UPPER(LTRIM(RTRIM(CAST(u.designation AS NVARCHAR(510))))) LIKE '%LINE LEADER%'
                    THEN 'Line Leader'
                WHEN UPPER(LTRIM(RTRIM(CAST(u.designation AS NVARCHAR(510))))) LIKE '%EXPERT%'
                    THEN 'Expert'
                ELSE 'Other'
            END
        `;


        const educationColumnSql = `
            CASE
                WHEN NULLIF(LTRIM(RTRIM(CAST(u.education AS NVARCHAR(510)))), '') IS NULL
                    THEN 'Not Provided'
                WHEN REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(CAST(u.education AS NVARCHAR(510))))), '.', ''), '-', ''), ' ', ''), '_', '') IN ('12TH','12','XII','XIISTD','12STD','12STANDARD','INTERMEDIATE')
                    THEN '12th'
                WHEN REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(CAST(u.education AS NVARCHAR(510))))), '.', ''), '-', ''), ' ', ''), '_', '') IN ('10TH','10','X','XSTD','10STD','10STANDARD','HIGHSCHOOL')
                    THEN '10th'
                WHEN REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(CAST(u.education AS NVARCHAR(510))))), '.', ''), '-', ''), ' ', ''), '_', '') IN ('ITI','I.T.I')
                    THEN 'ITI'
                WHEN REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(CAST(u.education AS NVARCHAR(510))))), '.', ''), '-', ''), ' ', ''), '_', '') IN ('DIPLOMA','DIP')
                    THEN 'Diploma'
                ELSE LTRIM(RTRIM(CAST(u.education AS NVARCHAR(510))))
            END
        `;

        const [
            skillLevels,
            genderData,
            stateData,
            districtData,
            designationData,
            leaderExpert,
            stateOptions,
            districtOptions,
            educationData,
        ] = await Promise.all([
            getGroupedComparisonChart({
                columnSql: skillColumnSql,
            }).catch(err => { console.warn("[DASHBOARD] skillLevels query failed:", err.message); return []; }),
            getGroupedComparisonChart({ columnSql: "ISNULL(NULLIF(LTRIM(RTRIM(CAST(u.gender AS NVARCHAR(100)))), ''), 'Not Provided')" }).catch(err => { console.warn("[DASHBOARD] genderData query failed:", err.message); return []; }),
            getGroupedComparisonChart({
                columnSql: getCleanTextColumnSql("u.state"),
                includeState: true,
                includeDistrict: true,
                caseInsensitiveNameMerge: true,
            }).catch(err => { console.warn("[DASHBOARD] stateData query failed:", err.message); return []; }),
            getGroupedComparisonChart({
                columnSql: getCleanTextColumnSql("u.district"),
                includeState: true,
                includeDistrict: true,
                caseInsensitiveNameMerge: true,
                preserveMergedDisplayName: true,
            }).catch(err => { console.warn("[DASHBOARD] districtData query failed:", err.message); return []; }),
            getGroupedComparisonChart({ columnSql: getCleanTextColumnSql("u.designation") }).catch(err => { console.warn("[DASHBOARD] designationData query failed:", err.message); return []; }),
            getGroupedComparisonChart({
                columnSql: leaderExpertColumnSql,
            }).catch(err => { console.warn("[DASHBOARD] leaderExpert query failed:", err.message); return []; }),
            getStateOptions().catch(err => { console.warn("[DASHBOARD] stateOptions query failed:", err.message); return []; }),
            getDistrictOptions().catch(err => { console.warn("[DASHBOARD] districtOptions query failed:", err.message); return []; }),
            getEducationComparisonChart({ columnSql: educationColumnSql }).catch(err => { console.warn("[DASHBOARD] educationData query failed:", err.message); return []; }),
        ]);

        pieCharts = {
            ...pieCharts,
            skillLevels,
            gender: genderData,
            state: stateData,
            district: districtData,
            designation: designationData,
            leaderExpert,
            leaderExpertTotalEmployees: await getUsersTotalDenominator(),
            stateOptions,
            districtOptions,
            education: educationData,
        };
    } catch (e) {
        console.warn("[DASHBOARD] Pie/comparison charts failed:", e.message);
    }

    try {
        // ============================================================
        // CONTRACTOR GRAPH COMPARISON FIX
        // Requirement:
        // Contractor graph me 2 bars dikhengi:
        // 1) Total Headcount (yellow) = first graph Total Manpower population,
        //    grouped by users.contractor.
        // 2) Actual Present (blue) = first graph Attendance population,
        //    grouped by the same contractor category and attendance shift.
        // ============================================================

        // Contractor category normalization:
        // 1) NULL/blank/placeholder values remain visible as one "Not Provided" category.
        // 2) Punctuation variants are merged before SQL GROUP BY.
        //    Examples:
        //    "B4S SOLUTIONS PVT. LTD" and "B4S SOLUTIONS PVT. LTD." -> "B4S SOLUTIONS PVT LTD"
        //    "VISION INDIA SERVICES PVT.LTD." and "VISION INDIA SERVICES PVT.LTD" -> "VISION INDIA SERVICES PVTLTD"
        // This prevents frontend/category-key collisions and keeps the contractor attendance sum
        // equal to the first Manpower graph attendance count.
        const contractorColumnSql = `
            CASE
                WHEN NULLIF(LTRIM(RTRIM(CAST(u.[contractor] AS NVARCHAR(510)))), '') IS NULL
                    THEN 'NOT PROVIDED'
                WHEN UPPER(LTRIM(RTRIM(CAST(u.[contractor] AS NVARCHAR(510))))) IN (
                    'NULL',
                    'UNDEFINED',
                    'UNKNOWN',
                    'NOT PROVIDED',
                    'N/A',
                    'NA',
                    '-'
                )
                    THEN 'NOT PROVIDED'
                ELSE UPPER(
                    LTRIM(
                        RTRIM(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    CAST(u.[contractor] AS NVARCHAR(510)),
                                                    '.',
                                                    ''
                                                ),
                                                ',',
                                                ''
                                            ),
                                            CHAR(9),
                                            ' '
                                        ),
                                        '  ',
                                        ' '
                                    ),
                                    '  ',
                                    ' '
                                ),
                                '  ',
                                ' '
                            )
                        )
                    )
                )
            END
        `;

        const applyContractorHierarchyAndLocationFilters = (sqlText, params) => {
            let nextSql = addUserMasterHierarchyFilters(sqlText, params, "u");
            nextSql = addStateDistrictFilters(nextSql, params, { alias: "u" });
            return nextSql;
        };

        let contractorTotalSql = `
            SELECT
                ${contractorColumnSql} AS contractorName,
                COUNT(DISTINCT u.id) AS totalHeadcount
            FROM users u
            WHERE 1=1
              ${activeUserIdFilterSql}
        `;
        const contractorTotalParams = [];
        contractorTotalSql = applyContractorHierarchyAndLocationFilters(contractorTotalSql, contractorTotalParams);
        contractorTotalSql += `
            GROUP BY ${contractorColumnSql}
        `;

        let contractorPresentSql = `
            SELECT
                ${contractorColumnSql} AS contractorName,
                COUNT(DISTINCT u.id) AS actualPresent
            FROM attendance_logs al
            INNER JOIN users u ON al.userId = u.id
            WHERE al.[date] >= '${masterSqlStartDate}'
              AND al.[date] <= '${masterSqlEndDate}'
              AND al.status IN ('P','PRESENT','Present')
              ${masterHoliday ? "AND 1 = 0 /* declared dashboard holiday */" : ""}
              ${getEligibleUserSql("u")}
                  ${getDashboardDesignationShutterExclusionSql("u")}
        `;
        const contractorPresentParams = [];
        contractorPresentSql = applyContractorHierarchyAndLocationFilters(contractorPresentSql, contractorPresentParams);
        contractorPresentSql = addShiftFilter(contractorPresentSql, contractorPresentParams, "al");
        contractorPresentSql += `
            GROUP BY ${contractorColumnSql}
        `;

        const [contractorTotalRows, contractorPresentRows] = await Promise.all([
            executeQuery(contractorTotalSql, contractorTotalParams).then(([rows]) => rows || []),
            executeQuery(contractorPresentSql, contractorPresentParams).then(([rows]) => rows || []),
        ]);

        const contractorMap = new Map();

        (contractorTotalRows || []).forEach(row => {
            const contractorName = normalizeChartName(row.contractorName);
            const existing = contractorMap.get(contractorName) || {
                name: contractorName,
                totalHeadcount: 0,
                actualPresent: 0,
            };

            // Add instead of overwrite as a final safety net in case the DB returns
            // multiple source variants that normalize to the same contractor name.
            existing.totalHeadcount += Number(row.totalHeadcount || 0);
            contractorMap.set(contractorName, existing);
        });

        (contractorPresentRows || []).forEach(row => {
            const contractorName = normalizeChartName(row.contractorName);

            const existing = contractorMap.get(contractorName) || {
                name: contractorName,
                totalHeadcount: 0,
                actualPresent: 0,
            };

            // Add instead of overwrite so no contractor attendance row is lost
            // when multiple source spellings map to one normalized category.
            existing.actualPresent += Number(row.actualPresent || 0);
            contractorMap.set(contractorName, existing);
        });

        const contractorDenominator = await getUsersTotalDenominator();

        pieCharts.contractorPrefix = Array.from(contractorMap.values())
            .map(row => {
                const totalHeadcount = Number(row.totalHeadcount || 0);
                const actualPresent = Number(row.actualPresent || 0);
                const attendancePercentage = contractorDenominator > 0
                    ? Number(((actualPresent / contractorDenominator) * 100).toFixed(1))
                    : 0;
                const masterPercentage = contractorDenominator > 0
                    ? Number(((totalHeadcount / contractorDenominator) * 100).toFixed(1))
                    : 0;

                return {
                    name: row.name,
                    value: actualPresent,
                    rawValue: actualPresent,
                    employeeCount: totalHeadcount,
                    actualPresent,
                    totalHeadcount,
                    attendanceValue: actualPresent,
                    masterValue: totalHeadcount,
                    attendanceCount: actualPresent,
                    masterCount: totalHeadcount,
                    percentage: attendancePercentage,
                    attendancePercentage,
                    masterPercentage,
                    totalEmployees: contractorDenominator,
                    denominatorTotal: contractorDenominator,
                };
            })
            .filter(item => item.name && (Number(item.masterValue || 0) > 0 || Number(item.attendanceValue || 0) > 0))
            .sort((a, b) => Number(b.masterValue || 0) - Number(a.masterValue || 0));
    } catch (e) {
        console.warn("[DASHBOARD] Contractor comparison chart failed:", e.message);
        pieCharts.contractorPrefix = [];
    }

    if (masterHoliday) {
        const holidayKeys = [
            "skillLevels",
            "gender",
            "state",
            "district",
            "designation",
            "leaderExpert",
            "contractorPrefix",
            "education",
        ];

        holidayKeys.forEach((key) => {
            if (!Array.isArray(pieCharts?.[key])) return;

            pieCharts[key] = pieCharts[key].map((item) => ({
                ...item,
                value: 0,
                rawValue: 0,
                actualPresent: 0,
                attendanceValue: 0,
                attendanceCount: 0,
                percentage: 0,
                attendancePercentage: 0,
                isHoliday: true,
                holidayName: masterHoliday.holidayName,
                holidayShortCode: masterHoliday.shortCode,
                holidayType: masterHoliday.holidayType,
            }));
        });
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                manpowerData,
                rejoiningData,
                holidays: topHolidayRows,
                absenteeismData,
                attritionData,
                skillGapData: [],
                pieCharts,
                filters: {
                    departmentName,
                    sectionName,
                    lineName,
                    snapshotTotal,
                    startDate: sqlStartDate,
                    endDate: sqlEndDate,
                    masterStartDate: masterSqlStartDate,
                    masterEndDate: masterSqlEndDate,
                    stateFilter: stateFilter || "ALL",
                    districtFilter: districtFilter || "ALL",
                    masterAttendanceMode: "YES",
                    masterAttendanceDate: yesterdaySqlDate,
                    attendanceDateAvailable,
                    masterHoliday,
                    shift: selectedShiftValue || "ALL",
                    attendanceLogic:
                        "Dashboard Total Manpower/Users Total bars use statusHistory employment intervals for the relevant date. An employee is removed on the leavingDate itself, excluded during the LEFT-to-rejoin gap, and counted again from the new joiningDate. Users without valid history use the legacy joiningDate/leavingDate fallback. Attendance absence never hides manpower data.",
                },
                debug: {
                    requiredStartDate: sqlStartDate,
                    requiredEndDate: sqlEndDate,
                    masterStartDate: masterSqlStartDate,
                    masterEndDate: masterSqlEndDate,
                    shift: selectedShiftValue || "ALL",
                },
            },
            "Dashboard stats fetched successfully"
        )
    );
});


export const getDashboardAttendance = asyncHandler(async (req, res) => {
    const {
        department,
        section,
        line,
        startDate,
        endDate,
        shift,
    } = req.query;

    const selectedShiftValue = shift && String(shift).trim().toUpperCase() !== 'ALL' ? String(shift).trim() : null;

    const addShiftFilter = (sqlText, params, alias = "al") => {
        if (!selectedShiftValue) return sqlText;

        const shiftColumn = `UPPER(LTRIM(RTRIM(CAST(${alias}.shift AS NVARCHAR(100)))))`;

        sqlText += `
            AND (
                ${shiftColumn} = UPPER(LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND ${shiftColumn} IN ('G', 'GEN', 'GENERAL', 'GENERAL SHIFT')
                )
            )
        `;

        params.push(selectedShiftValue, selectedShiftValue, selectedShiftValue, selectedShiftValue);
        return sqlText;
    };

    const safeName = (s) => String(s || "").replace(/'/g, "''");

    const departmentIds = parseMultiParam(department);
    const sectionIds = parseMultiParam(section);
    const lineIds = parseMultiParam(line);

    const getNamesByIds = async (table, ids) => {
        if (!ids.length) return [];

        const numericIds = ids
            .map(id => parseInt(id, 10))
            .filter(id => !Number.isNaN(id));

        if (!numericIds.length) return [];

        try {
            const placeholders = numericIds.map(() => "?").join(",");
            const [rows] = await executeQuery(
                `SELECT name FROM [${table}] WHERE id IN (${placeholders})`,
                numericIds
            );
            return rows.map(row => String(row.name || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn(`[DASHBOARD ATTENDANCE] ${table} lookup failed:`, e.message);
            return [];
        }
    };

    const departmentNames = await getNamesByIds("departments", departmentIds);
    const sectionNames = await getNamesByIds("sections", sectionIds);
    const lineNames = await getNamesByIds("lines", lineIds);

    const buildNameInCondition = (columnSql, names) => {
        if (!names || names.length === 0) return "";
        const safeValues = names.map(name => `UPPER('${safeName(name)}')`).join(",");
        return ` AND UPPER(LTRIM(RTRIM(${columnSql}))) IN (${safeValues})`;
    };

    const numericDepartmentIds = departmentIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));

    const numericSectionIds = sectionIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));

    const numericLineIds = lineIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));


    // SECTION HIERARCHY FIX:
    // A user belongs to a selected section when any one of these is true:
    // 1) users.sectionId directly matches the selected section,
    // 2) users.sectionId is blank and the user's line/sub-section resolves to it,
    // 3) the user's id exists in sections.users JSON for the selected section.
    // This matches the SDP section assignment rule and prevents section-wise
    // Total Manpower/Attendance mismatches without changing other filters.
    const getSectionHierarchyMatchSql = (alias = "u") => {
        if (!numericSectionIds.length && !sectionNames.length) return "";

        const directMatchSql = numericSectionIds.length
            ? `${alias}.sectionId IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(${alias}.[section] AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        const resolvedSectionSelectionSql = numericSectionIds.length
            ? `resolvedSection.id IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(resolvedSection.name AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        const jsonSectionSelectionSql = numericSectionIds.length
            ? `jsonSection.id IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(jsonSection.name AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        return `(
            ${directMatchSql}
            OR (
                ${alias}.sectionId IS NULL
                AND EXISTS (
                    SELECT 1
                    FROM [lines] resolvedLine
                    LEFT JOIN sub_sections resolvedSubSection
                        ON resolvedSubSection.id = ${alias}.subSectionId
                    INNER JOIN sections resolvedSection
                        ON resolvedSection.id = resolvedLine.sectionId
                    WHERE resolvedLine.id = COALESCE(${alias}.lineId, resolvedSubSection.lineId)
                      AND ${resolvedSectionSelectionSql}
                )
            )
            OR EXISTS (
                SELECT 1
                FROM sections jsonSection
                CROSS APPLY OPENJSON(
                    CASE
                        WHEN ISJSON(CAST(jsonSection.[users] AS NVARCHAR(MAX))) = 1
                        THEN CAST(jsonSection.[users] AS NVARCHAR(MAX))
                        ELSE N'[]'
                    END
                ) jsonSectionUser
                WHERE ${jsonSectionSelectionSql}
                  AND TRY_CAST(jsonSectionUser.[value] AS INT) = ${alias}.id
            )
        )`;
    };

    // IMPORTANT FIX:
    // Attendance/present graphs must use the same hierarchy source as Current Headcount.
    // Current Headcount users.departmentId/users.sectionId se count hota hai.
    // Pehle attendance snapshot hierarchy se filter ho raha tha,
    // jiski wajah se department + shift select karne par attendance extra employees count kar sakta tha.
    let hierCondition = "";

    if (numericDepartmentIds.length) {
        hierCondition += ` AND u.departmentId IN (${numericDepartmentIds.join(",")})`;
    } else {
        hierCondition += buildNameInCondition("u.[department]", departmentNames);
    }

    const sectionHierarchyMatchSql = getSectionHierarchyMatchSql("u");
    if (sectionHierarchyMatchSql) {
        hierCondition += ` AND ${sectionHierarchyMatchSql}`;
    }

    if (numericLineIds.length) {
        hierCondition += ` AND u.lineId IN (${numericLineIds.join(",")})`;
    } else {
        hierCondition += buildNameInCondition("u.[line]", lineNames);
    }

    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const parseDateLocal = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = String(dateStr).split("-").map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let rangeStart;
    let rangeEnd;

    if (startDate) {
        rangeStart = parseDateLocal(startDate) || new Date(today);
        rangeEnd = parseDateLocal(endDate || startDate) || new Date(today);
    } else {
        rangeEnd = new Date(today);
        rangeStart = new Date(today);
        rangeStart.setDate(rangeStart.getDate() - 29);
    }

    const sqlStartDate = formatDateLocal(rangeStart);
    const sqlEndDate = formatDateLocal(rangeEnd);

    let sqlText = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS fullDate,
            DAY(al.[date]) AS dayNum,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('P','PRESENT') THEN u.id END) AS present,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','LEAVE','HALF DAY') THEN u.id END) AS absent,
            COUNT(DISTINCT u.id) AS total
        FROM attendance_logs al
        INNER JOIN users u
            ON al.userId = u.id
            AND ISNULL(u.isTemporary, 0) = 0
        WHERE CONVERT(DATE, al.[date]) >= '${sqlStartDate}'
          AND CONVERT(DATE, al.[date]) <= '${sqlEndDate}'
          ${hierCondition}
          ${getEligibleUserSql("u")}
                  ${getDashboardDesignationShutterExclusionSql("u")}
    `;

    const params = [];
    sqlText = addShiftFilter(sqlText, params, "al");
    sqlText += `
        GROUP BY al.[date], DAY(al.[date])
        ORDER BY al.[date]
    `;

    const [rows] = await executeQuery(sqlText, params);

    const data = rows.map(row => ({
        date: row.fullDate,
        day: row.dayNum,
        present: Number(row.present || 0),
        absent: Number(row.absent || 0),
        total: Number(row.total || 0),
    }));

    return res.status(200).json(
        new ApiResponse(200, { data }, "Dashboard attendance fetched successfully")
    );
});


export const getDashboardTenureStats = asyncHandler(async (req, res) => {
    const {
        department,
        section,
        line,
        startDate,
        endDate,
        customTenureFrom,
        customTenureTo,
        shift,
    } = req.query;

    const selectedShiftValue =
        shift && String(shift).trim().toUpperCase() !== "ALL"
            ? String(shift).trim()
            : null;

    const safeName = (s) => String(s || "").replace(/'/g, "''");

    const departmentIds = parseMultiParam(department);
    const sectionIds = parseMultiParam(section);
    const lineIds = parseMultiParam(line);

    const getNamesByIds = async (table, ids) => {
        if (!ids.length) return [];

        const numericIds = ids
            .map((id) => parseInt(id, 10))
            .filter((id) => !Number.isNaN(id));

        if (!numericIds.length) return [];

        try {
            const placeholders = numericIds.map(() => "?").join(",");
            const [rows] = await executeQuery(
                `SELECT name FROM [${table}] WHERE id IN (${placeholders})`,
                numericIds
            );
            return rows.map((row) => String(row.name || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn(`[TENURE] ${table} lookup failed:`, e.message);
            return [];
        }
    };



    const departmentNames = await getNamesByIds("departments", departmentIds);
    const sectionNames = await getNamesByIds("sections", sectionIds);
    const lineNames = await getNamesByIds("lines", lineIds);

    const buildNameInCondition = (columnSql, names) => {
        if (!names || names.length === 0) return "";
        const safeValues = names.map((name) => `UPPER('${safeName(name)}')`).join(",");
        return ` AND UPPER(LTRIM(RTRIM(${columnSql}))) IN (${safeValues})`;
    };

    const numericDepartmentIds = departmentIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));

    const numericSectionIds = sectionIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));

    const numericLineIds = lineIds
        .map(id => parseInt(id, 10))
        .filter(id => !Number.isNaN(id));


    // SECTION HIERARCHY FIX:
    // A user belongs to a selected section when any one of these is true:
    // 1) users.sectionId directly matches the selected section,
    // 2) users.sectionId is blank and the user's line/sub-section resolves to it,
    // 3) the user's id exists in sections.users JSON for the selected section.
    // This matches the SDP section assignment rule and prevents section-wise
    // Total Manpower/Attendance mismatches without changing other filters.
    const getSectionHierarchyMatchSql = (alias = "u") => {
        if (!numericSectionIds.length && !sectionNames.length) return "";

        const directMatchSql = numericSectionIds.length
            ? `${alias}.sectionId IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(${alias}.[section] AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        const resolvedSectionSelectionSql = numericSectionIds.length
            ? `resolvedSection.id IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(resolvedSection.name AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        const jsonSectionSelectionSql = numericSectionIds.length
            ? `jsonSection.id IN (${numericSectionIds.join(",")})`
            : `UPPER(LTRIM(RTRIM(CAST(jsonSection.name AS NVARCHAR(510))))) IN (${sectionNames.map(name => `UPPER('${safeName(name)}')`).join(",")})`;

        return `(
            ${directMatchSql}
            OR (
                ${alias}.sectionId IS NULL
                AND EXISTS (
                    SELECT 1
                    FROM [lines] resolvedLine
                    LEFT JOIN sub_sections resolvedSubSection
                        ON resolvedSubSection.id = ${alias}.subSectionId
                    INNER JOIN sections resolvedSection
                        ON resolvedSection.id = resolvedLine.sectionId
                    WHERE resolvedLine.id = COALESCE(${alias}.lineId, resolvedSubSection.lineId)
                      AND ${resolvedSectionSelectionSql}
                )
            )
            OR EXISTS (
                SELECT 1
                FROM sections jsonSection
                CROSS APPLY OPENJSON(
                    CASE
                        WHEN ISJSON(CAST(jsonSection.[users] AS NVARCHAR(MAX))) = 1
                        THEN CAST(jsonSection.[users] AS NVARCHAR(MAX))
                        ELSE N'[]'
                    END
                ) jsonSectionUser
                WHERE ${jsonSectionSelectionSql}
                  AND TRY_CAST(jsonSectionUser.[value] AS INT) = ${alias}.id
            )
        )`;
    };

    // IMPORTANT FIX:
    // Attendance/present graphs must use the same hierarchy source as Current Headcount.
    // Current Headcount users.departmentId/users.sectionId se count hota hai.
    // Pehle attendance snapshot hierarchy se filter ho raha tha,
    // jiski wajah se department + shift select karne par attendance extra employees count kar sakta tha.
    let hierCondition = "";

    if (numericDepartmentIds.length) {
        hierCondition += ` AND u.departmentId IN (${numericDepartmentIds.join(",")})`;
    } else {
        hierCondition += buildNameInCondition("u.[department]", departmentNames);
    }

    const sectionHierarchyMatchSql = getSectionHierarchyMatchSql("u");
    if (sectionHierarchyMatchSql) {
        hierCondition += ` AND ${sectionHierarchyMatchSql}`;
    }

    if (numericLineIds.length) {
        hierCondition += ` AND u.lineId IN (${numericLineIds.join(",")})`;
    } else {
        hierCondition += buildNameInCondition("u.[line]", lineNames);
    }

    // ATTRITION ONLY:
    // Tenure attrition hierarchy filters now come directly from users table.
    // users table is no longer required.
    // isTemporary / isDeleted / designation filters remain intentionally unchanged for attrition.
    const attritionHierCondition = hierCondition;

    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const parseDateLocal = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = String(dateStr).split("-").map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    };

    const indiaNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    indiaNow.setHours(0, 0, 0, 0);

    const yesterday = new Date(indiaNow);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = formatDateLocal(indiaNow);
    const yesterdayStr = formatDateLocal(yesterday);

    let todayHasAttendance = false;
    try {
        const checkTodaySql = `
            SELECT TOP 1 1 
            FROM attendance_logs al
            WHERE CONVERT(DATE, al.[date]) = CONVERT(DATE, ?, 23)
              AND (
                  UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = 'A'
                  OR UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = 'SHIFT A'
                  OR UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = 'A SHIFT'
                  OR UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = 'A-SHIFT'
              )
        `;
        const [todayCheckRows] = await executeQuery(checkTodaySql, [todayStr]);
        todayHasAttendance = todayCheckRows && todayCheckRows.length > 0;
    } catch (checkErr) {
        console.warn("[TENURE] Today Shift A check failed:", checkErr.message);
    }

    const effectiveDateStr = todayHasAttendance ? todayStr : yesterdayStr;

    let rangeStart = parseDateLocal(effectiveDateStr);
    let rangeEnd = parseDateLocal(effectiveDateStr);

    if (startDate && startDate === (endDate || startDate)) {
        const requestedDate = parseDateLocal(startDate);
        if (startDate === todayStr && !todayHasAttendance) {
            rangeStart = parseDateLocal(effectiveDateStr);
            rangeEnd = parseDateLocal(effectiveDateStr);
        } else {
            rangeStart = requestedDate;
            rangeEnd = requestedDate;
        }
    }

    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const sqlStartDate = formatDateLocal(rangeStart);
    const sqlEndDate = formatDateLocal(rangeEnd);


    const tenureHolidayRows = await getDashboardHolidaysForRange(sqlStartDate, sqlEndDate);
    const tenureHoliday = sqlStartDate === sqlEndDate
        ? (tenureHolidayRows.find(item => item.holidayDate === sqlStartDate) || null)
        : null;

    // Attendance and absenteeism continue to use the previous/selected attendance date.
    // Tenure Attrition uses the current India date independently.
    // Tenure Users Total buckets always use the current India date so their
    // Total Manpower values match all other dashboard comparison graphs.
    const usersTotalAsOfDate = sqlEndDate;

    const customFromDays = Number(customTenureFrom);
    const customToDays = Number(customTenureTo);

    const hasCustomTenureRange =
        customTenureFrom !== undefined &&
        customTenureTo !== undefined &&
        customTenureFrom !== "" &&
        customTenureTo !== "" &&
        Number.isFinite(customFromDays) &&
        Number.isFinite(customToDays) &&
        customFromDays >= 0 &&
        customToDays >= customFromDays;

    const emptyBuckets = () => ({
        "0-16d": 0,
        "17-30d": 0,
        "31-60d": 0,
        "61-90d": 0,
        "3m-6m": 0,
        "6m-9m": 0,
        "9m-1y": 0,
        "1y-2y": 0,
        "2y-3y": 0,
        "3y-others": 0,
        ...(hasCustomTenureRange ? { CUSTOM: 0 } : {}),
    });

    const BUCKET_LABELS = {
        "0-16d": "0–16 days",
        "17-30d": "17–30 days",
        "31-60d": "31–60 days",
        "61-90d": "61–90 days",
        "3m-6m": "3m–6m",
        "6m-9m": "6m–9m",
        "9m-1y": "9m–1y",
        "1y-2y": "1y–2y",
        "2y-3y": "2y–3y",
        "3y-others": "3y & others",
        ...(hasCustomTenureRange ? { CUSTOM: `${customFromDays}–${customToDays} days` } : {}),
    };

    const joinDateSQL = `
        COALESCE(
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 23),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 103),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 105),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 120),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 121),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 101),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 110),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 106),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 107)
        )
    `;

    const leaveDateSQL = `
        COALESCE(
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 23),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 103),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 105),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 120),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 121),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 101),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 110),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 106),
            TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 'NULL'), 107)
        )
    `;

    // Attrition tenure bucket joiningDate se hi calculate hoga.
    // Tenure Attrition ke liye leavingDate employee-left marker hai; users.status mandatory nahi hai.
    // Agar joiningDate blank/invalid hai to employee tenure attrition graph me skip hoga,
    // lekin Daily Attrition graph ka existing logic unchanged rahega.
    const attritionJoinDateSQL = joinDateSQL;

    const bucketCaseSQL = `
        CASE
            WHEN tenureDays BETWEEN 0 AND 16 THEN '0-16d'
            WHEN tenureDays BETWEEN 17 AND 30 THEN '17-30d'
            WHEN tenureDays BETWEEN 31 AND 60 THEN '31-60d'
            WHEN tenureDays BETWEEN 61 AND 90 THEN '61-90d'
            WHEN tenureDays BETWEEN 91 AND 180 THEN '3m-6m'
            WHEN tenureDays BETWEEN 181 AND 270 THEN '6m-9m'
            WHEN tenureDays BETWEEN 271 AND 365 THEN '9m-1y'
            WHEN tenureDays BETWEEN 366 AND 730 THEN '1y-2y'
            WHEN tenureDays BETWEEN 731 AND 1095 THEN '2y-3y'
            ELSE '3y-others'
        END
    `;

    const addShiftFilterOnAttendance = (sqlText, params) => {
        if (!selectedShiftValue) return sqlText;

        // Tenure Attendance uses the same flexible shift matching as the
        // other attendance graphs: A, Shift A, A Shift, A-Shift, A_Shift,
        // and General/G shift formats are treated as the same shift.
        const shiftColumn = `UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100)))))`;
        const shiftColumnCompact = `REPLACE(REPLACE(REPLACE(${shiftColumn}, ' ', ''), '-', ''), '_', '')`;

        sqlText += `
            AND (
                ${shiftColumn} = UPPER(LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = 'SHIFT' + REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '') + 'SHIFT'
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND ${shiftColumnCompact} IN ('G', 'GEN', 'GENERAL', 'GENERALSHIFT', 'SHIFTG', 'GSHIFT')
                )
            )
        `;

        params.push(
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue
        );

        return sqlText;
    };

    const addShiftFilterOnUser = (sqlText, params) => {
        if (!selectedShiftValue) return sqlText;
        sqlText += `
            AND (
                UPPER(LTRIM(RTRIM(CAST(u.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(CAST(u.shift AS NVARCHAR(100))))) = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(CAST(u.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND UPPER(LTRIM(RTRIM(CAST(u.shift AS NVARCHAR(100))))) IN ('G', 'GEN', 'GENERAL', 'GENERAL SHIFT')
                )
            )
        `;
        params.push(selectedShiftValue, selectedShiftValue, selectedShiftValue, selectedShiftValue);
        return sqlText;
    };

    const addFlexibleShiftFilterOnUser = (sqlText, params) => {
        if (!selectedShiftValue) return sqlText;

        // Optimized: avoid slow row-by-row EXISTS. Use IN with selected shift employees
        // from attendance_logs for selected date/range. This fixes users.shift blank/mismatch.
        sqlText += `
            AND UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100))))) IN (
                SELECT DISTINCT UPPER(LTRIM(RTRIM(CAST(alShift.payCode AS NVARCHAR(100)))))
                FROM attendance_logs alShift
                WHERE CONVERT(DATE, alShift.[date]) >= ?
                  AND CONVERT(DATE, alShift.[date]) <= ?
                  AND (
                      UPPER(LTRIM(RTRIM(CAST(alShift.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)))
                      OR UPPER(LTRIM(RTRIM(CAST(alShift.shift AS NVARCHAR(100))))) = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                      OR UPPER(LTRIM(RTRIM(CAST(alShift.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                      OR (
                          UPPER(LTRIM(RTRIM(?))) = 'G'
                          AND UPPER(LTRIM(RTRIM(CAST(alShift.shift AS NVARCHAR(100))))) IN ('G', 'GEN', 'GENERAL', 'GENERAL SHIFT')
                      )
                  )
            )
        `;

        params.push(
            sqlStartDate,
            sqlEndDate,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue
        );

        return sqlText;
    };

    let attendance = emptyBuckets();
    let absenteeism = emptyBuckets();
    let attrition = emptyBuckets();
    let masterTenure = emptyBuckets();

    try {
        // Tenure Attendance follows the selected shift.
        // Tenure Absenteeism intentionally ignores shift, so both metrics are
        // calculated with separate queries even though they use the same date,
        // hierarchy and tenure-bucket rules.
        let attendanceSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                COUNT(DISTINCT CASE WHEN attendanceStatus IN ('P','PRESENT','Present') THEN userId END) AS presentCount
            FROM (
                SELECT
                    u.id AS userId,
                    u.empId,
                    al.status AS attendanceStatus,
                    CASE
                        WHEN ${joinDateSQL} IS NULL THEN 1096
                        WHEN DATEDIFF(DAY, ${joinDateSQL}, al.[date]) < 0 THEN 0
                        ELSE DATEDIFF(DAY, ${joinDateSQL}, al.[date])
                    END AS tenureDays
                FROM attendance_logs al
                INNER JOIN users u
                    ON al.userId = u.id
                    AND ISNULL(u.isTemporary, 0) = 0
                WHERE al.[date] >= ?
                  AND al.[date] <= ?
                  ${tenureHoliday ? "AND 1 = 0 /* declared dashboard holiday */" : ""}
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND u.empId != ''
                  ${hierCondition}
                  ${getDashboardDesignationShutterExclusionSql("u")}
        `;

        const attendanceParams = [sqlStartDate, sqlEndDate];
        attendanceSql = addShiftFilterOnAttendance(attendanceSql, attendanceParams);
        attendanceSql += `
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;

        const [attendanceRows] = await executeQuery(attendanceSql, attendanceParams);
        attendanceRows.forEach((row) => {
            if (row.bucket && attendance[row.bucket] !== undefined) {
                attendance[row.bucket] = Number(row.presentCount || 0);
            }
        });

        let absenteeismSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                COUNT(DISTINCT CASE WHEN attendanceStatus IN ('ABSENT', 'LEAVE', 'HALF DAY', 'Absent', 'Leave', 'Half Day') THEN userId END) AS absentCount
            FROM (
                SELECT
                    u.id AS userId,
                    u.empId,
                    al.status AS attendanceStatus,
                    DATEDIFF(DAY, ${joinDateSQL}, al.[date]) AS tenureDays
                FROM attendance_logs al
                INNER JOIN users u
                    ON al.userId = u.id
                    AND ISNULL(u.isTemporary, 0) = 0
                WHERE al.[date] >= ?
                  AND al.[date] <= ?
                  ${tenureHoliday ? "AND 1 = 0 /* declared dashboard holiday */" : ""}
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND u.empId != ''
                  AND ${joinDateSQL} IS NOT NULL
                  ${hierCondition}
                  ${getDashboardDesignationShutterExclusionSql("u")}
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;

        const absenteeismParams = [sqlStartDate, sqlEndDate];
        const [absenteeismRows] = await executeQuery(absenteeismSql, absenteeismParams);
        absenteeismRows.forEach((row) => {
            if (row.bucket && absenteeism[row.bucket] !== undefined) {
                absenteeism[row.bucket] = Number(row.absentCount || 0);
            }
        });

        if (hasCustomTenureRange) {
            let customAttendanceSql = `
                SELECT
                    COUNT(DISTINCT CASE WHEN al.status IN ('P','PRESENT','Present') THEN u.id END) AS presentCount
                FROM attendance_logs al
                INNER JOIN users u
                    ON al.userId = u.id
                    AND ISNULL(u.isTemporary, 0) = 0
                WHERE al.[date] >= ?
                  AND al.[date] <= ?
                  ${tenureHoliday ? "AND 1 = 0 /* declared dashboard holiday */" : ""}
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND u.empId != ''
                  AND ${joinDateSQL} IS NOT NULL
                  AND DATEDIFF(DAY, ${joinDateSQL}, al.[date]) BETWEEN ? AND ?
                  ${hierCondition}
                  ${getDashboardDesignationShutterExclusionSql("u")}
            `;

            const customAttendanceParams = [sqlStartDate, sqlEndDate, customFromDays, customToDays];
            customAttendanceSql = addShiftFilterOnAttendance(customAttendanceSql, customAttendanceParams);
            const [attendanceCustomRows] = await executeQuery(customAttendanceSql, customAttendanceParams);
            attendance.CUSTOM = Number(attendanceCustomRows?.[0]?.presentCount || 0);

            const customAbsenteeismSql = `
                SELECT
                    COUNT(DISTINCT CASE WHEN al.status IN ('ABSENT', 'LEAVE', 'HALF DAY', 'Absent', 'Leave', 'Half Day') THEN u.id END) AS absentCount
                FROM attendance_logs al
                INNER JOIN users u
                    ON al.userId = u.id
                    AND ISNULL(u.isTemporary, 0) = 0
                WHERE al.[date] >= ?
                  AND al.[date] <= ?
                  ${tenureHoliday ? "AND 1 = 0 /* declared dashboard holiday */" : ""}
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND u.empId != ''
                  AND ${joinDateSQL} IS NOT NULL
                  AND DATEDIFF(DAY, ${joinDateSQL}, al.[date]) BETWEEN ? AND ?
                  ${hierCondition}
                  ${getDashboardDesignationShutterExclusionSql("u")}
            `;

            const customAbsenteeismParams = [sqlStartDate, sqlEndDate, customFromDays, customToDays];
            const [absenteeismCustomRows] = await executeQuery(customAbsenteeismSql, customAbsenteeismParams);
            absenteeism.CUSTOM = Number(absenteeismCustomRows?.[0]?.absentCount || 0);
        }
    } catch (e) {
        console.warn("[TENURE] attendance/absenteeism failed:", e.message);
        attendance = emptyBuckets();
        absenteeism = emptyBuckets();
    }

    try {
        let masterTenureSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                COUNT(DISTINCT userId) AS totalCount
            FROM (
                SELECT
                    u.id AS userId,
                    CASE
                        WHEN ${joinDateSQL} IS NULL THEN 1096
                        WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, ?)) < 0 THEN 0
                        ELSE DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, ?))
                    END AS tenureDays
                FROM users u
                WHERE 1=1
                  ${getFirstGraphTotalManpowerEligibilitySql("u")}
                  ${hierCondition}
        `;

        const masterTenureParams = [
            usersTotalAsOfDate,
            usersTotalAsOfDate,
        ];
        // IMPORTANT:
        // Users Total / master tenure bar par shift filter apply nahi hoga.
        // Shift filter sirf Tenure Attendance value par apply hoga.
        // Tenure Absenteeism aur Attrition dono shift ignore karenge.
        masterTenureSql += `
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;

        const [masterRows] = await executeQuery(masterTenureSql, masterTenureParams);
        masterRows.forEach((row) => {
            if (row.bucket && masterTenure[row.bucket] !== undefined) {
                masterTenure[row.bucket] = Number(row.totalCount || 0);
            }
        });

        if (hasCustomTenureRange) {
            let customMasterSql = `
                SELECT COUNT(DISTINCT u.id) AS totalCount
                FROM users u
                WHERE 1=1
                  ${getFirstGraphTotalManpowerEligibilitySql("u")}
                  AND ${joinDateSQL} IS NOT NULL
                  AND DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, ?)) BETWEEN ? AND ?
                  ${hierCondition}
            `;
            const customMasterParams = [
                usersTotalAsOfDate,
                customFromDays,
                customToDays,
            ];
            // IMPORTANT:
            // Custom tenure Users Total par shift filter apply nahi hoga.
            const [rows] = await executeQuery(customMasterSql, customMasterParams);
            masterTenure.CUSTOM = Number(rows?.[0]?.totalCount || 0);
        }
    } catch (e) {
        console.warn("[TENURE] users/master tenure failed:", e.message);
        masterTenure = emptyBuckets();
    }

    try {
        // TENURE ATTRITION ONLY:
        // Set dynamic date to sqlEndDate (Today or Yesterday)
        const tenureAttritionTodaySql = `CONVERT(DATE, ?, 23)`;

        let attritionSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                COUNT(DISTINCT userId) AS leftCount
            FROM (
                SELECT
                    u.id AS userId,
                    CASE 
                        WHEN DATEDIFF(DAY, ${attritionJoinDateSQL}, ${leaveDateSQL}) < 0 THEN 0 
                        ELSE DATEDIFF(DAY, ${attritionJoinDateSQL}, ${leaveDateSQL}) 
                    END AS tenureDays
                FROM users u
                WHERE
                  -- TENURE ATTRITION ONLY:
                  -- Employee must be LEFT and leavingDate must equal today's India date.
                  UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) = 'LEFT'
                  AND ${attritionJoinDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} = ${tenureAttritionTodaySql}

                  ${attritionHierCondition}

                  -- IMPORTANT: Do not use getEligibleUserSql() here.
                  -- In some deployments that shared helper still requires the employee
                  -- to exist in user_hierarchy_snapshots. LEFT employees can be removed
                  -- from that snapshot immediately, which incorrectly hides valid attrition.
                  -- Tenure Attrition therefore uses users-table eligibility only.
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND ISNULL(u.isTemporary, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  ${getDashboardDesignationShutterExclusionSql("u")}
                  -- Shift behavior remains unchanged.
        `;

        const attritionParams = [sqlEndDate];

        attritionSql += `
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;

        const [attritionRows] = await executeQuery(attritionSql, attritionParams);
        attritionRows.forEach((row) => {
            if (row.bucket && attrition[row.bucket] !== undefined) {
                attrition[row.bucket] = Number(row.leftCount || 0);
            }
        });

        if (hasCustomTenureRange) {
            let customAttritionSql = `
                SELECT COUNT(DISTINCT u.id) AS leftCount
                FROM users u
                WHERE
                  -- Custom Tenure Attrition follows the same LEFT + India-today rule.
                  UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) = 'LEFT'
                  AND ${attritionJoinDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} = ${tenureAttritionTodaySql}
                  AND (
                      CASE 
                          WHEN DATEDIFF(DAY, ${attritionJoinDateSQL}, ${leaveDateSQL}) < 0 THEN 0 
                          ELSE DATEDIFF(DAY, ${attritionJoinDateSQL}, ${leaveDateSQL}) 
                      END
                  ) BETWEEN ? AND ?
                  ${attritionHierCondition}

                  -- Snapshot-independent eligibility, only for Tenure Attrition.
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND ISNULL(u.isTemporary, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  ${getDashboardDesignationShutterExclusionSql("u")}
                  -- Shift behavior remains unchanged.
            `;

            const customAttritionParams = [sqlEndDate, customFromDays, customToDays];

            const [rows] = await executeQuery(customAttritionSql, customAttritionParams);
            attrition.CUSTOM = Number(rows?.[0]?.leftCount || 0);
        }
    } catch (e) {
        console.warn("[TENURE] attrition failed:", e.message);
        attrition = emptyBuckets();
    }

    const toArray = (bucketObj) =>
        Object.entries(bucketObj).map(([bucket, value]) => ({
            bucket,
            name: BUCKET_LABELS[bucket] || bucket,
            value: Number(value || 0),
        }));

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                attendance,
                absenteeism,
                attrition,
                masterTenure,
                usersTotalByTenure: masterTenure,

                tenureManpower: toArray(attendance),
                tenureAbsenteeism: toArray(absenteeism),
                tenureAttrition: toArray(attrition),
                tenureMaster: toArray(masterTenure),

                buckets: BUCKET_LABELS,

                filters: {
                    startDate: sqlStartDate,
                    endDate: sqlEndDate,
                    holiday: tenureHoliday,
                    shift: selectedShiftValue || "ALL",
                    attendanceLogic:
                        "Tenure Attendance selected date attendance_logs se calculate hoga aur selected shift attendance_logs.shift par apply hoga. Tenure Absenteeism same selected date aur hierarchy se calculate hoga, lekin shift ko ignore karega.",
                    masterLogic:
                        "Grey/dark yellow Users Total bar current India date ke active employee rule se calculate hota hai. Blank/invalid joiningDate 3y & others me count hogi; leavingDate employee ko sirf status LEFT hone par remove karegi. Selected attendance date aur shift is bar ko change nahi karenge.",
                    attritionLogic:
                        "Tenure Attrition me users.leavingDate authoritative left marker hai; users.status = LEFT mandatory nahi hai. Sirf current India date (today) ke exact leavingDate aur valid joiningDate wale eligible employees count honge. JoiningDate aur leavingDate se tenure bucket decide hoga. Department/section/line filters users table se apply honge aur shift ignore hoga.",
                    matchingLogic:
                        "attendance_logs.userId = users.id and users.joiningDate se tenure bucket calculate hota hai.",
                    customTenureFrom: hasCustomTenureRange ? customFromDays : null,
                    customTenureTo: hasCustomTenureRange ? customToDays : null,
                },
            },
            "Tenure stats fetched successfully"
        )
    );
});


export const getDashboardDepartments = asyncHandler(async (req, res) => {
    const [rows] = await executeQuery(
        `
        SELECT DISTINCT
            d.id,
            d.name
        FROM departments d
        ORDER BY d.name
        `,
        []
    );

    const departments = rows
        .filter(row => row.id !== null && row.id !== undefined && row.name)
        .map(row => ({
            id: String(row.id),
            name: String(row.name),
        }));

    return res.status(200).json(
        new ApiResponse(200, { departments }, "Departments fetched successfully")
    );
});


export const getDashboardSections = asyncHandler(async (req, res) => {
    const { departmentId } = req.query;

    const departmentIds = String(departmentId || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .filter(item => item.toUpperCase() !== "ALL")
        .map(item => parseInt(item, 10))
        .filter(item => !Number.isNaN(item));

    if (!departmentIds.length) {
        return res.status(200).json(
            new ApiResponse(200, { sections: [] }, "Invalid department selected")
        );
    }

    const placeholders = departmentIds.map(() => "?").join(",");

    const [rows] = await executeQuery(
        `
        SELECT DISTINCT
            s.id,
            s.name
        FROM sections s
        WHERE s.departmentId IN (${placeholders})
        ORDER BY s.name
        `,
        departmentIds
    );

    const sections = rows
        .filter(row => row.id !== null && row.id !== undefined && row.name)
        .map(row => ({
            id: String(row.id),
            name: String(row.name),
        }));

    return res.status(200).json(
        new ApiResponse(200, { sections }, "Sections fetched successfully")
    );
});


export const getDashboardLines = asyncHandler(async (req, res) => {
    const { sectionId } = req.query;

    const sectionIds = String(sectionId || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .filter(item => item.toUpperCase() !== "ALL")
        .map(item => parseInt(item, 10))
        .filter(item => !Number.isNaN(item));

    if (!sectionIds.length) {
        return res.status(200).json(
            new ApiResponse(200, { lines: [] }, "Invalid section selected")
        );
    }

    const placeholders = sectionIds.map(() => "?").join(",");

    const [rows] = await executeQuery(
        `
        SELECT DISTINCT
            l.id,
            l.name
        FROM lines l
        WHERE l.sectionId IN (${placeholders})
        ORDER BY l.name
        `,
        sectionIds
    );

    const lines = rows
        .filter(row => row.id !== null && row.id !== undefined && row.name)
        .map(row => ({
            id: String(row.id),
            name: String(row.name),
        }));

    return res.status(200).json(
        new ApiResponse(200, { lines }, "Lines fetched successfully")
    );
}); 