import { executeQuery } from "../db/mssqlHelper.js";

class HeadcountReport {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.month = data.month;
        this.year = data.year;
        this.tableData = typeof data.tableData === 'string' ? JSON.parse(data.tableData) : (data.tableData || {});
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='headcount_reports' and xtype='U')
            BEGIN
                CREATE TABLE headcount_reports (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL,
                    month INT NOT NULL,
                    year INT NOT NULL,
                    tableData NVARCHAR(MAX) DEFAULT '{}',
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    UNIQUE (departmentId, month, year)
                )
            END
        `;
        return await executeQuery(query);
    }

    static async findOne(query) {
        const { departmentId, month, year } = query;
        const [rows] = await executeQuery(
            `SELECT * FROM headcount_reports WHERE departmentId = ? AND month = ? AND year = ?`,
            [departmentId, month, year]
        );
        return rows.length > 0 ? new HeadcountReport(rows[0]) : null;
    }

    static async createOrUpdate(data) {
        const { departmentId, month, year, tableData } = data;
        const tableDataStr = JSON.stringify(tableData);

        // Check if exists
        const existing = await this.findOne({ departmentId, month, year });

        if (existing) {
            await executeQuery(
                `UPDATE headcount_reports SET tableData = ?, updatedAt = GETDATE() WHERE id = ?`,
                [tableDataStr, existing.id]
            );
            return existing.id;
        } else {
            const [rows, metadata] = await executeQuery(
                `INSERT INTO headcount_reports (departmentId, month, year, tableData) 
                 VALUES (?, ?, ?, ?); SELECT SCOPE_IDENTITY() AS id;`,
                [departmentId, month, year, tableDataStr]
            );
            return rows[0]?.id;
        }
    }
}

export default HeadcountReport;
