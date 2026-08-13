import { executeQuery } from "../db/mssqlHelper.js";
import RevisionRecordService from "../services/revisionRecord.service.js";
import { getFirstConfiguredLevelName } from "../utils/skillMatrix.util.js";
import { formatDateYMD, addDaysToDateString, getQuarterKeyAndYearFromDate } from "../utils/quarterDate.util.js";

class SkillUpgradationPlan {
    // Constructor to initialize SkillUpgradationPlan object
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.year = data.year;
        this.selectedLines = typeof data.selectedLines === "string"
            ? JSON.parse(data.selectedLines || "[]")
            : (data.selectedLines || []);
        this.tableData = typeof data.tableData === "string"
            ? JSON.parse(data.tableData || "{}")
            : (data.tableData || {});
        this.createdBy = data.createdBy || "";
        this.updatedBy = data.updatedBy || "";
        this.departmentName = data.departmentName || "";
        this.sectionName = data.sectionName || "";
        this.docNo = data.docNo;
        this.revNo = data.revNo;
        this.revDate = data.revDate;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    // Initialize the skill_upgradation_plans table
    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'skill_upgradation_plans')
            BEGIN
                CREATE TABLE skill_upgradation_plans (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL,
                    sectionId INT NULL,
                    year INT NULL,
                    selectedLines NVARCHAR(MAX),
                    tableData NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_dept_section_upgradation_year_plan UNIQUE (departmentId, sectionId, year)
                );
                CREATE INDEX idx_skill_upgrad_dept ON skill_upgradation_plans(departmentId);
                CREATE INDEX idx_skill_upgrad_sect ON skill_upgradation_plans(sectionId);
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('skill_upgradation_plans') AND name = 'sectionId')
                BEGIN
                    ALTER TABLE skill_upgradation_plans ADD sectionId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('skill_upgradation_plans') AND name = 'year')
                BEGIN
                    ALTER TABLE skill_upgradation_plans ADD year INT NULL;
                END

                -- Drop all old unique constraints on this table dynamically (excluding our target year constraint)
                DECLARE @ConstraintName NVARCHAR(255);
                SELECT TOP 1 @ConstraintName = name
                FROM sys.key_constraints
                WHERE parent_object_id = OBJECT_ID('skill_upgradation_plans') 
                  AND type = 'UQ' 
                  AND name <> 'unique_dept_section_upgradation_year_plan';

                WHILE @ConstraintName IS NOT NULL
                BEGIN
                    DECLARE @DropQuery NVARCHAR(MAX) = 'ALTER TABLE skill_upgradation_plans DROP CONSTRAINT ' + QUOTENAME(@ConstraintName);
                    EXEC sp_executesql @DropQuery;
                    
                    SET @ConstraintName = NULL;
                    SELECT TOP 1 @ConstraintName = name
                    FROM sys.key_constraints
                    WHERE parent_object_id = OBJECT_ID('skill_upgradation_plans') 
                      AND type = 'UQ' 
                      AND name <> 'unique_dept_section_upgradation_year_plan';
                END

                -- Add new unique constraint with year if it doesn't exist
                IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'unique_dept_section_upgradation_year_plan' AND type = 'UQ')
                BEGIN
                    ALTER TABLE skill_upgradation_plans ADD CONSTRAINT unique_dept_section_upgradation_year_plan UNIQUE (departmentId, sectionId, year);
                END

                -- Doc/revision snapshot: frozen at creation from the Revision Table.
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('skill_upgradation_plans') AND name = 'docNo')
                BEGIN
                    ALTER TABLE skill_upgradation_plans ADD docNo VARCHAR(255) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('skill_upgradation_plans') AND name = 'revNo')
                BEGIN
                    ALTER TABLE skill_upgradation_plans ADD revNo VARCHAR(255) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('skill_upgradation_plans') AND name = 'revDate')
                BEGIN
                    ALTER TABLE skill_upgradation_plans ADD revDate VARCHAR(255) NULL;
                END
            END
        `;
        await executeQuery(query);
    }

    // Find skill upgradation plan by department, section and year
    static async findByHierarchy(departmentId, sectionId = null, year = null) {
        let query = "SELECT TOP 1 * FROM skill_upgradation_plans WHERE departmentId = ?";
        let params = [departmentId];

        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        } else {
            query += " AND sectionId IS NULL";
        }

        if (year) {
            query += " AND year = ?";
            params.push(year);
        } else {
            query += " AND year IS NULL";
        }

        const [rows] = await executeQuery(query, params);
        if (rows.length === 0) return null;
        return new SkillUpgradationPlan(rows[0]);
    }

    // List all skill upgradation plans with department and section names
    static async listPlans(departmentId = null, sectionId = null) {
        let query = `
            SELECT sup.*, d.name AS departmentName, s.name AS sectionName
            FROM skill_upgradation_plans sup
            LEFT JOIN departments d ON sup.departmentId = d.id
            LEFT JOIN [sections] s ON sup.sectionId = s.id
        `;
        let params = [];
        let conditions = [];
        if (departmentId) {
            conditions.push("sup.departmentId = ?");
            params.push(departmentId);
        }
        if (sectionId) {
            conditions.push("sup.sectionId = ?");
            params.push(sectionId);
        }
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        query += " ORDER BY sup.year DESC, sup.updatedAt DESC";
        const [rows] = await executeQuery(query, params);
        return rows.map(r => new SkillUpgradationPlan(r));
    }

    // Upsert skill upgradation plan by department, section and year
    static async upsert({ departmentId, sectionId = null, year = null, selectedLines, tableData, userName, docNo, revNo, revDate }) {
        const existing = await this.findByHierarchy(departmentId, sectionId, year);

        if (existing) {
            const incomingIsEmpty = !tableData || Object.keys(tableData).length === 0;
            const finalTableData = incomingIsEmpty ? existing.tableData : tableData;
            const finalSelectedLines = (!selectedLines || selectedLines.length === 0) && incomingIsEmpty
                ? existing.selectedLines
                : selectedLines;

            await executeQuery(
                `UPDATE skill_upgradation_plans
                 SET selectedLines = ?, tableData = ?, updatedBy = ?, updatedAt = GETDATE()
                 WHERE departmentId = ?
                   AND (sectionId = ? OR (sectionId IS NULL AND ? IS NULL))
                   AND (year = ? OR (year IS NULL AND ? IS NULL))`,
                [
                    JSON.stringify(finalSelectedLines || []),
                    JSON.stringify(finalTableData || {}),
                    userName || "",
                    departmentId,
                    sectionId,
                    sectionId,
                    year,
                    year
                ]
            );
            return this.findByHierarchy(departmentId, sectionId, year);
        }

        const [rows] = await executeQuery(
            `INSERT INTO skill_upgradation_plans
             (departmentId, sectionId, year, selectedLines, tableData, createdBy, updatedBy, docNo, revNo, revDate)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                departmentId,
                sectionId,
                year,
                JSON.stringify(selectedLines || []),
                JSON.stringify(tableData || {}),
                userName || "",
                userName || "",
                docNo || null,
                revNo || null,
                revDate || null,
            ]
        );

        if (rows.length === 0) return null;
        return this.findByHierarchy(departmentId, sectionId, year);
    }

    // Syncs a student's 16-day approval into the Skill Upgradation Plan: stamps the Updation
    // Date (Plan) of whichever quarter the approval date + 1 day falls in, seeds that
    // quarter's Skill Level with the lowest-order configured level (e.g. "L1") if it isn't
    // already set, and marks it "Planned". The +1 and the quarter/year resolution both use
    // the shifted date (not the raw approval date) so a same-day approval right at a
    // quarter/year boundary (e.g. approved Dec 31) still files under the correct quarter —
    // computing the quarter from the raw date would silently mismatch it in that case.
    static async syncSixteenDayApproval(studentId, approveDateStr, activeConfig = null) {
        const userQuery = `
            SELECT
                u.id, u.fullName, u.empId, u.departmentId, u.sectionId, u.lineId, u.subSectionId, u.shift,
                l.name as lineName,
                ss.name as subSectionName
            FROM users u
            LEFT JOIN [lines] l ON u.lineId = l.id
            LEFT JOIN sub_sections ss ON u.subSectionId = ss.id
            WHERE u.id = ?
        `;
        const [users] = await executeQuery(userQuery, [studentId]);
        if (users.length === 0) return;
        const student = users[0];

        if (!student.departmentId || !student.sectionId) {
            console.log(`[syncSixteenDayApproval] Student ${studentId} lacks departmentId or sectionId`);
            return;
        }

        const approveDateObj = new Date(approveDateStr);
        if (isNaN(approveDateObj.getTime())) {
            console.error(`[syncSixteenDayApproval] Invalid approve date: ${approveDateStr}`);
            return;
        }

        const planDate = addDaysToDateString(formatDateYMD(approveDateObj), 1);
        const { quarterKey, year } = getQuarterKeyAndYearFromDate(planDate);
        if (!quarterKey || !year) return;

        const plan = await this.findByHierarchy(student.departmentId, student.sectionId, year);

        let tableData = {};
        if (plan) {
            tableData = typeof plan.tableData === "string" ? JSON.parse(plan.tableData) : plan.tableData || {};
        }

        const studentKey = String(studentId);
        if (!tableData[studentKey]) {
            tableData[studentKey] = {
                userName: student.fullName || "",
                cardNo: student.empId || "",
                modelLine: student.lineName || "",
                station: student.subSectionName || "",
                q1Skill: "", q1Date: "", q1DateActual: "", q1Status: "", q1Shift: "",
                q2Skill: "", q2Date: "", q2DateActual: "", q2Status: "", q2Shift: "",
                q3Skill: "", q3Date: "", q3DateActual: "", q3Status: "", q3Shift: "",
                q4Skill: "", q4Date: "", q4DateActual: "", q4Status: "", q4Shift: "",
            };
        }

        tableData[studentKey][`${quarterKey}Date`] = planDate;

        if (!tableData[studentKey][`${quarterKey}Skill`]) {
            const firstLevelName = getFirstConfiguredLevelName(activeConfig);
            if (firstLevelName) {
                tableData[studentKey][`${quarterKey}Skill`] = firstLevelName;
            }
        }

        if (!tableData[studentKey][`${quarterKey}Shift`] && student.shift) {
            tableData[studentKey][`${quarterKey}Shift`] = student.shift;
        }
        if (!tableData[studentKey][`${quarterKey}Status`]) {
            tableData[studentKey][`${quarterKey}Status`] = "Planned";
        }

        if (tableData.__removedUserIds) {
            tableData.__removedUserIds = tableData.__removedUserIds.filter(id => String(id) !== studentKey);
        }

        if (plan) {
            await executeQuery(
                `UPDATE skill_upgradation_plans
                 SET tableData = ?, updatedAt = GETDATE()
                 WHERE id = ?`,
                [JSON.stringify(tableData), plan.id]
            );
        } else {
            const revision = await RevisionRecordService.getLatestForSheet('skill-upgradation-plan', student.departmentId, student.sectionId);
            const docNo = revision?.docNo || null;
            const revNo = revision?.revNo || null;
            const revDate = revision?.revDate || null;

            await executeQuery(
                `INSERT INTO skill_upgradation_plans
                 (departmentId, sectionId, year, selectedLines, tableData, createdBy, updatedBy, docNo, revNo, revDate)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    student.departmentId,
                    student.sectionId,
                    year,
                    JSON.stringify([]),
                    JSON.stringify(tableData),
                    "System",
                    "System",
                    docNo,
                    revNo,
                    revDate
                ]
            );
        }
    }

    // Delete a skill upgradation plan by id
    static async delete(id) {
        const [rows] = await executeQuery(
            "DELETE FROM skill_upgradation_plans OUTPUT DELETED.id WHERE id = ?",
            [id]
        );
        return rows.length > 0;
    }
}

// Initialize the skill_upgradation_plans table
SkillUpgradationPlan.init().catch((err) => {
    console.error("Failed to initialize skill_upgradation_plans table:", err);
});

export default SkillUpgradationPlan;
