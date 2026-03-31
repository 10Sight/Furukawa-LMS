import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class Daily5MAssignment {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.role = data.role; // 'QA_SHIFT_INCHARGE', 'PROCESS_OWNER', 'APPROVED_BY'
        this.userId = data.userId;
        this.userName = data.userName;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'daily_5m_assignments')
            BEGIN
                CREATE TABLE daily_5m_assignments (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId NVARCHAR(255) NOT NULL,
                    role NVARCHAR(50) NOT NULL,
                    userId INT NOT NULL,
                    userName NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    UNIQUE (departmentId, role, userId)
                )
                CREATE INDEX idx_dept_role ON daily_5m_assignments(departmentId, role)
            END
        `;
        await executeQuery(query);
        console.log("Daily5MAssignment table verified/created in MSSQL.");
    }

    static async findByDepartment(departmentId) {
        const query = "SELECT * FROM daily_5m_assignments WHERE departmentId = ? ORDER BY role, userName";
        const [rows] = await executeQuery(query, [departmentId]);
        return rows.map(row => new Daily5MAssignment(row));
    }

    static async findByDepartmentAndRole(departmentId, role) {
        const query = "SELECT * FROM daily_5m_assignments WHERE departmentId = ? AND role = ? ORDER BY userName";
        const [rows] = await executeQuery(query, [departmentId, role]);
        return rows.map(row => new Daily5MAssignment(row));
    }

    static async create(data) {
        const { departmentId, role, userId, userName } = data;
        const query = `
            INSERT INTO daily_5m_assignments (departmentId, role, userId, userName, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, GETDATE(), GETDATE());
            SELECT SCOPE_IDENTITY() as id;
        `;
        const [result] = await executeQuery(query, [departmentId, role, userId, userName]);
        return result[0]?.id;
    }

    static async delete(id) {
        const query = "DELETE FROM daily_5m_assignments WHERE id = ?";
        const [, metadata] = await executeQuery(query, [id]);
        return metadata.affectedRows > 0;
    }
}

// Initialize table
Daily5MAssignment.init().catch(err => console.error("Failed to initialize Daily5MAssignment table:", err));

export default Daily5MAssignment;
