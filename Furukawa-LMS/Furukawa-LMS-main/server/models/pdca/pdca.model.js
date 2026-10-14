import {
    executeQuery,
    migrationHelper,
    isDbConnected,
    readPdcaStore as readFallbackStore,
    writePdcaStore as writeFallbackStore
} from "../../db/pdca/pdcaDb.js";
import logger from "../../logger/winston.logger.js";

export function createEmptyRow(customDefaults = {}) {
    return {
        date: customDefaults.date || '',
        shift: customDefaults.shift || '',
        lineArea: customDefaults.lineArea || '',
        status: customDefaults.status || 'Open',
        observation: customDefaults.observation || '',
        imagesBefore: Array.isArray(customDefaults.imagesBefore)
            ? customDefaults.imagesBefore
            : (customDefaults.imageBefore ? [{ id: 'legacy-before-0', url: customDefaults.imageBefore, name: customDefaults.imageBeforeName || 'Before Image', type: customDefaults.fileTypeBefore || 'image' }] : []),
        imageBefore: customDefaults.imageBefore || null,
        imageBeforeName: customDefaults.imageBeforeName || '',
        fileTypeBefore: customDefaults.fileTypeBefore || 'image',
        rootCause: customDefaults.rootCause || '',
        counterMeasure: customDefaults.counterMeasure || '',
        imagesAfter: Array.isArray(customDefaults.imagesAfter)
            ? customDefaults.imagesAfter
            : (customDefaults.imageAfter ? [{ id: 'legacy-after-0', url: customDefaults.imageAfter, name: customDefaults.imageAfterName || 'After Image', type: customDefaults.fileTypeAfter || 'image' }] : []),
        imageAfter: customDefaults.imageAfter || null,
        imageAfterName: customDefaults.imageAfterName || '',
        fileTypeAfter: customDefaults.fileTypeAfter || 'image',
        responseDate: customDefaults.responseDate || '',
        department: customDefaults.department || '',
        staffEmployee: customDefaults.staffEmployee || '',
        assignedEmployee: customDefaults.assignedEmployee || '',
        cftTopic: customDefaults.cftTopic || '',
        cftTopicId: customDefaults.cftTopicId || '',
        cftSelectedType: customDefaults.cftSelectedType || '',
        cftSelectedName: customDefaults.cftSelectedName || '',
        cftSelectedCode: customDefaults.cftSelectedCode || '',
        responsiblePersonConfirmation: customDefaults.responsiblePersonConfirmation || ''
    };
}

export function createDefaultRows(count = 10, customDefaults = {}) {
    return Array.from({ length: count }, () => createEmptyRow(customDefaults));
}

export class PDCAModel {
    static async init() {
        try {
            const dbActive = await isDbConnected();
            if (dbActive) {
                // 1. pdca_records table
                if (!await migrationHelper.tableExists('pdca_records')) {
                    await executeQuery(`
                        CREATE TABLE pdca_records (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            recordId NVARCHAR(100) NOT NULL,
                            topic NVARCHAR(500) NOT NULL,
                            description NVARCHAR(MAX),
                            plant NVARCHAR(100),
                            scope NVARCHAR(100) DEFAULT 'Company',
                            department NVARCHAR(255),
                            section NVARCHAR(255),
                            sectionId NVARCHAR(100),
                            date NVARCHAR(50),
                            time NVARCHAR(50),
                            createdBy NVARCHAR(MAX),
                            assignedMembers NVARCHAR(MAX),
                            lpaSource NVARCHAR(MAX),
                            isSelf BIT DEFAULT 0,
                            isDeleted BIT DEFAULT 0,
                            createdAt DATETIME DEFAULT GETDATE(),
                            updatedAt DATETIME DEFAULT GETDATE()
                        )
                    `);
                    await migrationHelper.ensureIndexExists('pdca_records', 'idx_pdca_recordId',
                        'CREATE UNIQUE INDEX idx_pdca_recordId ON pdca_records(recordId)');
                    await migrationHelper.ensureIndexExists('pdca_records', 'idx_pdca_plant_scope',
                        'CREATE INDEX idx_pdca_plant_scope ON pdca_records(plant, scope)');
                } else {
                    await migrationHelper.ensureColumnExists('pdca_records', 'recordId', 'NVARCHAR(100)');
                    await migrationHelper.ensureColumnExists('pdca_records', 'assignedMembers', 'NVARCHAR(MAX)');
                    await migrationHelper.ensureColumnExists('pdca_records', 'lpaSource', 'NVARCHAR(MAX)');
                    await migrationHelper.ensureColumnExists('pdca_records', 'isDeleted', 'BIT DEFAULT 0');
                }

                // 2. pdca_sheets table
                if (!await migrationHelper.tableExists('pdca_sheets')) {
                    await executeQuery(`
                        CREATE TABLE pdca_sheets (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            pdcaRecordId NVARCHAR(100) NOT NULL,
                            headerInfo NVARCHAR(MAX),
                            sheetData NVARCHAR(MAX),
                            createdAt DATETIME DEFAULT GETDATE(),
                            updatedAt DATETIME DEFAULT GETDATE()
                        )
                    `);
                    await migrationHelper.ensureIndexExists('pdca_sheets', 'idx_pdca_sheet_recordId',
                        'CREATE UNIQUE INDEX idx_pdca_sheet_recordId ON pdca_sheets(pdcaRecordId)');
                }

                // 3. pdca_cft_topics table
                if (!await migrationHelper.tableExists('pdca_cft_topics')) {
                    await executeQuery(`
                        CREATE TABLE pdca_cft_topics (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            topicId NVARCHAR(100) NOT NULL,
                            name NVARCHAR(500) NOT NULL,
                            description NVARCHAR(MAX),
                            plant NVARCHAR(100),
                            members NVARCHAR(MAX),
                            assignedEmployees NVARCHAR(MAX),
                            createdBy NVARCHAR(MAX),
                            isDeleted BIT DEFAULT 0,
                            createdAt DATETIME DEFAULT GETDATE(),
                            updatedAt DATETIME DEFAULT GETDATE()
                        )
                    `);
                    await migrationHelper.ensureIndexExists('pdca_cft_topics', 'idx_pdca_cft_topicId',
                        'CREATE UNIQUE INDEX idx_pdca_cft_topicId ON pdca_cft_topics(topicId)');
                }

                // 4. pdca_attachments table
                if (!await migrationHelper.tableExists('pdca_attachments')) {
                    await executeQuery(`
                        CREATE TABLE pdca_attachments (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            pdcaRecordId NVARCHAR(100) NOT NULL,
                            rowId NVARCHAR(100),
                            fieldName NVARCHAR(100),
                            filename NVARCHAR(255) NOT NULL,
                            originalFilename NVARCHAR(255) NOT NULL,
                            mimeType NVARCHAR(100),
                            size BIGINT,
                            url NVARCHAR(500),
                            uploadedBy NVARCHAR(255),
                            isDeleted BIT DEFAULT 0,
                            createdAt DATETIME DEFAULT GETDATE()
                        )
                    `);
                    await migrationHelper.ensureIndexExists('pdca_attachments', 'idx_pdca_att_recordId',
                        'CREATE INDEX idx_pdca_att_recordId ON pdca_attachments(pdcaRecordId)');
                }

                // 5. pdca_audit_logs table
                if (!await migrationHelper.tableExists('pdca_audit_logs')) {
                    await executeQuery(`
                        CREATE TABLE pdca_audit_logs (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            pdcaRecordId NVARCHAR(100) NOT NULL,
                            action NVARCHAR(100) NOT NULL,
                            actor NVARCHAR(255),
                            details NVARCHAR(MAX),
                            createdAt DATETIME DEFAULT GETDATE()
                        )
                    `);
                    await migrationHelper.ensureIndexExists('pdca_audit_logs', 'idx_pdca_audit_recordId',
                        'CREATE INDEX idx_pdca_audit_recordId ON pdca_audit_logs(pdcaRecordId)');
                }
                logger.info("PDCA tables verified/created in MSSQL.");
            }

            // Ensure store has initial seed data
            await PDCAModel.seedInitialDataIfEmpty();
        } catch (error) {
            logger.error("Failed to initialize PDCA tables", error);
        }
    }

    static async seedInitialDataIfEmpty() {
        try {
            const dbActive = await isDbConnected();
            const store = readFallbackStore();
            let total = store.records.filter(r => !r.isDeleted).length;

            if (dbActive) {
                const [countRows] = await executeQuery(`SELECT COUNT(*) AS total FROM pdca_records WHERE isDeleted = 0`);
                if (countRows && countRows[0]) total = countRows[0].total;
            }

            if (total === 0) {
                logger.info("Seeding initial PDCA records...");
                const seedItems = [
                    {
                        id: "PDCA-GJ-101",
                        topic: "Reduction of Solder Bridge Defects in ECU Assembly",
                        description: "Implement automated optical inspection (AOI) pre-wave soldering verification to reduce rework cycle time.",
                        date: "23 Sep 2026",
                        time: "09:45 AM",
                        createdBy: { name: "YOGESH KUMAR", code: "AS081213", email: "aso81213@fme-minda.co.in", avatarBg: "bg-blue-100 text-blue-700", initials: "YK" },
                        plant: "Gujrat",
                        scope: "Company",
                        department: "SRC Quality",
                        isSelf: false
                    },
                    {
                        id: "PDCA-BW-102",
                        topic: "Die-Casting Cycle Time Optimization on Cell #4",
                        description: "Hydraulic pressure recalibration and chilled water cooling channel upgrade for lower cycle duration.",
                        date: "22 Sep 2026",
                        time: "11:15 AM",
                        createdBy: { name: "RAHUL SHARMA", code: "BW041920", email: "r.sharma@fme-minda.co.in", avatarBg: "bg-emerald-100 text-emerald-700", initials: "RS" },
                        plant: "Bawal",
                        scope: "Company",
                        department: "Die Casting",
                        isSelf: true
                    },
                    {
                        id: "PDCA-GJ-103",
                        topic: "Forklift Traffic Collision Prevention IoT Radar",
                        description: "Install 360-degree proximity sensors and warning buzzers at blind intersections in main warehouse.",
                        date: "20 Sep 2026",
                        time: "02:30 PM",
                        createdBy: { name: "AMIT PATEL", code: "GJ092311", email: "amit.patel@fme-minda.co.in", avatarBg: "bg-amber-100 text-amber-700", initials: "AP" },
                        plant: "Gujrat",
                        scope: "Company",
                        department: "EHS Safety",
                        isSelf: false
                    },
                    {
                        id: "PDCA-BW-104",
                        topic: "Air Compressor Energy Leakage Elimination",
                        description: "Ultrasonic air leak survey across pneumatic piping network in press shop to reduce kWh consumption.",
                        date: "18 Sep 2026",
                        time: "10:00 AM",
                        createdBy: { name: "PRIYA NAIR", code: "GJ018442", email: "priya.nair@fme-minda.co.in", avatarBg: "bg-rose-100 text-rose-700", initials: "PN" },
                        plant: "Bawal",
                        scope: "Company",
                        department: "Plant Maintenance",
                        isSelf: false
                    },
                    {
                        id: "CFT-GJ-201",
                        topic: "Team Composition & Role",
                        description: "Cross-functional team operational charter defining roles for production engineering, quality assurance and maintenance leads.",
                        date: "25 Sep 2026",
                        time: "10:30 AM",
                        createdBy: { name: "YOGESH KUMAR", code: "AS081213", email: "aso81213@fme-minda.co.in", avatarBg: "bg-blue-100 text-blue-700", initials: "YK" },
                        plant: "Gujrat",
                        scope: "CFT",
                        department: "CFT",
                        isSelf: false,
                        assignedMembers: [
                            { name: "AMIT PATEL", code: "GJ092311" },
                            { name: "PRIYA NAIR", code: "GJ018442" }
                        ]
                    },
                    {
                        id: "CFT-BW-202",
                        topic: "Alignment & Goal Setting",
                        description: "Zero Lost Time Injury (LTI) milestone targets aligned across shift leaders and contractor teams.",
                        date: "24 Sep 2026",
                        time: "02:15 PM",
                        createdBy: { name: "RAHUL SHARMA", code: "BW041920", email: "r.sharma@fme-minda.co.in", avatarBg: "bg-emerald-100 text-emerald-700", initials: "RS" },
                        plant: "Bawal",
                        scope: "CFT",
                        department: "CFT",
                        isSelf: false,
                        assignedMembers: [
                            { name: "DEEPAK MEHTA", code: "GJ045819" },
                            { name: "YOGESH KUMAR", code: "AS081213" }
                        ]
                    }
                ];

                for (const item of seedItems) {
                    await PDCAModel.create(item, 'SYSTEM_SEED');
                }
            }
        } catch (e) {
            logger.warn("Seeding PDCA initial records note:", e.message);
        }
    }

    // --- Record CRUD ---
    static async create(data, actor = 'System') {
        const recordId = data.id || data.recordId || `PDCA-${Date.now()}`;
        const topic = data.topic;
        const description = data.description || '';
        const plant = data.plant || 'Bawal';
        const scope = data.scope || 'Company';
        let department = data.department || '';
        const section = data.section || '';
        const sectionId = data.sectionId || '';
        const date = data.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const time = data.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        let createdByObj = typeof data.createdBy === 'object' ? { ...data.createdBy } : null;
        let assignedMembersObj = Array.isArray(data.assignedMembers) ? [...data.assignedMembers] : [];

        // For CFT records, enforce that the department is authoritatively derived from the selected Member's database record,
        // and NEVER from any assigned employee's department.
        if (scope === 'CFT') {
            const employees = await PDCAModel.getEmployees();
            const memberKey = createdByObj?.id || createdByObj?.code || createdByObj?.empId || data.memberId || data.selectedMemberCode;
            const memberName = createdByObj?.name;
            const matchedMember = (Array.isArray(employees) ? employees : []).find(e =>
                (memberKey && (String(e.id) === String(memberKey) || String(e.code).toUpperCase() === String(memberKey).toUpperCase())) ||
                (memberName && String(e.name).trim().toUpperCase() === String(memberName).trim().toUpperCase())
            );

            if (matchedMember) {
                const memberDept = matchedMember.department ? String(matchedMember.department).trim() : 'Department not assigned';
                department = memberDept || 'Department not assigned';
                if (createdByObj) {
                    createdByObj.id = matchedMember.id || createdByObj.id;
                    createdByObj.code = matchedMember.code || createdByObj.code;
                    createdByObj.name = matchedMember.name || createdByObj.name;
                    createdByObj.department = department;
                    createdByObj.email = matchedMember.email || createdByObj.email || '';
                }
            } else if (!department || department === 'CFT') {
                department = createdByObj?.department || 'Department not assigned';
            }

            // Also preserve each assigned employee's own department independently from the database
            if (Array.isArray(assignedMembersObj) && assignedMembersObj.length > 0) {
                assignedMembersObj = assignedMembersObj.map(emp => {
                    const empKey = emp.id || emp.code || emp.empId;
                    const empName = emp.name;
                    const matchedEmp = (Array.isArray(employees) ? employees : []).find(e =>
                        (empKey && (String(e.id) === String(empKey) || String(e.code).toUpperCase() === String(empKey).toUpperCase())) ||
                        (empName && String(e.name).trim().toUpperCase() === String(empName).trim().toUpperCase())
                    );
                    return {
                        id: matchedEmp?.id || emp.id,
                        name: matchedEmp?.name || emp.name,
                        code: matchedEmp?.code || emp.code,
                        department: matchedEmp?.department || emp.department || 'Department not assigned'
                    };
                });
            }
        }

        const createdByStr = createdByObj ? JSON.stringify(createdByObj) : (data.createdBy || null);
        const assignedMembersStr = JSON.stringify(assignedMembersObj);
        const lpaSourceStr = typeof data.lpaSource === 'object' ? JSON.stringify(data.lpaSource) : (data.lpaSource || null);
        const isSelf = data.isSelf ? 1 : 0;

        const dbActive = await isDbConnected();
        if (dbActive) {
            await executeQuery(`
                INSERT INTO pdca_records (
                    recordId, topic, description, plant, scope, department, section, sectionId,
                    date, time, createdBy, assignedMembers, lpaSource, isSelf, isDeleted, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, GETDATE(), GETDATE())
            `, [
                recordId, topic, description, plant, scope, department, section, sectionId,
                date, time, createdByStr, assignedMembersStr, lpaSourceStr, isSelf
            ]);
        }

        // Mirror in persistent store
        const store = readFallbackStore();
        const existingIdx = store.records.findIndex(r => r.recordId === recordId || r.id === recordId);
        const recordItem = {
            id: recordId,
            recordId,
            topic,
            description,
            plant,
            scope,
            department,
            section,
            sectionId,
            date,
            time,
            createdBy: createdByObj,
            assignedMembers: assignedMembersObj,
            lpaSource: data.lpaSource || null,
            isSelf: Boolean(isSelf),
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            store.records[existingIdx] = recordItem;
        } else {
            store.records.unshift(recordItem);
        }
        writeFallbackStore(store);

        // Audit log
        await PDCAModel.logAudit(recordId, 'CREATE_RECORD', actor, `Created PDCA record: ${topic} (${recordId})`);

        const defaultRows = createDefaultRows(10);
        const sheetToSave = (data.sheet && Array.isArray(data.sheet.rows) && data.sheet.rows.length > 0)
            ? data.sheet
            : {
                headerInfo: data.sheet?.headerInfo || {
                    topicName: topic,
                    preparedBy: createdByObj?.name || '',
                    auditNo: '',
                    attendees: ''
                },
                rows: defaultRows
            };

        await PDCAModel.saveSheet(recordId, sheetToSave, actor);

        return await PDCAModel.findByRecordId(recordId);
    }

    static async findAll({ plant, scope, search, page = 1, limit = 100 } = {}) {
        const dbActive = await isDbConnected();
        if (dbActive) {
            let whereClauses = ["isDeleted = 0"];
            let params = [];

            if (plant && plant !== 'Unit' && plant !== 'All Plants') {
                whereClauses.push("plant = ?");
                params.push(plant);
            }
            if (scope && scope !== 'All') {
                whereClauses.push("scope = ?");
                params.push(scope);
            }
            if (search && search.trim()) {
                whereClauses.push("(recordId LIKE ? OR topic LIKE ? OR description LIKE ? OR department LIKE ? OR section LIKE ?)");
                const s = `%${search.trim()}%`;
                params.push(s, s, s, s, s);
            }

            const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
            const countQuery = `SELECT COUNT(*) AS total FROM pdca_records ${whereSql}`;
            const [countResult] = await executeQuery(countQuery, params);
            const total = countResult && countResult[0] ? countResult[0].total : 0;

            const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
            const query = `
                SELECT r.*, s.headerInfo, s.sheetData
                FROM pdca_records r
                LEFT JOIN pdca_sheets s ON r.recordId = s.pdcaRecordId
                ${whereSql}
                ORDER BY r.id DESC
                OFFSET ${offset} ROWS
                FETCH NEXT ${parseInt(limit, 10)} ROWS ONLY
            `;
            const [rows] = await executeQuery(query, params);
            if (rows && rows.length > 0) {
                const records = rows.map(r => PDCAModel.formatRecord(r));
                return { records, total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
            }
        }

        // Fallback / in-sync store read
        const store = readFallbackStore();
        let filtered = store.records.filter(r => !r.isDeleted);

        if (plant && plant !== 'Unit' && plant !== 'All Plants') {
            filtered = filtered.filter(r => r.plant === plant);
        }
        if (scope && scope !== 'All') {
            filtered = filtered.filter(r => r.scope === scope);
        }
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(r =>
                (r.recordId || r.id || '').toLowerCase().includes(q) ||
                (r.topic || '').toLowerCase().includes(q) ||
                (r.description || '').toLowerCase().includes(q) ||
                (r.department || '').toLowerCase().includes(q) ||
                (r.section || '').toLowerCase().includes(q)
            );
        }

        const total = filtered.length;
        const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
        const paginated = filtered.slice(offset, offset + parseInt(limit, 10));

        // Attach sheets
        const records = paginated.map(r => {
            const stored = store.sheets[r.recordId || r.id];
            const sheet = (stored && Array.isArray(stored.rows) && stored.rows.length > 0)
                ? stored
                : { headerInfo: stored?.headerInfo || null, rows: createDefaultRows(10) };
            return {
                ...r,
                id: r.recordId || r.id,
                sheet
            };
        });

        return { records, total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
    }

    static async findByRecordId(recordId) {
        const dbActive = await isDbConnected();
        if (dbActive) {
            const query = `
                SELECT r.*, s.headerInfo, s.sheetData
                FROM pdca_records r
                LEFT JOIN pdca_sheets s ON r.recordId = s.pdcaRecordId
                WHERE (r.recordId = ? OR CAST(r.id AS NVARCHAR(100)) = ?) AND r.isDeleted = 0
            `;
            const [rows] = await executeQuery(query, [recordId, recordId]);
            if (rows && rows.length > 0) {
                return PDCAModel.formatRecord(rows[0]);
            }
        }

        const store = readFallbackStore();
        const found = store.records.find(r => (r.recordId === recordId || r.id === recordId) && !r.isDeleted);
        if (!found) return null;

        const stored = store.sheets[found.recordId || found.id];
        const sheet = (stored && Array.isArray(stored.rows) && stored.rows.length > 0)
            ? stored
            : { headerInfo: stored?.headerInfo || null, rows: createDefaultRows(10) };
        return {
            ...found,
            id: found.recordId || found.id,
            sheet
        };
    }

    static async update(recordId, data, actor = 'System') {
        const existing = await PDCAModel.findByRecordId(recordId);
        if (!existing) return null;

        const topic = data.topic !== undefined ? data.topic : existing.topic;
        const description = data.description !== undefined ? data.description : existing.description;
        const plant = data.plant !== undefined ? data.plant : existing.plant;
        const scope = data.scope !== undefined ? data.scope : existing.scope;
        const department = data.department !== undefined ? data.department : existing.department;
        const section = data.section !== undefined ? data.section : existing.section;
        const sectionId = data.sectionId !== undefined ? data.sectionId : existing.sectionId;
        const assignedMembers = data.assignedMembers !== undefined ? data.assignedMembers : existing.assignedMembers;

        const dbActive = await isDbConnected();
        if (dbActive) {
            await executeQuery(`
                UPDATE pdca_records
                SET topic = ?, description = ?, plant = ?, scope = ?, department = ?,
                    section = ?, sectionId = ?, assignedMembers = ?, updatedAt = GETDATE()
                WHERE recordId = ?
            `, [
                topic, description, plant, scope, department,
                section, sectionId, JSON.stringify(assignedMembers), existing.id
            ]);
        }

        // Update in persistent store
        const store = readFallbackStore();
        const idx = store.records.findIndex(r => r.recordId === existing.id || r.id === existing.id);
        if (idx >= 0) {
            store.records[idx] = {
                ...store.records[idx],
                topic,
                description,
                plant,
                scope,
                department,
                section,
                sectionId,
                assignedMembers,
                updatedAt: new Date().toISOString()
            };
            writeFallbackStore(store);
        }

        await PDCAModel.logAudit(existing.id, 'UPDATE_RECORD', actor, `Updated record metadata: ${topic}`);

        if (data.sheet) {
            await PDCAModel.saveSheet(existing.id, data.sheet, actor);
        }

        return await PDCAModel.findByRecordId(existing.id);
    }

    static async delete(recordId, actor = 'System') {
        const existing = await PDCAModel.findByRecordId(recordId);
        if (!existing) return false;

        const dbActive = await isDbConnected();
        if (dbActive) {
            await executeQuery(`
                UPDATE pdca_records
                SET isDeleted = 1, updatedAt = GETDATE()
                WHERE recordId = ?
            `, [existing.id]);
        }

        // Update in store
        const store = readFallbackStore();
        const idx = store.records.findIndex(r => r.recordId === existing.id || r.id === existing.id);
        if (idx >= 0) {
            store.records[idx].isDeleted = true;
            writeFallbackStore(store);
        }

        await PDCAModel.logAudit(existing.id, 'DELETE_RECORD', actor, `Marked record ${existing.id} as deleted`);
        return true;
    }

    // --- Sheet Management ---
    static async getSheet(recordId) {
        const defaultRows = createDefaultRows(10);
        const dbActive = await isDbConnected();
        if (dbActive) {
            const [rows] = await executeQuery(`SELECT headerInfo, sheetData FROM pdca_sheets WHERE pdcaRecordId = ?`, [recordId]);
            if (rows && rows.length > 0) {
                let headerInfo = null;
                let sheetRows = [];
                try { headerInfo = rows[0].headerInfo ? JSON.parse(rows[0].headerInfo) : null; } catch {}
                try { sheetRows = rows[0].sheetData ? JSON.parse(rows[0].sheetData) : []; } catch {}
                return {
                    headerInfo,
                    rows: (Array.isArray(sheetRows) && sheetRows.length > 0) ? sheetRows : defaultRows
                };
            }
        }

        const store = readFallbackStore();
        const stored = store.sheets[recordId];
        if (stored && Array.isArray(stored.rows) && stored.rows.length > 0) {
            return stored;
        }
        return {
            headerInfo: stored?.headerInfo || null,
            rows: defaultRows
        };
    }

    static async saveSheet(recordId, sheet, actor = 'System') {
        const headerInfo = sheet.headerInfo || null;
        const rows = Array.isArray(sheet.rows) ? sheet.rows : (sheet.sheetData || []);

        const dbActive = await isDbConnected();
        if (dbActive) {
            const headerInfoStr = typeof headerInfo === 'object' ? JSON.stringify(headerInfo) : headerInfo;
            const rowsStr = JSON.stringify(rows);
            const [existing] = await executeQuery(`SELECT id FROM pdca_sheets WHERE pdcaRecordId = ?`, [recordId]);
            if (existing && existing.length > 0) {
                await executeQuery(`
                    UPDATE pdca_sheets
                    SET headerInfo = ?, sheetData = ?, updatedAt = GETDATE()
                    WHERE pdcaRecordId = ?
                `, [headerInfoStr, rowsStr, recordId]);
            } else {
                await executeQuery(`
                    INSERT INTO pdca_sheets (pdcaRecordId, headerInfo, sheetData, createdAt, updatedAt)
                    VALUES (?, ?, ?, GETDATE(), GETDATE())
                `, [recordId, headerInfoStr, rowsStr]);
            }
        }

        // Save in store
        const store = readFallbackStore();
        store.sheets[recordId] = {
            headerInfo,
            rows
        };
        writeFallbackStore(store);

        await PDCAModel.logAudit(recordId, 'SAVE_SHEET', actor, `Saved sheet with ${rows.length} rows`);
        return { headerInfo, rows };
    }

    // --- Employee & CFT Management ---
    static async getEmployees() {
        try {
            const dbActive = await isDbConnected();
            if (dbActive) {
                const [userRows] = await executeQuery(`
                    SELECT TOP 200 u.id, u.fullName, u.userName, u.empId, u.email,
                           COALESCE(d.name, u.department) as department
                    FROM users u
                    LEFT JOIN departments d ON u.departmentId = d.id
                    WHERE u.isDeleted = 0 OR u.isDeleted IS NULL
                    ORDER BY u.fullName ASC
                `);
                if (userRows && userRows.length > 0) {
                    return userRows.map(u => ({
                        id: u.id,
                        name: u.fullName || u.userName,
                        code: u.empId || u.userName || String(u.id),
                        department: u.department || '',
                        email: u.email || ''
                    }));
                }
            }
        } catch (e) {
            logger.warn("Querying employees failed, using fallback:", e.message);
        }

        const store = readFallbackStore();
        if (Array.isArray(store.employees) && store.employees.length > 0) {
            return store.employees;
        }

        const defaultEmployees = [
            { id: "EMP-001", name: "YOGESH KUMAR", code: "AS081213", department: "PE", email: "aso81213@fme-minda.co.in" },
            { id: "EMP-002", name: "VIKRAM SINGH", code: "GJ034112", department: "PE", email: "v.singh@fme-minda.co.in" },
            { id: "EMP-003", name: "DEEPAK MEHTA", code: "GJ045819", department: "Quality", email: "d.mehta@fme-minda.co.in" },
            { id: "EMP-004", name: "RAHUL SHARMA", code: "BW041920", department: "Assembly", email: "r.sharma@fme-minda.co.in" },
            { id: "EMP-005", name: "RAJESH KUMAR", code: "BW081290", department: "Maintenance", email: "r.kumar@fme-minda.co.in" },
            { id: "EMP-006", name: "POOJA NAIR", code: "BW039182", department: "Maintenance", email: "p.nair@fme-minda.co.in" },
            { id: "EMP-007", name: "AMIT PATEL", code: "GJ092311", department: "Safety", email: "amit.patel@fme-minda.co.in" },
            { id: "EMP-008", name: "PRIYA NAIR", code: "GJ018442", department: "HR", email: "priya.nair@fme-minda.co.in" },
            { id: "EMP-009", name: "MANISH JOSHI", code: "BW092301", department: "Maintenance", email: "m.joshi@fme-minda.co.in" },
            { id: "EMP-010", name: "JOY DASTIDAR", code: "ST080014", department: "D&D", email: "st080014@furukawaminda.com" },
            { id: "EMP-011", name: "SANJEEV VERMA", code: "BW019283", department: "Store", email: "s.verma@fme-minda.co.in" },
            { id: "EMP-012", name: "ANITA DESHMUKH", code: "GJ058291", department: "IT", email: "a.deshmukh@fme-minda.co.in" }
        ];
        store.employees = defaultEmployees;
        writeFallbackStore(store);
        return defaultEmployees;
    }

    static async createCft(data, actor = 'System') {
        const topicId = data.id || data.topicId || `CFT-${Date.now()}`;
        const name = data.name || data.topic;
        const description = data.description || '';
        const plant = data.plant || 'Bawal';
        const department = data.department || data.memberDepartment || data.createdBy?.department || '';
        const assignedEmployees = data.assignedEmployees || data.assignedMembers || [];

        return await PDCAModel.create({
            id: topicId,
            topic: name,
            description,
            plant,
            scope: 'CFT',
            department,
            createdBy: data.createdBy,
            assignedMembers: assignedEmployees,
            isSelf: false
        }, actor);
    }

    static async getCftMembers(recordId) {
        const record = await PDCAModel.findByRecordId(recordId);
        if (!record) return [];
        return record.assignedMembers || [];
    }

    static async updateCftMembers(recordId, members, actor = 'System') {
        const membersList = Array.isArray(members) ? members : [];
        const dbActive = await isDbConnected();
        if (dbActive) {
            await executeQuery(`
                UPDATE pdca_records
                SET assignedMembers = ?, updatedAt = GETDATE()
                WHERE recordId = ?
            `, [JSON.stringify(membersList), recordId]);
        }

        const store = readFallbackStore();
        const idx = store.records.findIndex(r => r.recordId === recordId || r.id === recordId);
        if (idx >= 0) {
            store.records[idx].assignedMembers = membersList;
            writeFallbackStore(store);
        }

        await PDCAModel.logAudit(recordId, 'UPDATE_CFT_MEMBERS', actor, `Updated assigned team members`);
        return membersList;
    }

    // --- Attachment Management ---
    static async createAttachment({ pdcaRecordId, rowId, fieldName, filename, originalFilename, mimeType, size, url, uploadedBy }) {
        const attItem = {
            id: Date.now(),
            pdcaRecordId,
            rowId: rowId || '',
            fieldName: fieldName || '',
            filename,
            originalFilename,
            mimeType,
            size: size || 0,
            url,
            uploadedBy: uploadedBy || 'User',
            createdAt: new Date().toISOString()
        };

        const dbActive = await isDbConnected();
        if (dbActive) {
            await executeQuery(`
                INSERT INTO pdca_attachments (
                    pdcaRecordId, rowId, fieldName, filename, originalFilename,
                    mimeType, size, url, uploadedBy, isDeleted, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, GETDATE())
            `, [
                pdcaRecordId, rowId || '', fieldName || '', filename, originalFilename,
                mimeType, size || 0, url, uploadedBy || 'User'
            ]);
        }

        const store = readFallbackStore();
        store.attachments.push(attItem);
        writeFallbackStore(store);

        return attItem;
    }

    static async getAttachmentById(attachmentId) {
        const dbActive = await isDbConnected();
        if (dbActive) {
            const [rows] = await executeQuery(`SELECT * FROM pdca_attachments WHERE id = ? AND isDeleted = 0`, [attachmentId]);
            if (rows && rows.length > 0) return rows[0];
        }

        const store = readFallbackStore();
        return store.attachments.find(a => String(a.id) === String(attachmentId) && !a.isDeleted) || null;
    }

    static async getAttachmentsByRecordId(pdcaRecordId) {
        const dbActive = await isDbConnected();
        if (dbActive) {
            const [rows] = await executeQuery(`SELECT * FROM pdca_attachments WHERE pdcaRecordId = ? AND isDeleted = 0 ORDER BY id DESC`, [pdcaRecordId]);
            if (rows && rows.length > 0) return rows;
        }

        const store = readFallbackStore();
        return store.attachments.filter(a => a.pdcaRecordId === pdcaRecordId && !a.isDeleted);
    }

    static async deleteAttachment(attachmentId) {
        const dbActive = await isDbConnected();
        if (dbActive) {
            await executeQuery(`UPDATE pdca_attachments SET isDeleted = 1 WHERE id = ?`, [attachmentId]);
        }

        const store = readFallbackStore();
        const att = store.attachments.find(a => String(a.id) === String(attachmentId));
        if (att) att.isDeleted = true;
        writeFallbackStore(store);
        return true;
    }

    // --- Audit Logging ---
    static async logAudit(pdcaRecordId, action, actor, details) {
        try {
            const dbActive = await isDbConnected();
            if (dbActive) {
                await executeQuery(`
                    INSERT INTO pdca_audit_logs (pdcaRecordId, action, actor, details, createdAt)
                    VALUES (?, ?, ?, ?, GETDATE())
                `, [pdcaRecordId, action, actor || 'System', details || '']);
            }

            const store = readFallbackStore();
            store.auditLogs.unshift({
                id: Date.now(),
                pdcaRecordId,
                action,
                actor: actor || 'System',
                details: details || '',
                createdAt: new Date().toISOString()
            });
            writeFallbackStore(store);
        } catch (e) {
            logger.warn("Failed writing PDCA audit log:", e.message);
        }
    }

    static async getHistory(pdcaRecordId) {
        const dbActive = await isDbConnected();
        if (dbActive) {
            const [rows] = await executeQuery(`
                SELECT * FROM pdca_audit_logs
                WHERE pdcaRecordId = ?
                ORDER BY createdAt DESC
            `, [pdcaRecordId]);
            if (rows && rows.length > 0) return rows;
        }

        const store = readFallbackStore();
        return store.auditLogs.filter(a => a.pdcaRecordId === pdcaRecordId);
    }

    // Helper formatter
    static formatRecord(row) {
        let createdBy = null;
        let assignedMembers = [];
        let lpaSource = null;
        let headerInfo = null;
        let rows = [];

        try { createdBy = row.createdBy ? (typeof row.createdBy === 'string' ? JSON.parse(row.createdBy) : row.createdBy) : null; } catch {}
        try { assignedMembers = row.assignedMembers ? (typeof row.assignedMembers === 'string' ? JSON.parse(row.assignedMembers) : row.assignedMembers) : []; } catch {}
        try { lpaSource = row.lpaSource ? (typeof row.lpaSource === 'string' ? JSON.parse(row.lpaSource) : row.lpaSource) : null; } catch {}
        try { headerInfo = row.headerInfo ? (typeof row.headerInfo === 'string' ? JSON.parse(row.headerInfo) : row.headerInfo) : null; } catch {}
        try { rows = row.sheetData ? (typeof row.sheetData === 'string' ? JSON.parse(row.sheetData) : row.sheetData) : []; } catch {}
        if (!Array.isArray(rows) || rows.length === 0) {
            rows = createDefaultRows(10);
        }

        return {
            id: row.recordId || String(row.id),
            dbId: row.id,
            topic: row.topic,
            description: row.description,
            plant: row.plant,
            scope: row.scope,
            department: row.department,
            section: row.section,
            sectionId: row.sectionId,
            date: row.date,
            time: row.time,
            createdBy,
            assignedMembers,
            lpaSource,
            isSelf: Boolean(row.isSelf),
            sheet: {
                headerInfo,
                rows
            },
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        };
    }
}

// Auto-initialize when loaded
PDCAModel.init().catch(err => logger.error("Failed to initialize pdca model:", err));

export default PDCAModel;
