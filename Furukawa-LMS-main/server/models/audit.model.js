import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class Audit {
    constructor(data) {
        this.id = data.id;
        this.user = data.user;
        this.action = data.action;
        this.resourceType = data.resourceType;
        this.resourceId = data.resourceId;
        this.ip = data.ip;
        this.userAgent = data.userAgent;
        this.severity = data.severity || 'info';
        this.details = typeof data.details === 'string' ? JSON.parse(data.details) : (data.details || {});
        this.createdAt = data.createdAt;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('audits')) {
                await executeQuery(`
                    CREATE TABLE audits (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        [user] NVARCHAR(255),
                        action NVARCHAR(255) NOT NULL,
                        resourceType NVARCHAR(255),
                        resourceId NVARCHAR(255),
                        ip NVARCHAR(50),
                        userAgent NVARCHAR(MAX),
                        severity NVARCHAR(50) DEFAULT 'info',
                        details NVARCHAR(MAX),
                        createdAt DATETIME DEFAULT GETDATE()
                    )
                `);
            }
            console.log("Audits table verified/created in MSSQL.");
        } catch (error) {
            console.error("Error creating audits table in MSSQL:", error);
        }
    }

    static async create(auditData) {
        const fields = [
            "[user]", "action", "resourceType", "resourceId", "ip", "userAgent", "severity", "details", "createdAt"
        ];

        const dataToInsert = { ...auditData };
        if (!dataToInsert.createdAt) dataToInsert.createdAt = new Date();
        if (!dataToInsert.severity) dataToInsert.severity = 'info';

        const values = [
            dataToInsert.user ? String(dataToInsert.user) : null,
            dataToInsert.action,
            dataToInsert.resourceType || null,
            dataToInsert.resourceId || null,
            dataToInsert.ip || null,
            dataToInsert.userAgent || null,
            dataToInsert.severity,
            JSON.stringify(dataToInsert.details || {}),
            dataToInsert.createdAt
        ];

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO audits (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

        try {
            const [result] = await executeQuery(query, values);
            return new Audit({ id: result[0]?.id, ...dataToInsert });
        } catch (error) {
            console.error("Error creating audit entry:", error);
            // Don't throw error for audit failures to prevent breaking main transaction
            return null;
        }
    }

    static async findById(id) {
        const query = "SELECT * FROM audits WHERE id = ?";
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new Audit(rows[0]);
    }

    static async find(query = {}) {
        let sql = "SELECT * FROM audits";
        let values = [];
        const keys = Object.keys(query).filter(key => query[key] !== undefined);

        if (keys.length > 0) {
            const whereClauses = keys.map(key => `${key === 'user' ? '[user]' : key} = ?`);
            sql += ` WHERE ${whereClauses.join(" AND ")}`;
            values = keys.map(key => query[key]);
        }

        sql += " ORDER BY createdAt DESC";

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Audit(row));
    }

    static async countDocuments(query = {}) {
        let sql = "SELECT COUNT(*) as count FROM audits";
        let values = [];
        const keys = Object.keys(query).filter(key => query[key] !== undefined);

        if (keys.length > 0) {
            const whereClauses = keys.map(key => `${key === 'user' ? '[user]' : key} = ?`);
            sql += ` WHERE ${whereClauses.join(" AND ")}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows[0].count;
    }
}

// Initialize table
Audit.init().catch(err => console.error("Failed to initialize Audit table:", err));

export default Audit;