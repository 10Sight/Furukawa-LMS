import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class LeftRequest {
    constructor(data) {
        this.id = data.id;
        this.userId = data.userId;
        this.empId = data.empId || "";
        this.fullName = data.fullName || "";
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.lineId = data.lineId;
        this.subSectionId = data.subSectionId;
        this.stationId = data.stationId;
        this.currentStatus = data.currentStatus || "PRESENT";
        this.leavingDate = data.leavingDate;
        this.reasonOfLeaving = data.reasonOfLeaving || "";
        // Reason submitted by the department at apply time vs. the one HR confirmed on approval.
        // Rows created before the split only have reasonOfLeaving, so fall back to it.
        this.reasonOfLeavingByDept = data.reasonOfLeavingByDept || data.reasonOfLeaving || "";
        this.reasonOfLeavingByHr = data.reasonOfLeavingByHr || "";
        this.remarks = data.remarks || "";
        this.status = data.status || "PENDING";
        this.requestedBy = data.requestedBy;
        this.requestedByName = data.requestedByName || "";
        this.requestedByRole = data.requestedByRole || "";
        this.reviewedBy = data.reviewedBy || null;
        this.reviewedByName = data.reviewedByName || "";
        this.reviewedAt = data.reviewedAt || null;
        this.rejectionReason = data.rejectionReason || "";
        this.isBulkRequest = !!data.isBulkRequest;
        this.bulkBatchId = data.bulkBatchId || null;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;

        // Present when the row came back from a JOIN with users/departments/sections
        if (data.departmentName !== undefined) this.departmentName = data.departmentName;
        if (data.sectionName !== undefined) this.sectionName = data.sectionName;
        if (data.lineName !== undefined) this.lineName = data.lineName;
        if (data.avatar !== undefined) this.avatar = data.avatar;
        if (data.userStatus !== undefined) this.userStatus = data.userStatus;
    }

    static async init() {
        if (!await migrationHelper.tableExists('left_requests')) {
            await executeQuery(`
                CREATE TABLE left_requests (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    userId INT NOT NULL,
                    empId NVARCHAR(100) NULL,
                    fullName NVARCHAR(255) NULL,
                    departmentId INT NULL,
                    sectionId INT NULL,
                    lineId INT NULL,
                    subSectionId INT NULL,
                    stationId INT NULL,
                    currentStatus NVARCHAR(50) DEFAULT 'PRESENT',
                    leavingDate DATE NOT NULL,
                    reasonOfLeaving NVARCHAR(500) NOT NULL,
                    reasonOfLeavingByDept NVARCHAR(500) NULL,
                    reasonOfLeavingByHr NVARCHAR(500) NULL,
                    remarks NVARCHAR(MAX) NULL,
                    status NVARCHAR(50) DEFAULT 'PENDING',
                    requestedBy INT NOT NULL,
                    requestedByName NVARCHAR(255) NULL,
                    requestedByRole NVARCHAR(100) NULL,
                    reviewedBy INT NULL,
                    reviewedByName NVARCHAR(255) NULL,
                    reviewedAt DATETIME NULL,
                    rejectionReason NVARCHAR(MAX) NULL,
                    isBulkRequest BIT DEFAULT 0,
                    bulkBatchId NVARCHAR(100) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_left_requests_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                    CONSTRAINT fk_left_requests_req_user FOREIGN KEY (requestedBy) REFERENCES users(id) ON DELETE NO ACTION
                )
            `);
        } else {
            await migrationHelper.ensureColumnExists('left_requests', 'remarks', 'NVARCHAR(MAX) NULL');
            await migrationHelper.ensureColumnExists('left_requests', 'rejectionReason', 'NVARCHAR(MAX) NULL');
            await migrationHelper.ensureColumnExists('left_requests', 'isBulkRequest', 'BIT DEFAULT 0');
            await migrationHelper.ensureColumnExists('left_requests', 'bulkBatchId', 'NVARCHAR(100) NULL');

            // Dual reason split: backfill from the legacy single reason the first time the
            // columns appear. Only approved rows have an HR-confirmed reason.
            if (await migrationHelper.ensureColumnExists('left_requests', 'reasonOfLeavingByDept', 'NVARCHAR(500) NULL')) {
                await executeQuery("UPDATE left_requests SET reasonOfLeavingByDept = reasonOfLeaving WHERE reasonOfLeavingByDept IS NULL");
            }
            if (await migrationHelper.ensureColumnExists('left_requests', 'reasonOfLeavingByHr', 'NVARCHAR(500) NULL')) {
                await executeQuery("UPDATE left_requests SET reasonOfLeavingByHr = reasonOfLeaving WHERE status = 'APPROVED' AND reasonOfLeavingByHr IS NULL");
            }
        }

        try {
            await migrationHelper.ensureIndexExists(
                'left_requests',
                'idx_left_requests_status',
                'CREATE INDEX idx_left_requests_status ON left_requests(status)'
            );
            await migrationHelper.ensureIndexExists(
                'left_requests',
                'idx_left_requests_user_status',
                'CREATE INDEX idx_left_requests_user_status ON left_requests(userId, status)'
            );
            await migrationHelper.ensureIndexExists(
                'left_requests',
                'idx_left_requests_dept_sect',
                'CREATE INDEX idx_left_requests_dept_sect ON left_requests(departmentId, sectionId)'
            );
            await migrationHelper.ensureIndexExists(
                'left_requests',
                'idx_left_requests_dept_sect_line',
                'CREATE INDEX idx_left_requests_dept_sect_line ON left_requests(departmentId, sectionId, lineId, status)'
            );
            await migrationHelper.ensureIndexExists(
                'left_requests',
                'idx_left_requests_created',
                'CREATE INDEX idx_left_requests_created ON left_requests(createdAt DESC)'
            );
        } catch (e) {
            console.error("Failed to create left_requests indexes:", e.message);
        }
    }

    static async create(data) {
        const {
            userId, empId, fullName, departmentId, sectionId, lineId, subSectionId, stationId,
            currentStatus, leavingDate, reasonOfLeaving, reasonOfLeavingByDept, remarks,
            requestedBy, requestedByName, requestedByRole,
            isBulkRequest, bulkBatchId
        } = data;

        const query = `
            INSERT INTO left_requests
            (userId, empId, fullName, departmentId, sectionId, lineId, subSectionId, stationId, currentStatus,
             leavingDate, reasonOfLeaving, reasonOfLeavingByDept, remarks, status, requestedBy, requestedByName, requestedByRole,
             isBulkRequest, bulkBatchId)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)
        `;

        const values = [
            userId, empId || null, fullName || null,
            departmentId || null, sectionId || null, lineId || null, subSectionId || null, stationId || null,
            currentStatus || "PRESENT", leavingDate, reasonOfLeaving, reasonOfLeavingByDept || reasonOfLeaving, remarks || null,
            requestedBy, requestedByName || null, requestedByRole || null,
            isBulkRequest ? 1 : 0, bulkBatchId || null
        ];

        const [rows] = await executeQuery(query, values);
        return LeftRequest.findById(rows[0].id);
    }

    static async findById(id) {
        const [rows] = await executeQuery(`
            SELECT lr.*, d.name as departmentName, s.name as sectionName, l.name as lineName,
                   u.avatar as avatar, u.status as userStatus
            FROM left_requests lr
            LEFT JOIN departments d ON lr.departmentId = d.id
            LEFT JOIN sections s ON lr.sectionId = s.id
            LEFT JOIN [lines] l ON lr.lineId = l.id
            LEFT JOIN users u ON lr.userId = u.id
            WHERE lr.id = ?
        `, [id]);
        if (rows.length === 0) return null;
        return new LeftRequest(rows[0]);
    }

    static async findPendingByUserId(userId) {
        const [rows] = await executeQuery(
            "SELECT * FROM left_requests WHERE userId = ? AND status = 'PENDING'",
            [userId]
        );
        if (rows.length === 0) return null;
        return new LeftRequest(rows[0]);
    }

    static async findAll({ status, departmentId, sectionId, lineId, search, page = 1, limit = 25 } = {}) {
        let where = ["1=1"];
        let params = [];

        if (status && status !== "ALL") {
            where.push("lr.status = ?");
            params.push(status);
        }
        // Hierarchy filters accept comma-separated IDs so the multi-select filter bar can pass
        // several departments/sections/lines at once.
        const addInFilter = (raw, column) => {
            const ids = raw ? String(raw).split(",").map(v => v.trim()).filter(Boolean) : [];
            if (ids.length === 0) return;
            where.push(`${column} IN (${ids.map(() => "?").join(",")})`);
            params.push(...ids);
        };
        addInFilter(departmentId, "lr.departmentId");
        addInFilter(sectionId, "lr.sectionId");
        addInFilter(lineId, "lr.lineId");
        if (search) {
            const t = `%${search}%`;
            where.push("(lr.fullName LIKE ? OR lr.empId LIKE ?)");
            params.push(t, t);
        }

        const whereSQL = where.join(" AND ");

        const [countRows] = await executeQuery(
            `SELECT COUNT(*) as total FROM left_requests lr WHERE ${whereSQL}`,
            params
        );
        const total = countRows[0]?.total || 0;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 25);
        const offset = (pageNum - 1) * limitNum;

        const [rows] = await executeQuery(`
            SELECT lr.*, d.name as departmentName, s.name as sectionName, l.name as lineName,
                   u.avatar as avatar, u.status as userStatus
            FROM left_requests lr
            LEFT JOIN departments d ON lr.departmentId = d.id
            LEFT JOIN sections s ON lr.sectionId = s.id
            LEFT JOIN [lines] l ON lr.lineId = l.id
            LEFT JOIN users u ON lr.userId = u.id
            WHERE ${whereSQL}
            ORDER BY lr.createdAt DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        `, [...params, offset, limitNum]);

        return {
            rows: rows.map(r => new LeftRequest(r)),
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.max(1, Math.ceil(total / limitNum)),
        };
    }

    static async countPending(departmentId) {
        let query = "SELECT COUNT(*) as cnt FROM left_requests WHERE status = 'PENDING'";
        const params = [];
        if (departmentId) {
            query += " AND departmentId = ?";
            params.push(departmentId);
        }
        const [rows] = await executeQuery(query, params);
        return rows[0]?.cnt || 0;
    }

    static async approve(id, { reviewedBy, reviewedByName, reasonOfLeavingByHr }) {
        const fields = ["status = 'APPROVED'", "reviewedBy = ?", "reviewedByName = ?", "reviewedAt = GETDATE()", "updatedAt = GETDATE()"];
        const params = [reviewedBy, reviewedByName || null];
        // HR confirms (or overrides) the department's reason at approval time. reasonOfLeaving
        // mirrors the HR reason so it keeps matching what actually got applied to the user;
        // reasonOfLeavingByDept is left untouched as the department's original submission.
        if (reasonOfLeavingByHr !== undefined) {
            fields.push("reasonOfLeavingByHr = ?", "reasonOfLeaving = ?");
            params.push(reasonOfLeavingByHr, reasonOfLeavingByHr);
        }
        params.push(id);
        await executeQuery(`UPDATE left_requests SET ${fields.join(", ")} WHERE id = ?`, params);
        return LeftRequest.findById(id);
    }

    static async reject(id, { reviewedBy, reviewedByName, rejectionReason }) {
        await executeQuery(`
            UPDATE left_requests
            SET status = 'REJECTED', reviewedBy = ?, reviewedByName = ?, reviewedAt = GETDATE(),
                rejectionReason = ?, updatedAt = GETDATE()
            WHERE id = ?
        `, [reviewedBy, reviewedByName || null, rejectionReason || null, id]);
        return LeftRequest.findById(id);
    }

    static async cancel(id) {
        await executeQuery(`
            UPDATE left_requests SET status = 'CANCELLED', updatedAt = GETDATE() WHERE id = ?
        `, [id]);
        return LeftRequest.findById(id);
    }
}

// Initialize table
LeftRequest.init().catch(err => console.error("Failed to initialize LeftRequest table:", err));

export default LeftRequest;
