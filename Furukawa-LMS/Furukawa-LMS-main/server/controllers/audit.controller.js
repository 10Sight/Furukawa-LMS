import { executeQuery } from "../db/mssqlHelper.js";
import Audit from "../models/audit.model.js";
import User from "../models/auth.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import logAudit from "../utils/auditLogger.js";

// In-memory per-user/action throttle to avoid a DB round-trip on every client log call.
// Bounded by (active users x distinct action identifiers), not by request volume, so it doesn't need eviction.
const lastLoggedAt = new Map();
const THROTTLE_WINDOW_MS = 3000;
const MAX_DETAILS_LENGTH = 2000;

// Helper to populate user details
const populateAuditUser = async (audit) => {
    if (!audit) return null;
    if (audit.user) {
        const userId = parseInt(audit.user);
        if (!isNaN(userId)) {
            const u = await User.findById(userId);
            if (u) {
                audit.user = { id: u.id, fullName: u.fullName, email: u.email, isAdmin: u.isAdmin, isTrainer: u.isTrainer, isEmployee: u.isEmployee };
            }
        }
    }
    return audit;
};

// Joins each audit to its user and the user's department / section, so the listing needs a single query.
const AUDIT_LIST_FROM = `
    FROM audits a
    LEFT JOIN users u ON u.id = TRY_CAST(a.[user] AS INT)
    LEFT JOIN departments d ON d.id = COALESCE(u.departmentId, u.targetDeptId)
    LEFT JOIN sections s ON s.id = COALESCE(u.sectionId, u.targetSectionId)`;

export const getAllAudits = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 900);
    const offset = (page - 1) * limit;

    const filters = [];
    const params = [];

    // Only the retention window is ever listed; older rows are deleted nightly by auditRetentionScheduler.
    const retentionCutoff = new Date(Date.now() - ENV.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    filters.push("a.createdAt >= ?");
    params.push(dateFrom && !isNaN(dateFrom) && dateFrom > retentionCutoff ? dateFrom : retentionCutoff);

    // Role-based filtering using isAdmin boolean flag
    // Non-admins cannot see admin/superadmin activities
    if (req.user && !req.user.isAdmin) {
        filters.push("(a.[user] IS NULL OR ISNULL(u.isAdmin, 0) = 0)");

        // Block sensitive system actions from non-admins
        filters.push(`(
            a.[user] IS NOT NULL
            OR
            (a.[user] IS NULL AND a.action NOT LIKE '%SYSTEM_ADMIN%'
                AND a.action NOT LIKE '%SUPERADMIN%'
                AND a.action NOT LIKE '%PRIVILEGE%'
                AND a.action NOT LIKE '%ROLE_CHANGE%'
                AND a.action NOT LIKE '%SYSTEM_SETTINGS%')
        )`);
    }

    // User filter
    if (req.query.userId) {
        if (!isNaN(parseInt(req.query.userId))) {
            filters.push("a.[user] = ?");
            params.push(String(parseInt(req.query.userId)));
        } else {
            filters.push("(u.email LIKE ? OR u.fullName LIKE ?)");
            params.push(`%${req.query.userId}%`, `%${req.query.userId}%`);
        }
    }

    // Department / section of the acting user
    if (req.query.departmentId && !isNaN(parseInt(req.query.departmentId))) {
        filters.push("d.id = ?");
        params.push(parseInt(req.query.departmentId));
    }
    if (req.query.sectionId && !isNaN(parseInt(req.query.sectionId))) {
        filters.push("s.id = ?");
        params.push(parseInt(req.query.sectionId));
    }

    // Action filter
    if (req.query.action) {
        filters.push("a.action LIKE ?");
        params.push(`%${req.query.action}%`);
    }

    // Search filter
    if (req.query.search) {
        const term = `%${req.query.search}%`;
        filters.push(`(a.action LIKE ? OR a.resourceType LIKE ? OR a.ip LIKE ? OR u.fullName LIKE ? OR u.empId LIKE ?)`);
        params.push(term, term, term, term, term);
    }

    if (req.query.dateTo) {
        filters.push("a.createdAt <= ?");
        params.push(new Date(req.query.dateTo));
    }

    // IP
    if (req.query.ipAddress) {
        filters.push("a.ip LIKE ?");
        params.push(`%${req.query.ipAddress}%`);
    }

    // User Agent
    if (req.query.userAgent) {
        filters.push("a.userAgent LIKE ?");
        params.push(`%${req.query.userAgent}%`);
    }

    // Severity
    if (req.query.severity) {
        filters.push("a.severity = ?");
        params.push(req.query.severity.toLowerCase());
    }

    const whereClause = "WHERE " + filters.join(" AND ");

    // Count total
    const [countRows] = await executeQuery(`SELECT COUNT(*) as count ${AUDIT_LIST_FROM} ${whereClause}`, params);
    const total = countRows[0].count;

    // Sorting - validate against allowed columns only
    const sortBy = req.query.sortBy || 'createdAt';
    const allowedSorts = ['createdAt', 'action', 'severity', 'ip'];
    const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'createdAt';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    // MSSQL pagination
    const [rows] = await executeQuery(
        `SELECT a.*,
                u.id AS u_id, u.fullName AS u_fullName, u.email AS u_email, u.empId AS u_empId,
                u.isAdmin AS u_isAdmin, u.isTrainer AS u_isTrainer, u.isEmployee AS u_isEmployee,
                d.id AS d_id, d.name AS d_name, s.id AS s_id, s.name AS s_name
         ${AUDIT_LIST_FROM} ${whereClause}
         ORDER BY a.${safeSortBy} ${order}, a.id ${order} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
        [...params, offset, limit]
    );

    const audits = rows.map(r => {
        const audit = new Audit(r);
        if (r.u_id) {
            audit.user = {
                id: r.u_id,
                fullName: r.u_fullName,
                email: r.u_email,
                empId: r.u_empId,
                isAdmin: r.u_isAdmin,
                isTrainer: r.u_isTrainer,
                isEmployee: r.u_isEmployee,
                department: r.d_id ? { id: r.d_id, name: r.d_name } : null,
                section: r.s_id ? { id: r.s_id, name: r.s_name } : null,
            };
        }
        return audit;
    });

    res.json(
        new ApiResponse(
            200,
            {
                audits,
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit),
                    limit,
                },
            },
            "Audit logs fetched successfully"
        )
    );
});

export const getAuditById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    let audit = await Audit.findById(id);
    if (!audit) throw new ApiError("Audit log not found", 404);

    audit = await populateAuditUser(audit);

    // Non-admins cannot see admin audit entries
    if (req.user && !req.user.isAdmin) {
        if (audit.user && audit.user.isAdmin) {
            throw new ApiError("Access denied: You don't have permission to view this audit log", 403);
        }

        if (!audit.user && audit.action &&
            /SYSTEM_ADMIN|SUPERADMIN|PRIVILEGE|ROLE_CHANGE|SYSTEM_SETTINGS/i.test(audit.action)) {
            throw new ApiError("Access denied: You don't have permission to view this audit log", 403);
        }
    }

    res.json(new ApiResponse(200, audit, "Audit log fetched successfully"));
});

// Generic endpoint for any page to log a view/action without a dedicated backend route.
export const logClientAction = asyncHandler(async (req, res) => {
    const { action, details } = req.body;

    if (!action || typeof action !== "string" || !/^[A-Z][A-Z0-9_]{2,49}$/.test(action)) {
        throw new ApiError("A valid action identifier (e.g. VIEW_DASHBOARD) is required", 400);
    }

    // Respond immediately so client logging never blocks page rendering.
    res.status(200).json(new ApiResponse(200, {}, "Action accepted"));

    // Only dedupe VIEW_* actions (prone to accidental duplicate calls from re-renders).
    // Mutations (ADD_/UPDATE_/DELETE_/etc.) are one-shot per user click and must never be dropped,
    // otherwise back-to-back actions on different targets (e.g. bulk delete) would silently disappear.
    if (action.startsWith("VIEW_")) {
        const throttleKey = `${req.user.id}:${action}`;
        const now = Date.now();
        const last = lastLoggedAt.get(throttleKey);
        if (last && now - last < THROTTLE_WINDOW_MS) {
            return;
        }
        lastLoggedAt.set(throttleKey, now);
    }

    let safeDetails = details && typeof details === "object" ? details : {};
    if (JSON.stringify(safeDetails).length > MAX_DETAILS_LENGTH) {
        safeDetails = { truncated: true };
    }

    logAudit(req.user.id, action, safeDetails, { req }).catch((err) =>
        console.error("logClientAction background logging error:", err.message)
    );
});

export const deleteAudit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const audit = await Audit.findById(id);
    if (!audit) throw new ApiError("Audit log not found", 404);

    await executeQuery("DELETE FROM audits WHERE id = ?", [id]);

    res.json(new ApiResponse(200, null, "Audit log deleted successfully"));
});