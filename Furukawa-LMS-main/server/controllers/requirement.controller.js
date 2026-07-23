import mssql from "mssql";
import ExcelJS from "exceljs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { poolPromise } from "../db/connectDB.js";
import Audit from "../models/audit.model.js";
import RequirementLog from "../models/requirementLogs.model.js";
import RequirementToken from "../models/requirementToken.model.js";
import sendMail from "../utils/mail.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import ENV from "../configs/env.config.js";
import { hasPermission } from "../middlewares/roleAuth.middleware.js";

/* ============================================================
   SQL HELPER
============================================================ */

const executeSql = async (queryStr, params = [], transactionOrPool = null) => {
    const activeConn = transactionOrPool || await poolPromise;
    const request = activeConn.request();
    request.timeout = 300000;

    let formattedQuery = queryStr;

    for (let i = 0; i < params.length; i++) {
        const paramName = `p${i}`;
        request.input(paramName, params[i]);
        formattedQuery = formattedQuery.replace("?", `@${paramName}`);
    }

    const result = await request.query(formattedQuery);

    return [
        result.recordset || [],
        {
            affectedRows: result.rowsAffected
                ? result.rowsAffected.reduce((a, b) => a + b, 0)
                : 0,
            insertId:
                result.recordset &&
                    result.recordset.length > 0 &&
                    result.recordset[0].id
                    ? result.recordset[0].id
                    : null,
        },
    ];
};

const safeTrim = (v) => (v === null || v === undefined ? "" : String(v).trim());

const normalizeEmailList = (value) => {
    if (!value) return [];

    return String(value)
        .split(/[;,\r\n]+/)
        .map((email) => email.trim())
        .filter((email) => email && email.includes("@"));
};

const getValueIgnoreCase = (obj, keys) => {
    if (!obj) return undefined;
    for (const key of keys) {
        if (obj[key] !== undefined) return obj[key];
    }
    const keysLower = keys.map(k => k.toLowerCase());
    for (const k of Object.keys(obj)) {
        if (keysLower.includes(k.toLowerCase())) {
            return obj[k];
        }
    }
    return undefined;
};

const getCcEmailListFromHeads = (heads = []) => {
    const uniqueEmails = new Set();

    for (const head of heads || []) {
        const ccMailVal = getValueIgnoreCase(head, [
            "CCMail",
            "ccMail",
            "ccmail",
            "CCMAIL",
            "ccEmail",
            "ccEmails",
            "cc_email",
            "cc",
            "CC",
            "CC Mail",
            "CCEmail",
            "CCEmails",
        ]);

        for (const email of normalizeEmailList(ccMailVal)) {
            uniqueEmails.add(email.toLowerCase());
        }
    }

    return Array.from(uniqueEmails);
};

const getGlobalCcEmailsFromDb = async () => {
    try {
        const [rows] = await executeSql(`
            SELECT email
            FROM global_cc_emails WITH (NOLOCK)
            WHERE is_active = 1
              AND email IS NOT NULL
              AND LTRIM(RTRIM(email)) != ''
            ORDER BY id ASC
        `);

        return (rows || [])
            .flatMap((row) => normalizeEmailList(row.email))
            .map((email) => email.toLowerCase());
    } catch (error) {
        console.error("[GLOBAL-CC] Failed to fetch global CC emails:", error.message);
        return [];
    }
};

const mergeUniqueEmails = (...emailLists) => {
    const uniqueEmails = new Set();

    for (const list of emailLists || []) {
        for (const email of Array.isArray(list) ? list : normalizeEmailList(list)) {
            const normalized = String(email || "").trim().toLowerCase();
            if (normalized && normalized.includes("@")) {
                uniqueEmails.add(normalized);
            }
        }
    }

    return Array.from(uniqueEmails);
};

const isEmailLike = (value) => /@/.test(String(value || ""));

const cleanDisplayName = (value) => {
    const text = safeTrim(value);
    if (!text || isEmailLike(text)) return "";
    if (text.toLowerCase() === "section head") return "";
    return text;
};

const resolvePersonNameByEmail = async (email, fallbackName = "Section Head") => {
    const cleanEmail = safeTrim(email).toLowerCase();
    const cleanFallback = cleanDisplayName(fallbackName);

    if (!cleanEmail || !cleanEmail.includes("@")) {
        return cleanFallback || "Section Head";
    }

    try {
        const [rows] = await executeSql(
            `
            SELECT TOP 1
                COALESCE(
                    NULLIF(LTRIM(RTRIM(u.fullName)), ''),
                    NULLIF(LTRIM(RTRIM(u.userName)), ''),
                    NULLIF(LTRIM(RTRIM(sh.name)), '')
                ) AS displayName
            FROM (SELECT ? AS email) e
            LEFT JOIN users u WITH (NOLOCK)
                ON LOWER(LTRIM(RTRIM(u.email))) = LOWER(LTRIM(RTRIM(e.email)))
            LEFT JOIN section_heads sh WITH (NOLOCK)
                ON LOWER(LTRIM(RTRIM(sh.email))) = LOWER(LTRIM(RTRIM(e.email)))
            WHERE
                u.id IS NOT NULL
                OR sh.id IS NOT NULL
            `,
            [cleanEmail]
        );

        const dbName = cleanDisplayName(rows?.[0]?.displayName);
        return dbName || cleanFallback || "Section Head";
    } catch (error) {
        console.error("[APPROVER-NAME] Failed to resolve name for email:", cleanEmail, error.message);
        return cleanFallback || "Section Head";
    }
};

const resolveApproverNameFromUserOrEmail = async (user, fallbackEmail = "", fallbackName = "Section Head") => {
    const directName =
        cleanDisplayName(user?.fullName) ||
        cleanDisplayName(user?.name) ||
        cleanDisplayName(user?.userName) ||
        cleanDisplayName(user?.username);

    if (directName) return directName;

    const email = safeTrim(user?.email || fallbackEmail);
    return resolvePersonNameByEmail(email, fallbackName);
};

const REQUIREMENT_LOG_FIELDS = [
    { key: "salesPlan", oldColumn: "old_salesPlan", newColumn: "new_salesPlan" },
    { key: "prodPlan", oldColumn: "old_prodPlan", newColumn: "new_prodPlan" },
    { key: "prodPlanFN01", oldColumn: "old_prodPlanFN01", newColumn: "new_prodPlanFN01" },
    { key: "prodPlanFN02", oldColumn: "old_prodPlanFN02", newColumn: "new_prodPlanFN02" },
];

const isSameRequirementLogValue = (a, b) => {
    if (a === null || a === undefined || b === null || b === undefined) {
        return a === b;
    }

    const n1 = Number(a);
    const n2 = Number(b);

    if (Number.isFinite(n1) && Number.isFinite(n2)) {
        return n1 === n2;
    }

    return String(a) === String(b);
};

const parseRequirementLogJson = (value) => {
    if (!value) return {};
    if (typeof value === "object") return value;

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
        return {};
    }
};

const getChangedRequirementLogValues = (oldReq = {}, newReq = {}) => {
    const oldValues = {
        sectionName: oldReq.sectionName || newReq.sectionName || null,
        lineDescription: oldReq.lineDescription || newReq.lineDescription || null,
        monthName: oldReq.monthName || newReq.monthName || null,
        year: oldReq.year || newReq.year || null,
    };

    const newValues = {
        sectionName: newReq.sectionName || oldReq.sectionName || null,
        lineDescription: newReq.lineDescription || oldReq.lineDescription || null,
        monthName: newReq.monthName || oldReq.monthName || null,
        year: newReq.year || oldReq.year || null,
    };

    const changedKeys = [];

    for (const { key } of REQUIREMENT_LOG_FIELDS) {
        const oldValue = oldReq?.[key];
        const newValue = newReq?.[key];

        if (isSameRequirementLogValue(oldValue, newValue)) continue;

        oldValues[key] = oldValue;
        newValues[key] = newValue;
        changedKeys.push(key);
    }

    return { oldValues, newValues, changedKeys };
};

const resolveRequirementLogUser = async (req, transactionOrPool = null) => {
    const rawUserId = req?.user?.id ?? req?.user?._id ?? null;
    const numericUserId = Number(rawUserId);
    const userEmail = safeTrim(req?.user?.email).toLowerCase();

    let dbUser = null;

    try {
        if (rawUserId !== null && rawUserId !== undefined && Number.isInteger(numericUserId)) {
            const [rows] = await executeSql(
                `
                SELECT TOP 1
                    u.id,
                    u.fullName,
                    u.userName,
                    u.email,
                    u.role
                FROM users u WITH (NOLOCK)
                WHERE u.id = ?
                `,
                [numericUserId],
                transactionOrPool
            );

            dbUser = rows?.[0] || null;
        }

        if (!dbUser && userEmail) {
            const [rows] = await executeSql(
                `
                SELECT TOP 1
                    u.id,
                    u.fullName,
                    u.userName,
                    u.email,
                    u.role
                FROM users u WITH (NOLOCK)
                WHERE LOWER(LTRIM(RTRIM(u.email))) = ?
                `,
                [userEmail],
                transactionOrPool
            );

            dbUser = rows?.[0] || null;
        }
    } catch (error) {
        console.error("[REQUIREMENT-LOG-USER] Failed to resolve logged-in user:", error.message);
    }

    const updatedByName =
        cleanDisplayName(dbUser?.fullName) ||
        cleanDisplayName(dbUser?.userName) ||
        cleanDisplayName(req?.user?.fullName) ||
        cleanDisplayName(req?.user?.name) ||
        cleanDisplayName(req?.user?.userName) ||
        cleanDisplayName(req?.user?.username) ||
        safeTrim(dbUser?.email) ||
        safeTrim(req?.user?.email) ||
        "Unknown";

    return {
        employeeId:
            dbUser?.id ??
            (Number.isInteger(numericUserId) ? numericUserId : null),
        employeeRole: dbUser?.role || req?.user?.role || "User",
        updatedByName,
    };
};

const getActualRequirementLogChanges = (row) => {
    const oldValues = parseRequirementLogJson(row?.old_values);
    const newValues = parseRequirementLogJson(row?.new_values);
    const changes = [];

    for (const field of REQUIREMENT_LOG_FIELDS) {
        const oldValue =
            row?.[field.oldColumn] !== undefined && row?.[field.oldColumn] !== null
                ? row[field.oldColumn]
                : oldValues?.[field.key];

        const newValue =
            row?.[field.newColumn] !== undefined && row?.[field.newColumn] !== null
                ? row[field.newColumn]
                : newValues?.[field.key];

        // An update log must contain both old and new values.
        // This excludes create/upload records where no previous value exists.
        if (
            oldValue === undefined ||
            oldValue === null ||
            newValue === undefined ||
            newValue === null
        ) {
            continue;
        }

        if (!isSameRequirementLogValue(oldValue, newValue)) {
            changes.push({ key: field.key, oldValue, newValue });
        }
    }

    return changes;
};

const sendMailToMultipleRecipients = async (recipients, subject, htmlMsg, logPrefix) => {
    const emailList = Array.isArray(recipients)
        ? recipients
        : normalizeEmailList(recipients);

    if (!emailList.length) return [];

    const results = await Promise.allSettled(
        emailList.map((email) => sendMail(email, subject, htmlMsg, [], ""))
    );

    results.forEach((result, index) => {
        const email = emailList[index];
        if (result.status === "fulfilled") {
            console.log(`${logPrefix} Sent to: ${email}`);
        } else {
            console.error(`${logPrefix} Failed for ${email}:`, result.reason?.message || result.reason);
        }
    });

    return results;
};


const safeNumber = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? Math.round(n) : null;
};

const normalizeMonth = (m) => {
    const MONTHS = {
        jan: "January",
        january: "January",
        feb: "February",
        february: "February",
        mar: "March",
        march: "March",
        apr: "April",
        april: "April",
        may: "May",
        jun: "June",
        june: "June",
        jul: "July",
        july: "July",
        aug: "August",
        august: "August",
        sep: "September",
        sept: "September",
        september: "September",
        oct: "October",
        october: "October",
        nov: "November",
        november: "November",
        dec: "December",
        december: "December",
    };

    if (!m && m !== 0) return null;

    if (typeof m === "number") {
        const full = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        return full[m - 1] || null;
    }

    const key = String(m).trim().toLowerCase();
    return MONTHS[key] || MONTHS[key.slice(0, 3)] || null;
};

const getMonthNumber = (monthName) => {
    const list = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    const idx = list.findIndex(
        (m) => m.toLowerCase() === String(monthName || "").toLowerCase()
    );

    return idx >= 0 ? idx + 1 : null;
};

const getTokenField = (tokenDoc, camelName, snakeName) => {
    if (!tokenDoc) return undefined;

    return (
        tokenDoc?.[camelName] ??
        tokenDoc?.[snakeName] ??
        tokenDoc?.dataValues?.[camelName] ??
        tokenDoc?.dataValues?.[snakeName] ??
        tokenDoc?._doc?.[camelName] ??
        tokenDoc?._doc?.[snakeName]
    );
};

const findRequirementToken = async (token) => {
    const [rows] = await executeSql(
        `
        SELECT TOP 1 *
        FROM requirement_tokens
        WHERE token = ?
        `,
        [token]
    );

    return rows?.[0] || null;
};

const updateRequirementToken = async (token, updates) => {
    const fields = [];
    const values = [];

    if (updates.status !== undefined) {
        fields.push("status = ?");
        values.push(updates.status);
    }

    if (updates.rejection_reason !== undefined) {
        fields.push("rejection_reason = ?");
        values.push(updates.rejection_reason);
    }

    if (fields.length === 0) return;

    values.push(token);

    await executeSql(
        `
        UPDATE requirement_tokens
        SET ${fields.join(", ")}
        WHERE token = ?
        `,
        values
    );
};

const createRequirementTokenSafe = async ({
    token,
    requirementId = null,
    uploadBatchId = null,
    sectionCode = null,
    sectionName = null,
    recipientEmail,
    senderEmail,
    expiresAt,
    status = "pending",
}) => {
    await executeSql(
        `
        INSERT INTO requirement_tokens
        (
            token,
            requirement_id,
            recipient_email,
            sender_email,
            expires_at,
            status,
            created_at,
            upload_batch_id,
            section_code,
            section_name
        )
        VALUES (?, ?, ?, ?, ?, ?, GETDATE(), ?, ?, ?)
        `,
        [
            token,
            requirementId,
            recipientEmail,
            senderEmail || null,
            expiresAt,
            status,
            uploadBatchId,
            sectionCode,
            sectionName,
        ]
    );

    return {
        token,
        requirement_id: requirementId,
        recipient_email: recipientEmail,
        sender_email: senderEmail,
        expires_at: expiresAt,
        status,
        upload_batch_id: uploadBatchId,
        section_code: sectionCode,
        section_name: sectionName,
    };
};

const getPendingRequirementTokens = async () => {
    const [rows] = await executeSql(
        `
        SELECT *
        FROM requirement_tokens
        WHERE status = 'pending'
        `
    );

    return rows || [];
};

const autoApproveExpiredRequirements = async () => {
    try {
        const pendingTokens = await getPendingRequirementTokens();
        const now = new Date();

        for (const tokenDoc of pendingTokens || []) {
            const token = getTokenField(tokenDoc, "token", "token");
            const status = getTokenField(tokenDoc, "status", "status");
            const expiresAt =
                getTokenField(tokenDoc, "expiresAt", "expires_at") ||
                getTokenField(tokenDoc, "expires_at", "expiresAt");

            const uploadBatchId = getTokenField(
                tokenDoc,
                "uploadBatchId",
                "upload_batch_id"
            );

            const sectionCode = getTokenField(
                tokenDoc,
                "sectionCode",
                "section_code"
            );

            const sectionName = getTokenField(
                tokenDoc,
                "sectionName",
                "section_name"
            );

            const requirementId =
                getTokenField(tokenDoc, "requirementId", "requirement_id") ||
                getTokenField(tokenDoc, "requirement_id", "requirementId");

            if (!token || status !== "pending") continue;
            if (!expiresAt || new Date(expiresAt) > now) continue;

            if (uploadBatchId && sectionCode) {
                await executeSql(
                    `
                    UPDATE requirements
                    SET
                        is_active = 1,
                        approvalStatus = 'system_approved',
                        approvedBy = 'System',
                        approvedByEmail = '',
                        approvedAt = GETDATE(),
                        approvalSource = 'system',
                        rejectedBy = NULL,
                        rejectedAt = NULL
                    WHERE uploadBatchId = ?
                      AND sectionCode = ?
                      AND ISNULL(approvalStatus, 'pending') = 'pending'
                    `,
                    [uploadBatchId, sectionCode]
                );
            } else if (requirementId) {
                await executeSql(
                    `
                    UPDATE requirements
                    SET
                        is_active = 1,
                        approvalStatus = 'system_approved',
                        approvedBy = 'System',
                        approvedByEmail = '',
                        approvedAt = GETDATE(),
                        approvalSource = 'system',
                        rejectedBy = NULL,
                        rejectedAt = NULL
                    WHERE id = ?
                      AND ISNULL(approvalStatus, 'pending') = 'pending'
                    `,
                    [requirementId]
                );
            }

            await updateRequirementToken(token, {
                status: "system_approved",
            });
        }
    } catch (e) {
        console.error("[AUTO-APPROVE] Error:", e.message);
    }
};

const findSectionHeadsForRequirement = async (reqRow) => {
    const sectionCode = safeTrim(reqRow.sectionCode);

    if (!sectionCode) return [];

    const [heads] = await executeSql(
        `
        SELECT DISTINCT
            sh.email,
            COALESCE(
                NULLIF(LTRIM(RTRIM(sh.name)), ''),
                NULLIF(LTRIM(RTRIM(u.fullName)), ''),
                NULLIF(LTRIM(RTRIM(u.userName)), ''),
                'Section Head'
            ) AS name,
            sh.CCMail,
            s.id AS sectionId,
            s.name AS dbSectionName,
            s.uniCode AS dbSectionCode
        FROM section_heads sh
        INNER JOIN sections s
            ON sh.sectionId = s.id
        LEFT JOIN users u WITH (NOLOCK)
            ON LOWER(LTRIM(RTRIM(u.email))) = LOWER(LTRIM(RTRIM(sh.email)))
        WHERE
            sh.email IS NOT NULL
            AND LTRIM(RTRIM(sh.email)) != ''
            AND UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(?)))
        `,
        [sectionCode]
    );

    return heads || [];
};



const sendRequirementEditApprovalMail = async ({
    req,
    requirementId,
    oldReq,
    newReq,
}) => {
    try {
        const heads = await findSectionHeadsForRequirement(newReq);
        const sectionWiseCcEmails = getCcEmailListFromHeads(heads);
        const globalCcEmails = await getGlobalCcEmailsFromDb();
        const ccEmails = mergeUniqueEmails(sectionWiseCcEmails, globalCcEmails);
        console.log("BASE_URL =", process.env.BASE_URL);
        console.log("APP_BASE_URL =", process.env.APP_BASE_URL);
        console.log("HOST =", `${req.protocol}://${req.get("host")}`);

        console.log("[REQ-EDIT-MAIL] Looking for section head:", {
            requirementId,
            sectionCode: newReq.sectionCode,
            sectionName: newReq.sectionName,
            lineCode: newReq.lineCode,
            lineDescription: newReq.lineDescription,
            found: heads.length,
        });

        if (!heads || heads.length === 0) {
            const [sampleHeads] = await executeSql(
                `
                SELECT TOP 20
                    sh.email,
                    sh.name,
                    sh.sectionId,
                    s.name AS sectionName,
                    s.uniCode
                FROM section_heads sh
                LEFT JOIN sections s
                    ON sh.sectionId = s.id
                WHERE sh.email IS NOT NULL
                  AND LTRIM(RTRIM(sh.email)) != ''
                `
            );

            console.log("[REQ-EDIT-MAIL] No matching section head found.");
            console.log("[REQ-EDIT-MAIL] Available sample heads:", sampleHeads);

            return {
                sent: false,
                reason: "No matching section head found for this requirement section/line",
            };
        }

        await executeSql(
            `
            UPDATE requirements
            SET
                approvalOwnerName = ?,
                approvalOwnerEmail = ?
            WHERE id = ?
            `,
            [
                getValueIgnoreCase(heads[0], ["name", "Name", "NAME"]) || "Section Head",
                getValueIgnoreCase(heads[0], ["email", "Email", "EMAIL"]) || "",
                requirementId,
            ]
        );

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

        await createRequirementTokenSafe({
            token,
            requirementId,
            recipientEmail: getValueIgnoreCase(heads[0], ["email", "Email", "EMAIL"]) || "",
            senderEmail: req.user?.email || "admin@furukawa.com",
            expiresAt,
            status: "pending",
        });

        const BASE_URL =
            process.env.BASE_URL ||
            process.env.APP_BASE_URL ||
            `${req.protocol}://${req.get("host")}`;

        // Single requirement edit approval should follow the same flow as bulk upload:
        // Mail button opens the SetRequirement page. If the user is not logged in,
        // frontend auth guard will redirect to Login, then return to the same page.
        const FRONTEND_BASE_URL =
            process.env.FRONTEND_BASE_URL ||
            process.env.CLIENT_URL ||
            process.env.APP_FRONTEND_URL ||
            "http://192.168.90.19:5174";

        const requirementDashboardUrl = `${FRONTEND_BASE_URL.replace(/\/$/, "")}/dashboard/requirements?approval=pending&requirementId=${encodeURIComponent(requirementId)}&sectionCode=${encodeURIComponent(safeTrim(newReq.sectionCode) || "")}&year=${encodeURIComponent(newReq.year || "")}&month=${encodeURIComponent(newReq.monthName || "")}`;
        const approveUrl = requirementDashboardUrl;

        const updatedByName =
            req.user?.fullName ||
            req.user?.name ||
            req.user?.username ||
            "Admin";

        const updatedByRole = req.user?.role || "Admin";

        const oldSP = oldReq.salesPlan ?? "—";
        const oldPP = oldReq.prodPlan ?? "—";
        const oldFN01 = oldReq.prodPlanFN01 ?? "—";
        const oldFN02 = oldReq.prodPlanFN02 ?? "—";
        const newSP = newReq.salesPlan ?? "—";
        const newPP = newReq.prodPlan ?? "—";
        const newFN01 = newReq.prodPlanFN01 ?? "—";
        const newFN02 = newReq.prodPlanFN02 ?? "—";

        const sectionCode = safeTrim(newReq.sectionCode);
        const sectionName = safeTrim(getValueIgnoreCase(heads[0], ["dbSectionName", "DBSECTIONNAME"]) || newReq.sectionName);
        const lineDescription = safeTrim(newReq.lineDescription);

        const subject = `Requirement Approval Required — ${sectionName || sectionCode}`;

        const getHtmlMsg = (recipientName, showButtons) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr>
<td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">

<tr>
<td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:30px 36px;text-align:center;">
    <div style="font-size:38px;margin-bottom:10px;">📋</div>
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Requirement Change Approval</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">
        Action required within 24 hours
    </p>
</td>
</tr>

<tr>
<td style="padding:26px 36px 8px;">
    <p style="font-size:15px;color:#334155;margin:0 0 8px;">
        Dear <strong>${recipientName}</strong>,
    </p>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">
        A manpower requirement has been edited for your section.
        The updated value is currently <strong style="color:#dc2626;">pending approval</strong>.
        Please open the requirement page, login if required, and approve the change from the SetRequirement page.
    </p>
</td>
</tr>

<tr>
<td style="padding:18px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Section Code</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${sectionCode || "-"}</td>
        </tr>
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Section Name</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${sectionName || "-"}</td>
        </tr>
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Section Description</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${lineDescription || "-"}</td>
        </tr>
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Month / Year</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${newReq.monthName || "-"} ${newReq.year || ""}</td>
        </tr>
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Updated By</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${updatedByName} (${updatedByRole})</td>
        </tr>
    </table>
</td>
</tr>

<tr>
<td style="padding:0 36px 22px;">
    <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 10px;">Changed Values:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
        <tr>
            <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Field</th>
            <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:center;border:1px solid #1e3a5f;">Previous</th>
            <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:center;border:1px solid #1e3a5f;">New</th>
        </tr>
        <tr>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:700;">Sales Plan</td>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">${oldSP}</td>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:800;">${newSP}</td>
        </tr>

        <tr>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:700;">FN01 Plan</td>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">${oldFN01}</td>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:800;">${newFN01}</td>
        </tr>
        <tr>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:700;">FN02 Plan</td>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">${oldFN02}</td>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:800;">${newFN02}</td>
        </tr>
    </table>
</td>
</tr>

${showButtons ? `
<tr>
<td style="padding:8px 36px 28px;text-align:center;">
    <a href="${approveUrl}" style="background:#2563eb;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;margin-right:10px;">
        View Requirement
    </a>
    <p style="font-size:12px;color:#64748b;line-height:1.5;margin:12px 0 0;">
        Please login with your assigned section-head account. You will see only your assigned section requirements.
    </p>

</td>
</tr>
` : ''}

<tr>
<td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 36px;text-align:center;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">
        Automated notification from <strong>Furukawa LMS</strong>.
    </p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;

        const headPromises = heads.map((h) => {
            const recipientName = getValueIgnoreCase(h, ["name", "Name", "NAME"]) || "Section Head";
            const email = getValueIgnoreCase(h, ["email", "Email", "EMAIL"]);
            const htmlMsgWithButtons = getHtmlMsg(recipientName, true);
            if (email) {
                return sendMail(email, subject, htmlMsgWithButtons, [], "");
            }
            return Promise.resolve({ sent: false, reason: "No email address found" });
        });

        const ccRecipientName = getValueIgnoreCase(heads[0], ["name", "Name", "NAME"]) || "Section Head";
        const htmlMsgWithoutButtons = getHtmlMsg(`${ccRecipientName} (CC)`, false);

        const headResults = await Promise.allSettled(headPromises);

        headResults.forEach((r, i) => {
            const email = getValueIgnoreCase(heads[i], ["email", "Email", "EMAIL"]) || `Index ${i}`;
            if (r.status === "fulfilled") {
                console.log(`[REQ-EDIT-MAIL] Sent to head: ${email}`);
            } else {
                console.error(`[REQ-EDIT-MAIL] Failed for head ${email}:`, r.reason?.message || r.reason);
            }
        });

        const ccResults = await sendMailToMultipleRecipients(
            ccEmails,
            subject,
            htmlMsgWithoutButtons,
            "[REQ-EDIT-MAIL-CC]"
        );

        return {
            sent: [...headResults, ...ccResults].some((r) => r.status === "fulfilled"),
            recipientCount: heads.length,
            ccRecipientCount: ccEmails.length,
            ccRecipients: ccEmails,
        };
    } catch (err) {
        console.error("[REQ-EDIT-MAIL] Outer error:", err.message, err.stack);
        return {
            sent: false,
            reason: err.message,
        };
    }
};

/* ============================================================
   CREATE SINGLE REQUIREMENT
============================================================ */

export const createRequirement = asyncHandler(async (req, res) => {
    const {
        srNo,
        sectionCode,
        sectionName,
        lineCode,
        lineDescription,
        monthName,
        month,
        monthNumber,
        year,
        salesPlan,
        prodPlan,
        prodPlanFN01,
        prodPlanFN02,
        count,
    } = req.body;

    const loggedInRole = String(req.user?.role || "").trim().toUpperCase();
    const isSuperUser =
        req.user?.isAdmin === true ||
        req.user?.isAdmin === 1 ||
        loggedInRole === "SUPERADMIN" ||
        loggedInRole === "ADMIN";

    if (!isSuperUser) {
        const assignedSections = await getAssignedRequirementSectionsForUser(req);
        if (assignedSections?.noAssignedSection) {
            throw new ApiError("You are not allowed to create requirements. No section is assigned to you.", 403);
        }
        const codeMatched = assignedSections?.sectionCodes?.some(
            (code) => String(code).trim().toUpperCase() === String(sectionCode || "").trim().toUpperCase()
        );
        const nameMatched = assignedSections?.sectionNames?.some(
            (name) => String(name).trim().toUpperCase() === String(sectionName || "").trim().toUpperCase()
        );
        if (!codeMatched && !nameMatched) {
            throw new ApiError("You can only create requirements for your assigned sections.", 403);
        }
    }

    const finalMonthName = normalizeMonth(monthName || month);
    const finalMonthNumber =
        monthNumber || getMonthNumber(finalMonthName) || null;

    const query = `
        INSERT INTO requirements
        (
            srNo,
            sectionCode,
            sectionName,
            lineCode,
            lineDescription,
            monthName,
            monthNumber,
            salesPlan,
            prodPlan,
            prodPlanFN01,
            prodPlanFN02,
            year,
            is_active,
            approvalStatus,
            createdAt
        )
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
    `;

    const [rows] = await executeSql(query, [
        srNo || null,
        sectionCode || "",
        sectionName || "",
        lineCode || "",
        lineDescription || "",
        finalMonthName,
        finalMonthNumber,
        salesPlan !== undefined ? salesPlan : count || 0,
        prodPlan !== undefined ? prodPlan : count || 0,
        prodPlanFN01 !== undefined ? prodPlanFN01 : (prodPlan !== undefined ? prodPlan : count || 0),
        prodPlanFN02 !== undefined ? prodPlanFN02 : 0,
        year || new Date().getFullYear(),
        1,
        "approved",
    ]);

    const requirementId = rows?.[0]?.id || null;

    try {
        await Audit.create({
            user: req.user?._id || req.user?.id,
            action: "CREATE_REQUIREMENT",
            resourceType: "Requirement",
            resourceId: String(requirementId),
            details: {
                new_values: { ...req.body, id: requirementId },
            },
        });
    } catch (logErr) {
        console.error("Failed to log requirement creation:", logErr.message);
    }

    res.status(201).json(
        new ApiResponse(
            201,
            { id: requirementId, ...req.body },
            "Requirement created successfully"
        )
    );
});

/* ============================================================
   UPLOAD REQUIREMENTS FROM EXCEL + SEND APPROVAL EMAILS
============================================================ */

export const addRequirements = asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError("No file uploaded", 400);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const MONTH_KEYS = [
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
    ];

    const MONTH_FULL = {
        jan: "January",
        feb: "February",
        mar: "March",
        apr: "April",
        may: "May",
        jun: "June",
        jul: "July",
        aug: "August",
        sep: "September",
        oct: "October",
        nov: "November",
        dec: "December",
    };

    const MONTH_ABBR_MAP = {
        jan: "jan", january: "jan",
        feb: "feb", february: "feb",
        mar: "mar", march: "mar",
        apr: "apr", april: "apr",
        may: "may",
        jun: "jun", june: "jun",
        jul: "jul", july: "jul",
        aug: "aug", august: "aug",
        sep: "sep", sept: "sep", september: "sep",
        oct: "oct", october: "oct",
        nov: "nov", november: "nov",
        dec: "dec", december: "dec",
    };

    const norm = (s) =>
        (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");

    const readCell = (cell) => {
        if (!cell) return null;

        let val = cell.isMerged && cell.master ? cell.master.value : cell.value;

        if (val === null || val === undefined) return null;

        if (typeof val === "object") {
            if (val.result !== undefined) val = val.result;
            else if (val.text !== undefined) val = val.text;
            else if (val.richText) val = val.richText.map((x) => x.text).join("");
            else if (val instanceof Date) val = val.toISOString();
            else val = val.toString();
        }

        if (val === null || val === undefined) return null;

        return String(val).trim();
    };

    const isSalesHeader = (txt) => norm(txt).includes("sales");
    const isProdHeader = (txt) => norm(txt).includes("prod");

    const targetSheet = workbook.worksheets[0];

    if (!targetSheet) {
        throw new ApiError("Invalid file format. No worksheet found.", 400);
    }

    let headerRowIdx = -1;
    let headerMap = {};
    let monthStartColMap = {};

    targetSheet.eachRow((row, rowNumber) => {
        if (headerRowIdx !== -1) return;

        let hasSectionCode = false;
        let hasAnyMonth = false;
        const tempHeader = {};
        const tempMonthStarts = {};

        row.eachCell({ includeEmpty: false }, (cell, colNum) => {
            const raw = readCell(cell);
            if (!raw) return;

            const key = norm(raw);
            if (!tempHeader[key]) tempHeader[key] = colNum;

            if (key === "section code") hasSectionCode = true;

            const mk = MONTH_ABBR_MAP[key];
            if (mk) {
                if (!tempMonthStarts[mk]) tempMonthStarts[mk] = colNum;
                hasAnyMonth = true;
            }
        });

        if (hasSectionCode && hasAnyMonth) {
            headerRowIdx = rowNumber;
            headerMap = tempHeader;
            monthStartColMap = tempMonthStarts;
        }
    });

    if (headerRowIdx === -1) {
        throw new ApiError("Invalid file format. Header row missing.", 400);
    }

    const subHeaderRowIdx = headerRowIdx + 1;
    const subHeaderRow = targetSheet.getRow(subHeaderRowIdx);

    const colOf = (...keys) => {
        for (const k of keys) {
            const idx = headerMap[norm(k)];
            if (idx) return idx;
        }
        return null;
    };

    const COL = {
        srNo: colOf("sr. no.", "sr. no", "sr no", "sr"),
        sectionCode: colOf("section code"),
        sectionName: colOf("section"),
        // New format: line code is removed. This column is treated as section description only.
        sectionDescUnicode: colOf("section description", "sectiondescunicode", "section desc unicode", "description line", "description"),
        descriptionLine: colOf("section description", "description line", "description"),
        year: colOf("year"),
        category: colOf("category"),
    };

    const getCellVal = (row, colIdx) =>
        colIdx ? readCell(row.getCell(colIdx)) : null;

    const subHeaderRoleMap = {};
    const allMonthCols = Object.values(monthStartColMap).filter(Boolean);

    if (allMonthCols.length > 0) {
        const scanStart = Math.min(...allMonthCols);
        const maxScanCol = Math.max(...allMonthCols) + 24;

        for (let colNum = scanStart; colNum <= maxScanCol; colNum++) {
            const cell = subHeaderRow.getCell(colNum);
            let effectiveCell = cell;

            try {
                if (cell.isMerged && cell.master && cell.master !== cell) {
                    effectiveCell = cell.master;
                }
            } catch (_) { }

            const rawVal = readCell(effectiveCell);

            if (!rawVal) subHeaderRoleMap[colNum] = "unknown";
            else if (isSalesHeader(rawVal)) subHeaderRoleMap[colNum] = "sales";
            else if (isProdHeader(rawVal)) subHeaderRoleMap[colNum] = "prod";
            else subHeaderRoleMap[colNum] = "unknown";
        }
    }

    const monthsSortedByCols = MONTH_KEYS.filter(
        (mk) => monthStartColMap[mk] != null
    ).sort((a, b) => monthStartColMap[a] - monthStartColMap[b]);

    const monthColMap = {};

    for (let i = 0; i < monthsSortedByCols.length; i++) {
        const mk = monthsSortedByCols[i];
        const startCol = monthStartColMap[mk];

        const salesCol = startCol;
        const fn01Col = startCol + 1;
        const fn02Col = startCol + 2;

        monthColMap[mk] = { salesCol, fn01Col, fn02Col };
    }

    const rowsToProcess = [];

    targetSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= subHeaderRowIdx) return;

        const sectionCode = getCellVal(row, COL.sectionCode);
        const sectionName = getCellVal(row, COL.sectionName);

        if (!sectionCode && !sectionName) return;
        if (norm(sectionCode) === "section code") return;

        const srNo = safeNumber(getCellVal(row, COL.srNo)) || null;
        const sectionDescUnicode = getCellVal(row, COL.sectionDescUnicode) || "";
        const descriptionLine = getCellVal(row, COL.descriptionLine) || "";
        const yearStr = getCellVal(row, COL.year);
        const category = getCellVal(row, COL.category);
        const year = yearStr
            ? parseInt(String(yearStr).trim(), 10)
            : new Date().getFullYear();

        for (const mk of MONTH_KEYS) {
            const m = monthColMap[mk];
            if (!m) continue;

            const sp = safeNumber(readCell(row.getCell(m.salesCol)));
            const fn01 = safeNumber(readCell(row.getCell(m.fn01Col)));
            const fn02 = safeNumber(readCell(row.getCell(m.fn02Col)));

            // IMPORTANT:
            // Earlier code skipped the month when Sales/FN01/FN02 were all blank/null.
            // Requirement: if Section Code is present in Excel, the section must be saved
            // even when all monthly values are 0/blank. So every detected month is inserted
            // with 0 values. Explicit 0 and blank are both treated as 0 for upload rows.
            const pp = (fn01 || 0) + (fn02 || 0);

            rowsToProcess.push({
                srNo,
                sectionCode: safeTrim(sectionCode) || null,
                sectionName: safeTrim(sectionName) || null,
                // New format has no line code. Keep lineCode blank so upload depends only on Section Code.
                lineCode: "",
                lineDescription: safeTrim(descriptionLine || sectionDescUnicode) || null,
                category: safeTrim(category) || null,
                monthName: MONTH_FULL[mk],
                monthNumber: MONTH_KEYS.indexOf(mk) + 1,
                year,
                salesPlan: sp !== null ? sp : 0,
                prodPlan: pp,
                prodPlanFN01: fn01 !== null ? fn01 : 0,
                prodPlanFN02: fn02 !== null ? fn02 : 0,
            });
        }
    });

    if (rowsToProcess.length === 0) {
        throw new ApiError("No valid data found in the Excel file.", 400);
    }

    const [dbSections] = await executeSql("SELECT id, name, uniCode FROM [sections]");

    const normalizeUnicode = (str) => {
        if (!str) return "";

        return str
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    };

    const validSectionsMap = new Map();

    dbSections.forEach((s) => {
        const codeKey = normalizeUnicode(s.uniCode);
        if (!codeKey) return;

        validSectionsMap.set(codeKey, {
            id: s.id,
            name: safeTrim(s.name),
            uniCode: safeTrim(s.uniCode),
        });
    });

    const validRowsToProcess = [];
    const invalidSections = new Set();

    for (const row of rowsToProcess) {
        const codeKey = normalizeUnicode(row.sectionCode);
        const matchedSection = validSectionsMap.get(codeKey);

        if (matchedSection) {
            // IMPORTANT: Excel section name can be wrong. Always use DB section name/code after Unicode match.
            row.sectionId = matchedSection.id;
            row.sectionCode = matchedSection.uniCode;
            row.sectionName = matchedSection.name;
            row.lineCode = "";
            validRowsToProcess.push(row);
        } else {
            invalidSections.add(`${row.sectionCode || "Blank Section Code"}`);
        }
    }

    if (invalidSections.size > 0) {
        const ignoredList = Array.from(invalidSections).slice(0, 10).join("', '");
        console.log(`Skipped requirement rows because Section Code was not found in sections.uniCode: '${ignoredList}'`);
    }

    if (validRowsToProcess.length === 0) {
        throw new ApiError(
            "Validation Failed: None of the Section Codes in the Excel file exist in the system. No data was uploaded.",
            400
        );
    }

    const loggedInRole = String(req.user?.role || "").trim().toUpperCase();
    const isSuperUser =
        req.user?.isAdmin === true ||
        req.user?.isAdmin === 1 ||
        loggedInRole === "SUPERADMIN" ||
        loggedInRole === "ADMIN";

    if (!isSuperUser) {
        const assignedSections = await getAssignedRequirementSectionsForUser(req);
        if (assignedSections?.noAssignedSection) {
            throw new ApiError("You are not allowed to upload requirements. No section is assigned to you.", 403);
        }
        
        for (const row of validRowsToProcess) {
            const codeMatched = assignedSections?.sectionCodes?.some(
                (code) => String(code).trim().toUpperCase() === String(row.sectionCode || "").trim().toUpperCase()
            );
            const nameMatched = assignedSections?.sectionNames?.some(
                (name) => String(name).trim().toUpperCase() === String(row.sectionName || "").trim().toUpperCase()
            );
            if (!codeMatched && !nameMatched) {
                throw new ApiError(`You are not allowed to upload requirements for section ${row.sectionCode || row.sectionName}.`, 403);
            }
        }
    }

    // Same Section Unicode should not be saved multiple times in one upload.
    // If Excel contains the same Section Code more than once, the later row replaces the earlier row.
    const uniqueRowsMap = new Map();
    const duplicateUploadSections = new Set();

    for (const row of validRowsToProcess) {
        const uniqueKey = [
            normalizeUnicode(row.sectionCode),
            String(row.monthName || "").trim().toLowerCase(),
            String(row.year || "").trim(),
        ].join("|");

        if (uniqueRowsMap.has(uniqueKey)) {
            duplicateUploadSections.add(row.sectionCode);
        }

        uniqueRowsMap.set(uniqueKey, row);
    }

    if (duplicateUploadSections.size > 0) {
        console.log(
            `[UPLOAD] Duplicate Section Code rows found in Excel and replaced by latest row: ${Array.from(duplicateUploadSections).join(", ")}`
        );
    }

    const finalRowsToProcess = Array.from(uniqueRowsMap.values());

    // Mutate rowsToProcess in-place so all downstream logic works without changes
    rowsToProcess.length = 0;
    rowsToProcess.push(...finalRowsToProcess);

    const conn = await poolPromise;
    const transaction = new mssql.Transaction(conn);
    let totalInsertedRows = 0;

    try {
        await transaction.begin();



        const uploadBatchId = `BATCH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const yearsToUpdate = [...new Set(rowsToProcess.map((r) => r.year).filter(Boolean))];
        const sectionCodesToReplace = [
            ...new Set(rowsToProcess.map((r) => safeTrim(r.sectionCode)).filter(Boolean)),
        ];
        const placeholdersYears = yearsToUpdate.map(() => "?").join(",");
        const placeholdersSectionCodes = sectionCodesToReplace.map(() => "?").join(",");

        // Captured BEFORE the delete below so the upload history log can show
        // what each section/month/year requirement looked like beforehand.
        let priorRequirementRows = [];

        if (yearsToUpdate.length > 0 && sectionCodesToReplace.length > 0) {
            const scopeParams = [...yearsToUpdate, ...sectionCodesToReplace];

            const [priorRows] = await executeSql(
                `
                SELECT *
                FROM requirements WITH (NOLOCK)
                WHERE year IN (${placeholdersYears})
                  AND sectionCode IN (${placeholdersSectionCodes})
                `,
                scopeParams,
                transaction
            );

            priorRequirementRows = priorRows || [];

            await executeSql(
                `
                DELETE FROM requirements
                WHERE year IN (${placeholdersYears})
                  AND sectionCode IN (${placeholdersSectionCodes})
                `,
                scopeParams,
                transaction
            );
        }

        const [existingReqs] = await executeSql(
            `
            SELECT *
            FROM requirements WITH (NOLOCK)
            WHERE year IN (${placeholdersYears})
            `,
            yearsToUpdate,
            transaction
        );

        const makeKey = (r) =>
            `${safeTrim(r.sectionCode).toLowerCase()}|${String(r.monthName || "").trim().toLowerCase()}|${r.year || ""}`;

        const existingMap = new Map();

        existingReqs.forEach((r) => {
            existingMap.set(makeKey(r), r);
        });

        const rowsToInsert = [];
        const rowsToUpdate = [];

        rowsToProcess.forEach((r) => {
            const key = makeKey(r);
            const existingReq = existingMap.get(key);

            if (existingReq) {
                r.id = existingReq.id;
                r.oldReq = existingReq;
                rowsToUpdate.push(r);
            } else {
                rowsToInsert.push(r);
            }
        });

        const chunkSize = 50;

        for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
            const chunk = rowsToInsert.slice(i, i + chunkSize);
            const paramsArray = [];

            chunk.forEach((row) => {
                paramsArray.push(
                    row.srNo,
                    row.sectionCode,
                    row.sectionName,
                    row.lineCode,
                    row.lineDescription,
                    row.monthName,
                    row.monthNumber,
                    row.salesPlan,
                    row.prodPlan,
                    row.prodPlanFN01 || 0,
                    row.prodPlanFN02 || 0,
                    row.year,
                    0,
                    uploadBatchId,
                    "pending",
                    row.category
                );
            });

            const placeholders = chunk
                .map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .join(", ");

            const insertQuery = `
                INSERT INTO requirements
                (
                    srNo,
                    sectionCode,
                    sectionName,
                    lineCode,
                    lineDescription,
                    monthName,
                    monthNumber,
                    salesPlan,
                    prodPlan,
                    prodPlanFN01,
                    prodPlanFN02,
                    year,
                    is_active,
                    uploadBatchId,
                    approvalStatus,
                    category
                )
                OUTPUT INSERTED.id, INSERTED.srNo, INSERTED.sectionCode, INSERTED.lineCode, INSERTED.monthName, INSERTED.year, INSERTED.sectionName, INSERTED.lineDescription, INSERTED.salesPlan, INSERTED.prodPlan, INSERTED.prodPlanFN01, INSERTED.prodPlanFN02, INSERTED.category
                VALUES ${placeholders}
            `;

            const [insertedRows, meta] = await executeSql(
                insertQuery,
                paramsArray,
                transaction
            );

            totalInsertedRows += meta?.affectedRows || chunk.length;

            const insertedIdByKey = new Map();
            (insertedRows || []).forEach((ir) => {
                insertedIdByKey.set(makeKey(ir), ir.id);
            });
            chunk.forEach((row) => {
                const insertedId = insertedIdByKey.get(makeKey(row));
                if (insertedId) row.id = insertedId;
            });
        }

        let updateCount = 0;

        for (const row of rowsToUpdate) {
            const updateQuery = `
                UPDATE requirements
                SET
                    srNo = ?,
                    sectionCode = ?,
                    sectionName = ?,
                    lineCode = ?,
                    lineDescription = ?,
                    monthNumber = ?,
                    salesPlan = ?,
                    prodPlan = ?,
                    prodPlanFN01 = ?,
                    prodPlanFN02 = ?,
                    is_active = ?,
                    uploadBatchId = ?,
                    approvalStatus = ?,
                    category = ?,
                    approvalSource = NULL,
                    approvedBy = NULL,
                    approvedByEmail = NULL,
                    approvedAt = NULL,
                    rejectedBy = NULL,
                    rejectedAt = NULL
                WHERE id = ?
            `;

            await executeSql(
                updateQuery,
                [
                    row.srNo,
                    row.sectionCode,
                    row.sectionName,
                    row.lineCode,
                    row.lineDescription,
                    row.monthNumber,
                    row.salesPlan,
                    row.prodPlan,
                    row.prodPlanFN01 || 0,
                    row.prodPlanFN02 || 0,
                    0,
                    uploadBatchId,
                    "pending",
                    row.category,
                    row.id,
                ],
                transaction
            );

            updateCount++;
        }

        totalInsertedRows += updateCount;

        await transaction.commit();

        try {
            await Audit.create({
                user: req.user?._id || req.user?.id,
                action: "UPLOAD_REQUIREMENTS",
                resourceType: "Requirement",
                details: {
                    count: totalInsertedRows,
                    uploadBatchId,
                    message: `Uploaded/Updated ${totalInsertedRows} requirements via Excel.`,
                },
            });
        } catch (logErr) {
            console.error("Failed to log requirement upload:", logErr.message);
        }

        // Granular per-row history log for the Excel upload, mirroring the manual-edit
        // log so both origins show up in RequirementUpdateLogs with the same shape.
        try {
            const priorMap = new Map();
            priorRequirementRows.forEach((r) => priorMap.set(makeKey(r), r));

            const processedKeys = new Set(rowsToProcess.map((r) => makeKey(r)));
            const logUser = await resolveRequirementLogUser(req);
            const ZERO_BASELINE = { salesPlan: 0, prodPlan: 0, prodPlanFN01: 0, prodPlanFN02: 0 };

            for (const row of rowsToProcess) {
                const priorRow = priorMap.get(makeKey(row)) || null;
                const oldReqForDiff = priorRow || {
                    sectionName: row.sectionName,
                    lineDescription: row.lineDescription,
                    monthName: row.monthName,
                    year: row.year,
                    ...ZERO_BASELINE,
                };

                const { oldValues, newValues, changedKeys } =
                    getChangedRequirementLogValues(oldReqForDiff, row);

                if (changedKeys.length === 0) continue;

                await RequirementLog.create({
                    requirement_id: row.id || priorRow?.id || null,
                    section_id: validSectionsMap.get(normalizeUnicode(row.sectionCode))?.id || null,
                    action_type: "UPLOAD",
                    old_values: oldValues,
                    new_values: newValues,
                    employee_id: logUser.employeeId,
                    employee_role: logUser.employeeRole,
                    updated_by_name: logUser.updatedByName,
                });
            }

            // Section/month/year requirements that existed before this upload but were not
            // re-supplied by the sheet (e.g. a 6-month sheet uploaded over an annual one)
            // get wiped by the DELETE above. Log that drop too so it isn't invisible in history.
            for (const [key, priorRow] of priorMap.entries()) {
                if (processedKeys.has(key)) continue;

                const newReqForDiff = {
                    sectionName: priorRow.sectionName,
                    lineDescription: priorRow.lineDescription,
                    monthName: priorRow.monthName,
                    year: priorRow.year,
                    ...ZERO_BASELINE,
                };

                const { oldValues, newValues, changedKeys } =
                    getChangedRequirementLogValues(priorRow, newReqForDiff);

                if (changedKeys.length === 0) continue;

                await RequirementLog.create({
                    requirement_id: priorRow.id,
                    section_id: validSectionsMap.get(normalizeUnicode(priorRow.sectionCode))?.id || null,
                    action_type: "UPLOAD",
                    old_values: oldValues,
                    new_values: newValues,
                    employee_id: logUser.employeeId,
                    employee_role: logUser.employeeRole,
                    updated_by_name: logUser.updatedByName,
                });
            }
        } catch (logErr) {
            console.error("Failed to log requirement upload changes:", logErr.message);
        }

        try {
            const sectionDataMap = new Map();

            for (const r of rowsToProcess) {
                const secCode = safeTrim(r.sectionCode);
                const secName = safeTrim(r.sectionName);

                if (!secCode) continue;

                if (!sectionDataMap.has(secCode)) {
                    sectionDataMap.set(secCode, {
                        sectionName: secName,
                        sectionCode: secCode,
                        descriptions: new Set(),
                        rows: [],
                        months: new Set(),
                        salesCount: 0,
                        prodCount: 0,
                    });
                }

                const entry = sectionDataMap.get(secCode);
                entry.rows.push(r);
                if (safeTrim(r.lineDescription)) entry.descriptions.add(safeTrim(r.lineDescription));

                if (r.monthName) entry.months.add(r.monthName);
                if (r.salesPlan !== null && r.salesPlan !== undefined) entry.salesCount++;
                if (r.prodPlan !== null && r.prodPlan !== undefined) entry.prodCount++;
            }

            const uploadedByName =
                req.user?.fullName || req.user?.name || req.user?.username || "Admin";
            const uploadedByRole = req.user?.role || "Admin";
            const uploadedAt = new Date().toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
            });

            const ccSummaryEmailSet = new Set();
            const ccSummarySectionMap = new Map();

            const addCcSummaryRecipients = (emails = [], secDataForCc = {}) => {
                const secCodeForCc = safeTrim(secDataForCc.sectionCode);
                if (!secCodeForCc) return;

                const sectionInfo = {
                    sectionCode: secCodeForCc,
                    sectionName: safeTrim(secDataForCc.sectionName) || secCodeForCc,
                    sectionDescription: Array.from(secDataForCc.descriptions || [])
                        .filter(Boolean)
                        .join(", ") || "-",
                    monthsCount: secDataForCc.months?.size || 0,
                    salesCount: secDataForCc.salesCount || 0,
                    prodCount: secDataForCc.prodCount || 0,
                };

                for (const email of emails || []) {
                    const normalizedEmail = String(email || "").trim().toLowerCase();
                    if (!normalizedEmail || !normalizedEmail.includes("@")) continue;

                    ccSummaryEmailSet.add(normalizedEmail);

                    if (!ccSummarySectionMap.has(normalizedEmail)) {
                        ccSummarySectionMap.set(normalizedEmail, new Map());
                    }

                    ccSummarySectionMap.get(normalizedEmail).set(secCodeForCc, sectionInfo);
                }
            };

            for (const [secCode, secData] of sectionDataMap.entries()) {
                const secName = secData.sectionName;
                const sectionDescription = Array.from(secData.descriptions || [])
                    .filter(Boolean)
                    .join(", ") || "-";

                const [secHeads] = await executeSql(
                    `
                    SELECT DISTINCT
                        sh.email,
                        sh.name,
                        sh.CCMail,
                        s.id AS sectionId,
                        s.name AS dbSectionName,
                        s.uniCode AS dbSectionCode
                    FROM section_heads sh
                    INNER JOIN sections s ON sh.sectionId = s.id
                    WHERE
                        (
                            (sh.email IS NOT NULL AND LTRIM(RTRIM(sh.email)) != '')
                            OR
                            (sh.CCMail IS NOT NULL AND LTRIM(RTRIM(sh.CCMail)) != '')
                        )
                        AND UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(?)))
                    `,
                    [secCode]
                );

                if (!secHeads || secHeads.length === 0) {
                    console.log(
                        `[UPLOAD-EMAIL] No section head/CC mail found for section: ${secName}`
                    );
                    continue;
                }

                const approvalHeads = secHeads.filter((head) =>
                    normalizeEmailList(getValueIgnoreCase(head, ["email", "Email", "EMAIL"])).length > 0
                );

                const sectionWiseCcEmails = getCcEmailListFromHeads(secHeads);
                const globalCcEmails = await getGlobalCcEmailsFromDb();
                const ccEmails = mergeUniqueEmails(sectionWiseCcEmails, globalCcEmails);

                if (approvalHeads.length === 0) {
                    console.log(
                        `[UPLOAD-EMAIL] No section-head email found for section: ${secName}. CC notification will still be sent without buttons.`
                    );
                }

                await executeSql(
                    `
                    UPDATE requirements
                    SET
                        approvalOwnerName = ?,
                        approvalOwnerEmail = ?
                    WHERE uploadBatchId = ?
                      AND sectionCode = ?
                      AND ISNULL(approvalStatus, 'pending') = 'pending'
                    `,
                    [
                        approvalHeads.length > 0
                            ? (getValueIgnoreCase(approvalHeads[0], ["name", "Name", "NAME"]) || "Section Head")
                            : "Section Head",
                        approvalHeads.length > 0
                            ? (getValueIgnoreCase(approvalHeads[0], ["email", "Email", "EMAIL"]) || "")
                            : "",
                        uploadBatchId,
                        secCode,
                    ]
                );

                const monthOrder = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December",
                ];

                const sortedMonths = Array.from(secData.months).sort(
                    (a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)
                );

                let monthRows = "";

                sortedMonths.forEach((month) => {
                    const monthRows_ = secData.rows.filter(
                        (r) => r.monthName === month
                    );
                    const totalSP = monthRows_.reduce(
                        (s, r) => s + (Number(r.salesPlan) || 0),
                        0
                    );
                    const totalFN01 = monthRows_.reduce(
                        (s, r) => s + (Number(r.prodPlanFN01) || 0),
                        0
                    );
                    const totalFN02 = monthRows_.reduce(
                        (s, r) => s + (Number(r.prodPlanFN02) || 0),
                        0
                    );

                    monthRows += `
                    <tr>
                        <td style="padding:8px 14px;border:1px solid #e2e8f0;font-weight:600;color:#1e293b;">${month}</td>
                        <td style="padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:700;">${totalSP}</td>
                        <td style="padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:700;">${totalFN01}</td>
                        <td style="padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:700;">${totalFN02}</td>
                    </tr>`;
                });

                const uploadTypeLabel = secData.months.size <= 6 ? "6-Month" : "Annual";

                const subject = `📊 ${uploadTypeLabel} Requirements for Approval — ${secName}`;

                const tkn = `ACT_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 10)}`.toUpperCase();

                if (approvalHeads.length > 0) {
                    await createRequirementTokenSafe({
                        token: tkn,
                        uploadBatchId,
                        sectionCode: secCode,
                        sectionName: secName,
                        recipientEmail: getValueIgnoreCase(approvalHeads[0], ["email", "Email", "EMAIL"]) || "",
                        senderEmail: req.user?.email || "admin@furukawa.com",
                        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiration
                        status: "pending",
                    });
                }

                const BASE_URL =
                    process.env.BASE_URL ||
                    process.env.APP_BASE_URL ||
                    `${req.protocol}://${req.get("host")}`;

                const FRONTEND_BASE_URL =
                    process.env.FRONTEND_BASE_URL ||
                    process.env.CLIENT_URL ||
                    process.env.APP_FRONTEND_URL ||
                    "http://192.168.90.19:5174";

                const requirementDashboardUrl = `${FRONTEND_BASE_URL.replace(/\/$/, "")}/dashboard/requirements`;

                const getHtmlMsg = (recipientName, showButtons) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr>
<td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">
<tr>
<td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 36px;text-align:center;">
    <div style="font-size:40px;margin-bottom:10px;">📊</div>
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Requirements Approval Request</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">
        Action required within 24 hours
    </p>
</td>
</tr>
<tr>
<td style="padding:28px 36px 8px;">
    <p style="font-size:15px;color:#334155;margin:0 0 6px;">
        Dear <strong>${recipientName}</strong>,
    </p>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">
        New <strong>${uploadTypeLabel}</strong> manpower requirements have been uploaded for section <strong>${secName}</strong>
        <span style="color:#475569;">(${secCode})</span>.
        These requirements are currently <strong style="color:#dc2626;">pending approval</strong>.
        If no action is taken within 24 hours, they will be marked as <strong>Approved by System</strong>.
    </p>
</td>
</tr>
<tr>
<td style="padding:14px 36px 6px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Section Code</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${secCode}</td>
        </tr>
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Section Name</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${secName}</td>
        </tr>
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Section Description</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${sectionDescription}</td>
        </tr>
    </table>
</td>
</tr>
<tr>
<td style="padding:16px 36px;">
    <table width="100%" cellpadding="0" cellspacing="8">
        <tr>
            <td width="33%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:26px;font-weight:700;color:#2563eb;">${secData.months.size}</div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:600;">MONTHS</div>
            </td>
            <td width="2%"></td>
            <td width="33%" style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:26px;font-weight:700;color:#dc2626;">${secData.salesCount}</div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:600;">SALES ENTRIES</div>
            </td>
            <td width="2%"></td>
            <td width="30%" style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:26px;font-weight:700;color:#dc2626;">${secData.prodCount}</div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:600;">PROD ENTRIES</div>
            </td>
        </tr>
    </table>
</td>
</tr>
<tr>
<td style="padding:10px 36px 24px;text-align:center;">
    <a href="${requirementDashboardUrl}" style="background:#2563eb;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">
        View Requirement
    </a>
    <p style="font-size:12px;color:#64748b;line-height:1.5;margin:12px 0 0;">
        Please login with your assigned section-head account. You will see only your assigned section requirements.
    </p>
</td>
</tr>
<tr>
<td style="padding:0 36px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;">📤 <strong>Uploaded By</strong></td>
            <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;">${uploadedByName} (${uploadedByRole})</td>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;">🕒 <strong>Date</strong></td>
            <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;">${uploadedAt}</td>
        </tr>
    </table>
</td>
</tr>
<tr>
<td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 36px;text-align:center;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">
        Automated notification from <strong>Furukawa LMS</strong>.
    </p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

                for (const head of approvalHeads) {
                    const recipientName = getValueIgnoreCase(head, ["name", "Name", "NAME"]) || "Section Head";
                    const email = getValueIgnoreCase(head, ["email", "Email", "EMAIL"]);
                    const htmlMsgWithButtons = getHtmlMsg(recipientName, true);

                    await sendMail(email, subject, htmlMsgWithButtons, [], "")
                        .then(() =>
                            console.log(
                                `[UPLOAD-EMAIL] Sent approval mail with buttons to ${email} for section: ${secName}`
                            )
                        )
                        .catch((e) =>
                            console.error(
                                `[UPLOAD-EMAIL] Failed for approval head ${email}:`,
                                e.message
                            )
                        );
                }

                console.log(`[UPLOAD-EMAIL] For section ${secName}, secHeads rows: ${secHeads.length}, approvalHeads: ${approvalHeads.length}`);
                console.log(`[UPLOAD-EMAIL] For section ${secName}, section-wise CC extracted:`, sectionWiseCcEmails);
                console.log(`[UPLOAD-EMAIL] For section ${secName}, global CC extracted:`, globalCcEmails);
                console.log(`[UPLOAD-EMAIL] For section ${secName}, final CC extracted:`, ccEmails);

                if (ccEmails.length > 0) {
                    // CC recipients should receive only one consolidated mail per upload.
                    // Do not send section-wise CC mails inside this loop.
                    addCcSummaryRecipients(ccEmails, secData);
                } else {
                    console.log(`[UPLOAD-EMAIL-CC][${secName}] No CC email configured.`);
                }
            }

            if (ccSummaryEmailSet.size > 0) {
                const FRONTEND_BASE_URL =
                    process.env.FRONTEND_BASE_URL ||
                    process.env.CLIENT_URL ||
                    process.env.APP_FRONTEND_URL ||
                    "http://192.168.90.19:5174";

                const requirementDashboardUrl = `${FRONTEND_BASE_URL.replace(/\/$/, "")}/dashboard/requirements`;
                const ccSubject = `📊 Requirements Uploaded — ${sectionDataMap.size} Section${sectionDataMap.size > 1 ? "s" : ""}`;

                const buildCcSummaryHtml = (sectionsForEmail = []) => {
                    const sectionRowsHtml = sectionsForEmail
                        .sort((a, b) => String(a.sectionName || "").localeCompare(String(b.sectionName || "")))
                        .map((sec, index) => `
                            <tr>
                                <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#64748b;text-align:center;font-weight:700;">${index + 1}</td>
                                <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;font-weight:700;">${sec.sectionCode || "-"}</td>
                                <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;font-weight:700;">${sec.sectionName || "-"}</td>
                                <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#475569;line-height:1.5;">${sec.sectionDescription || "-"}</td>
                                <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#2563eb;text-align:center;font-weight:800;">${sec.monthsCount || 0}</td>
                            </tr>`)
                        .join("");

                    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr>
<td align="center">
<table width="760" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">
<tr>
<td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 36px;text-align:center;">
    <div style="font-size:40px;margin-bottom:10px;">📊</div>
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Requirements Uploaded</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">
        Consolidated CC information mail
    </p>
</td>
</tr>
<tr>
<td style="padding:28px 36px 8px;">
    <p style="font-size:15px;color:#334155;margin:0 0 6px;">
        Dear <strong>Team</strong>,
    </p>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">
        New manpower requirements have been uploaded. You are receiving this as a CC information mail.
        You can view the requirements from the dashboard, but approval action is allowed only for the assigned section head.
    </p>
</td>
</tr>
<tr>
<td style="padding:16px 36px 10px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;">📤 <strong>Uploaded By</strong></td>
            <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;">${uploadedByName} (${uploadedByRole})</td>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;">🕒 <strong>Date</strong></td>
            <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;">${uploadedAt}</td>
        </tr>
    </table>
</td>
</tr>
<tr>
<td style="padding:14px 36px 20px;">
    <p style="font-size:14px;font-weight:800;color:#1e293b;margin:0 0 10px;">Sections included in this upload:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
        <tr>
            <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:center;border:1px solid #1e3a5f;width:45px;">#</th>
            <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Section Code</th>
            <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Section Name</th>
            <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Description</th>
            <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:center;border:1px solid #1e3a5f;">Months</th>
        </tr>
        ${sectionRowsHtml}
    </table>
</td>
</tr>
<tr>
<td style="padding:4px 36px 28px;text-align:center;">
    <a href="${requirementDashboardUrl}" style="background:#2563eb;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">
        View Requirement
    </a>
    <p style="font-size:12px;color:#64748b;line-height:1.5;margin:12px 0 0;">
        This mail does not provide approval permission. Approval depends on your assigned section-head access in the system.
    </p>
</td>
</tr>
<tr>
<td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 36px;text-align:center;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">
        Automated notification from <strong>Furukawa LMS</strong>.
    </p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
                };

                for (const ccEmail of Array.from(ccSummaryEmailSet)) {
                    const sectionMapForEmail = ccSummarySectionMap.get(ccEmail);
                    const sectionsForEmail = Array.from(sectionMapForEmail?.values() || []);
                    if (sectionsForEmail.length === 0) continue;

                    const ccHtml = buildCcSummaryHtml(sectionsForEmail);
                    await sendMail(ccEmail, ccSubject, ccHtml, [], "")
                        .then(() => console.log(`[UPLOAD-EMAIL-CC-SUMMARY] Sent consolidated CC mail to ${ccEmail}`))
                        .catch((e) => console.error(`[UPLOAD-EMAIL-CC-SUMMARY] Failed for ${ccEmail}:`, e.message));
                }
            }
        } catch (emailErr) {
            console.error(
                "[UPLOAD-EMAIL] Error sending upload summary emails:",
                emailErr.message
            );
        }

        res.status(201).json(
            new ApiResponse(
                201,
                {
                    totalExcelMonthRows: rowsToProcess.length,
                    insertedRows: totalInsertedRows,
                    uploadBatchId,
                },
                "Requirements uploaded successfully."
            )
        );
    } catch (err) {
        console.error("EXCEL UPLOAD FATAL ERROR:", err);

        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error("Rollback also failed:", rollbackErr);
        }

        throw new ApiError(`Database Error during upload: ${err.message}`, 500);
    }
});

/* ============================================================
   GET REQUIREMENTS
============================================================ */

const parseJsonArrayIds = (value) => {
    if (value === null || value === undefined || value === "") return [];

    const addFromAny = (raw, output) => {
        if (raw === null || raw === undefined || raw === "") return;

        if (Array.isArray(raw)) {
            raw.forEach((v) => addFromAny(v, output));
            return;
        }

        if (typeof raw === "number") {
            if (Number.isInteger(raw) && raw > 0) output.push(raw);
            return;
        }

        const str = String(raw).trim();
        if (!str || str.toLowerCase() === "null") return;

        try {
            const parsed = JSON.parse(str);
            if (parsed !== str) {
                addFromAny(parsed, output);
                return;
            }
        } catch (_) { }

        str.split(/[;,]+/)
            .map((x) => x.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean)
            .forEach((x) => {
                const n = Number(x);
                if (Number.isInteger(n) && n > 0) output.push(n);
            });
    };

    const ids = [];
    addFromAny(value, ids);
    return [...new Set(ids)];
};

const getAssignedRequirementSectionsForUser = async (req) => {
    const userId = req.user?.id || req.user?._id;
    const userEmail = req.user?.email;

    const isSuperUser =
        req.user?.isAdmin === true ||
        req.user?.isAdmin === 1 ||
        String(req.user?.role || "").toUpperCase() === "SUPERADMIN" ||
        String(req.user?.role || "").toUpperCase() === "ADMIN";

    if (isSuperUser) return null;

    const currentRole = String(req.user?.role || "").trim().toUpperCase();

    // Only CUSTOM section-head users are restricted by assigned section IDs.
    if (currentRole && currentRole !== "CUSTOM") return null;

    const filters = [];
    const values = [];

    if (userId) {
        filters.push("u.id = ?");
        values.push(userId);
    }

    if (userEmail) {
        filters.push("LOWER(LTRIM(RTRIM(u.email))) = LOWER(LTRIM(RTRIM(?)))");
        values.push(userEmail);
    }

    if (!filters.length) return null;

    const [userRows] = await executeSql(
        `
        SELECT TOP 1
            u.id,
            u.role,
            u.sectionId,
            u.sections
        FROM users u WITH (NOLOCK)
        WHERE (${filters.join(" OR ")})
          AND UPPER(LTRIM(RTRIM(ISNULL(u.role, '')))) = 'CUSTOM'
        `,
        values
    );

    const assignedUser = userRows?.[0];

    // If logged-in user is not CUSTOM, do not restrict this endpoint.
    if (!assignedUser && currentRole !== "CUSTOM") return null;
    if (!assignedUser) return { noAssignedSection: true };

    const sectionIds = [
        ...parseJsonArrayIds(assignedUser.sectionId),
        ...parseJsonArrayIds(assignedUser.sections),
        ...parseJsonArrayIds(req.user?.sectionId),
        ...parseJsonArrayIds(req.user?.sections),
    ];

    const uniqueSectionIds = [...new Set(sectionIds)].filter((id) => Number.isInteger(Number(id)) && Number(id) > 0).map(Number);

    if (uniqueSectionIds.length === 0) return { noAssignedSection: true };

    const placeholders = uniqueSectionIds.map(() => "?").join(",");
    const [sectionRows] = await executeSql(
        `
        SELECT DISTINCT
            id AS sectionId,
            name AS sectionName,
            uniCode AS sectionCode,
            category AS sectionCategory
        FROM sections WITH (NOLOCK)
        WHERE id IN (${placeholders})
        `,
        uniqueSectionIds
    );

    const sections = (sectionRows || [])
        .filter((s) => s.sectionId)
        .map((s) => ({
            sectionId: Number(s.sectionId),
            sectionCode: safeTrim(s.sectionCode),
            sectionName: safeTrim(s.sectionName),
            sectionCategory: safeTrim(s.sectionCategory),
        }));

    if (sections.length === 0) return { noAssignedSection: true };

    return {
        sectionIds: sections.map((s) => s.sectionId),
        sectionCodes: [...new Set(sections.map((s) => s.sectionCode).filter(Boolean))],
        sectionNames: [...new Set(sections.map((s) => s.sectionName).filter(Boolean))],
        sections,
    };
};

const appendAssignedSectionsFilter = (countSql, sql, params, assignedSections, alias = "r") => {
    if (!assignedSections?.sectionCodes?.length && !assignedSections?.sectionNames?.length) {
        return { countSql, sql, params };
    }

    const codePlaceholders = assignedSections.sectionCodes.map(() => "?").join(",");
    const namePlaceholders = assignedSections.sectionNames.map(() => "?").join(",");
    const conditions = [];
    const filterParams = [];

    if (assignedSections.sectionCodes.length) {
        conditions.push(`UPPER(LTRIM(RTRIM(ISNULL(${alias}.sectionCode, '')))) IN (${codePlaceholders.split(',').map(() => 'UPPER(LTRIM(RTRIM(?)))').join(',')})`);
        filterParams.push(...assignedSections.sectionCodes);
    }

    if (assignedSections.sectionNames.length) {
        conditions.push(`UPPER(LTRIM(RTRIM(ISNULL(${alias}.sectionName, '')))) IN (${namePlaceholders.split(',').map(() => 'UPPER(LTRIM(RTRIM(?)))').join(',')})`);
        filterParams.push(...assignedSections.sectionNames);
    }

    const cond = ` AND (${conditions.join(" OR ")})`;
    return {
        countSql: countSql + cond,
        sql: sql + cond,
        params: [...params, ...filterParams],
    };
};

export const getRequirements = asyncHandler(async (req, res) => {
    await autoApproveExpiredRequirements();

    const { section, sub_section, startDate, endDate, search } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    let countSql = "SELECT COUNT(r.id) AS total FROM requirements r WHERE 1=1";
    let sql = "SELECT r.*, (SELECT TOP 1 category FROM [sections] sec WHERE r.sectionCode = sec.uniCode OR r.sectionName = sec.name) AS sectionCategory FROM requirements r WHERE 1=1";
    let params = [];

    const hasViewAllSections = hasPermission(req.user, "mps_requirement:view_all_sections");
    const assignedSections = await getAssignedRequirementSectionsForUser(req);

    if (assignedSections?.noAssignedSection && !hasViewAllSections) {
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    pagination: {
                        totalItems: 0,
                        totalPages: 1,
                        currentPage: page,
                        limit,
                    },
                    totalManpower: 0,
                    filtersApplied: {
                        department: "Assigned section not found",
                        section: "Assigned section not found",
                        line: "All",
                        dateMode: startDate || endDate ? "Range" : "Current Month",
                    },
                    data: [],
                },
                "No assigned section found for this custom user."
            )
        );
    }

    if (!hasViewAllSections) {
        ({ countSql, sql, params } = appendAssignedSectionsFilter(countSql, sql, params, assignedSections, "r"));
    }

    // Frontend first dropdown is Department. In requirements data this is stored either
    // in requirements.category or in sections.category. Keep r.sectionName fallback for older data.
    if (section && String(section).toLowerCase() !== "all") {
        const cond = `
            AND (
                UPPER(LTRIM(RTRIM(ISNULL(r.category, '')))) = UPPER(LTRIM(RTRIM(?)))
                OR EXISTS (
                    SELECT 1
                    FROM sections sec WITH (NOLOCK)
                    WHERE (sec.uniCode = r.sectionCode OR sec.name = r.sectionName)
                      AND UPPER(LTRIM(RTRIM(ISNULL(sec.category, '')))) = UPPER(LTRIM(RTRIM(?)))
                )
                OR UPPER(LTRIM(RTRIM(ISNULL(r.sectionName, '')))) = UPPER(LTRIM(RTRIM(?)))
            )
        `;
        countSql += cond;
        sql += cond;
        params.push(section, section, section);
    }

    // Frontend second dropdown is Section. Fallback to lineDescription for old records/UI labels.
    if (sub_section && String(sub_section).toLowerCase() !== "all") {
        const cond = `
            AND (
                UPPER(LTRIM(RTRIM(ISNULL(r.sectionName, '')))) = UPPER(LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(ISNULL(r.lineDescription, '')))) = UPPER(LTRIM(RTRIM(?)))
            )
        `;
        countSql += cond;
        sql += cond;
        params.push(sub_section, sub_section);
    }

    if (search) {
        const searchPattern = `%${search}%`;
        const cond = `
            AND (
                r.sectionCode LIKE ?
                OR r.sectionName LIKE ?
                OR r.lineCode LIKE ?
                OR r.lineDescription LIKE ?
                OR r.monthName LIKE ?
                OR CAST(r.year AS NVARCHAR(20)) LIKE ?
            )
        `;
        countSql += cond;
        sql += cond;
        params.push(
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern
        );
    }

    if (startDate || endDate) {
        const dateExpr = `
            TRY_CAST(
                '01 ' + SUBSTRING(r.monthName, 1, 3) + ' ' + CAST(r.year AS VARCHAR)
                AS DATE
            )
        `;

        if (startDate) {
            countSql += ` AND ${dateExpr} >= ?`;
            sql += ` AND ${dateExpr} >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            countSql += ` AND ${dateExpr} <= ?`;
            sql += ` AND ${dateExpr} <= ?`;
            params.push(endDate);
        }
    }

    const [countResult] = await executeSql(countSql, params);
    const totalItems = countResult[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    sql += " ORDER BY r.id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";

    const [results] = await executeSql(sql, [...params, offset, limit]);

    const loggedInRole = String(req.user?.role || "").trim().toUpperCase();
    const isSuperUser =
        req.user?.isAdmin === true ||
        req.user?.isAdmin === 1 ||
        loggedInRole === "SUPERADMIN" ||
        loggedInRole === "ADMIN";

    const data = results.map((row) => {
        let isAssigned = true;
        if (!isSuperUser) {
            if (assignedSections?.noAssignedSection) {
                isAssigned = false;
            } else if (assignedSections?.sectionCodes?.length || assignedSections?.sectionNames?.length) {
                const codeMatched = assignedSections.sectionCodes?.some(
                    (code) => String(code).trim().toUpperCase() === String(row.sectionCode || "").trim().toUpperCase()
                );
                const nameMatched = assignedSections.sectionNames?.some(
                    (name) => String(name).trim().toUpperCase() === String(row.sectionName || "").trim().toUpperCase()
                );
                isAssigned = !!(codeMatched || nameMatched);
            } else {
                isAssigned = false;
            }
        }

        return {
            ...row,
            count: row.salesPlan,
            section: row.sectionName,
            sectionCategory: row.category || row.sectionCategory || "Not Applicable",
            sub_section: row.lineDescription,
            line_area: "N/A",
            isActive: row.is_active === true || row.is_active === 1,
            approvalStatus: row.approvalStatus || "pending",
            approvalOwnerName: row.approvalOwnerName || null,
            approvalOwnerEmail: row.approvalOwnerEmail || null,
            approvedBy: row.approvedBy || null,
            approvedByEmail: row.approvedByEmail || null,
            approvedAt: row.approvedAt || null,
            approvalSource: row.approvalSource || null,
            rejectedBy: row.rejectedBy || null,
            rejectedAt: row.rejectedAt || null,
            isAssigned,
        };
    });

    const totalManpower = results.reduce(
        (sum, row) => sum + (parseFloat(row.salesPlan || 0) || 0),
        0
    );

    res.status(200).json(
        new ApiResponse(
            200,
            {
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: page,
                    limit,
                },
                totalManpower,
                filtersApplied: {
                    department: section || "All",
                    section: sub_section || "All",
                    assignedSections: assignedSections || null,
                    line: sub_section || "All",
                    dateMode: startDate || endDate ? "Range" : "Current Month",
                },
                data,
            },
            "Requirements fetched successfully"
        )
    );
});

/* ============================================================
   LOGS / FILTERS / BY ID
============================================================ */

export const getRequirementLogs = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const filters = {};

    if (id && id !== "logs") {
        filters.requirement_id = id;
    }

    const rows = await RequirementLog.getLogs(filters, { limit, offset });

    // Keep only genuine requirement-value updates.
    // Create/upload logs and status-only changes are not returned to the frontend.
    const changedRows = (rows || []).filter(
        (row) => getActualRequirementLogChanges(row).length > 0
    );

    const employeeIds = [
        ...new Set(
            changedRows
                .map((row) => Number(row.employee_id))
                .filter((employeeId) => Number.isInteger(employeeId))
        ),
    ];

    const userNameById = new Map();

    if (employeeIds.length > 0) {
        try {
            const [users] = await executeSql(
                `
                SELECT
                    u.id,
                    u.fullName,
                    u.userName,
                    u.email
                FROM users u WITH (NOLOCK)
                WHERE u.id IN (${employeeIds.map(() => "?").join(",")})
                `,
                employeeIds
            );

            for (const user of users || []) {
                const resolvedName =
                    cleanDisplayName(user.fullName) ||
                    cleanDisplayName(user.userName) ||
                    safeTrim(user.email) ||
                    "Unknown";

                userNameById.set(Number(user.id), resolvedName);
            }
        } catch (error) {
            console.error("[REQUIREMENT-LOGS] Failed to resolve employee names:", error.message);
        }
    }

    const logsWithNames = changedRows.map((row) => ({
        ...row,
        updated_by_name:
            userNameById.get(Number(row.employee_id)) ||
            row.updated_by_name ||
            row.user_name ||
            row.employee_name ||
            row.name ||
            "Unknown",
    }));

    res.status(200).json(
        new ApiResponse(200, logsWithNames, "Requirement logs fetched successfully")
    );
});

export const getRequirementFilters = asyncHandler(async (req, res) => {
    const { department } = req.query || {};
    const hasViewAllSections = hasPermission(req.user, "mps_requirement:view_all_sections");
    const assignedSections = await getAssignedRequirementSectionsForUser(req);

    if (assignedSections?.noAssignedSection && !hasViewAllSections) {
        return res.status(200).json(
            new ApiResponse(
                200,
                { departments: [], sections: [], subSections: [] },
                "No assigned section found for this custom user."
            )
        );
    }

    let baseWhere = " WHERE 1=1 ";
    let params = [];

    if (!hasViewAllSections && (assignedSections?.sectionCodes?.length || assignedSections?.sectionNames?.length)) {
        const tmp = appendAssignedSectionsFilter("", "", [], assignedSections, "r");
        baseWhere += tmp.sql.replace(/^\s*AND/i, " AND");
        params.push(...tmp.params);
    }

    const departmentCond = department && String(department).toLowerCase() !== "all"
        ? `
          AND (
              UPPER(LTRIM(RTRIM(ISNULL(r.category, '')))) = UPPER(LTRIM(RTRIM(?)))
              OR EXISTS (
                  SELECT 1
                  FROM sections sec2 WITH (NOLOCK)
                  WHERE (sec2.uniCode = r.sectionCode OR sec2.name = r.sectionName)
                    AND UPPER(LTRIM(RTRIM(ISNULL(sec2.category, '')))) = UPPER(LTRIM(RTRIM(?)))
              )
          )
        `
        : "";

    const departmentParams = department && String(department).toLowerCase() !== "all"
        ? [department, department]
        : [];

    const [departments] = await executeSql(
        `
        SELECT DISTINCT department
        FROM (
            SELECT NULLIF(LTRIM(RTRIM(ISNULL(r.category, ''))), '') AS department
            FROM requirements r WITH (NOLOCK)
            ${baseWhere}
            UNION
            SELECT NULLIF(LTRIM(RTRIM(ISNULL(sec.category, ''))), '') AS department
            FROM requirements r WITH (NOLOCK)
            LEFT JOIN sections sec WITH (NOLOCK)
                ON sec.uniCode = r.sectionCode OR sec.name = r.sectionName
            ${baseWhere}
        ) d
        WHERE department IS NOT NULL
        ORDER BY department
        `,
        [...params, ...params]
    );

    const [sections] = await executeSql(
        `
        SELECT DISTINCT r.sectionName AS section
        FROM requirements r WITH (NOLOCK)
        ${baseWhere}
        ${departmentCond}
          AND r.sectionName IS NOT NULL
          AND LTRIM(RTRIM(r.sectionName)) != ''
        ORDER BY r.sectionName
        `,
        [...params, ...departmentParams]
    );

    const [subSections] = await executeSql(
        `
        SELECT DISTINCT r.lineDescription AS sub_section
        FROM requirements r WITH (NOLOCK)
        ${baseWhere}
        ${departmentCond}
          AND r.lineDescription IS NOT NULL
          AND LTRIM(RTRIM(r.lineDescription)) != ''
        ORDER BY r.lineDescription
        `,
        [...params, ...departmentParams]
    );

    res.status(200).json(
        new ApiResponse(
            200,
            {
                departments: departments.map((d) => d.department).filter(Boolean),
                sections: sections.map((s) => s.section).filter(Boolean),
                subSections: subSections.map((s) => s.sub_section).filter(Boolean),
            },
            "Filters fetched successfully"
        )
    );
});

export const getRequirementById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [result] = await executeSql(
        "SELECT r.*, (SELECT TOP 1 category FROM [sections] sec WHERE r.sectionCode = sec.uniCode OR r.sectionName = sec.name) AS sectionCategory FROM requirements r WHERE r.id = ?",
        [id]
    );

    if (result.length === 0) {
        throw new ApiError("Requirement not found", 404);
    }

    const row = result[0];

    const loggedInRole = String(req.user?.role || "").trim().toUpperCase();
    const isSuperUser =
        req.user?.isAdmin === true ||
        req.user?.isAdmin === 1 ||
        loggedInRole === "SUPERADMIN" ||
        loggedInRole === "ADMIN";

    const hasViewAllSections = hasPermission(req.user, "mps_requirement:view_all_sections");
    const assignedSections = await getAssignedRequirementSectionsForUser(req);

    let isAssigned = true;
    if (!isSuperUser) {
        if (assignedSections?.noAssignedSection) {
            isAssigned = false;
        } else if (assignedSections?.sectionCodes?.length || assignedSections?.sectionNames?.length) {
            const codeMatched = assignedSections.sectionCodes?.some(
                (code) => String(code).trim().toUpperCase() === String(row.sectionCode || "").trim().toUpperCase()
            );
            const nameMatched = assignedSections.sectionNames?.some(
                (name) => String(name).trim().toUpperCase() === String(row.sectionName || "").trim().toUpperCase()
            );
            isAssigned = !!(codeMatched || nameMatched);
        } else {
            isAssigned = false;
        }

        if (!hasViewAllSections && !isAssigned) {
            throw new ApiError("You are not allowed to view this requirement.", 403);
        }
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                ...row,
                count: row.salesPlan,
                section: row.sectionName,
                sectionCategory: row.category || row.sectionCategory || "Not Applicable",
                sub_section: row.lineDescription,
                line_area: "N/A",
                isActive: row.is_active === true || row.is_active === 1,
                approvalStatus: row.approvalStatus || "pending",
                isAssigned,
            },
            "Requirement fetched successfully"
        )
    );
});

/* ============================================================
   UPDATE SINGLE REQUIREMENT + SEND APPROVAL MAIL
============================================================ */

export const updateRequirement = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) throw new ApiError("Requirement ID is required", 400);

    const [existingRows] = await executeSql(
        "SELECT * FROM requirements WHERE id = ?",
        [id]
    );

    if (existingRows.length === 0) {
        throw new ApiError("Requirement not found", 404);
    }

    const oldReq = existingRows[0];

    const loggedInRole = String(req.user?.role || "").trim().toUpperCase();
    const isSuperUser =
        req.user?.isAdmin === true ||
        req.user?.isAdmin === 1 ||
        loggedInRole === "SUPERADMIN" ||
        loggedInRole === "ADMIN";

    if (!isSuperUser) {
        const assignedSections = await getAssignedRequirementSectionsForUser(req);
        if (assignedSections?.noAssignedSection) {
            throw new ApiError("You are not allowed to update requirements. No section is assigned to you.", 403);
        }
        const codeMatched = assignedSections?.sectionCodes?.some(
            (code) => String(code).trim().toUpperCase() === String(oldReq.sectionCode || "").trim().toUpperCase()
        );
        const nameMatched = assignedSections?.sectionNames?.some(
            (name) => String(name).trim().toUpperCase() === String(oldReq.sectionName || "").trim().toUpperCase()
        );
        if (!codeMatched && !nameMatched) {
            throw new ApiError("You can only update requirements for your assigned sections.", 403);
        }
    }

    const isSameNumber = (a, b) => {
        const n1 = a === null || a === undefined || a === "" ? null : Number(a);
        const n2 = b === null || b === undefined || b === "" ? null : Number(b);

        if (n1 === null && n2 === null) return true;
        return Number(n1 || 0) === Number(n2 || 0);
    };

    const {
        sectionCode,
        sectionName,
        lineCode,
        lineDescription,
        monthName,
        month,
        year,
        salesPlan,
        prodPlan,
        prodPlanFN01,
        prodPlanFN02,
    } = req.body;

    const finalMonthName = normalizeMonth(monthName || month);

    const fields = [];
    const values = [];

    if (sectionCode !== undefined) {
        fields.push("sectionCode = ?");
        values.push(sectionCode);
    }

    if (sectionName !== undefined) {
        fields.push("sectionName = ?");
        values.push(sectionName);
    }

    if (lineCode !== undefined) {
        fields.push("lineCode = ?");
        values.push(lineCode);
    }

    if (lineDescription !== undefined) {
        fields.push("lineDescription = ?");
        values.push(lineDescription);
    }

    if (finalMonthName) {
        fields.push("monthName = ?", "monthNumber = ?");
        values.push(finalMonthName, getMonthNumber(finalMonthName));
    }

    if (year !== undefined) {
        fields.push("year = ?");
        values.push(year);
    }

    if (salesPlan !== undefined) {
        fields.push("salesPlan = ?");
        values.push(salesPlan);
    }

    if (prodPlan !== undefined) {
        fields.push("prodPlan = ?");
        values.push(prodPlan);
    }

    if (prodPlanFN01 !== undefined) {
        fields.push("prodPlanFN01 = ?");
        values.push(prodPlanFN01);
    }

    if (prodPlanFN02 !== undefined) {
        fields.push("prodPlanFN02 = ?");
        values.push(prodPlanFN02);
    }

    // No ccEmail column in requirements database table

    if (fields.length === 0) {
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    oldReq,
                    "Requirement is already up to date"
                )
            );
    }

    fields.push("is_active = ?");
    values.push(0);

    fields.push("approvalStatus = ?");
    values.push("pending");

    fields.push("approvalSource = NULL");
    fields.push("approvedBy = NULL");
    fields.push("approvedByEmail = NULL");
    fields.push("approvedAt = NULL");
    fields.push("rejectedBy = NULL");
    fields.push("rejectedAt = NULL");

    values.push(id);

    await executeSql(
        `UPDATE requirements SET ${fields.join(", ")} WHERE id = ?`,
        values
    );

    const [updatedRows] = await executeSql(
        "SELECT * FROM requirements WHERE id = ?",
        [id]
    );

    const newReq = updatedRows[0];

    const salesChanged =
        salesPlan !== undefined && !isSameNumber(oldReq.salesPlan, newReq.salesPlan);

    const prodChanged =
        prodPlan !== undefined && !isSameNumber(oldReq.prodPlan, newReq.prodPlan);

    const fn01Changed =
        prodPlanFN01 !== undefined && !isSameNumber(oldReq.prodPlanFN01, newReq.prodPlanFN01);

    const fn02Changed =
        prodPlanFN02 !== undefined && !isSameNumber(oldReq.prodPlanFN02, newReq.prodPlanFN02);

    if (!salesChanged && !prodChanged && !fn01Changed && !fn02Changed) {
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    ...newReq,
                    mailSent: false,
                    mailInfo: {
                        sent: false,
                        reason: "No SP/PP/FN01/FN02 value changed, mail skipped.",
                    },
                },
                "Requirement checked. No value changed, mail skipped."
            )
        );
    }

    // Save exactly one log only when an actual requirement value changed.
    // The log contains only the previous and new plan values that are different.
    try {
        let sectionIdToLog = null;

        const [sectionRows] = await executeSql(
            `
            SELECT id FROM sections
            WHERE UPPER(LTRIM(RTRIM(uniCode))) = UPPER(LTRIM(RTRIM(?)))
            `,
            [newReq.sectionCode]
        );

        if (sectionRows.length > 0) {
            sectionIdToLog = sectionRows[0].id;
        }

        const { oldValues, newValues, changedKeys } =
            getChangedRequirementLogValues(oldReq, newReq);

        if (changedKeys.length > 0) {
            const logUser = await resolveRequirementLogUser(req);

            await RequirementLog.create({
                requirement_id: id,
                section_id: sectionIdToLog,
                action_type: "UPDATE",
                old_values: oldValues,
                new_values: newValues,
                employee_id: logUser.employeeId,
                employee_role: logUser.employeeRole,
                updated_by_name: logUser.updatedByName,
            });
        }
    } catch (logErr) {
        console.error("Failed to log requirement update:", logErr.message);
    }

    const mailResult = await sendRequirementEditApprovalMail({
        req,
        requirementId: id,
        oldReq,
        newReq,
    });

    res.status(200).json(
        new ApiResponse(
            200,
            {
                ...newReq,
                mailSent: mailResult.sent,
                mailInfo: mailResult,
            },
            mailResult.sent
                ? "Requirement updated successfully and approval mail sent."
                : `Requirement updated successfully but mail not sent: ${mailResult.reason || "No matching section head found"}`
        )
    );
});

/* ============================================================
   BATCH UPDATE
============================================================ */

export const batchUpdateRequirements = asyncHandler(async (req, res) => {
    const { ids, updates } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
        throw new ApiError("ids array is required", 400);
    }

    if (!updates || typeof updates !== "object") {
        throw new ApiError("updates object is required", 400);
    }

    const allowedFields = [
        "sectionCode",
        "sectionName",
        "lineCode",
        "lineDescription",
        "monthName",
        "monthNumber",
        "year",
        "salesPlan",
        "prodPlan",
        "prodPlanFN01",
        "prodPlanFN02",
    ];

    const fields = [];
    const values = [];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(updates[field]);
        }
    }

    if (fields.length === 0) {
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { updatedCount: 0, updatedIds: [] },
                    "No valid fields to update"
                )
            );
    }

    fields.push("is_active = ?");
    values.push(0);

    fields.push("approvalStatus = ?");
    values.push("pending");

    fields.push("approvalSource = NULL");
    fields.push("approvedBy = NULL");
    fields.push("approvedByEmail = NULL");
    fields.push("approvedAt = NULL");
    fields.push("rejectedBy = NULL");
    fields.push("rejectedAt = NULL");

    const placeholders = ids.map(() => "?").join(",");
    const sql = `
        UPDATE requirements
        SET ${fields.join(", ")}
        WHERE id IN (${placeholders})
    `;

    await executeSql(sql, [...values, ...ids]);

    res.status(200).json(
        new ApiResponse(
            200,
            { updatedCount: ids.length, updatedIds: ids },
            "Batch update successful"
        )
    );
});

/* ============================================================
   DELETE
============================================================ */

export const deleteRequirement = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [existingRows] = await executeSql(
        "SELECT sectionCode, sectionName FROM requirements WHERE id = ?",
        [id]
    );

    if (existingRows.length === 0) {
        throw new ApiError("Requirement not found", 404);
    }

    const targetReq = existingRows[0];

    const loggedInRole = String(req.user?.role || "").trim().toUpperCase();
    const isSuperUser =
        req.user?.isAdmin === true ||
        req.user?.isAdmin === 1 ||
        loggedInRole === "SUPERADMIN" ||
        loggedInRole === "ADMIN";

    if (!isSuperUser) {
        const assignedSections = await getAssignedRequirementSectionsForUser(req);
        if (assignedSections?.noAssignedSection) {
            throw new ApiError("You are not allowed to delete requirements. No section is assigned to you.", 403);
        }
        const codeMatched = assignedSections?.sectionCodes?.some(
            (code) => String(code).trim().toUpperCase() === String(targetReq.sectionCode || "").trim().toUpperCase()
        );
        const nameMatched = assignedSections?.sectionNames?.some(
            (name) => String(name).trim().toUpperCase() === String(targetReq.sectionName || "").trim().toUpperCase()
        );
        if (!codeMatched && !nameMatched) {
            throw new ApiError("You can only delete requirements for your assigned sections.", 403);
        }
    }

    await executeSql("DELETE FROM requirements WHERE id = ?", [id]);

    res.status(200).json(
        new ApiResponse(200, null, "Requirement deleted successfully")
    );
});


/* ============================================================
   APPROVE REQUIREMENTS FROM DASHBOARD (SECTION HEAD)
   Route needed: POST /api/requirements/approve-dashboard
============================================================ */

export const approveDashboardRequirements = asyncHandler(async (req, res) => {
    const { ids } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
        throw new ApiError("ids array is required", 400);
    }

    const cleanIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

    if (cleanIds.length === 0) {
        throw new ApiError("Valid requirement IDs are required", 400);
    }

    const loggedInRole = String(req.user?.role || "").trim().toUpperCase();
    const isSuperUser =
        req.user?.isAdmin === true ||
        req.user?.isAdmin === 1 ||
        loggedInRole === "SUPERADMIN" ||
        loggedInRole === "ADMIN";

    const assignedSections = await getAssignedRequirementSectionsForUser(req);

    if (assignedSections?.noAssignedSection) {
        throw new ApiError("No section is assigned to this custom user.", 403);
    }

    // CUSTOM users can approve only their assigned sections.
    // Admin/Superadmin can approve any selected requirement IDs.
    if (!isSuperUser) {
        if (!assignedSections?.sectionCodes?.length && !assignedSections?.sectionNames?.length) {
            throw new ApiError("You are not allowed to approve these requirements.", 403);
        }

        const idPlaceholders = cleanIds.map(() => "?").join(",");
        const codeConditions = assignedSections.sectionCodes?.length
            ? `UPPER(LTRIM(RTRIM(ISNULL(r.sectionCode, '')))) IN (${assignedSections.sectionCodes.map(() => "UPPER(LTRIM(RTRIM(?)))").join(",")})`
            : "";
        const nameConditions = assignedSections.sectionNames?.length
            ? `UPPER(LTRIM(RTRIM(ISNULL(r.sectionName, '')))) IN (${assignedSections.sectionNames.map(() => "UPPER(LTRIM(RTRIM(?)))").join(",")})`
            : "";
        const sectionConditions = [codeConditions, nameConditions].filter(Boolean).join(" OR ");

        const [allowedRows] = await executeSql(
            `
            SELECT COUNT(1) AS matchedCount
            FROM requirements r WITH (NOLOCK)
            WHERE r.id IN (${idPlaceholders})
              AND (${sectionConditions})
            `,
            [
                ...cleanIds,
                ...(assignedSections.sectionCodes || []),
                ...(assignedSections.sectionNames || []),
            ]
        );

        const matchedCount = Number(allowedRows?.[0]?.matchedCount || 0);

        if (matchedCount !== cleanIds.length) {
            throw new ApiError("You can approve only your assigned section requirements.", 403);
        }
    }

    const approvedByEmail = safeTrim(req.user?.email || "");
    const approvedByName = await resolveApproverNameFromUserOrEmail(req.user, approvedByEmail, "Section Head");

    const placeholders = cleanIds.map(() => "?").join(",");

    const [, updateInfo] = await executeSql(
        `
        UPDATE requirements
        SET
            is_active = 1,
            approvalStatus = 'approved',
            approvedBy = ?,
            approvedByEmail = ?,
            approvedAt = GETDATE(),
            approvalSource = 'section_head_dashboard',
            approvalOwnerName = CASE
                WHEN approvalOwnerName IS NULL OR LTRIM(RTRIM(approvalOwnerName)) = '' OR LTRIM(RTRIM(approvalOwnerName)) = 'Section Head'
                THEN ?
                ELSE approvalOwnerName
            END,
            rejectedBy = NULL,
            rejectedAt = NULL
        WHERE id IN (${placeholders})
          AND ISNULL(approvalStatus, 'pending') IN ('pending', 'rejected', 'system_approved')
        `,
        [approvedByName, approvedByEmail, approvedByName, ...cleanIds]
    );

    res.status(200).json(
        new ApiResponse(
            200,
            {
                approvedCount: updateInfo.affectedRows || 0,
                approvedIds: cleanIds,
                approvedBy: approvedByName,
                approvedByEmail,
            },
            "Requirements approved successfully."
        )
    );
});

const checkUserAuth = async (req) => {
    const token = req?.cookies?.accessToken;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
        if (decoded.exp * 1000 < Date.now()) return null;

        const User = (await import("../models/auth.model.js")).default;
        const user = await User.findById(decoded.id);
        if (!user || ['LEFT', 'SUSPENDED', 'BANNED'].includes(user.status)) {
            return null;
        }
        return user;
    } catch (_) {
        return null;
    }
};

const renderLoginPage = (id, token, action, isBatch, errorMsg = null) => {
    const postUrl = isBatch
        ? `/api/requirements/approve-batch?token=${token}&action=${action}`
        : `/api/requirements/approve-single?id=${id}&token=${token}&action=${action}`;

    const title = isBatch ? "Batch Approval Login" : "Requirement Approval Login";
    const subtitle = isBatch
        ? "Please login to authorize bulk requirement actions"
        : `Please login to authorize action on Requirement #${id}`;

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Approval Login - Furukawa LMS</title>
<style>
body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    padding: 20px;
    color: #f8fafc;
}
.card {
    background: rgba(30, 41, 59, 0.7);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    padding: 40px;
    max-width: 400px;
    width: 100%;
}
.header {
    text-align: center;
    margin-bottom: 30px;
}
.logo {
    font-size: 48px;
    margin-bottom: 12px;
}
h2 {
    color: #fff;
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 700;
}
p.subtitle {
    color: #94a3b8;
    font-size: 13.5px;
    margin: 0;
    line-height: 1.5;
}
.form-group {
    margin-bottom: 20px;
}
label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #cbd5e1;
    margin-bottom: 8px;
}
input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 15px;
    box-sizing: border-box;
    transition: all 0.2s;
}
input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}
.btn {
    width: 100%;
    padding: 12px;
    background: #2563eb;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 10px;
}
.btn:hover {
    background: #1d4ed8;
}
.error-box {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 12px;
    border-radius: 8px;
    font-size: 13.5px;
    margin-bottom: 20px;
    text-align: center;
}
</style>
</head>
<body>
<div class="card">
    <div class="header">
        <div class="logo">📋</div>
        <h2>${title}</h2>
        <p class="subtitle">${subtitle}</p>
    </div>
    
    ${errorMsg ? `<div class="error-box">${errorMsg}</div>` : ""}
    
    <form method="POST" action="${postUrl}">
        <div class="form-group">
            <label for="userName">Username</label>
            <input type="text" id="userName" name="userName" required autocomplete="username" placeholder="Enter username"/>
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="Enter password"/>
        </div>
        <button type="submit" class="btn">Log In & Authorize</button>
    </form>
</div>
</body>
</html>`;
};

/* ============================================================
   APPROVE / REJECT SINGLE REQUIREMENT FROM EMAIL
============================================================ */

export const approveSingleRequirement = asyncHandler(async (req, res) => {
    const query = req.query || {};
    const requirementId = query.id;
    const token = query.token;
    const action = query.action || query["amp;action"];
    const reason = query.reason;

    const renderPage = (title, message, isSuccess = false) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    padding: 20px;
    color: #f8fafc;
}
.card {
    background: rgba(30, 41, 59, 0.7);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    padding: 40px;
    max-width: 440px;
    width: 100%;
    text-align: center;
}
h2 {
    color: #fff;
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 700;
}
p {
    color: #cbd5e1;
    font-size: 15.5px;
    line-height: 1.6;
    margin: 0;
}
.icon {
    font-size: 56px;
    margin-bottom: 20px;
}
</style>
</head>
<body>
<div class="card">
<div class="icon">${isSuccess ? "✅" : "❌"}</div>
<h2>${title}</h2>
<p>${message}</p>
</div>
</body>
</html>`;

    if (!token || !action || !requirementId) {
        return res
            .status(400)
            .send(
                renderPage(
                    "Missing Parameters",
                    "The link is missing required parameters (ID, token, or action)."
                )
            );
    }

    const finalAction = action ? String(action).toLowerCase().trim() : null;

    if (finalAction !== "approve" && finalAction !== "reject") {
        return res
            .status(400)
            .send(
                renderPage(
                    "Invalid Action",
                    "The requested action is not valid."
                )
            );
    }

    // AUTH CHECK
    let user = await checkUserAuth(req);

    if (!user) {
        if (req.method === "POST") {
            const { userName, password } = req.body || {};
            if (!userName || !password) {
                return res.status(200).send(renderLoginPage(requirementId, token, action, false, "Username and password are required."));
            }

            try {
                const User = (await import("../models/auth.model.js")).default;
                const foundUser = await User.findOne({ userName: userName.toLowerCase() });
                if (!foundUser) {
                    return res.status(200).send(renderLoginPage(requirementId, token, action, false, "Invalid username or password."));
                }

                const isPasswordValid = await foundUser.comparePassword(password);
                if (!isPasswordValid) {
                    return res.status(200).send(renderLoginPage(requirementId, token, action, false, "Invalid username or password."));
                }

                if (['LEFT', 'SUSPENDED', 'BANNED'].includes(foundUser.status)) {
                    return res.status(200).send(renderLoginPage(requirementId, token, action, false, "Your account has been deactivated."));
                }

                const { generateAuthTokens } = await import("./auth.controller.js");
                const { accessToken, refreshToken } = await generateAuthTokens(foundUser);
                const { accessTokenOptions, refreshTokenOptions } = await import("../utils/constant.js");

                res.cookie("accessToken", accessToken, accessTokenOptions);
                res.cookie("refreshToken", refreshToken, refreshTokenOptions);

                user = foundUser;
            } catch (authErr) {
                console.error("Auth error in approval login:", authErr);
                return res.status(200).send(renderLoginPage(requirementId, token, action, false, "An error occurred during login."));
            }
        } else {
            return res.status(200).send(renderLoginPage(requirementId, token, action, false));
        }
    }

    const tokenDoc = await findRequirementToken(token);

    if (!tokenDoc) {
        return res
            .status(400)
            .send(
                renderPage(
                    "Invalid Link",
                    "This link is invalid or has already been used."
                )
            );
    }

    const tokenStatus = getTokenField(tokenDoc, "status", "status");

    const expiresAt =
        getTokenField(tokenDoc, "expiresAt", "expires_at") ||
        getTokenField(tokenDoc, "expires_at", "expiresAt");

    if (expiresAt && new Date(expiresAt) < new Date()) {
        return res
            .status(400)
            .send(
                renderPage(
                    "Link Expired",
                    "This approval link has expired. It was valid for 24 hours only."
                )
            );
    }

    const tokenRequirementId =
        getTokenField(tokenDoc, "requirementId", "requirement_id") ||
        getTokenField(tokenDoc, "requirement_id", "requirementId");

    const recipientEmail =
        getTokenField(tokenDoc, "recipientEmail", "recipient_email") ||
        getTokenField(tokenDoc, "recipient_email", "recipientEmail");

    const senderEmail =
        getTokenField(tokenDoc, "senderEmail", "sender_email") ||
        getTokenField(tokenDoc, "sender_email", "senderEmail");

    if (tokenStatus !== "pending") {
        return res
            .status(400)
            .send(
                renderPage(
                    "Already Processed",
                    `This requirement was already <strong>${tokenStatus}</strong>.`
                )
            );
    }

    if (String(tokenRequirementId) !== String(requirementId)) {
        return res
            .status(400)
            .send(
                renderPage(
                    "Invalid ID Match",
                    "The requirement ID in the link does not match the token payload."
                )
            );
    }

    if (finalAction === "approve") {
        const approverName = await resolvePersonNameByEmail(recipientEmail, "Section Head");
        await executeSql(
            `
            UPDATE requirements
            SET
                is_active = 1,
                approvalStatus = 'approved',
                approvedBy = ?,
                approvedByEmail = ?,
                approvedAt = GETDATE(),
                approvalSource = 'section_head',
                approvalOwnerName = CASE
                    WHEN approvalOwnerName IS NULL OR LTRIM(RTRIM(approvalOwnerName)) = '' OR LTRIM(RTRIM(approvalOwnerName)) = 'Section Head'
                    THEN ?
                    ELSE approvalOwnerName
                END,
                rejectedBy = NULL,
                rejectedAt = NULL
            WHERE id = ?
            `,
            [approverName, recipientEmail || "", approverName, requirementId]
        );

        await updateRequirementToken(token, { status: "approved" });

        if (senderEmail) {
            await sendMail(
                senderEmail,
                `Requirement Approved — ID #${requirementId}`,
                `<p>Requirement <strong>#${requirementId}</strong> has been approved.</p>`
            ).catch((e) =>
                console.error("Approve mail error:", e.message)
            );
        }

        return res.send(
            renderPage(
                "Approval Successful",
                `Requirement <strong>#${requirementId}</strong> has been approved successfully.`,
                true
            )
        );
    }

    if (finalAction === "reject") {
        const finalReason = reason || "Rejected by section head";

        await executeSql(
            `
            UPDATE requirements
            SET
                is_active = 0,
                approvalStatus = 'rejected',
                rejectedBy = ?,
                rejectedAt = GETDATE(),
                approvalSource = 'section_head'
            WHERE id = ?
            `,
            [recipientEmail || "Section Head", requirementId]
        );

        await updateRequirementToken(token, {
            status: "rejected",
            rejection_reason: finalReason,
        });

        if (senderEmail) {
            await sendMail(
                senderEmail,
                `Requirement Rejected — ID #${requirementId}`,
                `<p>Requirement <strong>#${requirementId}</strong> has been rejected.</p><p>Reason: ${finalReason}</p>`
            ).catch((e) =>
                console.error("Reject mail error:", e.message)
            );
        }

        return res.send(
            renderPage(
                "Rejection Successful",
                `Requirement <strong>#${requirementId}</strong> has been rejected successfully.`,
                true
            )
        );
    }

    return res.status(400).send(renderPage("Unknown Action", "Invalid action."));
});

/* ============================================================
   APPROVE / REJECT UPLOAD BATCH FROM EMAIL
============================================================ */

export const approveBatchRequirements = asyncHandler(async (req, res) => {
    const query = req.query || {};
    const token = query.token;
    const action = query.action || query["amp;action"];

    const renderBatchResult = (success, title, message) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    padding: 20px;
    color: #f8fafc;
}
.card {
    background: rgba(30, 41, 59, 0.7);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    padding: 40px;
    max-width: 480px;
    width: 100%;
    text-align: center;
}
h1 {
    color: #fff;
    margin: 0 0 12px;
    font-size: 24px;
    font-weight: 800;
}
p {
    color: #cbd5e1;
    font-size: 16px;
    line-height: 1.6;
    margin: 0;
}
.icon {
    font-size: 64px;
    margin-bottom: 20px;
    display: block;
}
</style>
</head>
<body>
<div class="card">
<span class="icon">${success ? "✅" : "❌"}</span>
<h1>${title}</h1>
<p>${message}</p>
</div>
</body>
</html>`;

    if (token) {
        const finalAction = action ? String(action).toLowerCase().trim() : null;

        if (finalAction !== "approve" && finalAction !== "reject") {
            return res
                .status(400)
                .send(
                    renderBatchResult(
                        false,
                        "Invalid Action",
                        "The requested action is not valid."
                    )
                );
        }
    }

    if (!token || !action) {
        return res.status(400).send("Missing required parameters.");
    }

    // AUTH CHECK
    let user = await checkUserAuth(req);

    if (!user) {
        if (req.method === "POST") {
            const { userName, password } = req.body || {};
            if (!userName || !password) {
                return res.status(200).send(renderLoginPage(null, token, action, true, "Username and password are required."));
            }

            try {
                const User = (await import("../models/auth.model.js")).default;
                const foundUser = await User.findOne({ userName: userName.toLowerCase() });
                if (!foundUser) {
                    return res.status(200).send(renderLoginPage(null, token, action, true, "Invalid username or password."));
                }

                const isPasswordValid = await foundUser.comparePassword(password);
                if (!isPasswordValid) {
                    return res.status(200).send(renderLoginPage(null, token, action, true, "Invalid username or password."));
                }

                if (['LEFT', 'SUSPENDED', 'BANNED'].includes(foundUser.status)) {
                    return res.status(200).send(renderLoginPage(null, token, action, true, "Your account has been deactivated."));
                }

                const { generateAuthTokens } = await import("./auth.controller.js");
                const { accessToken, refreshToken } = await generateAuthTokens(foundUser);
                const { accessTokenOptions, refreshTokenOptions } = await import("../utils/constant.js");

                res.cookie("accessToken", accessToken, accessTokenOptions);
                res.cookie("refreshToken", refreshToken, refreshTokenOptions);

                user = foundUser;
            } catch (authErr) {
                console.error("Auth error in approval login:", authErr);
                return res.status(200).send(renderLoginPage(null, token, action, true, "An error occurred during login."));
            }
        } else {
            return res.status(200).send(renderLoginPage(null, token, action, true));
        }
    }

    const tokenDoc = await findRequirementToken(token);

    if (!tokenDoc) {
        return res.status(400).send("Invalid or expired link.");
    }

    const tokenStatus = getTokenField(tokenDoc, "status", "status");

    const expiresAt =
        getTokenField(tokenDoc, "expiresAt", "expires_at") ||
        getTokenField(tokenDoc, "expires_at", "expiresAt");

    if (expiresAt && new Date(expiresAt) < new Date()) {
        return res.status(400).send("This approval link has expired.");
    }

    if (tokenStatus !== "pending") {
        return res
            .status(400)
            .send(`This link has already been processed (Status: ${tokenStatus}).`);
    }

    const uploadBatchId = getTokenField(
        tokenDoc,
        "uploadBatchId",
        "upload_batch_id"
    );

    const sectionCode = getTokenField(
        tokenDoc,
        "sectionCode",
        "section_code"
    );

    const sectionName = getTokenField(
        tokenDoc,
        "sectionName",
        "section_name"
    );

    const recipientEmail =
        getTokenField(tokenDoc, "recipientEmail", "recipient_email") ||
        getTokenField(tokenDoc, "recipient_email", "recipientEmail");

    if (!uploadBatchId || !sectionCode) {
        return res
            .status(400)
            .send("Invalid token data. Batch or section not found.");
    }

    if (action === "approve") {
        const approverEmail = safeTrim(user?.email || recipientEmail || "");
        const approverName = await resolveApproverNameFromUserOrEmail(user, approverEmail || recipientEmail, "Section Head");

        const [_, meta] = await executeSql(
            `
            UPDATE requirements
            SET
                is_active = 1,
                approvalStatus = 'approved',
                approvedBy = ?,
                approvedByEmail = ?,
                approvedAt = GETDATE(),
                approvalSource = 'section_head',
                approvalOwnerName = CASE
                    WHEN approvalOwnerName IS NULL OR LTRIM(RTRIM(approvalOwnerName)) = '' OR LTRIM(RTRIM(approvalOwnerName)) = 'Section Head'
                    THEN ?
                    ELSE approvalOwnerName
                END,
                rejectedBy = NULL,
                rejectedAt = NULL
            WHERE LTRIM(RTRIM(uploadBatchId)) = LTRIM(RTRIM(?))
              AND LTRIM(RTRIM(sectionCode)) = LTRIM(RTRIM(?))
              AND (approvalStatus IS NULL OR LTRIM(RTRIM(approvalStatus)) = '' OR LTRIM(RTRIM(approvalStatus)) = 'pending')
            `,
            [
                approverName,
                approverEmail || recipientEmail || "",
                approverName,
                uploadBatchId,
                sectionCode,
            ]
        );

        const affected = meta?.affectedRows || 0;
        console.log(`[APPROVE-BATCH] Token: ${token}, BatchId: ${uploadBatchId}, SectionCode: ${sectionCode}, Affected Rows: ${affected}`);

        await updateRequirementToken(token, { status: "approved" });

        return res.send(
            renderBatchResult(
                true,
                "Batch Requirements Approved",
                `All pending requirements for batch <strong>${uploadBatchId}</strong> (Section: ${sectionName || sectionCode}) have been approved successfully (Rows affected: ${affected}).`
            )
        );
    }

    if (action === "reject") {
        const [_, meta] = await executeSql(
            `
            UPDATE requirements
            SET
                is_active = 0,
                approvalStatus = 'rejected',
                rejectedBy = ?,
                rejectedAt = GETDATE(),
                approvalSource = 'section_head'
            WHERE LTRIM(RTRIM(uploadBatchId)) = LTRIM(RTRIM(?))
              AND LTRIM(RTRIM(sectionCode)) = LTRIM(RTRIM(?))
              AND (approvalStatus IS NULL OR LTRIM(RTRIM(approvalStatus)) = '' OR LTRIM(RTRIM(approvalStatus)) = 'pending')
            `,
            [
                recipientEmail || "Section Head",
                uploadBatchId,
                sectionCode,
            ]
        );

        const affected = meta?.affectedRows || 0;
        console.log(`[REJECT-BATCH] Token: ${token}, BatchId: ${uploadBatchId}, SectionCode: ${sectionCode}, Affected Rows: ${affected}`);

        await updateRequirementToken(token, { status: "rejected" });

        return res.send(
            renderBatchResult(
                true,
                "Batch Requirements Rejected",
                `All pending requirements for batch <strong>${uploadBatchId}</strong> (Section: ${sectionName || sectionCode}) have been rejected (Rows affected: ${affected}).`
            )
        );
    }

    return res.status(400).send("Invalid action requested.");
});