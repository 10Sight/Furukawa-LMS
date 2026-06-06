import { executeQuery as executeSql } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class DepartmentCCConfig {
    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DepartmentCCConfig]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[DepartmentCCConfig] (
                    ConfigID INT IDENTITY(1,1) PRIMARY KEY,
                    DeptID INT NOT NULL,
                    DepartmentHeadName NVARCHAR(255) NULL,
                    DepartmentHeadEmail NVARCHAR(510) NOT NULL,
                    IsActive BIT DEFAULT 1,
                    CONSTRAINT FK_dcc_Department FOREIGN KEY (DeptID) REFERENCES departments(id) ON DELETE CASCADE
                )
            END
        `;
        try {
            await executeSql(query);
            logger.info("DepartmentCCConfig table initialized successfully.");
        } catch (error) {
            logger.error("Failed to initialize DepartmentCCConfig table.", error);
        }
    }

    static async findAll() {
        const query = `
            SELECT dcc.*, 
                   d.name AS departmentName,
                   d.uniCode AS departmentUnicode
            FROM DepartmentCCConfig dcc
            LEFT JOIN departments d ON dcc.DeptID = d.id
            ORDER BY dcc.ConfigID DESC
        `;
        const [rows] = await executeSql(query);
        return rows;
    }

    static async findById(id) {
        const query = "SELECT * FROM DepartmentCCConfig WHERE ConfigID = ?";
        const [rows] = await executeSql(query, [id]);
        return rows[0] || null;
    }

    static async findByDeptId(deptId) {
        const query = "SELECT * FROM DepartmentCCConfig WHERE DeptID = ? AND IsActive = 1";
        const [rows] = await executeSql(query, [deptId]);
        return rows;
    }

    static async create(data) {
        const { deptId, departmentHeadName, departmentHeadEmail, isActive = 1 } = data;
        const query = `
            INSERT INTO DepartmentCCConfig (DeptID, DepartmentHeadName, DepartmentHeadEmail, IsActive)
            OUTPUT INSERTED.ConfigID AS ConfigID
            VALUES (?, ?, ?, ?)
        `;
        const [rows] = await executeSql(query, [deptId, departmentHeadName || null, departmentHeadEmail, isActive ? 1 : 0]);
        const insertedId = rows?.[0]?.ConfigID ?? null;
        return { ConfigID: insertedId, ...data };
    }

    static async update(id, updates) {
        const fields = [];
        const values = [];

        if (updates.deptId !== undefined) { fields.push("DeptID = ?"); values.push(updates.deptId); }
        if (updates.departmentHeadName !== undefined) { fields.push("DepartmentHeadName = ?"); values.push(updates.departmentHeadName || null); }
        if (updates.departmentHeadEmail !== undefined) { fields.push("DepartmentHeadEmail = ?"); values.push(updates.departmentHeadEmail); }
        if (updates.isActive !== undefined) { fields.push("IsActive = ?"); values.push(updates.isActive ? 1 : 0); }

        if (fields.length === 0) return null;

        values.push(id);
        const query = `UPDATE DepartmentCCConfig SET ${fields.join(", ")} WHERE ConfigID = ?`;
        await executeSql(query, values);

        return this.findById(id);
    }

    static async delete(id) {
        await executeSql("DELETE FROM DepartmentCCConfig WHERE ConfigID = ?", [id]);
        return true;
    }
}

// Initialize table
DepartmentCCConfig.init();

export default DepartmentCCConfig;
