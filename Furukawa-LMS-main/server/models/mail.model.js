import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class Mail {
    constructor(data) {
        this.id = data.id;
        this.email = data.email;
        this.isDailyReport = !!data.isDailyReport;
        this.isMonthlyReport = !!data.isMonthlyReport;
        this.reportTypes = data.reportTypes || "";
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='email_report_recipients' and xtype='U')
            BEGIN
                CREATE TABLE email_report_recipients (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    isDailyReport BIT DEFAULT 0,
                    isMonthlyReport BIT DEFAULT 0,
                    reportTypes VARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uq_email_report_email UNIQUE (email)
                )
            END
        `;
        try {
            await executeQuery(query);
            // Add column if not exists
            try {
                await executeQuery("SELECT TOP 1 reportTypes FROM email_report_recipients");
            } catch (e) {
                try {
                    await executeQuery("ALTER TABLE email_report_recipients ADD reportTypes VARCHAR(255)");
                } catch (e2) { }
            }
        } catch (error) {
            logger.error("Failed to initialize Mail table", error);
        }
    }

    static async create(data) {
        const { email, isDailyReport, isMonthlyReport, reportTypes } = data;

        const daily = isDailyReport ? 1 : 0;
        const monthly = isMonthlyReport ? 1 : 0;
        const types = reportTypes || "";

        const query = `
            INSERT INTO email_report_recipients (email, isDailyReport, isMonthlyReport, reportTypes)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?)
        `;

        const [rows] = await executeQuery(query, [email, daily, monthly, types]);
        return new Mail({ id: rows[0].id, email, isDailyReport: !!daily, isMonthlyReport: !!monthly, reportTypes: types });
    }

    static async findAll(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM email_report_recipients";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Mail(row));
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM email_report_recipients WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Mail(rows[0]);
    }

    static async update(id, updates) {
        const fields = Object.keys(updates);
        if (fields.length === 0) return null;

        const setClause = fields.map(f => `${f} = ?`).join(", ");
        const values = fields.map(f => updates[f]);
        values.push(id);

        await executeQuery(`UPDATE email_report_recipients SET ${setClause} WHERE id = ?`, values);
        return this.findById(id);
    }

    static async delete(id) {
        await executeQuery("DELETE FROM email_report_recipients WHERE id = ?", [id]);
        return true;
    }
}

// Initialize
Mail.init();

export default Mail;
