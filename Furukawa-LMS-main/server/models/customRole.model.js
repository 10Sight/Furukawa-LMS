import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class CustomRole {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description || "";
        this.color = data.color || "#3B82F6";
        this.allowedPages = typeof data.allowedPages === "string"
            ? JSON.parse(data.allowedPages || "[]")
            : (data.allowedPages || []);
        
        // Handle both simple string arrays and accidental object arrays
        const rawPermissions = typeof data.permissions === "string"
            ? JSON.parse(data.permissions || "[]")
            : (data.permissions || []);
        
        this.permissions = Array.isArray(rawPermissions)
            ? rawPermissions.map(p => typeof p === 'object' && p !== null ? (p.id || p) : p)
            : [];

        this.generateManagementPage = !!data.generateManagementPage;
        this.targetLayout = data.targetLayout || null;
        this.isSystem = !!data.isSystem;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        // SQL for creating the table
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='custom_roles' AND xtype='U')
            BEGIN
                CREATE TABLE custom_roles (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    name NVARCHAR(100) NOT NULL UNIQUE,
                    description NVARCHAR(500),
                    color NVARCHAR(20) DEFAULT '#3B82F6',
                    allowedPages NVARCHAR(MAX),
                    permissions NVARCHAR(MAX),
                    generateManagementPage BIT DEFAULT 0,
                    targetLayout NVARCHAR(50),
                    isSystem BIT DEFAULT 0,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            END
        `;

        try {
            const [, metadata] = await executeQuery(createTableQuery);
            if (metadata.affectedRows > 0) {
                logger.info("custom_roles table created in MSSQL");
            }

            // Migration: Check for all missing columns using helper
            const columnsToAdd = [
                { name: 'permissions', type: 'NVARCHAR(MAX)' },
                { name: 'targetLayout', type: 'NVARCHAR(50)' },
                { name: 'generateManagementPage', type: 'BIT DEFAULT 0' },
                { name: 'color', type: 'NVARCHAR(20) DEFAULT \'#3B82F6\'' },
                { name: 'isSystem', type: 'BIT DEFAULT 0' }
            ];

            for (const col of columnsToAdd) {
                await migrationHelper.ensureColumnExists('custom_roles', col.name, col.type);
            }

            // Ensure customRoleId exists in users table
            await migrationHelper.ensureColumnExists('users', 'customRoleId', 'INT NULL');

            // Seed default roles if table is empty
            const [rows] = await executeQuery("SELECT COUNT(*) as cnt FROM custom_roles");
            if (rows[0].cnt === 0) {
                const defaults = [
                    { name: "Operator", description: "Basic operator access", color: "#3B82F6", pages: [], isSystem: 0, permissions: [] },
                    { name: "Trainer", description: "Custom trainer access", color: "#10B981", pages: [], isSystem: 0, permissions: [] },
                ];
                for (const r of defaults) {
                    await executeQuery(
                        `INSERT INTO custom_roles (name, description, color, allowedPages, permissions, isSystem) VALUES (?, ?, ?, ?, ?, ?)`,
                        [r.name, r.description, r.color, JSON.stringify(r.pages), JSON.stringify(r.permissions), r.isSystem]
                    ).catch(() => { });
                }
            }

        } catch (error) {
            logger.error("Failed to initialize custom_roles table:", error.message);
        }
    }

    static async findAll() {
        const [rows] = await executeQuery("SELECT * FROM custom_roles ORDER BY isSystem DESC, name ASC");
        return rows.map(r => new CustomRole(r));
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM custom_roles WHERE id = ?", [id]);
        if (!rows.length) return null;
        return new CustomRole(rows[0]);
    }

    static async findByName(name) {
        const [rows] = await executeQuery("SELECT * FROM custom_roles WHERE name = ?", [name]);
        if (!rows.length) return null;
        return new CustomRole(rows[0]);
    }

    static async create({ name, description, color, allowedPages, permissions, generateManagementPage, targetLayout }) {
        const [result] = await executeQuery(
            `INSERT INTO custom_roles (name, description, color, allowedPages, permissions, generateManagementPage, targetLayout, isSystem)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                name,
                description || "",
                color || "#3B82F6",
                JSON.stringify(allowedPages || []),
                JSON.stringify(permissions || []),
                generateManagementPage ? 1 : 0,
                targetLayout || null
            ]
        );
        return CustomRole.findById(result[0].id);
    }

    static async update(id, { name, description, color, allowedPages, permissions, generateManagementPage, targetLayout }) {
        const fields = [];
        const vals = [];
        if (name !== undefined) { fields.push("name = ?"); vals.push(name); }
        if (description !== undefined) { fields.push("description = ?"); vals.push(description); }
        if (color !== undefined) { fields.push("color = ?"); vals.push(color); }
        if (allowedPages !== undefined) { fields.push("allowedPages = ?"); vals.push(JSON.stringify(allowedPages)); }
        if (permissions !== undefined) { fields.push("permissions = ?"); vals.push(JSON.stringify(permissions)); }
        if (generateManagementPage !== undefined) { fields.push("generateManagementPage = ?"); vals.push(generateManagementPage ? 1 : 0); }
        if (targetLayout !== undefined) { fields.push("targetLayout = ?"); vals.push(targetLayout); }
        fields.push("updatedAt = GETDATE()");
        vals.push(id);
        await executeQuery(`UPDATE custom_roles SET ${fields.join(", ")} WHERE id = ?`, vals);
        return CustomRole.findById(id);
    }

    static async delete(id) {
        // Check if any users are assigned to this role
        const [users] = await executeQuery("SELECT COUNT(*) as cnt FROM users WHERE customRoleId = ?", [id]);
        if (users[0].cnt > 0) throw new Error(`Cannot delete: ${users[0].cnt} user(s) still have this role`);
        await executeQuery("DELETE FROM custom_roles WHERE id = ?", [id]);
    }
}

// Initialize on startup
CustomRole.init().catch(err => logger.error("CustomRole init failed:", err.message));

export default CustomRole;
