import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import ENV from "../configs/env.config.js";
import { slugify } from "../utils/slugify.js";
import { buildStatusHistoryEntry } from "../utils/statusHistory.js";

// Cascades NULLs down the section -> line -> subSection -> station hierarchy (and the
// mirrored target* chain used for temporary users) on a plain object carrying those keys.
const applyHierarchyCascade = (obj) => {
    if (!obj.sectionId) {
        obj.lineId = null;
        obj.lines = [];
    }
    if (!obj.lineId) {
        obj.subSectionId = null;
        obj.subSections = [];
    }
    if (!obj.subSectionId) {
        obj.stationId = null;
        obj.stations = [];
    }

    if (!obj.targetSectionId) obj.targetLineId = null;
    if (!obj.targetLineId) obj.targetSubSectionId = null;
    if (!obj.targetSubSectionId) obj.targetStationId = null;
};

const getEntityName = async (table, id) => {
    if (!id) return null;
    const [rows] = await executeQuery(`SELECT name FROM ${table} WHERE id = ?`, [id]);
    return rows.length > 0 ? rows[0].name : null;
};

// Keeps the legacy string columns (department, section, line, sub_section, stationNo) in
// sync with their relational ID columns so consumers that still read the string columns
// don't see stale/obsolete values.
const resolveHierarchyNames = async (obj) => {
    obj.department = await getEntityName('departments', obj.departmentId);
    obj.section = await getEntityName('[sections]', obj.sectionId);
    obj.line = await getEntityName('[lines]', obj.lineId);
    obj.sub_section = await getEntityName('sub_sections', obj.subSectionId);
    obj.stationNo = await getEntityName('machines', obj.stationId);
};

class User {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility with Mongoose _id usage
        this.fullName = data.fullName;
        this.userName = data.userName;
        this.slug = data.slug;
        this.email = data.email;
        this.phoneNumber = data.phoneNumber;
        this.password = data.password;
        this.avatar = typeof data.avatar === 'string' ? JSON.parse(data.avatar) : (data.avatar || { publicId: "", url: "" });
        this.refreshToken = data.refreshToken;
        this.resetPasswordToken = data.resetPasswordToken;
        this.resetPasswordExpiry = data.resetPasswordExpiry ? new Date(data.resetPasswordExpiry) : null;
        this.role = data.role || "STUDENT";
        this.currentLevel = data.currentLevel || null;
        this.currentSkill = typeof data.currentSkill === 'string' ? JSON.parse(data.currentSkill) : (data.currentSkill || {});
        this.currentEffeciency = data.currentEffeciency || 0;
        this.skillEffeciency = typeof data.skillEffeciency === 'string' ? JSON.parse(data.skillEffeciency) : (data.skillEffeciency || {});
        this.status = data.status || "PRESENT";
        this.isVerified = !!data.isVerified;
        this.enrolledCourses = typeof data.enrolledCourses === 'string' ? JSON.parse(data.enrolledCourses) : (data.enrolledCourses || []);
        this.createdCourses = typeof data.createdCourses === 'string' ? JSON.parse(data.createdCourses) : (data.createdCourses || []);
        this.lastLogin = data.lastLogin ? new Date(data.lastLogin) : null;
        this.loginHistory = typeof data.loginHistory === 'string' ? JSON.parse(data.loginHistory) : (data.loginHistory || []);
        this.statusHistory = (() => {
            if (Array.isArray(data.statusHistory)) return data.statusHistory;
            if (typeof data.statusHistory === 'string') {
                try { return JSON.parse(data.statusHistory || "[]"); } catch (e) { return []; }
            }
            return [];
        })();
        this.isDeleted = !!data.isDeleted;
        this.department = data.department;
        this.departments = typeof data.departments === 'string' ? JSON.parse(data.departments) : (data.departments || []);
        this.stations = typeof data.stations === 'string' ? JSON.parse(data.stations) : (data.stations || []);
        this.sections = typeof data.sections === 'string' ? JSON.parse(data.sections) : (data.sections || []);
        this.lines = typeof data.lines === 'string' ? JSON.parse(data.lines) : (data.lines || []);
        this.subSections = typeof data.subSections === 'string' ? JSON.parse(data.subSections) : (data.subSections || []);
        this.unit = data.unit;
        this.empId = data.empId || null;
        this.isEmployee = !!data.isEmployee;
        this.isAdmin = !!data.isAdmin;
        this.isTrainer = !!data.isTrainer;
        this.shift = data.shift || null;
        this.idCard = data.idCard || null;
        this.privileges = data.privileges || null;
        this.joiningDate = data.joiningDate || null;
        this.leavingDate = data.leavingDate || null;
        this.isTemporary = !!data.isTemporary;
        this.sectionId = data.resolvedSectionId || data.sectionId || null;
        this.subSectionId = data.subSectionId || null;
        this.lineId = data.resolvedLineId || data.lineId || null;
        this.stationId = data.stationId || (this.stations && this.stations.length > 0 ? parseInt(this.stations[0]) : null);
        this.departmentId = data.resolvedDeptId || data.departmentId || (this.departments && this.departments.length > 0 ? parseInt(this.departments[0]) : null);
        this.targetDeptId = data.targetDeptId || null;
        this.targetSectionId = data.targetSectionId || null;
        this.targetLineId = data.targetLineId || null;
        this.targetSubSectionId = data.targetSubSectionId || null;
        this.targetStationId = data.targetStationId || null;
        this.fatherHusbandName = data.fatherHusbandName || null;
        this.gender = data.gender || null;
        this.dob = data.dob || null;
        this.education = data.education || null;
        this.district = data.district || null;
        this.state = data.state || null;
        this.pin = data.pin || null;
        this.busRoute = data.busRoute || null;
        this.reasonOfLeaving = data.reasonOfLeaving || null;
        this.contractor = data.contractor || null;
        this.contractorId = data.contractorId || null;
        this.mentor = data.mentor || null;
        this.designation = data.designation || null;
        this.supervisor = data.supervisor || null;
        this.incharge = data.incharge || null;
        this.isMentor = !!data.isMentor;
        this.isSupervisor = !!data.isSupervisor;
        this.isIncharge = !!data.isIncharge;
        this.mentorLimit = data.mentorLimit !== undefined && data.mentorLimit !== null ? Number(data.mentorLimit) : 0;
        this.customRoleId = data.customRoleId || null;
        this.customRole = data.customRole || null;
        this.shiftSchedule = typeof data.shiftSchedule === 'string' ? (() => { try { return JSON.parse(data.shiftSchedule); } catch (e) { return {}; } })() : (data.shiftSchedule || {});
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        this.ojt = typeof data.ojt === 'string' ? JSON.parse(data.ojt) : (data.ojt || []);
        // expectedHandover is the only genuine SQL DATE column on this table; tedious
        // (with useUTC:false, see connectDB.js) reconstructs it as a Date using LOCAL
        // fields, which JSON.stringify then re-encodes via toISOString() (always UTC) --
        // shifting the calendar day back by the server's UTC offset. Flatten it to a
        // plain date string here (using the matching local getters) so API responses
        // never carry a Date object that can get corrupted on serialization.
        this.expectedHandover = data.expectedHandover instanceof Date
            ? (isNaN(data.expectedHandover.getTime()) ? null : `${data.expectedHandover.getFullYear()}-${String(data.expectedHandover.getMonth() + 1).padStart(2, '0')}-${String(data.expectedHandover.getDate()).padStart(2, '0')}`)
            : (data.expectedHandover || null);
        this.dojoShift = data.dojoShift || null;

        // Carry over any extra columns/joined fields (e.g. deptName, assignments) that
        // aren't explicitly mapped above but were returned by the query.
        Object.keys(data).forEach(key => {
            if (this[key] === undefined) {
                this[key] = data[key];
            }
        });

        // Internal tracking for password changes
        this._originalPassword = data.password;

        // Internal tracking for hierarchy ID changes, so save() can skip the
        // 5-query name resolution when none of these were actually modified.
        this._originalHierarchyIds = {
            departmentId: this.departmentId,
            sectionId: this.sectionId,
            lineId: this.lineId,
            subSectionId: this.subSectionId,
            stationId: this.stationId,
        };
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' and xtype='U')
            BEGIN
                CREATE TABLE users (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    fullName NVARCHAR(255) NOT NULL,
                    userName NVARCHAR(255) NOT NULL UNIQUE,
                    slug NVARCHAR(255) UNIQUE,
                    email NVARCHAR(255) NULL,
                    phoneNumber NVARCHAR(50) NULL,
                    password NVARCHAR(255) NOT NULL,
                    avatar NVARCHAR(MAX),
                    refreshToken NVARCHAR(MAX),
                    resetPasswordToken NVARCHAR(255),
                    resetPasswordExpiry DATETIME,
                    role NVARCHAR(50) DEFAULT 'STUDENT',
                    currentLevel NVARCHAR(50) DEFAULT 'L1',
                    currentSkill NVARCHAR(MAX) DEFAULT '{}',
                    currentEffeciency FLOAT DEFAULT 0,
                    skillEffeciency NVARCHAR(MAX) DEFAULT '{}',
                    status NVARCHAR(50) DEFAULT 'PRESENT',
                    isVerified BIT DEFAULT 0,
                    enrolledCourses NVARCHAR(MAX),
                    createdCourses NVARCHAR(MAX),
                    lastLogin DATETIME,
                    loginHistory NVARCHAR(MAX),
                    isDeleted BIT DEFAULT 0,
                    department NVARCHAR(255),
                    sub_section NVARCHAR(255) DEFAULT NULL,
                    departments NVARCHAR(MAX),
                    stations NVARCHAR(MAX),
                    unit NVARCHAR(50) NOT NULL,
                    empId NVARCHAR(255),
                    isEmployee BIT DEFAULT 0,
                    isAdmin BIT DEFAULT 0,
                    isTrainer BIT DEFAULT 0,
                    shift NVARCHAR(100),
                    idCard NVARCHAR(255),
                    privileges NVARCHAR(255),
                    joiningDate NVARCHAR(255),
                    leavingDate NVARCHAR(255),
                    isTemporary BIT DEFAULT 0,
                    sectionId INT,
                    subSectionId INT,
                    lineId INT,
                    stationId INT,
                    departmentId INT NULL,
                    targetDeptId INT NULL,
                    targetSectionId INT NULL,
                    targetLineId INT NULL,
                    targetSubSectionId INT NULL,
                    targetStationId INT NULL,
                    fatherHusbandName NVARCHAR(255) NULL,
                    gender NVARCHAR(50),
                    dob NVARCHAR(50),
                    education NVARCHAR(MAX),
                    district NVARCHAR(255),
                    state NVARCHAR(255),
                    pin NVARCHAR(50),
                    busRoute NVARCHAR(255),
                    reasonOfLeaving NVARCHAR(MAX),
                    contractor NVARCHAR(255) NULL,
                    mentor NVARCHAR(255),
                    designation NVARCHAR(255),
                    supervisor NVARCHAR(255),
                    incharge NVARCHAR(255),
                    section NVARCHAR(255),
                    line NVARCHAR(255),
                    stationNo NVARCHAR(255),
                    isMentor BIT DEFAULT 0,
                    isSupervisor BIT DEFAULT 0,
                    isIncharge BIT DEFAULT 0,
                    mentorLimit INT DEFAULT 0,
                    expectedHandover DATE NULL,
                    dojoShift NVARCHAR(50) DEFAULT NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    -- Foreign keys will be created if the referenced tables exist.
                    -- They are omitted here or can be added manually after all tables are created
                    -- to prevent dependency issues during initial table creation.
                )
            END
        `;
        try {
            const { executeQuery } = await import("../db/mssqlHelper.js");
            await executeQuery(query);

            // Column migration logic using helper
            const columnsToAdd = [
                { name: 'fatherHusbandName', type: 'NVARCHAR(255)' },
                { name: 'gender', type: 'NVARCHAR(50)' },
                { name: 'dob', type: 'NVARCHAR(50)' },
                { name: 'education', type: 'NVARCHAR(MAX)' },
                { name: 'district', type: 'NVARCHAR(255)' },
                { name: 'state', type: 'NVARCHAR(255)' },
                { name: 'pin', type: 'NVARCHAR(50)' },
                { name: 'busRoute', type: 'NVARCHAR(255)' },
                { name: 'reasonOfLeaving', type: 'NVARCHAR(MAX)' },
                { name: 'contractor', type: 'NVARCHAR(255)' },
                { name: 'mentor', type: 'NVARCHAR(255)' },
                { name: 'designation', type: 'NVARCHAR(255)' },
                { name: 'supervisor', type: 'NVARCHAR(255)' },
                { name: 'incharge', type: 'NVARCHAR(255)' },
                { name: 'section', type: 'NVARCHAR(255)' },
                { name: 'line', type: 'NVARCHAR(255)' },
                { name: 'stationNo', type: 'NVARCHAR(255)' },
                { name: 'stationId', type: 'INT' },
                { name: 'departmentId', type: 'INT' },
                { name: 'sectionId', type: 'INT' },
                { name: 'lineId', type: 'INT' },
                { name: 'subSectionId', type: 'INT' },
                { name: 'isEmployee', type: 'BIT DEFAULT 0' },
                { name: 'isAdmin', type: 'BIT DEFAULT 0' },
                { name: 'isTrainer', type: 'BIT DEFAULT 0' },
                { name: 'isMentor', type: 'BIT DEFAULT 0' },
                { name: 'isSupervisor', type: 'BIT DEFAULT 0' },
                { name: 'isIncharge', type: 'BIT DEFAULT 0' },
                { name: 'mentorLimit', type: 'INT DEFAULT 0' },
                { name: 'customRoleId', type: 'INT' },
                { name: 'currentSkill', type: 'NVARCHAR(MAX) DEFAULT \'{}\'' },
                { name: 'currentEffeciency', type: 'FLOAT DEFAULT 0' },
                { name: 'skillEffeciency', type: 'NVARCHAR(MAX) DEFAULT \'{}\'' },
                { name: 'ojt', type: 'NVARCHAR(MAX) DEFAULT \'[]\'' },
                { name: 'stations', type: 'NVARCHAR(MAX) DEFAULT \'[]\'' },
                { name: 'sections', type: 'NVARCHAR(MAX) DEFAULT \'[]\'' },
                { name: 'lines', type: 'NVARCHAR(MAX) DEFAULT \'[]\'' },
                { name: 'subSections', type: 'NVARCHAR(MAX) DEFAULT \'[]\'' },
                { name: 'expectedHandover', type: 'DATE NULL' },
                { name: 'contractorId', type: 'INT NULL' },
                { name: 'shiftSchedule', type: "NVARCHAR(MAX) DEFAULT '{}'" },
                { name: 'dojoShift', type: 'NVARCHAR(50) NULL' },
                { name: 'statusHistory', type: "NVARCHAR(MAX) DEFAULT '[]'" }
            ];

            for (const col of columnsToAdd) {
                await migrationHelper.ensureColumnExists('users', col.name, col.type);
            }

            // Create index for departmentId to optimize lookups
            try {
                const [existsDeptIdx] = await executeQuery("SELECT name FROM sys.indexes WHERE name = 'idx_users_departmentId'");
                if (existsDeptIdx.length === 0) {
                    await executeQuery("CREATE INDEX idx_users_departmentId ON users(departmentId)");
                }
            } catch (err) {
                console.error("Migration error for departmentId index:", err);
            }

            // Create index for empId to optimize lookups and joins
            try {
                const [existsEmpIdIdx] = await executeQuery("SELECT name FROM sys.indexes WHERE name = 'idx_users_empId' AND object_id = OBJECT_ID('users')");
                if (existsEmpIdIdx.length === 0) {
                    await executeQuery("CREATE INDEX idx_users_empId ON users(empId)");
                }
            } catch (err) {
                console.error("Migration error for empId index:", err);
            }

            // Create index for userName/email to optimize login lookups (User.findOne by
            // userName/email was doing a full table scan on every login attempt).
            try {
                const [existsUserNameIdx] = await executeQuery("SELECT name FROM sys.indexes WHERE name = 'idx_users_userName' AND object_id = OBJECT_ID('users')");
                if (existsUserNameIdx.length === 0) {
                    await executeQuery("CREATE INDEX idx_users_userName ON users(userName)");
                }
            } catch (err) {
                console.error("Migration error for userName index:", err);
            }

            try {
                const [existsEmailIdx] = await executeQuery("SELECT name FROM sys.indexes WHERE name = 'idx_users_email' AND object_id = OBJECT_ID('users')");
                if (existsEmailIdx.length === 0) {
                    await executeQuery("CREATE INDEX idx_users_email ON users(email)");
                }
            } catch (err) {
                console.error("Migration error for email index:", err);
            }

            // Create index on the legacy string 'department' column and a covering composite
            // index so the "(departmentId = ? OR department = ? OR department = ?) AND isDeleted
            // ... AND isEmployee ..." lookups used by department.controller.js (studentCount /
            // students preview) can use an index seek instead of a full table scan.
            try {
                const [existsDeptStrIdx] = await executeQuery("SELECT name FROM sys.indexes WHERE name = 'idx_users_department_str' AND object_id = OBJECT_ID('users')");
                if (existsDeptStrIdx.length === 0) {
                    await executeQuery("CREATE INDEX idx_users_department_str ON users(department)");
                }
            } catch (err) {
                console.error("Migration error for department (string) index:", err);
            }

            try {
                const [existsDeptLookupIdx] = await executeQuery("SELECT name FROM sys.indexes WHERE name = 'idx_users_dept_lookup' AND object_id = OBJECT_ID('users')");
                if (existsDeptLookupIdx.length === 0) {
                    await executeQuery(`
                        CREATE INDEX idx_users_dept_lookup ON users(departmentId, isEmployee, isDeleted)
                        INCLUDE (id, fullName, email, slug, createdAt, avatar, userName, empId, currentLevel, status, isTrainer, customRoleId, department)
                    `);
                }
            } catch (err) {
                console.error("Migration error for dept lookup composite index:", err);
            }

            // Additional indexes to speed up the list endpoints (getAllUsers/getAllStudents/
            // getAllMentors/getAllSupervisors/getAllIncharges in user.controller.js), which
            // filter/sort on these columns on every page load.
            const additionalIndexes = [
                // Status filtering/exclusion (`u.status = ?`, `status != 'LEFT'`) used in every list endpoint.
                { name: 'idx_users_status', ddl: 'CREATE INDEX idx_users_status ON users(status)' },
                // Direct `u.stationId IN (...)` filters plus the station-name correlated lookup.
                { name: 'idx_users_stationId', ddl: 'CREATE INDEX idx_users_stationId ON users(stationId)' },
                // Supports the default `ORDER BY u.createdAt DESC ... OFFSET/FETCH` pagination.
                { name: 'idx_users_createdAt', ddl: 'CREATE INDEX idx_users_createdAt ON users(createdAt DESC)' },
                // Parity with the existing departmentId index; used by temporary-user target-hierarchy
                // resolution and direct filters.
                { name: 'idx_users_lineId', ddl: 'CREATE INDEX idx_users_lineId ON users(lineId)' },
                { name: 'idx_users_subSectionId', ddl: 'CREATE INDEX idx_users_subSectionId ON users(subSectionId)' },
                // Drives the contractor-name correlated lookup.
                { name: 'idx_users_contractorId', ddl: 'CREATE INDEX idx_users_contractorId ON users(contractorId)' },
                // Composite covering the near-universal base predicate present in essentially every
                // list query, so SQL Server can narrow the row set before any correlated join work.
                { name: 'idx_users_scope', ddl: 'CREATE INDEX idx_users_scope ON users(isDeleted, isTemporary, isEmployee, isTrainer)' },
            ];
            for (const idx of additionalIndexes) {
                try {
                    const [existsIdx] = await executeQuery(`SELECT name FROM sys.indexes WHERE name = '${idx.name}' AND object_id = OBJECT_ID('users')`);
                    if (existsIdx.length === 0) {
                        await executeQuery(idx.ddl);
                    }
                } catch (err) {
                    console.error(`Migration error for ${idx.name} index:`, err);
                }
            }

            // Ensure phoneNumber is nullable and has no unique constraint (duplicates are allowed)
            try {
                // 1. Drop existing unique indexes/constraints on phoneNumber first
                const [idxRows] = await executeQuery(`
                    SELECT i.name, i.is_unique_constraint
                    FROM sys.indexes i
                    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    WHERE i.object_id = OBJECT_ID('users') 
                    AND i.name IS NOT NULL
                    AND i.name NOT LIKE 'PK_%'
                    AND c.name = 'phoneNumber'
                `);

                for (const row of idxRows) {
                    try {
                        if (row.is_unique_constraint) {
                            await executeQuery(`ALTER TABLE [users] DROP CONSTRAINT [${row.name}]`);
                        } else {
                            await executeQuery(`DROP INDEX [${row.name}] ON [users]`);
                        }
                    } catch (e) {
                        console.error(`Failed to drop dependency ${row.name}:`, e.message);
                    }
                }

                // Explicitly drop any remaining index or statistics with the problematic name
                await executeQuery(`
                    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_users_phoneNumber_Filtered' AND object_id = OBJECT_ID('users'))
                        DROP INDEX UQ_users_phoneNumber_Filtered ON users;
                    IF EXISTS (SELECT * FROM sys.stats WHERE name = 'UQ_users_phoneNumber_Filtered' AND object_id = OBJECT_ID('users'))
                        DROP STATISTICS users.UQ_users_phoneNumber_Filtered;
                    IF EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_users_phoneNumber_Filtered' AND parent_object_id = OBJECT_ID('users') AND type = 'UQ')
                        ALTER TABLE users DROP CONSTRAINT UQ_users_phoneNumber_Filtered;
                    IF EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_users_phoneNumber' AND parent_object_id = OBJECT_ID('users') AND type = 'UQ')
                        ALTER TABLE users DROP CONSTRAINT UQ_users_phoneNumber;
                `);

                // 2. Make column nullable
                await executeQuery("ALTER TABLE users ALTER COLUMN phoneNumber NVARCHAR(50) NULL");
            } catch (err) {
                console.error("Migration error for phoneNumber:", err);
            }

            // Ensure idCard has a filtered unique index (duplicates are no longer allowed for phoneNumber's
            // former role — idCard is now the unique identifier instead)
            try {
                // Existing data may contain duplicate idCard values; null out all but the
                // most recently updated record for each duplicate so the unique index can be created
                // without deleting any user records.
                await executeQuery(`
                    WITH CTE AS (
                        SELECT id,
                               ROW_NUMBER() OVER (PARTITION BY idCard ORDER BY updatedAt DESC, id DESC) as rn
                        FROM users
                        WHERE idCard IS NOT NULL
                    )
                    UPDATE users
                    SET idCard = NULL
                    WHERE id IN (SELECT id FROM CTE WHERE rn > 1);
                `);

                const [existsIdCardFiltered] = await executeQuery("SELECT name FROM sys.indexes WHERE name = 'UQ_users_idCard_Filtered'");
                if (existsIdCardFiltered.length === 0) {
                    await executeQuery("CREATE UNIQUE INDEX UQ_users_idCard_Filtered ON users(idCard) WHERE idCard IS NOT NULL");
                }
            } catch (err) {
                console.error("Migration error for idCard unique index:", err);
            }

            // Ensure email is not unique
            try {
                // Find all unique indexes/constraints on email column
                const [emailIdxRows] = await executeQuery(`
                    SELECT i.name 
                    FROM sys.indexes i
                    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    WHERE i.object_id = OBJECT_ID('users') 
                    AND i.is_unique = 1
                    AND i.name IS NOT NULL
                    AND i.name NOT LIKE 'PK_%'
                    AND c.name = 'email'
                `);

                for (const row of emailIdxRows) {
                    try {
                        logger.info(`Migration: Dropping unique constraint/index '${row.name}' on users(email)...`);
                        await executeQuery(`DROP INDEX [${row.name}] ON [users]`);
                    } catch (e) {
                        try {
                            await executeQuery(`ALTER TABLE [users] DROP CONSTRAINT [${row.name}]`);
                        } catch (e2) {
                            console.error(`Failed to drop email constraint/index ${row.name}:`, e2.message);
                        }
                    }
                }
            } catch (err) {
                console.error("Migration error for email uniqueness:", err);
            }

            // Target Assignment Columns for Temporary Users
            await migrationHelper.ensureColumnExists('users', 'targetDeptId', 'INT NULL');
            await migrationHelper.ensureColumnExists('users', 'targetSectionId', 'INT NULL');
            await migrationHelper.ensureColumnExists('users', 'targetLineId', 'INT NULL');
            await migrationHelper.ensureColumnExists('users', 'targetSubSectionId', 'INT NULL');
            await migrationHelper.ensureColumnExists('users', 'targetStationId', 'INT NULL');

            // Ensure email is nullable
            try {
                await executeQuery("ALTER TABLE users ALTER COLUMN email NVARCHAR(255) NULL");
            } catch (err) {
                console.error("Migration error making email nullable:", err);
            }

            // One-time data migration for currentSkill: convert stationId to subSectionId
            try {
                const [users] = await executeQuery("SELECT id, currentSkill FROM users WHERE currentSkill IS NOT NULL AND currentSkill != '{}'");
                const [machines] = await executeQuery("SELECT id, subSectionId FROM [machines]");
                
                const stationToSubSection = {};
                machines.forEach(m => {
                    stationToSubSection[String(m.id)] = String(m.subSectionId);
                });

                for (const u of users) {
                    let skillMap = {};
                    try {
                        skillMap = typeof u.currentSkill === 'string' ? JSON.parse(u.currentSkill) : u.currentSkill;
                    } catch (e) {
                        continue;
                    }

                    if (!skillMap || typeof skillMap !== 'object') continue;

                    let migrated = false;
                    const newSkillMap = {};
                    for (const [key, val] of Object.entries(skillMap)) {
                        if (stationToSubSection[key]) {
                            const subSecId = stationToSubSection[key];
                            newSkillMap[subSecId] = val;
                            migrated = true;
                        } else {
                            newSkillMap[key] = val;
                        }
                    }

                    if (migrated) {
                        await executeQuery("UPDATE users SET currentSkill = ? WHERE id = ?", [JSON.stringify(newSkillMap), u.id]);
                    }
                }
            } catch (migrationErr) {
                console.error("Error during currentSkill schema migration:", migrationErr);
            }

            // One-time backfill: derive hierarchy reference IDs (departmentId, sectionId,
            // lineId, subSectionId, stationId) for users that still have them NULL.
            // Step 1 trusts the already-resolved IDs stored in the JSON array columns.
            // Step 2 performs a self-healing walk-up (if a child ID is set, resolve parent IDs based on master associations).
            // Step 3 falls back to matching raw text strings ignoring hyphens, spaces, and casing.
            try {
                // 1. Array ID check
                await executeQuery(`
                    UPDATE u SET u.departmentId = TRY_CAST(dep.value AS INT)
                    FROM users u OUTER APPLY (SELECT TOP 1 value FROM OPENJSON(u.departments) WHERE [key] = '0') dep
                    WHERE u.departmentId IS NULL AND u.departments IS NOT NULL AND ISJSON(u.departments) = 1
                `);
                await executeQuery(`
                    UPDATE u SET u.sectionId = TRY_CAST(sec.value AS INT)
                    FROM users u OUTER APPLY (SELECT TOP 1 value FROM OPENJSON(u.sections) WHERE [key] = '0') sec
                    WHERE u.sectionId IS NULL AND u.sections IS NOT NULL AND ISJSON(u.sections) = 1
                `);
                await executeQuery(`
                    UPDATE u SET u.lineId = TRY_CAST(ln.value AS INT)
                    FROM users u OUTER APPLY (SELECT TOP 1 value FROM OPENJSON(u.lines) WHERE [key] = '0') ln
                    WHERE u.lineId IS NULL AND u.lines IS NOT NULL AND ISJSON(u.lines) = 1
                `);
                await executeQuery(`
                    UPDATE u SET u.subSectionId = TRY_CAST(ss.value AS INT)
                    FROM users u OUTER APPLY (SELECT TOP 1 value FROM OPENJSON(u.subSections) WHERE [key] = '0') ss
                    WHERE u.subSectionId IS NULL AND u.subSections IS NOT NULL AND ISJSON(u.subSections) = 1
                `);
                await executeQuery(`
                    UPDATE u SET u.stationId = TRY_CAST(st.value AS INT)
                    FROM users u OUTER APPLY (SELECT TOP 1 value FROM OPENJSON(u.stations) WHERE [key] = '0') st
                    WHERE u.stationId IS NULL AND u.stations IS NOT NULL AND ISJSON(u.stations) = 1
                `);

                // 2. Self-healing walk-ups from child references
                // 2a. Walk up from stationId
                await executeQuery(`
                    UPDATE u SET 
                        u.subSectionId = COALESCE(u.subSectionId, m.subSectionId),
                        u.lineId = COALESCE(u.lineId, ss.lineId),
                        u.sectionId = COALESCE(u.sectionId, l.sectionId),
                        u.departmentId = COALESCE(u.departmentId, s.departmentId)
                    FROM users u
                    JOIN machines m ON u.stationId = m.id
                    LEFT JOIN sub_sections ss ON m.subSectionId = ss.id
                    LEFT JOIN [lines] l ON ss.lineId = l.id
                    LEFT JOIN [sections] s ON l.sectionId = s.id
                    WHERE u.stationId IS NOT NULL
                `);
                // 2b. Walk up from subSectionId
                await executeQuery(`
                    UPDATE u SET 
                        u.lineId = COALESCE(u.lineId, ss.lineId),
                        u.sectionId = COALESCE(u.sectionId, l.sectionId),
                        u.departmentId = COALESCE(u.departmentId, s.departmentId)
                    FROM users u
                    JOIN sub_sections ss ON u.subSectionId = ss.id
                    LEFT JOIN [lines] l ON ss.lineId = l.id
                    LEFT JOIN [sections] s ON l.sectionId = s.id
                    WHERE u.subSectionId IS NOT NULL
                `);
                // 2c. Walk up from lineId
                await executeQuery(`
                    UPDATE u SET 
                        u.sectionId = COALESCE(u.sectionId, l.sectionId),
                        u.departmentId = COALESCE(u.departmentId, s.departmentId)
                    FROM users u
                    JOIN [lines] l ON u.lineId = l.id
                    LEFT JOIN [sections] s ON l.sectionId = s.id
                    WHERE u.lineId IS NOT NULL
                `);
                // 2d. Walk up from sectionId
                await executeQuery(`
                    UPDATE u SET 
                        u.departmentId = COALESCE(u.departmentId, s.departmentId)
                    FROM users u
                    JOIN [sections] s ON u.sectionId = s.id
                    WHERE u.sectionId IS NOT NULL
                `);

                // 3. Name-based resolution using normalized strings (ignoring spaces, hyphens, and case)
                // 3a. Departments
                await executeQuery(`
                    UPDATE u SET u.departmentId = d.id
                    FROM users u
                    JOIN departments d ON 
                        LOWER(REPLACE(REPLACE(REPLACE(u.department, ' ', ''), '-', ''), '_', '')) = 
                        LOWER(REPLACE(REPLACE(REPLACE(d.name, ' ', ''), '-', ''), '_', ''))
                    WHERE u.departmentId IS NULL AND u.department IS NOT NULL AND u.department != ''
                `);
                // 3b. Sections (uses departmentId scoping only if it was successfully resolved)
                await executeQuery(`
                    UPDATE u SET u.sectionId = s.id
                    FROM users u
                    JOIN [sections] s ON 
                        LOWER(REPLACE(REPLACE(REPLACE(u.section, ' ', ''), '-', ''), '_', '')) = 
                        LOWER(REPLACE(REPLACE(REPLACE(s.name, ' ', ''), '-', ''), '_', ''))
                        AND (u.departmentId IS NULL OR s.departmentId = u.departmentId)
                    WHERE u.sectionId IS NULL AND u.section IS NOT NULL AND u.section != ''
                `);
                // 3c. Lines (uses sectionId scoping only if it was successfully resolved)
                await executeQuery(`
                    UPDATE u SET u.lineId = l.id
                    FROM users u
                    JOIN [lines] l ON 
                        LOWER(REPLACE(REPLACE(REPLACE(u.line, ' ', ''), '-', ''), '_', '')) = 
                        LOWER(REPLACE(REPLACE(REPLACE(l.name, ' ', ''), '-', ''), '_', ''))
                        AND (u.sectionId IS NULL OR l.sectionId = u.sectionId)
                    WHERE u.lineId IS NULL AND u.line IS NOT NULL AND u.line != ''
                `);
                // 3d. SubSections (uses lineId scoping only if it was successfully resolved)
                await executeQuery(`
                    UPDATE u SET u.subSectionId = ss.id
                    FROM users u
                    JOIN sub_sections ss ON 
                        LOWER(REPLACE(REPLACE(REPLACE(u.sub_section, ' ', ''), '-', ''), '_', '')) = 
                        LOWER(REPLACE(REPLACE(REPLACE(ss.name, ' ', ''), '-', ''), '_', ''))
                        AND (u.lineId IS NULL OR ss.lineId = u.lineId)
                    WHERE u.subSectionId IS NULL AND u.sub_section IS NOT NULL AND u.sub_section != ''
                `);
                // 3e. Stations (uses subSectionId scoping only if it was successfully resolved)
                await executeQuery(`
                    UPDATE u SET u.stationId = m.id
                    FROM users u
                    JOIN machines m ON 
                        LOWER(REPLACE(REPLACE(REPLACE(u.stationNo, ' ', ''), '-', ''), '_', '')) = 
                        LOWER(REPLACE(REPLACE(REPLACE(m.name, ' ', ''), '-', ''), '_', ''))
                        AND (u.subSectionId IS NULL OR m.subSectionId = u.subSectionId)
                    WHERE u.stationId IS NULL AND u.stationNo IS NOT NULL AND u.stationNo != ''
                `);

                // 3f. Cascade NULLs down the hierarchy: if a parent is NULL, its children must be
                // NULL too. Run as separate sequential statements rather than one UPDATE with CASE
                // expressions -- SQL Server evaluates every SET expression in a single-table UPDATE
                // against the pre-update row image, so a CASE checking a column set earlier in the
                // same statement would still see its old value.
                await executeQuery(`
                    UPDATE users SET lineId = NULL, lines = '[]'
                    WHERE sectionId IS NULL AND lineId IS NOT NULL
                `);
                await executeQuery(`
                    UPDATE users SET subSectionId = NULL, subSections = '[]'
                    WHERE lineId IS NULL AND subSectionId IS NOT NULL
                `);
                await executeQuery(`
                    UPDATE users SET stationId = NULL, stations = '[]'
                    WHERE subSectionId IS NULL AND stationId IS NOT NULL
                `);
                await executeQuery(`
                    UPDATE users SET targetLineId = NULL
                    WHERE targetSectionId IS NULL AND targetLineId IS NOT NULL
                `);
                await executeQuery(`
                    UPDATE users SET targetSubSectionId = NULL
                    WHERE targetLineId IS NULL AND targetSubSectionId IS NOT NULL
                `);
                await executeQuery(`
                    UPDATE users SET targetStationId = NULL
                    WHERE targetSubSectionId IS NULL AND targetStationId IS NOT NULL
                `);

                // 4. Sync Array Columns from ID Columns (Forward sync)
                await executeQuery(`
                    UPDATE users SET departments = CONCAT('[', departmentId, ']')
                    WHERE departmentId IS NOT NULL AND (departments IS NULL OR departments = '[]' OR departments = '');
                `);
                await executeQuery(`
                    UPDATE users SET sections = CONCAT('[', sectionId, ']')
                    WHERE sectionId IS NOT NULL AND (sections IS NULL OR sections = '[]' OR sections = '');
                `);
                await executeQuery(`
                    UPDATE users SET lines = CONCAT('[', lineId, ']')
                    WHERE lineId IS NOT NULL AND (lines IS NULL OR lines = '[]' OR lines = '');
                `);
                await executeQuery(`
                    UPDATE users SET subSections = CONCAT('[', subSectionId, ']')
                    WHERE subSectionId IS NOT NULL AND (subSections IS NULL OR subSections = '[]' OR subSections = '');
                `);
                await executeQuery(`
                    UPDATE users SET stations = CONCAT('[', stationId, ']')
                    WHERE stationId IS NOT NULL AND (stations IS NULL OR stations = '[]' OR stations = '');
                `);

                // 5. Sync legacy string columns (department, section, line, sub_section, stationNo)
                // from their resolved ID columns, and clear them out when the ID is NULL, so
                // consumers that still read the string columns never see stale/obsolete values.
                await executeQuery(`
                    UPDATE u SET u.department = d.name
                    FROM users u JOIN departments d ON u.departmentId = d.id
                    WHERE u.departmentId IS NOT NULL
                `);
                await executeQuery(`UPDATE users SET department = NULL WHERE departmentId IS NULL`);

                await executeQuery(`
                    UPDATE u SET u.section = s.name
                    FROM users u JOIN [sections] s ON u.sectionId = s.id
                    WHERE u.sectionId IS NOT NULL
                `);
                await executeQuery(`UPDATE users SET section = NULL WHERE sectionId IS NULL`);

                await executeQuery(`
                    UPDATE u SET u.line = l.name
                    FROM users u JOIN [lines] l ON u.lineId = l.id
                    WHERE u.lineId IS NOT NULL
                `);
                await executeQuery(`UPDATE users SET line = NULL WHERE lineId IS NULL`);

                await executeQuery(`
                    UPDATE u SET u.sub_section = ss.name
                    FROM users u JOIN sub_sections ss ON u.subSectionId = ss.id
                    WHERE u.subSectionId IS NOT NULL
                `);
                await executeQuery(`UPDATE users SET sub_section = NULL WHERE subSectionId IS NULL`);

                await executeQuery(`
                    UPDATE u SET u.stationNo = m.name
                    FROM users u JOIN machines m ON u.stationId = m.id
                    WHERE u.stationId IS NOT NULL
                `);
                await executeQuery(`UPDATE users SET stationNo = NULL WHERE stationId IS NULL`);
            } catch (backfillErr) {
                console.error("Error during hierarchy reference ID backfill migration:", backfillErr);
            }

            // One-time backfill: seed a genesis statusHistory entry (from the row's current
            // status/joiningDate/leavingDate) for users whose history is still the column
            // default '[]', so the timeline isn't empty for everyone who existed before this
            // column was introduced.
            try {
                const [rows] = await executeQuery(
                    "SELECT id, status, joiningDate, leavingDate, createdAt FROM users WHERE statusHistory IS NULL OR statusHistory = '[]'"
                );
                for (const row of rows) {
                    const entry = JSON.stringify({
                        status: row.status ?? null,
                        joiningDate: row.joiningDate ?? null,
                        leavingDate: row.leavingDate ?? null,
                        changedBy: null,
                        changedByName: "System (migration)",
                        changedAt: (row.createdAt ? new Date(row.createdAt) : new Date()).toISOString(),
                    });
                    await executeQuery("UPDATE users SET statusHistory = ? WHERE id = ?", [`[${entry}]`, row.id]);
                }
            } catch (statusHistoryBackfillErr) {
                console.error("Error during statusHistory genesis backfill migration:", statusHistoryBackfillErr);
            }

            console.log("Users table verified/created in MSSQL.");
        } catch (error) {
            console.error("Error creating users table in MSSQL:", error);
        }
    }

    static async create(userData) {
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }

        // Generate unique slug
        let baseSlug = slugify(userData.userName || userData.fullName);
        let slug = baseSlug;
        let suffix = 1;
        while (true) {
            const [rows] = await executeQuery("SELECT id FROM users WHERE slug = ?", [slug]);
            if (rows.length === 0) break;
            suffix++;
            slug = `${baseSlug}-${suffix}`;
        }
        userData.slug = slug;

        const fields = [
            "fullName", "userName", "slug", "email", "phoneNumber", "password",
            "avatar", "refreshToken", "role", "currentLevel", "currentSkill", "currentEffeciency", "skillEffeciency", "status", "isVerified",
            "enrolledCourses", "createdCourses", "lastLogin", "loginHistory",
            "isDeleted", "department", "sub_section", "departments", "stations", "sections", "lines", "subSections", "unit", "empId", "isEmployee",
            "isAdmin", "isTrainer", "shift", "idCard", "privileges", "joiningDate",
            "leavingDate", "isTemporary", "sectionId", "subSectionId", "lineId", "stationId", "departmentId",
            "targetDeptId", "targetSectionId", "targetLineId", "targetSubSectionId", "targetStationId",
            "fatherHusbandName", "gender", "dob", "education", "district", "state", "pin", "busRoute", "reasonOfLeaving", "contractor", "mentor", "designation",
            "supervisor", "incharge", "section", "line", "stationNo", "isMentor", "isSupervisor", "isIncharge", "mentorLimit", "customRoleId", "createdAt", "ojt", "expectedHandover", "shiftSchedule", "contractorId", "dojoShift", "statusHistory"
        ];

        // Apply defaults if fields are missing in userData
        const dataToInsert = { ...userData };
        if (!dataToInsert.createdAt) dataToInsert.createdAt = new Date();
        if (dataToInsert.status === undefined) dataToInsert.status = 'PRESENT';
        dataToInsert.statusHistory = `[${buildStatusHistoryEntry({
            status: dataToInsert.status,
            joiningDate: dataToInsert.joiningDate,
            leavingDate: dataToInsert.leavingDate,
            changedBy: dataToInsert.createdBy,
            changedByName: dataToInsert.createdByName,
        })}]`;
        if (dataToInsert.role === undefined) dataToInsert.role = 'STUDENT';
        if (dataToInsert.isDeleted === undefined) dataToInsert.isDeleted = 0;
        if (dataToInsert.isVerified === undefined) dataToInsert.isVerified = 0;
        if (dataToInsert.isTemporary === undefined) dataToInsert.isTemporary = 0;
        // if (dataToInsert.currentLevel === undefined || dataToInsert.currentLevel === null) dataToInsert.currentLevel = 'L1';

        if (dataToInsert.stations && Array.isArray(dataToInsert.stations) && dataToInsert.stations.length > 0) {
            dataToInsert.stationId = parseInt(dataToInsert.stations[0]);
        }
        if (dataToInsert.departments && Array.isArray(dataToInsert.departments) && dataToInsert.departments.length > 0) {
            dataToInsert.departmentId = parseInt(dataToInsert.departments[0]);
        }
        if (dataToInsert.sections && Array.isArray(dataToInsert.sections) && dataToInsert.sections.length > 0) {
            dataToInsert.sectionId = dataToInsert.sectionId || parseInt(dataToInsert.sections[0]);
        }
        if (dataToInsert.lines && Array.isArray(dataToInsert.lines) && dataToInsert.lines.length > 0) {
            dataToInsert.lineId = dataToInsert.lineId || parseInt(dataToInsert.lines[0]);
        }
        if (dataToInsert.subSections && Array.isArray(dataToInsert.subSections) && dataToInsert.subSections.length > 0) {
            dataToInsert.subSectionId = dataToInsert.subSectionId || parseInt(dataToInsert.subSections[0]);
        }

        applyHierarchyCascade(dataToInsert);
        await resolveHierarchyNames(dataToInsert);

        const values = fields.map(field => {
            let val = dataToInsert[field];
            if (['avatar', 'enrolledCourses', 'createdCourses', 'loginHistory', 'departments', 'stations', 'sections', 'lines', 'subSections', 'currentSkill', 'skillEffeciency', 'ojt', 'shiftSchedule'].includes(field)) {
                return JSON.stringify(val || (['avatar', 'shiftSchedule', 'currentSkill', 'skillEffeciency'].includes(field) ? {} : []));
            }
            if (val === undefined || val === "") return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO users (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return User.findById(result[0]?.id);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        // Defensive check: If searching by numeric ID, ensure it's actually numeric
        if (query.id && isNaN(query.id)) return null;

        const whereClause = keys.map(key => `u.${key === 'id' ? 'id' : key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);
        const hasStatusFilter = keys.includes('status') || keys.includes('id') || keys.includes('_id');
        const leftExclusion = hasStatusFilter ? '' : " AND u.status NOT IN ('LEFT', 'SUSPENDED', 'BANNED')";

        const sql = `
            SELECT u.*,
                   d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName,
                   COALESCE(u.departmentId, s_res.sDeptId, l_res.lDeptId) as resolvedDeptId,
                   COALESCE(u.sectionId, l_res.lSectionId) as resolvedSectionId,
                   COALESCE(u.lineId, ss_res.ssLineId) as resolvedLineId,
                   cr.name as cr_name, cr.description as cr_description,
                   cr.color as cr_color, cr.allowedPages as cr_allowedPages,
                   cr.permissions as cr_permissions, cr.generateManagementPage as cr_generateManagementPage,
                   cr.targetLayout as cr_targetLayout
            FROM users u
            OUTER APPLY (
                SELECT TOP 1 ss.name as subSectionName, ss.lineId as ssLineId
                FROM sub_sections ss WHERE ss.id = u.subSectionId
            ) ss_res
            OUTER APPLY (
                SELECT TOP 1 l.name as lineName, l.sectionId as lSectionId, l.department as lDeptId
                FROM [lines] l WHERE l.id = COALESCE(u.lineId, ss_res.ssLineId)
            ) l_res
            OUTER APPLY (
                SELECT TOP 1 s.name as sectionName, s.departmentId as sDeptId, s.id as sectionId
                FROM [sections] s WHERE s.id = COALESCE(u.sectionId, l_res.lSectionId)
            ) s_res
            OUTER APPLY (
                SELECT TOP 1 d.id, d.name as deptName
                FROM departments d
                WHERE d.id = COALESCE(u.departmentId, s_res.sDeptId, l_res.lDeptId)
            ) d
            OUTER APPLY (
                SELECT TOP 1 name as stationName FROM machines WHERE id = u.stationId
            ) st
            LEFT JOIN custom_roles cr ON u.customRoleId = cr.id
            WHERE ${whereClause}${leftExclusion}
        `;

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM (${sql}) t`, values);
        if (rows.length === 0) return null;

        const userData = rows[0];
        const user = new User(userData);

        if (userData.customRoleId) {
            // Helper to parse safely since some SQL drivers may automatically parse JSON
            const safeParse = (data) => {
                if (typeof data === 'string') {
                    try { return JSON.parse(data || "[]"); } catch (e) { return []; }
                }
                return data || [];
            };

            const rawPermissions = safeParse(userData.cr_permissions);
            const rawPages = safeParse(userData.cr_allowedPages);

            user.customRole = {
                id: userData.customRoleId,
                name: userData.cr_name,
                description: userData.cr_description,
                color: userData.cr_color,
                allowedPages: Array.isArray(rawPages) ? rawPages : [],
                permissions: Array.isArray(rawPermissions)
                    ? rawPermissions.map(p => typeof p === 'object' && p !== null ? (p.id || p) : p)
                    : [],
                generateManagementPage: !!userData.cr_generateManagementPage,
                targetLayout: userData.cr_targetLayout
            };
        }
        return user;
    }

    // Lightweight lookup used by verifyJWT: only the base users columns plus a fast
    // LEFT JOIN on departments for deptName. Skips the OUTER APPLY hierarchy resolution
    // and the assignments FOR JSON PATH subquery that findById() needs for full profiles.
    static async findByIdLight(id) {
        if (!id || isNaN(id)) return null;
        const query = `
            SELECT u.*, d.name as deptName
            FROM users u
            LEFT JOIN departments d ON d.id = u.departmentId
            WHERE u.id = ?
        `;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new User(rows[0]);
    }

    static async findById(id) {
        if (!id || isNaN(id)) return null;
        const query = `
            SELECT u.*,
                   d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName,
                   COALESCE(u.departmentId, s_res.sDeptId, l_res.lDeptId) as resolvedDeptId,
                   COALESCE(u.sectionId, l_res.lSectionId) as resolvedSectionId,
                   COALESCE(u.lineId, ss_res.ssLineId) as resolvedLineId,
                   cr.name as cr_name, cr.description as cr_description, 
                   cr.color as cr_color, cr.allowedPages as cr_allowedPages,
                   cr.permissions as cr_permissions, cr.generateManagementPage as cr_generateManagementPage,
                   cr.targetLayout as cr_targetLayout,
                    (SELECT 
                         data.machineId, data.stationName, 
                         data.subSectionId, data.subSectionName, 
                         data.lineId, data.lineName, 
                         data.sectionId, data.sectionName, 
                         data.departmentId, data.deptName,
                         data.assigned_at
                     FROM (
                        -- Current Primary Station from Users table
                        SELECT 
                            m.id as machineId, m.name as stationName, 
                            ss.id as subSectionId, ss.name as subSectionName, 
                            l.id as lineId, l.name as lineName, 
                            s.id as sectionId, s.name as sectionName, 
                            d.id as departmentId, d.name as deptName,
                            u.updatedAt as assigned_at
                        FROM users u2
                        JOIN machines m ON u2.stationId = m.id
                        LEFT JOIN sub_sections ss ON m.subSectionId = ss.id
                        LEFT JOIN [lines] l ON ss.lineId = l.id
                        LEFT JOIN [sections] s ON l.sectionId = s.id
                        LEFT JOIN departments d ON s.departmentId = d.id
                        WHERE u2.id = u.id AND u2.stationId IS NOT NULL

                        UNION ALL

                        -- Other Assignments from Junction Table
                        SELECT 
                            m.id as machineId, m.name as stationName, 
                            ss.id as subSectionId, ss.name as subSectionName, 
                            l.id as lineId, l.name as lineName, 
                            s.id as sectionId, s.name as sectionName, 
                            d.id as departmentId, d.name as deptName,
                            ma.assigned_at
                        FROM machine_assignments ma
                        JOIN machines m ON ma.machine_id = m.id
                        LEFT JOIN sub_sections ss ON m.subSectionId = ss.id
                        LEFT JOIN [lines] l ON ss.lineId = l.id
                        LEFT JOIN [sections] s ON l.sectionId = s.id
                        LEFT JOIN departments d ON s.departmentId = d.id
                        WHERE ma.user_id = u.id
                        -- Filter out the one already added if it's the same
                        AND NOT EXISTS (SELECT 1 FROM users u3 WHERE u3.id = u.id AND u3.stationId = ma.machine_id)
                     ) data
                     ORDER BY data.assigned_at ASC
                     FOR JSON PATH) as assignments
            FROM users u
            OUTER APPLY (
                SELECT TOP 1 ss.name as subSectionName, ss.lineId as ssLineId 
                FROM sub_sections ss WHERE ss.id = u.subSectionId
            ) ss_res
            OUTER APPLY (
                SELECT TOP 1 l.name as lineName, l.sectionId as lSectionId, l.department as lDeptId
                FROM [lines] l WHERE l.id = COALESCE(u.lineId, ss_res.ssLineId)
            ) l_res
            OUTER APPLY (
                SELECT TOP 1 s.name as sectionName, s.departmentId as sDeptId, s.id as sectionId
                FROM [sections] s WHERE s.id = COALESCE(u.sectionId, l_res.lSectionId)
            ) s_res
            OUTER APPLY (
                SELECT TOP 1 d.id, d.name as deptName
                FROM departments d 
                WHERE d.id = COALESCE(u.departmentId, s_res.sDeptId, l_res.lDeptId)
            ) d
            OUTER APPLY (
                SELECT TOP 1 name as stationName FROM machines WHERE id = u.stationId
            ) st
            LEFT JOIN custom_roles cr ON u.customRoleId = cr.id
            WHERE u.id = ?
        `;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;

        const userData = rows[0];
        const user = new User(userData);
        if (userData.customRoleId) {
            const safeParse = (data) => {
                if (typeof data === 'string') {
                    try { return JSON.parse(data || "[]"); } catch (e) { return []; }
                }
                return data || [];
            };

            const rawPermissions = safeParse(userData.cr_permissions);
            const rawPages = safeParse(userData.cr_allowedPages);

            user.customRole = {
                id: userData.customRoleId,
                name: userData.cr_name,
                description: userData.cr_description,
                color: userData.cr_color,
                allowedPages: Array.isArray(rawPages) ? rawPages : [],
                permissions: Array.isArray(rawPermissions)
                    ? rawPermissions.map(p => typeof p === 'object' && p !== null ? (p.id || p) : p)
                    : [],
                generateManagementPage: !!userData.cr_generateManagementPage,
                targetLayout: userData.cr_targetLayout
            };
        }
        return user;
    }

    // Static compatibility alias for Mongoose's findById
    static async findOneById(id) {
        return this.findById(id);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM users";
        let values = [];
        const whereClauses = [];

        for (const key of keys) {
            const value = query[key];
            const sqlKey = key === '_id' ? 'id' : key;

            // Check if value is an object with $in operator
            if (value && typeof value === 'object' && value.$in && Array.isArray(value.$in)) {
                const validInValues = sqlKey === 'id' ? value.$in.filter(v => !isNaN(v)) : value.$in;
                if (validInValues.length > 0) {
                    const placeholders = validInValues.map(() => '?').join(', ');
                    whereClauses.push(`${sqlKey} IN (${placeholders})`);
                    values.push(...validInValues);
                } else {
                    whereClauses.push('1=0');
                }
            } else if (value === null) {
                whereClauses.push(`${sqlKey} IS NULL`);
            } else {
                // Defensive check for numeric ID
                if (sqlKey === 'id' && isNaN(value)) {
                    whereClauses.push('1=0');
                } else {
                    whereClauses.push(`${sqlKey} = ?`);
                    values.push(value);
                }
            }
        }

        // Auto-exclude LEFT and legacy inactive users unless caller explicitly filters by status or queries by specific ID
        if (!keys.includes('status') && !keys.includes('id') && !keys.includes('_id')) {
            whereClauses.push("status NOT IN ('LEFT', 'SUSPENDED', 'BANNED')");
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(" AND ")}`;
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new User(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM users";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        // Auto-exclude LEFT and legacy inactive users unless caller explicitly filters by status or queries by specific ID
        if (!keys.includes('status') && !keys.includes('id') && !keys.includes('_id')) {
            sql += (keys.length > 0 ? ' AND ' : ' WHERE ') + "status NOT IN ('LEFT', 'SUSPENDED', 'BANNED')";
        }

        const [rows] = await executeQuery(sql, values);
        return rows[0].count;
    }

    static async exists(query) {
        const user = await this.findOne(query);
        return !!user;
    }

    async save() {
        // Hash password if modified
        if (this.password && this.password !== this._originalPassword) {
            this.password = await bcrypt.hash(this.password, 10);
        }

        const fields = [
            "fullName", "userName", "slug", "email", "phoneNumber", "password",
            "avatar", "refreshToken", "role", "currentLevel", "currentSkill", "currentEffeciency", "skillEffeciency", "status", "isVerified",
            "enrolledCourses", "createdCourses", "lastLogin", "loginHistory",
            "isDeleted", "department", "sub_section", "departments", "stations", "sections", "lines", "subSections", "unit", "empId", "isEmployee",
            "isAdmin", "isTrainer", "shift", "idCard", "privileges", "joiningDate",
            "leavingDate", "isTemporary", "sectionId", "subSectionId", "lineId", "stationId", "departmentId",
            "targetDeptId", "targetSectionId", "targetLineId", "targetSubSectionId", "targetStationId",
            "fatherHusbandName", "gender", "dob", "education", "district", "state", "pin", "busRoute", "reasonOfLeaving", "contractor", "mentor", "designation",
            "supervisor", "incharge", "section", "line", "stationNo", "isMentor", "isSupervisor", "isIncharge", "mentorLimit", "customRoleId", "resetPasswordToken", "resetPasswordExpiry", "ojt", "expectedHandover", "shiftSchedule", "dojoShift"
        ];

        if (this.stations && Array.isArray(this.stations) && this.stations.length > 0) {
            this.stationId = parseInt(this.stations[0]);
        }
        if (this.departments && Array.isArray(this.departments) && this.departments.length > 0) {
            this.departmentId = parseInt(this.departments[0]);
        }
        if (this.sections && Array.isArray(this.sections) && this.sections.length > 0) {
            this.sectionId = this.sectionId || parseInt(this.sections[0]);
        }
        if (this.lines && Array.isArray(this.lines) && this.lines.length > 0) {
            this.lineId = this.lineId || parseInt(this.lines[0]);
        }
        if (this.subSections && Array.isArray(this.subSections) && this.subSections.length > 0) {
            this.subSectionId = this.subSectionId || parseInt(this.subSections[0]);
        }

        // Skip the cascade + 5-query name resolution unless a hierarchy ID actually
        // changed since load -- these run on every save() (login/logout/refresh all
        // call save() just to persist refreshToken) and were a major source of
        // needless DB round-trips under load.
        const original = this._originalHierarchyIds || {};
        const hierarchyChanged = ["departmentId", "sectionId", "lineId", "subSectionId", "stationId"]
            .some(key => (this[key] ?? null) !== (original[key] ?? null));

        if (hierarchyChanged) {
            applyHierarchyCascade(this);
            await resolveHierarchyNames(this);
        }

        // Only update fields that are defined on the instance
        const definedFields = fields.filter(field => this[field] !== undefined);
        const setClause = definedFields.map(field => `${field} = ?`).join(", ");
        const values = definedFields.map(field => {
            const val = this[field];
            if (['avatar', 'enrolledCourses', 'createdCourses', 'loginHistory', 'departments', 'stations', 'sections', 'lines', 'subSections', 'currentSkill', 'skillEffeciency', 'ojt', 'shiftSchedule'].includes(field)) {
                return typeof val === 'object' ? JSON.stringify(val) : val;
            }
            if (val instanceof Date) return val;
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE users SET ${setClause} WHERE id = ?`, values);

        this._originalPassword = this.password;
        this._originalHierarchyIds = {
            departmentId: this.departmentId,
            sectionId: this.sectionId,
            lineId: this.lineId,
            subSectionId: this.subSectionId,
            stationId: this.stationId,
        };
        return this;
    }

    async comparePassword(password) {
        return await bcrypt.compare(password, this.password);
    }

    generateAccessToken() {
        return jwt.sign({ id: this.id }, ENV.JWT_ACCESS_SECRET, {
            expiresIn: ENV.JWT_ACCESS_EXPIRES_IN,
        });
    }

    generateRefreshToken() {
        return jwt.sign({ id: this.id }, ENV.JWT_REFRESH_SECRET, {
            expiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
        });
    }

    async generatePasswordResetToken() {
        const resetToken = crypto.randomBytes(20).toString("hex");
        this.resetPasswordToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");
        this.resetPasswordExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
        // Note: Caller is expected to call save() after this, similar to Mongoose
        return resetToken;
    }

    static async updateMany(filter, update) {
        // Construct WHERE clause
        const keys = Object.keys(filter).filter(key => filter[key] !== undefined);
        let whereSql = "";
        let values = [];

        if (keys.length > 0) {
            const whereClauses = [];
            for (const key of keys) {
                const value = filter[key];
                if (value && typeof value === 'object' && value.$in && Array.isArray(value.$in)) {
                    if (value.$in.length > 0) {
                        const placeholders = value.$in.map(() => '?').join(', ');
                        const sqlKey = key === '_id' ? 'id' : key;
                        whereClauses.push(`${sqlKey} IN (${placeholders})`);
                        values.push(...value.$in);
                    } else {
                        whereClauses.push('1=0');
                    }
                } else {
                    const sqlKey = key === '_id' ? 'id' : key;
                    whereClauses.push(`${sqlKey} = ?`);
                    values.push(value);
                }
            }
            if (whereClauses.length > 0) {
                whereSql = `WHERE ${whereClauses.join(" AND ")}`;
            }
        }

        // Construct SET clause
        // Handles $set and $addToSet (for departments array)
        let setClauses = [];

        // Handle $set
        if (update.$set) {
            const setKeys = Object.keys(update.$set);
            for (const key of setKeys) {
                const sqlKey = key === '_id' ? 'id' : key;
                setClauses.push(`${sqlKey} = ?`);
                values.push(update.$set[key]);
            }
        }

        // Handle specific $addToSet logic for 'departments' which is a JSON array column
        // This is a simplified implementation specifically for this use case
        // For a generic solution, we'd need to fetch, modify, and update loop, but that's complex for updateMany
        // Here we can use JSON_ARRAY_APPEND if supported or assume application logic is fine
        // Since MySQL JSON functions vary, and we are storing as TEXT likely based on save() implementation:
        // "departments" is TEXT. We can't easily do array append in pure SQL "UPDATE" for TEXT columns without concat hack.
        // Given complexity, and that bulk update is mostly for adding departmentId reference:
        // Let's rely on fetching and saving if complexity is high, OR for this specific 'departments' field,
        // we can try a hack if we know it is a JSON array string.

        // However, the controller used $addToSet: { departments: departmentId }
        // Let's implement a "best effort" for simple fields, but warn for complex operators
        // Or better: Re-implement controller to find -> loop -> save since our ORM is light.
        // BUT, user asked to fix `User.updateMany is not a function`.
        // So implementing it is the path forward.

        // For now, let's only support $set. The $addToSet in controller needs a workaround or we handle it here.
        // If we strictly follow the requested fix (implement updateMany), we should support what's called.
        // But implementing $addToSet for TEXT column in SQL updateMany is hard.

        // ALTERNATIVE: Implementing a Loop-Update inside updateMany
        // This simulates Mongoose behavior and is safer for our light ORM.

        // 1. Find all matching records
        const rows = await User.find(filter);

        // 2. Loop and Apply Updates
        const updatePromises = rows.map(async (user) => {
            // Apply $set
            if (update.$set) {
                Object.assign(user, update.$set);
            }

            // Apply $addToSet
            if (update.$addToSet) {
                for (const [key, val] of Object.entries(update.$addToSet)) {
                    let currentArr = user[key];
                    if (typeof currentArr === 'string') {
                        try { currentArr = JSON.parse(currentArr); } catch (e) { currentArr = []; }
                    }
                    if (!Array.isArray(currentArr)) {
                        currentArr = [];
                    }
                    // Check if exists
                    const exists = currentArr.some(existing => String(existing) === String(val));
                    if (!exists) {
                        currentArr.push(val);
                    }
                    user[key] = currentArr;
                }
            }

            // Save
            return user.save();
        });

        await Promise.all(updatePromises);
        return { modifiedCount: rows.length };
    }

    static async findByIdAndUpdate(id, update) {
        const user = await this.findById(id);
        if (!user) return null;

        // Simple implementation for $set
        if (update) {
            Object.assign(user, update);
            await user.save();
        }
        return user;
    }
}

// Initialize table asynchronously
// Not awaiting here to avoid blocking import, but errors will be logged if it fails
User.init().catch(err => console.error("Failed to initialize User table:", err));

export default User;