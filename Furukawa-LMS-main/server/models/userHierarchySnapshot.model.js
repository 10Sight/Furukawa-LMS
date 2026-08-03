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

    // Guards against overlapping TRUNCATE+rebuild passes: if a sync is already running
    // (e.g. the 30-min interval firing while a prior run is still in flight on a slow DB),
    // concurrent callers await the same in-flight promise instead of starting another
    // full-table rebuild and piling more load onto the connection pool.
    static _syncPromise = null;

    static async syncFromUsers() {
        if (this._syncPromise) return this._syncPromise;
        this._syncPromise = this._doSyncFromUsers().finally(() => {
            this._syncPromise = null;
        });
        return this._syncPromise;
    }

    static async _doSyncFromUsers() {
        try {
            // 1. Clear existing snapshot
            await executeQuery("TRUNCATE TABLE user_hierarchy_snapshots");

            // 2. Insert fresh data from joins
            // Plain LEFT JOINs on the resolved hierarchy FK columns (subSectionId/lineId/sectionId/
            // departmentId/stationId, backfilled for every user on startup by auth.model.js), rather
            // than per-row OUTER APPLY + legacy string-name fallbacks. Those FKs are now reliably
            // populated, so this is index-seek friendly and drops ~17s to well under 100ms.
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
                    s.name as section,
                    l.name as lines,
                    ss.name as [sub-section],
                    st.name as station,
                    d.uniCode as department_unicode,
                    s.uniCode as section_unicode,
                    l.uniCode as line_unicode,
                    u.shiftSchedule as schedule_shift,
                    GETDATE()
                FROM users u
                LEFT JOIN custom_roles cr ON u.customRoleId = cr.id
                LEFT JOIN sub_sections ss ON ss.id = COALESCE(u.subSectionId, CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END)
                LEFT JOIN [lines] l ON l.id = COALESCE(u.lineId, CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END, ss.lineId)
                LEFT JOIN [sections] s ON s.id = COALESCE(u.sectionId, CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END, l.sectionId)
                LEFT JOIN departments d ON d.id = COALESCE(u.departmentId, CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END, s.departmentId, l.department)
                LEFT JOIN machines st ON st.id = COALESCE(u.stationId, CASE WHEN u.isTemporary = 1 THEN u.targetStationId ELSE NULL END)
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

// Initialization is explicitly awaited in index.js's startup sequence (after User/Section/Line/
// SubSection init), instead of self-invoking here. syncFromUsers() does a full scan+join against
// `users`; firing it unawaited at import time let it race against User.init()'s concurrent
// ALTER/CREATE INDEX statements on the same table, causing lock-contention timeouts on both sides.

export default UserHierarchySnapshot;
