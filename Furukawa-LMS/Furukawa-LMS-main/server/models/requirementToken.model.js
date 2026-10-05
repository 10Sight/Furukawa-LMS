import { executeQuery as executeSql } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class RequirementToken {
    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[requirement_tokens]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[requirement_tokens] (
                    token            NVARCHAR(64)  PRIMARY KEY,
                    requirement_id   INT           NULL,
                    upload_batch_id  NVARCHAR(50)  NULL,
                    section_code     NVARCHAR(100) NULL,
                    section_name     NVARCHAR(255) NULL,
                    recipient_email  NVARCHAR(255) NOT NULL,
                    sender_email     NVARCHAR(255),
                    expires_at       DATETIME      NOT NULL,
                    status           NVARCHAR(50)  DEFAULT 'pending',
                    rejection_reason NVARCHAR(MAX),
                    created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP
                )
            END
        `;
        try {
            await executeSql(query);
            logger.info("requirement_tokens table initialized successfully.");
        } catch (error) {
            logger.error("Failed to initialize requirement_tokens table.", error);
        }
    }

    static async findOne(queryObj) {
        const keys = Object.keys(queryObj);
        if (keys.length === 0) return null;
        const whereClause = keys.map(k => `${k} = ?`).join(" AND ");
        const [rows] = await executeSql(`SELECT TOP 1 * FROM requirement_tokens WHERE ${whereClause}`, Object.values(queryObj));
        return rows[0] || null;
    }

    static async create(data) {
        const fields = Object.keys(data);
        const placeholders = fields.map(() => "?").join(", ");
        const query = `INSERT INTO requirement_tokens (${fields.join(", ")}) VALUES (${placeholders})`;
        await executeSql(query, Object.values(data));
        return data;
    }

    static async update(updates, options) {
        const where = options.where || {};
        const whereKeys = Object.keys(where);
        const updateKeys = Object.keys(updates);

        if (updateKeys.length === 0 || whereKeys.length === 0) return null;

        const setClause = updateKeys.map(k => `${k} = ?`).join(", ");
        const whereClause = whereKeys.map(k => `${k} = ?`).join(" AND ");

        const query = `UPDATE requirement_tokens SET ${setClause} WHERE ${whereClause}`;
        const params = [...Object.values(updates), ...Object.values(where)];

        await executeSql(query, params);
        return true;
    }
}

export default RequirementToken;
