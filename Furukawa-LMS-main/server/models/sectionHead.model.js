import { executeQuery as executeSql } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class SectionHead {
    static async init() {
        // Init mssql server table
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[section_heads]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[section_heads] (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    sectionId INT NULL,
                    subSectionId INT NULL,
                    email NVARCHAR(255) NOT NULL,
                    name NVARCHAR(255) NULL,
                    created_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_sh_Section FOREIGN KEY (sectionId) REFERENCES sections(id) ON DELETE CASCADE,
                    CONSTRAINT FK_sh_SubSection FOREIGN KEY (subSectionId) REFERENCES [lines](id) ON DELETE CASCADE
                )
            END
            ELSE
            BEGIN
                -- Drop old constraint if exist
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SectionHead_Section')
                BEGIN
                    ALTER TABLE [dbo].[section_heads] DROP CONSTRAINT FK_SectionHead_Section;
                    
                    -- Before adding new constraint, clear data to prevent conflict if IDs mismatch
                    TRUNCATE TABLE [dbo].[section_heads];
                    
                    ALTER TABLE [dbo].[section_heads] ADD CONSTRAINT FK_sh_Section FOREIGN KEY (sectionId) REFERENCES sections(id) ON DELETE CASCADE;
                END
            END
        `;
        try {
            await executeSql(query);
            logger.info("section_heads table initialized successfully.");
        } catch (error) {
            logger.error("Failed to initialize section_heads table.", error);
        }
    }

    static async findAll() {
        const query = `
            SELECT sh.*, 
                   s.name AS sectionName, 
                   s.category AS sectionCategory,
                   l.name AS subSectionName
            FROM section_heads sh
            LEFT JOIN sections s ON sh.sectionId = s.id
            LEFT JOIN lines l ON sh.subSectionId = l.id
            ORDER BY sh.id DESC
        `;
        const [rows] = await executeSql(query);
        return rows;
    }

    static async findById(id) {
        const query = "SELECT * FROM section_heads WHERE id = ?";
        const [rows] = await executeSql(query, [id]);
        return rows[0] || null;
    }

    static async findByContext(sectionId, subSectionId) {
        let query = "SELECT * FROM section_heads WHERE 1=1";
        let params = [];

        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        }
        if (subSectionId) {
            query += " AND subSectionId = ?";
            params.push(subSectionId);
        }

        const [rows] = await executeSql(query, params);
        return rows;
    }

    static async create(data) {
        const { sectionId, subSectionId, email, name } = data;
        const query = `
            INSERT INTO section_heads (sectionId, subSectionId, email, name)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?)
        `;
        // OUTPUT INSERTED.id puts the new id into result.recordset[0].id (not meta.insertId which is always null in mssqlHelper)
        const [rows] = await executeSql(query, [sectionId || null, subSectionId || null, email, name || null]);
        const insertedId = rows?.[0]?.id ?? null;
        return { id: insertedId, ...data };
    }

    static async update(id, updates) {
        const fields = [];
        const values = [];

        if (updates.sectionId !== undefined) { fields.push("sectionId = ?"); values.push(updates.sectionId || null); }
        if (updates.subSectionId !== undefined) { fields.push("subSectionId = ?"); values.push(updates.subSectionId || null); }
        if (updates.email !== undefined) { fields.push("email = ?"); values.push(updates.email); }
        if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name || null); }

        if (fields.length === 0) return null;

        values.push(id);
        const query = `UPDATE section_heads SET ${fields.join(", ")} WHERE id = ?`;
        await executeSql(query, values);

        return this.findById(id);
    }

    static async delete(id) {
        await executeSql("DELETE FROM section_heads WHERE id = ?", [id]);
        return true;
    }
}

// Initialize table
SectionHead.init();

export default SectionHead;
