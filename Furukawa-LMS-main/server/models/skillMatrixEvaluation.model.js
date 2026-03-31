import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class SkillMatrixEvaluation {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;
        this.departmentId = data.departmentId;
        this.headerData = typeof data.headerData === 'string' ? JSON.parse(data.headerData) : (data.headerData || {});
        this.docData = typeof data.docData === 'string' ? JSON.parse(data.docData) : (data.docData || {});
        this.evalData = typeof data.evalData === 'string' ? JSON.parse(data.evalData) : (data.evalData || {});
        this.opinion = data.opinion || "";
        this.updatedBy = data.updatedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='skill_matrix_evaluations' and xtype='U')
            BEGIN
                CREATE TABLE skill_matrix_evaluations (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    departmentId VARCHAR(255),
                    headerData NVARCHAR(MAX),
                    docData NVARCHAR(MAX),
                    evalData NVARCHAR(MAX),
                    opinion NVARCHAR(MAX),
                    updatedBy INT,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uq_sm_eval_student UNIQUE (studentId)
                )
            END
        `;
        try {
            await executeQuery(query);
        } catch (error) {
            logger.error("Failed to initialize SkillMatrixEvaluation table", error);
        }
    }

    static async findByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM skill_matrix_evaluations WHERE studentId = ?", [studentId]);
        if (rows.length === 0) return null;
        return new SkillMatrixEvaluation(rows[0]);
    }

    static async upsert(data) {
        const { studentId, departmentId, headerData, docData, evalData, opinion, updatedBy } = data;

        const existing = await executeQuery("SELECT id FROM skill_matrix_evaluations WHERE studentId = ?", [studentId]);

        if (existing[0].length > 0) {
            await executeQuery(
                `UPDATE skill_matrix_evaluations SET 
                 departmentId = ?, headerData = ?, docData = ?, evalData = ?, opinion = ?, updatedBy = ?, updatedAt = GETDATE() 
                 WHERE studentId = ?`,
                [departmentId, JSON.stringify(headerData), JSON.stringify(docData), JSON.stringify(evalData), opinion, updatedBy, studentId]
            );
        } else {
            await executeQuery(
                `INSERT INTO skill_matrix_evaluations (studentId, departmentId, headerData, docData, evalData, opinion, updatedBy) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [studentId, departmentId, JSON.stringify(headerData), JSON.stringify(docData), JSON.stringify(evalData), opinion, updatedBy]
            );
        }

        return this.findByStudentId(studentId);
    }
}

// Initialize table


export { SkillMatrixEvaluation };
export default SkillMatrixEvaluation;
