import { executeQuery } from "../db/mssqlHelper.js";

// Formats a Date using local calendar fields, avoiding the UTC day-shift toISOString() causes in IST.
const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

class DPRManualStatistics {
    constructor(data) {
        if (!data) return;
        this.id = data.id;
        this.date = data.date instanceof Date
            ? formatLocalDate(data.date)
            : (typeof data.date === 'string' ? data.date.split('T')[0] : data.date);

        // SRC Efficiency Performance
        this.srcEffPlan = Number(data.srcEffPlan) || 0;
        this.srcEffActual = Number(data.srcEffActual) || 0;
        this.srcEffTarget = Number(data.srcEffTarget) || 95.0;

        // SRC Defect Summary
        this.srcDefAuto = Number(data.srcDefAuto) || 0;
        this.srcDefManual = Number(data.srcDefManual) || 0;
        this.srcDefJoint = Number(data.srcDefJoint) || 0;
        this.srcDefProduction = Number(data.srcDefProduction) || 0;
        this.srcDefTarget = Number(data.srcDefTarget) || 5.9;

        // Quality Defect Summary
        this.qaDefAuto = Number(data.qaDefAuto) || 0;
        this.qaDefManual = Number(data.qaDefManual) || 0;
        this.qaDefJoint = Number(data.qaDefJoint) || 0;
        this.qaDefProduction = Number(data.qaDefProduction) || 0;
        this.qaDefTarget = Number(data.qaDefTarget) || 5.9;

        // Quality Efficiency Performance
        this.qaEffPlan = Number(data.qaEffPlan) || 0;
        this.qaEffActual = Number(data.qaEffActual) || 0;
        this.qaEffTarget = Number(data.qaEffTarget) || 95.0;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'dpr_manual_statistics')
            BEGIN
                CREATE TABLE dpr_manual_statistics (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    date DATE NOT NULL UNIQUE,
                    
                    -- SRC Efficiency Performance
                    srcEffPlan INT DEFAULT 0,
                    srcEffActual INT DEFAULT 0,
                    srcEffTarget FLOAT DEFAULT 95.0,
                    
                    -- SRC Defect Summary
                    srcDefAuto INT DEFAULT 0,
                    srcDefManual INT DEFAULT 0,
                    srcDefJoint INT DEFAULT 0,
                    srcDefProduction INT DEFAULT 0,
                    srcDefTarget FLOAT DEFAULT 5.9,
                    
                    -- Quality Defect Summary
                    qaDefAuto INT DEFAULT 0,
                    qaDefManual INT DEFAULT 0,
                    qaDefJoint INT DEFAULT 0,
                    qaDefProduction INT DEFAULT 0,
                    qaDefTarget FLOAT DEFAULT 5.9,
                    
                    -- Quality Efficiency Performance
                    qaEffPlan INT DEFAULT 0,
                    qaEffActual INT DEFAULT 0,
                    qaEffTarget FLOAT DEFAULT 95.0,
                    
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            END
        `;
        try {
            await executeQuery(query);
            console.log("dpr_manual_statistics table verified/created in MSSQL.");
        } catch (error) {
            console.error("Failed to initialize dpr_manual_statistics table:", error);
        }
    }

    static async findByDate(date) {
        const formattedDate = new Date(date).toISOString().split('T')[0];
        const [rows] = await executeQuery("SELECT * FROM dpr_manual_statistics WHERE date = ?", [formattedDate]);
        if (rows.length === 0) return null;
        return new DPRManualStatistics(rows[0]);
    }

    static async findDateRange(startDate, endDate) {
        const formattedStart = new Date(startDate).toISOString().split('T')[0];
        const formattedEnd = new Date(endDate).toISOString().split('T')[0];
        const [rows] = await executeQuery(
            "SELECT * FROM dpr_manual_statistics WHERE date >= ? AND date <= ? ORDER BY date ASC",
            [formattedStart, formattedEnd]
        );
        return rows.map(row => new DPRManualStatistics(row));
    }

    static async findFilledDatesInMonth(month) {
        // month is "YYYY-MM"
        const [year, mon] = month.split('-');
        const startDate = `${year}-${mon}-01`;
        const lastDay = new Date(Number(year), Number(mon), 0).getDate();
        const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`;

        const [rows] = await executeQuery(
            `SELECT date FROM dpr_manual_statistics
             WHERE date >= ? AND date <= ?
             AND (srcEffPlan > 0 OR srcEffActual > 0 OR srcDefAuto > 0
                  OR srcDefManual > 0 OR srcDefJoint > 0 OR qaDefAuto > 0
                  OR qaDefManual > 0 OR qaDefJoint > 0 OR qaEffPlan > 0
                  OR qaEffActual > 0)
             ORDER BY date ASC`,
            [startDate, endDate]
        );

        return rows.map(row => {
            const d = row.date instanceof Date
                ? row.date.toISOString().split('T')[0]
                : String(row.date).split('T')[0];
            return d;
        });
    }

    static async upsert(data) {
        const formattedDate = new Date(data.date).toISOString().split('T')[0];
        const existing = await this.findByDate(formattedDate);

        if (existing) {
            const query = `
                UPDATE dpr_manual_statistics
                SET srcEffPlan = ?, srcEffActual = ?, srcEffTarget = ?,
                    srcDefAuto = ?, srcDefManual = ?, srcDefJoint = ?, srcDefProduction = ?, srcDefTarget = ?,
                    qaDefAuto = ?, qaDefManual = ?, qaDefJoint = ?, qaDefProduction = ?, qaDefTarget = ?,
                    qaEffPlan = ?, qaEffActual = ?, qaEffTarget = ?,
                    updatedAt = GETDATE()
                WHERE date = ?
            `;
            await executeQuery(query, [
                Number(data.srcEffPlan) || 0,
                Number(data.srcEffActual) || 0,
                Number(data.srcEffTarget) || 95.0,
                Number(data.srcDefAuto) || 0,
                Number(data.srcDefManual) || 0,
                Number(data.srcDefJoint) || 0,
                Number(data.srcDefProduction) || 0,
                Number(data.srcDefTarget) || 5.9,
                Number(data.qaDefAuto) || 0,
                Number(data.qaDefManual) || 0,
                Number(data.qaDefJoint) || 0,
                Number(data.qaDefProduction) || 0,
                Number(data.qaDefTarget) || 5.9,
                Number(data.qaEffPlan) || 0,
                Number(data.qaEffActual) || 0,
                Number(data.qaEffTarget) || 95.0,
                formattedDate
            ]);
        } else {
            const query = `
                INSERT INTO dpr_manual_statistics (
                    date, srcEffPlan, srcEffActual, srcEffTarget,
                    srcDefAuto, srcDefManual, srcDefJoint, srcDefProduction, srcDefTarget,
                    qaDefAuto, qaDefManual, qaDefJoint, qaDefProduction, qaDefTarget,
                    qaEffPlan, qaEffActual, qaEffTarget,
                    createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
            `;
            await executeQuery(query, [
                formattedDate,
                Number(data.srcEffPlan) || 0,
                Number(data.srcEffActual) || 0,
                Number(data.srcEffTarget) || 95.0,
                Number(data.srcDefAuto) || 0,
                Number(data.srcDefManual) || 0,
                Number(data.srcDefJoint) || 0,
                Number(data.srcDefProduction) || 0,
                Number(data.srcDefTarget) || 5.9,
                Number(data.qaDefAuto) || 0,
                Number(data.qaDefManual) || 0,
                Number(data.qaDefJoint) || 0,
                Number(data.qaDefProduction) || 0,
                Number(data.qaDefTarget) || 5.9,
                Number(data.qaEffPlan) || 0,
                Number(data.qaEffActual) || 0,
                Number(data.qaEffTarget) || 95.0
            ]);
        }

        return this.findByDate(formattedDate);
    }
}

// Initialize Table
DPRManualStatistics.init();

export default DPRManualStatistics;
