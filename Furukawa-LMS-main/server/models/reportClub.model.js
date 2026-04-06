import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class ReportClub {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.departmentId = data.departmentId;
        this.sectionIds = typeof data.sectionIds === 'string' ? JSON.parse(data.sectionIds) : (data.sectionIds || []);
        this.showInReport = !!data.showInReport;
        this.createdBy = data.createdBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        
        // Joined data (if any)
        this.departmentName = data.departmentName;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'report_clubs')
            BEGIN
                CREATE TABLE [report_clubs] (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    name NVARCHAR(255) NOT NULL,
                    departmentId INT NOT NULL,
                    sectionIds NVARCHAR(MAX) NOT NULL, -- JSON array of section IDs
                    showInReport BIT DEFAULT 0,
                    createdBy INT NOT NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE,
                    FOREIGN KEY (createdBy) REFERENCES users(id)
                );
                CREATE INDEX idx_report_club_dept ON [report_clubs](departmentId);
            END
            ELSE
            BEGIN
                -- Add showInReport column if it doesn't exist
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('report_clubs') AND name = 'showInReport')
                BEGIN
                    ALTER TABLE [report_clubs] ADD showInReport BIT DEFAULT 0;
                END
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created report_clubs table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize ReportClub table", error);
        }
    }

    static async create(data) {
        const query = `
            INSERT INTO [report_clubs] (name, departmentId, sectionIds, showInReport, createdBy, createdAt, updatedAt)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE())
        `;
        const sectionIdsJson = JSON.stringify(data.sectionIds || []);
        const showInReport = data.showInReport ? 1 : 0;
        const [result] = await executeQuery(query, [data.name, data.departmentId, sectionIdsJson, showInReport, data.createdBy]);
        return ReportClub.findById(result[0].id);
    }

    static async update(id, data) {
        const fields = [];
        const values = [];

        if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
        if (data.departmentId !== undefined) { fields.push("departmentId = ?"); values.push(data.departmentId); }
        if (data.sectionIds !== undefined) { fields.push("sectionIds = ?"); values.push(JSON.stringify(data.sectionIds)); }
        if (data.showInReport !== undefined) { fields.push("showInReport = ?"); values.push(data.showInReport ? 1 : 0); }

        if (fields.length === 0) return ReportClub.findById(id);

        const query = `UPDATE [report_clubs] SET ${fields.join(", ")}, updatedAt = GETDATE() WHERE id = ?`;
        values.push(id);
        await executeQuery(query, values);
        return ReportClub.findById(id);
    }

    static async findById(id) {
        const query = `
            SELECT rc.*, d.name as departmentName
            FROM [report_clubs] rc
            LEFT JOIN departments d ON rc.departmentId = d.id
            WHERE rc.id = ?
        `;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new ReportClub(rows[0]);
    }

    static async findAll() {
        const query = `
            SELECT rc.*, d.name as departmentName
            FROM [report_clubs] rc
            LEFT JOIN departments d ON rc.departmentId = d.id
            ORDER BY rc.createdAt DESC
        `;
        const [rows] = await executeQuery(query);
        return rows.map(r => new ReportClub(r));
    }

    static async delete(id) {
        const [result, metadata] = await executeQuery("DELETE FROM [report_clubs] WHERE id = ?", [id]);
        return metadata.affectedRows > 0;
    }
}

export default ReportClub;
