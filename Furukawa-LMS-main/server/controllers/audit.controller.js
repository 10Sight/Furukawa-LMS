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
const THROTTLE_WINDOW_MS = 5000;
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

export const getAllAudits = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 900);
    const offset = (page - 1) * limit;

    const filters = [];
    const params = [];

    // Role-based filtering using isAdmin boolean flag
    // Non-admins cannot see admin/superadmin activities
    let adminIds = [];
    if (req.user && !req.user.isAdmin) {
        const [admins] = await executeQuery("SELECT id FROM users WHERE isAdmin = 1");
        adminIds = admins.map(u => String(u.id));
    }

    // User filter
    if (req.query.userId) {
        const isId = !isNaN(parseInt(req.query.userId));

        if (isId) {
            const targetId = parseInt(req.query.userId);
            if (!req.user.isAdmin && adminIds.includes(String(targetId))) {
                filters.push("1=0"); // Block access to admin audit entries
            } else {
                filters.push("[user] = ?");
                params.push(String(targetId));
            }
        } else {
            const [users] = await executeQuery(
                "SELECT id FROM users WHERE (email LIKE ? OR fullName LIKE ?)",
                [`%${req.query.userId}%`, `%${req.query.userId}%`]
            );

            let allowedUserIds = users.map(u => String(u.id));
            if (!req.user.isAdmin) {
                allowedUserIds = allowedUserIds.filter(id => !adminIds.includes(id));
            }

            if (allowedUserIds.length > 0) {
                filters.push(`[user] IN (${allowedUserIds.map(id => `'${id}'`).join(',')})`);
            } else {
                filters.push("1=0");
            }
        }
    } else if (!req.user.isAdmin && adminIds.length > 0) {
        // Exclude admin users' audit entries
        const idList = adminIds.map(id => `'${id}'`).join(',');
        filters.push(`([user] NOT IN (${idList}) OR [user] IS NULL)`);
    }

    // Block sensitive system actions from non-admins
    if (req.user && !req.user.isAdmin) {
        filters.push(`(
            [user] IS NOT NULL 
            OR 
            ([user] IS NULL AND action NOT LIKE '%SYSTEM_ADMIN%'
                AND action NOT LIKE '%SUPERADMIN%'
                AND action NOT LIKE '%PRIVILEGE%'
                AND action NOT LIKE '%ROLE_CHANGE%'
                AND action NOT LIKE '%SYSTEM_SETTINGS%')
        )`);
    }

    // Action filter
    if (req.query.action) {
        filters.push("action LIKE ?");
        params.push(`%${req.query.action}%`);
    }

    // Search filter
    if (req.query.search) {
        const term = `%${req.query.search}%`;
        filters.push(`(action LIKE ? OR resourceType LIKE ? OR ip LIKE ?)`);
        params.push(term, term, term);
    }

    // Date range
    if (req.query.dateFrom) {
        filters.push("createdAt >= ?");
        params.push(new Date(req.query.dateFrom));
    }
    if (req.query.dateTo) {
        filters.push("createdAt <= ?");
        params.push(new Date(req.query.dateTo));
    }

    // IP
    if (req.query.ipAddress) {
        filters.push("ip LIKE ?");
        params.push(`%${req.query.ipAddress}%`);
    }

    // User Agent
    if (req.query.userAgent) {
        filters.push("userAgent LIKE ?");
        params.push(`%${req.query.userAgent}%`);
    }

    // Severity
    if (req.query.severity) {
        filters.push("severity = ?");
        params.push(req.query.severity.toLowerCase());
    }

    const whereClause = filters.length > 0 ? "WHERE " + filters.join(" AND ") : "";

    // Count total
    const [countRows] = await executeQuery(`SELECT COUNT(*) as count FROM audits ${whereClause}`, params);
    const total = countRows[0].count;

    // Sorting - validate against allowed columns only
    const sortBy = req.query.sortBy || 'createdAt';
    const allowedSorts = ['createdAt', 'action', 'severity', 'ip'];
    const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'createdAt';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    // MSSQL pagination
    const [rows] = await executeQuery(
        `SELECT * FROM audits ${whereClause} ORDER BY ${safeSortBy} ${order} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
        [...params, offset, limit]
    );

    let audits = rows.map(r => new Audit(r));
    audits = await Promise.all(audits.map(populateAuditUser));

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