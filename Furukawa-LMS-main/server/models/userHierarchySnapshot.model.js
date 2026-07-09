import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import migrationHelper from "../db/migrationHelper.js";

class UserHierarchySnapshot {
    constructor(data) {
        this.id = data.id;
        this.employeename = data.employeename;
        this.employeeid = data.employeeid;
        this.shift = data.shift;
        this.status = data.status;
        this.role = data.role;
        this.department = data.department;
        this.section = data.section;
        this.lines = data.lines;
        this.sub_section = data["sub-section"]; // Handle hyphen in column name
        this.station = data.station;
        this.department_unicode = data.department_unicode;
        this.section_unicode = data.section_unicode;
        this.line_unicode = data.line_unicode;
        this.schedule_shift = data.schedule_shift;
        this.createdAt = data.createdAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_hierarchy_snapshots')
            BEGIN
                CREATE TABLE user_hierarchy_snapshots (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    employeename NVARCHAR(255),
                    employeeid NVARCHAR(255),
                    shift NVARCHAR(50),
                    status NVARCHAR(50),
                    role NVARCHAR(255),
                    department NVARCHAR(255),
                    section NVARCHAR(255),
                    lines NVARCHAR(255),
                    [sub-section] NVARCHAR(255),
                    station NVARCHAR(255),
                    department_unicode NVARCHAR(255),
                    section_unicode NVARCHAR(255),
                    line_unicode NVARCHAR(255),
                    schedule_shift NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE()
                );
                CREATE INDEX idx_snapshot_employeeid ON user_hierarchy_snapshots(employeeid);
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created user_hierarchy_snapshots table in MSSQL");

            await migrationHelper.ensureColumnExists('user_hierarchy_snapshots', 'schedule_shift', 'NVARCHAR(MAX)');

            // Automatic population on startup
            await this.syncFromUsers();
            logger.info("Automatically populated user_hierarchy_snapshots table");

            // Setup periodic background sync every 30 minutes
            setInterval(async () => {
                try {
                    await this.syncFromUsers();
                    logger.info("Periodic background sync for user_hierarchy_snapshots completed");
                } catch (err) {
                    logger.error("Periodic background sync failure:", err);
                }
            }, 30 * 60 * 1000); 

        } catch (error) {
            logger.error("Failed to initialize or sync UserHierarchySnapshot table", error);
        }
    }

    static async syncFromUsers() {
        try {
            // 1. Clear existing snapshot
            await executeQuery("TRUNCATE TABLE user_hierarchy_snapshots");

            // 2. Insert fresh data from joins
            // We use OUTER APPLY or LEFT JOIN to ensure we get all users even if some hierarchy info is missing.
            const syncQuery = `
                INSERT INTO user_hierarchy_snapshots (
                    employeename, employeeid, shift, status, role,
                    department, section, lines, [sub-section], station,
                    department_unicode, section_unicode, line_unicode,
                    schedule_shift, createdAt
                )
                SELECT 
                    u.fullName as employeename,
                    u.empId as employeeid,
                    u.shift,
                    u.status,
                    COALESCE(cr.name, u.role) as role,
                    d.name as department,
                    s_res.sectionName as section,
                    l_res.lineName as lines,
                    ss_res.subSectionName as [sub-section],
                    st.stationName as station,
                    d.uniCode as department_unicode,
                    s_res.sectionUnicode as section_unicode,
                    l_res.lineUnicode as line_unicode,
                    u.shiftSchedule as schedule_shift,
                    GETDATE()
                FROM users u
                LEFT JOIN custom_roles cr ON u.customRoleId = cr.id
                OUTER APPLY (
                    SELECT TOP 1 ss.name as subSectionName, ss.lineId as ssLineId
                    FROM sub_sections ss WHERE ss.id = COALESCE(u.subSectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END))
                ) ss_res
                OUTER APPLY (
                    SELECT TOP 1 l.name as lineName, l.sectionId as lSectionId, l.uniCode as lineUnicode, l.department as lDeptId
                    FROM [lines] l WHERE l.id = COALESCE(u.lineId, (CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END), ss_res.ssLineId)
                ) l_res
                OUTER APPLY (
                    SELECT TOP 1 s.name as sectionName, s.uniCode as sectionUnicode, s.departmentId as sDeptId
                    FROM [sections] s WHERE s.id = COALESCE(u.sectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END), l_res.lSectionId)
                ) s_res
                OUTER APPLY (
                    SELECT TOP 1 name, uniCode
                    FROM departments d
                    WHERE d.id = COALESCE(u.departmentId, (CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END), s_res.sDeptId, l_res.lDeptId)
                       OR (u.departmentId IS NULL AND u.targetDeptId IS NULL AND (u.department = CAST(d.id AS NVARCHAR(50)) OR u.department = d.name))
                ) d
                OUTER APPLY (
                    SELECT TOP 1 name as stationName FROM machines WHERE id = COALESCE(u.stationId, (CASE WHEN u.isTemporary = 1 THEN u.targetStationId ELSE NULL END))
                ) st
                WHERE (u.isDeleted = 0 OR u.isDeleted IS NULL);
            `;

            await executeQuery(syncQuery);
            return { success: true, message: "Snapshot synchronized successfully" };
        } catch (error) {
            logger.error("Failed to sync UserHierarchySnapshot", error);
            throw error;
        }
    }

    static async getAll() {
        const [rows] = await executeQuery("SELECT * FROM user_hierarchy_snapshots ORDER BY employeename ASC");
        return rows;
    }
}

// Automatically init the table when model is imported - with error handling
UserHierarchySnapshot.init().catch(err => {
    logger.error("Failed to auto-init UserHierarchySnapshot:", err);
});

export default UserHierarchySnapshot;
