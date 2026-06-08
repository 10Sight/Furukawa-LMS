import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

// Parses a DB column that may be a JSON array string, a plain path string, or null.
// Always returns an array for consistent frontend consumption.
const parseFileField = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [val];
    }
};

class LearningComparison {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description;
        this.beforeDescription = data.beforeDescription;
        this.afterDescription = data.afterDescription;

        this.beforeVideo = parseFileField(data.beforeVideo);
        this.beforePdf   = parseFileField(data.beforePdf);
        this.beforeExcel = parseFileField(data.beforeExcel);
        this.beforeWord  = parseFileField(data.beforeWord);
        this.beforePpt   = parseFileField(data.beforePpt);
        this.beforeImage = parseFileField(data.beforeImage);

        this.afterVideo  = parseFileField(data.afterVideo);
        this.afterPdf    = parseFileField(data.afterPdf);
        this.afterExcel  = parseFileField(data.afterExcel);
        this.afterWord   = parseFileField(data.afterWord);
        this.afterPpt    = parseFileField(data.afterPpt);
        this.afterImage  = parseFileField(data.afterImage);

        this.beforeVideoDescriptions = parseFileField(data.beforeVideoDescriptions);
        this.beforePdfDescriptions   = parseFileField(data.beforePdfDescriptions);
        this.beforeExcelDescriptions = parseFileField(data.beforeExcelDescriptions);
        this.beforeWordDescriptions  = parseFileField(data.beforeWordDescriptions);
        this.beforePptDescriptions   = parseFileField(data.beforePptDescriptions);
        this.beforeImageDescriptions = parseFileField(data.beforeImageDescriptions);

        this.afterVideoDescriptions  = parseFileField(data.afterVideoDescriptions);
        this.afterPdfDescriptions    = parseFileField(data.afterPdfDescriptions);
        this.afterExcelDescriptions  = parseFileField(data.afterExcelDescriptions);
        this.afterWordDescriptions   = parseFileField(data.afterWordDescriptions);
        this.afterPptDescriptions    = parseFileField(data.afterPptDescriptions);
        this.afterImageDescriptions  = parseFileField(data.afterImageDescriptions);

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
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'beforeVideoDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD beforeVideoDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'beforePdfDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD beforePdfDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'beforeExcelDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD beforeExcelDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'beforeWordDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD beforeWordDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'beforePptDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD beforePptDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'beforeImageDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD beforeImageDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'afterVideoDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD afterVideoDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'afterPdfDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD afterPdfDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'afterExcelDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD afterExcelDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'afterWordDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD afterWordDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'afterPptDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD afterPptDescriptions NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('learning_comparisons') AND name = 'afterImageDescriptions')
                BEGIN
                    ALTER TABLE learning_comparisons ADD afterImageDescriptions NVARCHAR(MAX);
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
            "beforeVideoDescriptions", "beforePdfDescriptions", "beforeExcelDescriptions",
            "beforeWordDescriptions", "beforePptDescriptions", "beforeImageDescriptions",
            "afterVideoDescriptions", "afterPdfDescriptions", "afterExcelDescriptions",
            "afterWordDescriptions", "afterPptDescriptions", "afterImageDescriptions",
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
