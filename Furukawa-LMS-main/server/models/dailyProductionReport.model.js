import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class DailyProductionReport {
    constructor(data) {
        this.id = data.id;
        this.date = data.date;
        this.department = data.department || data.department_id;
        this.line = data.line || data.line_id;
        this.shift = data.shift;
        this.leaderName = data.leaderName;

        this.delivery = typeof data.delivery === 'string'
            ? JSON.parse(data.delivery)
            : (data.delivery || []);

        this.quality = typeof data.quality === 'string'
            ? JSON.parse(data.quality)
            : (data.quality || {});

        this.downTime = typeof data.downTime === 'string'
            ? JSON.parse(data.downTime)
            : (data.downTime || {});

        this.shiftCommunication = typeof data.shiftCommunication === 'string'
            ? JSON.parse(data.shiftCommunication)
            : (data.shiftCommunication || []);

        this.moral = typeof data.moral === 'string'
            ? JSON.parse(data.moral)
            : (data.moral || []);

        this.directEfficiency = typeof data.directEfficiency === 'string'
            ? JSON.parse(data.directEfficiency)
            : (data.directEfficiency || {});

        this.madeBy = data.madeBy;
        this.checkedBy = data.checkedBy;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='daily_production_reports' and xtype='U')
            BEGIN
                CREATE TABLE daily_production_reports (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    date DATE NOT NULL,
                    department_id INT NOT NULL,
                    line_id INT NOT NULL,
                    shift VARCHAR(50) NOT NULL,
                    leaderName VARCHAR(255),
                    delivery NVARCHAR(MAX),
                    quality NVARCHAR(MAX),
                    downTime NVARCHAR(MAX),
                    shiftCommunication NVARCHAR(MAX),
                    moral NVARCHAR(MAX),
                    directEfficiency NVARCHAR(MAX),
                    madeBy VARCHAR(255),
                    checkedBy VARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uq_daily_report UNIQUE (date, department_id, line_id, shift)
                )
            END
        `;
        try {
            await executeQuery(query);
        } catch (error) {
            logger.error("Failed to initialize daily_production_reports table", error);
        }
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => {
            if (key === 'department') return `department_id = ?`;
            if (key === 'line') return `line_id = ?`;
            return `${key} = ?`;
        }).join(" AND ");

        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM daily_production_reports WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new DailyProductionReport(rows[0]);
    }

    static async upsert(data) {
        // Check if the record exists first
        const existing = await DailyProductionReport.findOne({
            date: data.date,
            department: data.department,
            line: data.line,
            shift: data.shift
        });

        const jsonValues = {
            delivery: JSON.stringify(data.delivery || []),
            quality: JSON.stringify(data.quality || {}),
            downTime: JSON.stringify(data.downTime || {}),
            shiftCommunication: JSON.stringify(data.shiftCommunication || []),
            moral: JSON.stringify(data.moral || []),
            directEfficiency: JSON.stringify(data.directEfficiency || {})
        };

        if (existing) {
            // UPDATE
            await executeQuery(`
                UPDATE daily_production_reports
                SET leaderName = ?, delivery = ?, quality = ?, downTime = ?, shiftCommunication = ?,
                    moral = ?, directEfficiency = ?, madeBy = ?, checkedBy = ?, updatedAt = GETDATE()
                WHERE date = ? AND department_id = ? AND line_id = ? AND shift = ?
            `, [
                data.leaderName || null,
                jsonValues.delivery, jsonValues.quality, jsonValues.downTime,
                jsonValues.shiftCommunication, jsonValues.moral, jsonValues.directEfficiency,
                data.madeBy || null, data.checkedBy || null,
                data.date, data.department, data.line, data.shift
            ]);
        } else {
            // INSERT
            await executeQuery(`
                INSERT INTO daily_production_reports
                (date, department_id, line_id, shift, leaderName, delivery, quality, downTime, shiftCommunication, moral, directEfficiency, madeBy, checkedBy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.date, data.department, data.line, data.shift,
                data.leaderName || null,
                jsonValues.delivery, jsonValues.quality, jsonValues.downTime,
                jsonValues.shiftCommunication, jsonValues.moral, jsonValues.directEfficiency,
                data.madeBy || null, data.checkedBy || null
            ]);
        }

        return DailyProductionReport.findOne({
            date: data.date,
            department: data.department,
            line: data.line,
            shift: data.shift
        });
    }
}

// Initialize table
DailyProductionReport.init();

export default DailyProductionReport;
