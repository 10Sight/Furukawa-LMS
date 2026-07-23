import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class Mail {
    constructor(data) {
        if (!data) return;
        
        // Robust case-insensitive lookup
        const getVal = (obj, key) => {
            const lowerKey = key.toLowerCase();
            const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
            return foundKey ? obj[foundKey] : undefined;
        };

        this.id = getVal(data, 'id');
        this.email = getVal(data, 'email') || "";
        
        const dailyVal = getVal(data, 'isDailyReport');
        this.isDailyReport = dailyVal === true || dailyVal === 1 || dailyVal === '1' || String(dailyVal).toLowerCase() === 'true';

        const mgmtVal = getVal(data, 'isManagementDailyReport');
        this.isManagementDailyReport =
            mgmtVal === true || mgmtVal === 1 || mgmtVal === '1' || String(mgmtVal).toLowerCase() === 'true';

        const monthlyVal = getVal(data, 'isMonthlyReport');
        this.isMonthlyReport =
            monthlyVal === true || monthlyVal === 1 || monthlyVal === '1' || String(monthlyVal).toLowerCase() === 'true';

        this.reportTypes = getVal(data, 'reportTypes') || "";
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='email_report_recipients' and xtype='U')
            BEGIN
                CREATE TABLE email_report_recipients (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    isDailyReport BIT DEFAULT 0,
                    isManagementDailyReport BIT DEFAULT 0,
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
            try {
                await executeQuery("SELECT TOP 1 isManagementDailyReport FROM email_report_recipients");
            } catch (e) {
                try {
                    await executeQuery("ALTER TABLE email_report_recipients ADD isManagementDailyReport BIT DEFAULT 0");
                } catch (e2) { }
            }
            try {
                await executeQuery("SELECT TOP 1 isMonthlyReport FROM email_report_recipients");
            } catch (e) {
                try {
                    await executeQuery("ALTER TABLE email_report_recipients ADD isMonthlyReport BIT DEFAULT 0");
                } catch (e2) { }
            }
        } catch (error) {
            logger.error("Failed to initialize Mail table", error);
        }
    }

    static async create(data) {
        const { email, isDailyReport, isManagementDailyReport, isMonthlyReport, reportTypes } = data;

        const daily = isDailyReport ? 1 : 0;
        const managementDaily = isManagementDailyReport ? 1 : 0;
        const monthly = isMonthlyReport ? 1 : 0;
        const types = reportTypes || "";

        const query = `
            INSERT INTO email_report_recipients (email, isDailyReport, isManagementDailyReport, isMonthlyReport, reportTypes)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?)
        `;

        const [rows] = await executeQuery(query, [email, daily, managementDaily, monthly, types]);
        return new Mail({ id: rows[0].id, email, isDailyReport: !!daily, isManagementDailyReport: !!managementDaily, isMonthlyReport: !!monthly, reportTypes: types });
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
