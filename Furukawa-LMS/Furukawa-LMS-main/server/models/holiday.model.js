import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

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
            logger.error("[Holiday Model] Failed to initialize dashboard_holidays table", error);
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
        if (!startDate || !endDate) return [];
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

        const [rows] = await executeQuery(query, [startDate, endDate]);
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
        if (!Number.isInteger(holidayId) || holidayId <= 0) return null;

        const query = `
            UPDATE dbo.dashboard_holidays
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
                inserted.createdBy,
                inserted.createdAt,
                inserted.updatedAt
            WHERE id = ?
        `;

        const [rows] = await executeQuery(query, [holidayId]);
        return rows?.[0] || null;
    }
}

Holiday.init().catch((error) => {
    console.error("[Holiday Model] Initialization error:", error);
});

export default Holiday;
