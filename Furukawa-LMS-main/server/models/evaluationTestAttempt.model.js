import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class EvaluationTestAttempt {
    constructor(data) {
        this.id = data.id;
        this.testId = data.testId;
        this.traineeName = data.traineeName;
        this.employeeNo = data.employeeNo;
        this.educatorName = data.educatorName;
        this.userId = data.userId;
        
        // JSON mapping qId -> { results: ["", "", ...], comment: "" }
        this.attemptData = typeof data.attemptData === 'string'
            ? JSON.parse(data.attemptData)
            : (data.attemptData || {});
            
        this.createdBy = data.createdBy;
        this.createdAt = data.createdAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_test_attempts' AND xtype='U')
            BEGIN
                CREATE TABLE evaluation_test_attempts (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    testId INT NOT NULL,
                    traineeName NVARCHAR(255),
                    employeeNo NVARCHAR(255),
                    educatorName NVARCHAR(255),
                    attemptData NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    userId INT NULL,
                    CONSTRAINT fk_evaluation_test FOREIGN KEY (testId) REFERENCES evaluation_tests(id) ON DELETE CASCADE
                )
            END
            ELSE
            BEGIN
                IF COL_LENGTH('evaluation_test_attempts', 'userId') IS NULL
                BEGIN
                    ALTER TABLE evaluation_test_attempts ADD userId INT NULL;
                END
            END
        `;
        try {
            await executeQuery(query);
            logger.info("MSSQL evaluation_test_attempts table initialized successfully.");
        } catch (error) {
            logger.error("Failed to initialize evaluation_test_attempts table", error);
            throw error;
        }
    }

    static async create(data) {
        let resolvedUserId = null;
        if (data.employeeNo) {
            try {
                const [userRows] = await executeQuery("SELECT id FROM users WHERE empId = ? OR userName = ?", [data.employeeNo, data.employeeNo.toLowerCase()]);
                if (userRows && userRows.length > 0) {
                    resolvedUserId = userRows[0].id;
                }
            } catch (e) {
                logger.error("Failed to resolve trainee userId in EvaluationTestAttempt.create", e);
            }
        }

        const query = `
            INSERT INTO evaluation_test_attempts (testId, traineeName, employeeNo, educatorName, attemptData, createdBy, userId)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const attemptDataStr = JSON.stringify(data.attemptData || {});
        const [rows] = await executeQuery(query, [
            data.testId,
            data.traineeName || "",
            data.employeeNo || "",
            data.educatorName || "",
            attemptDataStr,
            data.createdBy,
            resolvedUserId
        ]);
        return new EvaluationTestAttempt(rows[0]);
    }

    static async findById(id) {
        const query = `
            SELECT a.*, t.title as testTitle, t.performDateCount, t.contentStructure,
                   u.userName, u.isTemporary
            FROM evaluation_test_attempts a
            JOIN evaluation_tests t ON a.testId = t.id
            LEFT JOIN users u ON a.userId = u.id OR (a.userId IS NULL AND a.employeeNo = u.empId)
            WHERE a.id = ?
        `;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        
        const row = rows[0];
        if (typeof row.attemptData === "string") {
            try {
                row.attemptData = JSON.parse(row.attemptData);
            } catch (e) {
                row.attemptData = {};
            }
        }
        if (typeof row.contentStructure === "string") {
            try {
                row.contentStructure = JSON.parse(row.contentStructure);
            } catch (e) {
                row.contentStructure = [];
            }
        }
        return row;
    }

    static async findByTestId(testId) {
        const query = `
            SELECT * FROM evaluation_test_attempts 
            WHERE testId = ? 
            ORDER BY createdAt DESC
        `;
        const [rows] = await executeQuery(query, [testId]);
        return rows.map(row => new EvaluationTestAttempt(row));
    }

    static async findAll() {
        const query = `
            SELECT a.*, t.title as testTitle, t.performDateCount,
                   COALESCE(u.departmentId, (CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END)) as departmentId,
                   COALESCE(u.sectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END)) as sectionId,
                   COALESCE(u.lineId, (CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END)) as lineId,
                   COALESCE(u.subSectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END)) as subSectionId,
                   u.isTemporary, u.userName,
                   dept.name as departmentName, sec.name as sectionName,
                   l.name as lineName, ss.name as subSectionName
            FROM evaluation_test_attempts a
            JOIN evaluation_tests t ON a.testId = t.id
            LEFT JOIN users u ON a.userId = u.id OR (a.userId IS NULL AND a.employeeNo = u.empId)
            LEFT JOIN departments dept ON COALESCE(u.departmentId, (CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END)) = dept.id
            LEFT JOIN [sections] sec ON COALESCE(u.sectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END)) = sec.id
            LEFT JOIN [lines] l ON COALESCE(u.lineId, (CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END)) = l.id
            LEFT JOIN sub_sections ss ON COALESCE(u.subSectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END)) = ss.id
            ORDER BY a.createdAt DESC
        `;
        const [rows] = await executeQuery(query);
        return rows.map(row => {
            if (typeof row.attemptData === "string") {
                try {
                    row.attemptData = JSON.parse(row.attemptData);
                } catch (e) {
                    row.attemptData = {};
                }
            }
            return row;
        });
    }

    static async delete(id) {
        await executeQuery("DELETE FROM evaluation_test_attempts WHERE id = ?", [id]);
        return true;
    }

    static async update(id, data) {
        const fields = [];
        const values = [];

        if (data.attemptData !== undefined) {
            fields.push("attemptData = ?");
            values.push(JSON.stringify(data.attemptData));
        }
        if (data.traineeName !== undefined) {
            fields.push("traineeName = ?");
            values.push(data.traineeName);
        }
        if (data.employeeNo !== undefined) {
            fields.push("employeeNo = ?");
            values.push(data.employeeNo);

            // Also update resolved userId
            let resolvedUserId = null;
            if (data.employeeNo) {
                try {
                    const [userRows] = await executeQuery("SELECT id FROM users WHERE empId = ? OR userName = ?", [data.employeeNo, data.employeeNo.toLowerCase()]);
                    if (userRows && userRows.length > 0) {
                        resolvedUserId = userRows[0].id;
                    }
                } catch (e) {
                    logger.error("Failed to resolve trainee userId in EvaluationTestAttempt.update", e);
                }
            }
            fields.push("userId = ?");
            values.push(resolvedUserId);
        }
        if (data.educatorName !== undefined) {
            fields.push("educatorName = ?");
            values.push(data.educatorName);
        }
        if (data.createdBy !== undefined) {
            fields.push("createdBy = ?");
            values.push(data.createdBy);
        }

        if (fields.length === 0) return await this.findById(id);

        const query = `
            UPDATE evaluation_test_attempts 
            SET ${fields.join(",")}
            WHERE id = ?
        `;
        values.push(id);

        await executeQuery(query, values);
        return await this.findById(id);
    }
}

export default EvaluationTestAttempt;
