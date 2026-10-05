import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
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
        this.groupName = data.groupName;
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
        try {
            if (!await migrationHelper.tableExists('learning_comparisons')) {
                await executeQuery(`
                    CREATE TABLE learning_comparisons (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        title NVARCHAR(255) NOT NULL,
                        description NVARCHAR(MAX),
                        groupName NVARCHAR(255),

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
                    )
                `);
            } else {
                const columnsToEnsure = [
                    ["groupName", "NVARCHAR(255)"],
                    ["beforeDescription", "NVARCHAR(MAX)"],
                    ["afterDescription", "NVARCHAR(MAX)"],
                    ["beforeImage", "NVARCHAR(MAX)"],
                    ["afterImage", "NVARCHAR(MAX)"],
                    ["beforeVideoDescriptions", "NVARCHAR(MAX)"],
                    ["beforePdfDescriptions", "NVARCHAR(MAX)"],
                    ["beforeExcelDescriptions", "NVARCHAR(MAX)"],
                    ["beforeWordDescriptions", "NVARCHAR(MAX)"],
                    ["beforePptDescriptions", "NVARCHAR(MAX)"],
                    ["beforeImageDescriptions", "NVARCHAR(MAX)"],
                    ["afterVideoDescriptions", "NVARCHAR(MAX)"],
                    ["afterPdfDescriptions", "NVARCHAR(MAX)"],
                    ["afterExcelDescriptions", "NVARCHAR(MAX)"],
                    ["afterWordDescriptions", "NVARCHAR(MAX)"],
                    ["afterPptDescriptions", "NVARCHAR(MAX)"],
                    ["afterImageDescriptions", "NVARCHAR(MAX)"],
                ];
                for (const [columnName, dataType] of columnsToEnsure) {
                    await migrationHelper.ensureColumnExists('learning_comparisons', columnName, dataType);
                }
            }
        } catch (error) {
            logger.error("Failed to initialize LearningComparison table", error);
        }
    }

    static async create(data) {
        const fields = [
            "title", "description", "groupName", "beforeDescription", "afterDescription",
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

    static async findAll(groupName) {
        if (groupName) {
            const [rows] = await executeQuery(
                "SELECT * FROM learning_comparisons WHERE groupName = ? ORDER BY createdAt DESC",
                [groupName]
            );
            return rows.map(row => new LearningComparison(row));
        }
        const [rows] = await executeQuery("SELECT * FROM learning_comparisons ORDER BY createdAt DESC");
        return rows.map(row => new LearningComparison(row));
    }

    static async getDistinctGroups() {
        const [rows] = await executeQuery(
            "SELECT groupName, COUNT(*) as count FROM learning_comparisons WHERE groupName IS NOT NULL AND groupName <> '' GROUP BY groupName ORDER BY groupName ASC"
        );
        return rows;
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
