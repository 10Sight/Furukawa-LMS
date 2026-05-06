import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class Machine {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.name = data.name;
        this.line = data.line;
        this.subSectionId = data.subSectionId || null;
        this.description = data.description;
        this.minimumRequiredLevel = data.minimumRequiredLevel || null;
        this.isActive = data.isActive !== undefined ? !!data.isActive : true;
        this.machineCount = data.machineCount || 0;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async asyncExecute(query, params = []) {
        try {
            return await executeQuery(query, params);
        } catch (error) {
            logger.error(`Database error: ${error.message}`, { query, params });
            // Don't throw for cleanup errors to allow init to proceed
            return [[]];
        }
    }

    static async init() {
        try {
            logger.info("Initializing Machine table and cleaning up schema...");

            // 1. Identify and drop unique constraints
            const [constraints] = await this.asyncExecute(`
                SELECT name 
                FROM sys.key_constraints 
                WHERE type = 'UQ' AND parent_object_id = OBJECT_ID('machines')
            `);
            for (const constraint of constraints) {
                logger.info(`Dropping unique constraint: ${constraint.name}`);
                await this.asyncExecute(`ALTER TABLE machines DROP CONSTRAINT [${constraint.name}]`);
            }

            // 2. Identify and drop unique indexes
            const [indexes] = await this.asyncExecute(`
                SELECT name 
                FROM sys.indexes 
                WHERE is_unique = 1 AND object_id = OBJECT_ID('machines') AND is_primary_key = 0
            `);
            for (const index of indexes) {
                logger.info(`Dropping unique index: ${index.name}`);
                await this.asyncExecute(`DROP INDEX [${index.name}] ON machines`);
            }

            // 3. Drop uniCode column if it exists
            const [columns] = await this.asyncExecute(`
                SELECT name FROM sys.columns 
                WHERE object_id = OBJECT_ID('machines') AND name = 'uniCode'
            `);
            if (columns.length > 0) {
                logger.info("Dropping uniCode column from machines");
                await this.asyncExecute("ALTER TABLE machines DROP COLUMN [uniCode]");
            }

            const createMachinesInfo = `
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'machines')
                BEGIN
                    CREATE TABLE machines (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name NVARCHAR(255) NOT NULL,
                        line INT NOT NULL,
                        subSectionId INT NOT NULL,
                        description NVARCHAR(MAX),
                        minimumRequiredLevel NVARCHAR(50),
                        isActive BIT DEFAULT 1,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (subSectionId) REFERENCES [sub_sections](id) ON DELETE CASCADE
                    );
                    CREATE INDEX idx_line ON machines(line);
                    CREATE INDEX idx_subsection ON machines(subSectionId);
                END
                ELSE
                BEGIN
                    -- Migration: Add minimumRequiredLevel if it doesn't exist
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('machines') AND name = 'minimumRequiredLevel')
                    BEGIN
                        ALTER TABLE machines ADD minimumRequiredLevel NVARCHAR(50);
                    END

                    -- Migration: Check if subSectionId points to lines instead of sub_sections
                    IF EXISTS (
                        SELECT * 
                        FROM sys.foreign_key_columns fkc
                        JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
                        JOIN sys.tables t ON fkc.referenced_object_id = t.object_id
                        WHERE OBJECT_NAME(fkc.parent_object_id) = 'machines'
                        AND c.name = 'subSectionId'
                        AND t.name = 'lines'
                    )
                    BEGIN
                        -- Find the constraint name
                        DECLARE @ConstraintName NVARCHAR(255);
                        SELECT @ConstraintName = OBJECT_NAME(fkc.constraint_object_id)
                        FROM sys.foreign_key_columns fkc
                        JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
                        JOIN sys.tables t ON fkc.referenced_object_id = t.object_id
                        WHERE OBJECT_NAME(fkc.parent_object_id) = 'machines'
                        AND c.name = 'subSectionId'
                        AND t.name = 'lines';

                        -- Drop the incorrect constraint
                        IF @ConstraintName IS NOT NULL
                        BEGIN
                            EXEC('ALTER TABLE machines DROP CONSTRAINT ' + @ConstraintName);
                        END
                    END

                    -- Add the correct constraint if it doesn't exist
                    IF NOT EXISTS (
                        SELECT * 
                        FROM sys.foreign_keys 
                        WHERE name = 'FK_Machines_SubSections' AND parent_object_id = OBJECT_ID('machines')
                    )
                    BEGIN
                        ALTER TABLE machines
                        ADD CONSTRAINT FK_Machines_SubSections FOREIGN KEY (subSectionId) REFERENCES sub_sections(id) ON DELETE CASCADE;
                    END
                END
            `;

            const createAssignmentsTable = `
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'machine_assignments')
                BEGIN
                    CREATE TABLE machine_assignments (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        machine_id INT NOT NULL,
                        user_id INT NOT NULL,
                        assigned_by INT,
                        assigned_at DATETIME DEFAULT GETDATE(),
                        CONSTRAINT unique_machine_user UNIQUE (machine_id, user_id)
                    );
                    CREATE INDEX idx_machine ON machine_assignments(machine_id);
                    CREATE INDEX idx_user ON machine_assignments(user_id);
                END
            `;

            await executeQuery(createMachinesInfo);
            await executeQuery(createAssignmentsTable);
            logger.info("Machine tables initialized successfully");
        } catch (error) {
            logger.error("Failed to initialize Machine tables", error);
        }
    }

    static async create(data) {
        const machine = new Machine(data);

        const fields = [
            "name", "line", "subSectionId", "description", "minimumRequiredLevel", "isActive", "createdAt"
        ];

        if (!machine.createdAt) machine.createdAt = new Date();

        const values = fields.map(field => {
            const val = machine[field];
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO machines (${fields.join(",")}) 
        OUTPUT INSERTED.id
        VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Machine.findById(result[0].id);
    }

    static async findById(id) {
        const query = `
            SELECT m.*, 
            (SELECT COUNT(DISTINCT u.id) 
             FROM users u
             WHERE (u.role = 'Student' AND (u.isDeleted = 0 OR u.isDeleted IS NULL))
             AND (
                u.stationId = m.id 
                OR u.id IN (SELECT user_id FROM machine_assignments WHERE machine_id = m.id)
             )
            ) as machineCount
            FROM machines m 
            WHERE m.id = ?`;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new Machine(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM machines WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Machine(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = `
            SELECT m.*, 
            (SELECT COUNT(DISTINCT u.id) 
             FROM users u
             WHERE (u.role = 'Student' AND (u.isDeleted = 0 OR u.isDeleted IS NULL))
             AND (
                u.stationId = m.id 
                OR u.id IN (SELECT user_id FROM machine_assignments WHERE machine_id = m.id)
             )
            ) as machineCount
            FROM machines m`;
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Machine(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM machines";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows[0].count;
    }

    async save() {
        const fields = [
            "name", "line", "subSectionId", "description", "minimumRequiredLevel", "isActive"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => this[field]);
        values.push(this.id);

        await executeQuery(`UPDATE machines SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
Machine.init();

export default Machine;
