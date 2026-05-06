import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class LearningComparison {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description;
        this.beforeDescription = data.beforeDescription;
        this.afterDescription = data.afterDescription;
        
        // Before fields
        this.beforeVideo = data.beforeVideo;
        this.beforePdf = data.beforePdf;
        this.beforeExcel = data.beforeExcel;
        this.beforeWord = data.beforeWord;
        this.beforePpt = data.beforePpt;
        this.beforeImage = data.beforeImage;
        
        // After fields
        this.afterVideo = data.afterVideo;
        this.afterPdf = data.afterPdf;
        this.afterExcel = data.afterExcel;
        this.afterWord = data.afterWord;
        this.afterPpt = data.afterPpt;
        this.afterImage = data.afterImage;
        
        this.createdBy = data.createdBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'learning_comparisons')
            BEGIN
                CREATE TABLE learning_comparisons (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    title NVARCHAR(255) NOT NULL,
                    description NVARCHAR(MAX),
                    
                    beforeVideo NVARCHAR(MAX),
                    beforePdf NVARCHAR(MAX),
                    beforeExcel NVARCHAR(MAX),
                    beforeWord NVARCHAR(MAX),
                    beforePpt NVARCHAR(MAX),
                    beforeImage NVARCHAR(MAX),
                    
                    afterVideo NVARCHAR(MAX),
                    afterPdf NVARCHAR(MAX),
                    afterExcel NVARCHAR(MAX),
                    afterWord NVARCHAR(MAX),
                    afterPpt NVARCHAR(MAX),
                    afterImage NVARCHAR(MAX),
                    
                    createdBy INT NOT NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                );
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'beforeDescription')
                BEGIN
                    ALTER TABLE learning_comparisons ADD beforeDescription NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'afterDescription')
                BEGIN
                    ALTER TABLE learning_comparisons ADD afterDescription NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'beforeImage')
                BEGIN
                    ALTER TABLE learning_comparisons ADD beforeImage NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'afterImage')
                BEGIN
                    ALTER TABLE learning_comparisons ADD afterImage NVARCHAR(MAX);
                END
            END
        `;
        try {
            await executeQuery(query);
        } catch (error) {
            logger.error("Failed to initialize LearningComparison table", error);
        }
    }

    static async create(data) {
        const fields = [
            "title", "description", "beforeDescription", "afterDescription",
            "beforeVideo", "beforePdf", "beforeExcel", "beforeWord", "beforePpt", "beforeImage",
            "afterVideo", "afterPdf", "afterExcel", "afterWord", "afterPpt", "afterImage",
            "createdBy"
        ];
        const values = fields.map(field => data[field]);
        const placeholders = fields.map(() => "?").join(",");

        const query = `
            INSERT INTO learning_comparisons (${fields.join(",")}) 
            OUTPUT INSERTED.*
            VALUES (${placeholders})
        `;

        const [rows] = await executeQuery(query, values);
        return new LearningComparison(rows[0]);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM learning_comparisons WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new LearningComparison(rows[0]);
    }

    static async findAll() {
        const [rows] = await executeQuery("SELECT * FROM learning_comparisons ORDER BY createdAt DESC");
        return rows.map(row => new LearningComparison(row));
    }

    static async update(id, data) {
        const fields = [];
        const values = [];

        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && key !== 'id') {
                fields.push(`${key} = ?`);
                values.push(data[key]);
            }
        });

        if (fields.length === 0) return true;

        const query = `
            UPDATE learning_comparisons 
            SET ${fields.join(",")}, updatedAt = GETDATE()
            WHERE id = ?
        `;
        values.push(id);

        await executeQuery(query, values);
        return await this.findById(id);
    }

    static async delete(id) {
        await executeQuery("DELETE FROM learning_comparisons WHERE id = ?", [id]);
        return true;
    }
}

LearningComparison.init();

export default LearningComparison;
