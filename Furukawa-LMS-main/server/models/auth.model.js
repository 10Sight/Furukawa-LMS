import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import ENV from "../configs/env.config.js";
import { slugify } from "../utils/slugify.js";

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
        this.currentLevel = data.currentLevel || "L1";
        this.status = data.status || "PRESENT";
        this.isVerified = !!data.isVerified;
        this.enrolledCourses = typeof data.enrolledCourses === 'string' ? JSON.parse(data.enrolledCourses) : (data.enrolledCourses || []);
        this.createdCourses = typeof data.createdCourses === 'string' ? JSON.parse(data.createdCourses) : (data.createdCourses || []);
        this.lastLogin = data.lastLogin ? new Date(data.lastLogin) : null;
        this.loginHistory = typeof data.loginHistory === 'string' ? JSON.parse(data.loginHistory) : (data.loginHistory || []);
        this.isDeleted = !!data.isDeleted;
        this.department = data.department;
        this.departments = typeof data.departments === 'string' ? JSON.parse(data.departments) : (data.departments || []);
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
        this.stationId = data.stationId || null;
        this.departmentId = data.resolvedDeptId || data.departmentId || null;
        this.fatherHusbandName = data.fatherHusbandName || null;
        this.gender = data.gender || null;
        this.dob = data.dob || null;
        this.education = data.education || null;
        this.district = data.district || null;
        this.state = data.state || null;
        this.pin = data.pin || null;
        this.busRoute = data.busRoute || null;
        this.reasonOfLeaving = data.reasonOfLeaving || null;
        this.mentor = data.mentor || null;
        this.designation = data.designation || null;
        this.supervisor = data.supervisor || null;
        this.incharge = data.incharge || null;
        this.isMentor = !!data.isMentor;
        this.isSupervisor = !!data.isSupervisor;
        this.isIncharge = !!data.isIncharge;
        this.customRoleId = data.customRoleId || null;
        this.customRole = data.customRole || null;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;

        // Internal tracking for password changes
        this._originalPassword = data.password;
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
                    email NVARCHAR(255) NOT NULL,
                    phoneNumber NVARCHAR(50) NULL,
                    password NVARCHAR(255) NOT NULL,
                    avatar NVARCHAR(MAX),
                    refreshToken NVARCHAR(MAX),
                    resetPasswordToken NVARCHAR(255),
                    resetPasswordExpiry DATETIME,
                    role NVARCHAR(50) DEFAULT 'STUDENT',
                    currentLevel NVARCHAR(50) DEFAULT 'L1',
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
                    departmentId INT,
                    fatherHusbandName NVARCHAR(255),
                    gender NVARCHAR(50),
                    dob NVARCHAR(50),
                    education NVARCHAR(MAX),
                    district NVARCHAR(255),
                    state NVARCHAR(255),
                    pin NVARCHAR(50),
                    busRoute NVARCHAR(255),
                    reasonOfLeaving NVARCHAR(MAX),
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
                { name: 'customRoleId', type: 'INT' }
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

            // Ensure phoneNumber is nullable and has filtered index
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
                `);
                
                try { await executeQuery("ALTER TABLE [users] DROP CONSTRAINT [UQ_users_phoneNumber]"); } catch (e) { }

                // 2. Make column nullable
                await executeQuery("ALTER TABLE users ALTER COLUMN phoneNumber NVARCHAR(50) NULL");

                // 3. Create/Recreate filtered unique index
                const [existsFiltered] = await executeQuery("SELECT name FROM sys.indexes WHERE name = 'UQ_users_phoneNumber_Filtered'");
                if (existsFiltered.length === 0) {
                    await executeQuery("CREATE UNIQUE INDEX UQ_users_phoneNumber_Filtered ON users(phoneNumber) WHERE phoneNumber IS NOT NULL");
                }
            } catch (err) {
                console.error("Migration error for phoneNumber:", err);
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
            "avatar", "refreshToken", "role", "currentLevel", "status", "isVerified",
            "enrolledCourses", "createdCourses", "lastLogin", "loginHistory",
            "isDeleted", "department", "sub_section", "departments", "unit", "empId", "isEmployee",
            "isAdmin", "isTrainer", "shift", "idCard", "privileges", "joiningDate",
            "leavingDate", "isTemporary", "sectionId", "subSectionId", "lineId", "stationId", "departmentId",
            "fatherHusbandName", "gender", "dob", "education", "district", "state", "pin", "busRoute", "reasonOfLeaving", "mentor", "designation",
            "supervisor", "incharge", "section", "line", "stationNo", "isMentor", "isSupervisor", "isIncharge", "customRoleId", "createdAt"
        ];

        // Apply defaults if fields are missing in userData
        const dataToInsert = { ...userData };
        if (!dataToInsert.createdAt) dataToInsert.createdAt = new Date();
        if (dataToInsert.status === undefined) dataToInsert.status = 'PRESENT';
        if (dataToInsert.role === undefined) dataToInsert.role = 'STUDENT';
        if (dataToInsert.isDeleted === undefined) dataToInsert.isDeleted = 0;
        if (dataToInsert.isVerified === undefined) dataToInsert.isVerified = 0;
        if (dataToInsert.isTemporary === undefined) dataToInsert.isTemporary = 0;
        if (dataToInsert.currentLevel === undefined || dataToInsert.currentLevel === null) dataToInsert.currentLevel = 'L1';

        const values = fields.map(field => {
            let val = dataToInsert[field];
            if (['avatar', 'enrolledCourses', 'createdCourses', 'loginHistory', 'departments'].includes(field)) {
                return JSON.stringify(val || (field === 'avatar' ? {} : []));
            }
            if (val === undefined) return null;
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
            WHERE ${whereClause}
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

        if (keys.length > 0) {
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

            if (whereClauses.length > 0) {
                sql += ` WHERE ${whereClauses.join(" AND ")}`;
            }
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
            "avatar", "refreshToken", "role", "currentLevel", "status", "isVerified",
            "enrolledCourses", "createdCourses", "lastLogin", "loginHistory",
            "isDeleted", "department", "sub_section", "departments", "unit", "empId", "isEmployee",
            "isAdmin", "isTrainer", "shift", "idCard", "privileges", "joiningDate",
            "leavingDate", "isTemporary", "sectionId", "subSectionId", "lineId", "stationId", "departmentId",
            "fatherHusbandName", "gender", "dob", "education", "district", "state", "pin", "busRoute", "reasonOfLeaving", "mentor", "designation",
            "supervisor", "incharge", "section", "line", "stationNo", "isMentor", "isSupervisor", "isIncharge", "customRoleId", "resetPasswordToken", "resetPasswordExpiry"
        ];

        // Only update fields that are defined on the instance
        const definedFields = fields.filter(field => this[field] !== undefined);
        const setClause = definedFields.map(field => `${field} = ?`).join(", ");
        const values = definedFields.map(field => {
            const val = this[field];
            if (['avatar', 'enrolledCourses', 'createdCourses', 'loginHistory', 'departments'].includes(field)) {
                return typeof val === 'object' ? JSON.stringify(val) : val;
            }
            if (val instanceof Date) return val;
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE users SET ${setClause} WHERE id = ?`, values);

        this._originalPassword = this.password;
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