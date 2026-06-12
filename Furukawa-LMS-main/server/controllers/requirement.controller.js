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
    const sectionName = safeTrim(reqRow.sectionName);
    const lineCode = safeTrim(reqRow.lineCode);
    const lineDescription = safeTrim(reqRow.lineDescription);

    const [heads] = await executeSql(
        `
        SELECT DISTINCT
            sh.email,
            sh.name,
            sh.CCMail
        FROM section_heads sh
        LEFT JOIN sections s
            ON sh.sectionId = s.id
        WHERE
            sh.email IS NOT NULL
            AND LTRIM(RTRIM(sh.email)) != ''
            AND (
                UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(s.name))) = UPPER(LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(s.name))) = UPPER(LTRIM(RTRIM(?)))
            )
        `,
        [sectionCode, sectionName, lineCode, lineDescription]
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
        const ccEmails = heads.map((h) => h.CCMail).filter(Boolean).join(", ");
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
                heads[0]?.name || "Section Head",
                heads[0]?.email || "",
                requirementId,
            ]
        );

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await createRequirementTokenSafe({
            token,
            requirementId,
            recipientEmail: heads[0].email,
            senderEmail: req.user?.email || "admin@furukawa.com",
            expiresAt,
            status: "pending",
        });

        const BASE_URL =
            process.env.BASE_URL ||
            process.env.APP_BASE_URL ||
            `${req.protocol}://${req.get("host")}`;

        const approveUrl = `${BASE_URL}/api/requirements/approve-single?id=${requirementId}&token=${token}&action=approve`;
        const rejectUrl = `${BASE_URL}/api/requirements/approve-single?id=${requirementId}&token=${token}&action=reject`;

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

        const sectionName = safeTrim(newReq.sectionName);
        const sectionCode = safeTrim(newReq.sectionCode);
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
        Please approve or reject the change.
    </p>
</td>
</tr>

<tr>
<td style="padding:18px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Section</strong></td>
            <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:700;">${sectionName || "-"}</td>
        </tr>
        <tr>
            <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Line</strong></td>
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
            <td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:700;">Production Plan</td>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">${oldPP}</td>
            <td style="padding:9px 12px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:800;">${newPP}</td>
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
    <a href="${approveUrl}" style="background:#16a34a;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;margin-right:10px;">
        ✅ APPROVE
    </a>
    <a href="${rejectUrl}" style="background:#dc2626;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">
        ❌ REJECT
    </a>
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
            const recipientName = h.name || "Section Head";
            const htmlMsgWithButtons = getHtmlMsg(recipientName, true);
            return sendMail(h.email, subject, htmlMsgWithButtons, [], "");
        });

        const ccPromises = [];
        if (ccEmails) {
            const senderEmail = req.user?.email || "admin@furukawa.com";
            const ccRecipientName = heads[0]?.name || "Section Head";
            const htmlMsgWithoutButtons = getHtmlMsg(ccRecipientName, false);
            ccPromises.push(
                sendMail(senderEmail, subject, htmlMsgWithoutButtons, [], ccEmails)
            );
        }

        const results = await Promise.allSettled([...headPromises, ...ccPromises]);

        results.forEach((r, i) => {
            if (i < heads.length) {
                const email = heads[i].email;
                if (r.status === "fulfilled") {
                    console.log(`[REQ-EDIT-MAIL] Sent to head: ${email}`);
                } else {
                    console.error(`[REQ-EDIT-MAIL] Failed for head ${email}:`, r.reason?.message);
                }
            } else {
                if (r.status === "fulfilled") {
                    console.log(`[REQ-EDIT-MAIL] Sent to CC recipients: ${ccEmails}`);
                } else {
                    console.error(`[REQ-EDIT-MAIL] Failed for CC recipients ${ccEmails}:`, r.reason?.message);
                }
            }
        });

        return {
            sent: results.some((r) => r.status === "fulfilled"),
            recipientCount: heads.length,
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
        sectionDescUnicode: colOf("sectiondescunicode", "section desc unicode", "line code/sub section", "line code", "sub section"),
        descriptionLine: colOf("description line", "description"),
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

            if (sp === null && fn01 === null && fn02 === null) continue;

            const pp = (fn01 || 0) + (fn02 || 0);

            rowsToProcess.push({
                srNo,
                sectionCode: safeTrim(sectionCode) || null,
                sectionName: safeTrim(sectionName) || null,
                lineCode: safeTrim(sectionDescUnicode) || null,
                lineDescription: safeTrim(descriptionLine) || null,
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
        if (s.name) {
            const nameKey = normalizeUnicode(s.name);
            const uniKey = normalizeUnicode(s.uniCode);

            validSectionsMap.set(`${nameKey}|${uniKey}`, s.id);

            if (!validSectionsMap.has(`FALLBACK|${nameKey}`)) {
                validSectionsMap.set(`FALLBACK|${nameKey}`, s.id);
            }
        }
    });

    const validRowsToProcess = [];
    const invalidSections = new Set();

    for (const row of rowsToProcess) {
        const nameKey = normalizeUnicode(row.sectionName);
        const uniKey = normalizeUnicode(row.lineCode);
        const comboKey = `${nameKey}|${uniKey}`;
        const fallbackKey = `FALLBACK|${nameKey}`;

        if (validSectionsMap.has(comboKey) || validSectionsMap.has(fallbackKey)) {
            validRowsToProcess.push(row);
        } else {
            invalidSections.add(`${row.sectionName} (${row.lineCode})`);
        }
    }

    if (invalidSections.size > 0) {
        const ignoredList = Array.from(invalidSections).slice(0, 10).join("', '");
        console.log(`Skipped requirement rows for non-existent sections (unicodes): '${ignoredList}'`);
    }

    if (validRowsToProcess.length === 0) {
        throw new ApiError(
            "Validation Failed: None of the sections in the Excel file exist in the system. No data was uploaded.",
            400
        );
    }

    // Mutate rowsToProcess in-place so all downstream logic works without changes
    rowsToProcess.length = 0;
    rowsToProcess.push(...validRowsToProcess);

    const conn = await poolPromise;
    const transaction = new mssql.Transaction(conn);
    let totalInsertedRows = 0;

    try {
        await transaction.begin();



        const uploadBatchId = `BATCH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const yearsToUpdate = [...new Set(rowsToProcess.map((r) => r.year))];

        const placeholdersYears = yearsToUpdate.map(() => "?").join(",");

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
            `${r.srNo || ""}|${r.sectionCode || ""}|${r.lineCode || ""}|${r.monthName || ""}|${r.year || ""}`;

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

        const getSectionId = (sectionName, lineCode) => {
            const nameKey = normalizeUnicode(sectionName);
            const uniKey = normalizeUnicode(lineCode);
            return validSectionsMap.get(`${nameKey}|${uniKey}`) || validSectionsMap.get(`FALLBACK|${nameKey}`) || null;
        };

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

            // Log inserted requirements
            for (const insertedRow of insertedRows) {
                try {
                    await RequirementLog.create({
                        requirement_id: insertedRow.id,
                        section_id: getSectionId(insertedRow.sectionName, insertedRow.lineCode),
                        old_values: null,
                        new_values: insertedRow,
                        employee_id: req.user?._id || req.user?.id || null,
                        employee_role: req.user?.role || "Admin",
                    }, transaction);
                } catch (logErr) {
                    console.error("Failed to log bulk insert requirement:", logErr.message);
                }
            }

            totalInsertedRows += meta?.affectedRows || chunk.length;
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

            // Fetch and log updated requirement
            try {
                const [newRows] = await executeSql(
                    "SELECT * FROM requirements WHERE id = ?",
                    [row.id],
                    transaction
                );
                if (newRows.length > 0) {
                    await RequirementLog.create({
                        requirement_id: row.id,
                        section_id: getSectionId(row.sectionName, row.lineCode),
                        old_values: row.oldReq,
                        new_values: newRows[0],
                        employee_id: req.user?._id || req.user?.id || null,
                        employee_role: req.user?.role || "Admin",
                    }, transaction);
                }
            } catch (logErr) {
                console.error("Failed to log bulk update requirement:", logErr.message);
            }

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

        try {
            const sectionDataMap = new Map();

            for (const r of rowsToProcess) {
                const secCode = safeTrim(r.sectionCode);
                const secName = safeTrim(r.sectionName);

                if (!secCode) continue;

                if (!sectionDataMap.has(secCode)) {
                    sectionDataMap.set(secCode, {
                        sectionName: secName,
                        rows: [],
                        months: new Set(),
                        salesCount: 0,
                        prodCount: 0,
                    });
                }

                const entry = sectionDataMap.get(secCode);
                entry.rows.push(r);

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

            for (const [secCode, secData] of sectionDataMap.entries()) {
                const secName = secData.sectionName;

                const [secHeads] = await executeSql(
                    `
                    SELECT sh.email, sh.name, sh.CCMail
                    FROM section_heads sh
                    LEFT JOIN sections s ON sh.sectionId = s.id
                    WHERE
                        sh.email IS NOT NULL
                        AND LTRIM(RTRIM(sh.email)) != ''
                        AND (
                            UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(?)))
                            OR UPPER(LTRIM(RTRIM(s.name))) = UPPER(LTRIM(RTRIM(?)))
                        )
                    `,
                    [secCode, secName]
                );

                if (!secHeads || secHeads.length === 0) {
                    console.log(
                        `[UPLOAD-EMAIL] No section head found for section: ${secName}`
                    );
                    continue;
                }

                const ccEmails = secHeads.map((h) => h.CCMail).filter(Boolean).join(", ");

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
                        secHeads[0]?.name || "Section Head",
                        secHeads[0]?.email || "",
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
                    const totalPP = monthRows_.reduce(
                        (s, r) => s + (Number(r.prodPlan) || 0),
                        0
                    );

                    monthRows += `
                    <tr>
                        <td style="padding:8px 14px;border:1px solid #e2e8f0;font-weight:600;color:#1e293b;">${month}</td>
                        <td style="padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:700;">${totalSP}</td>
                        <td style="padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:700;">
                            ${totalPP}
                        </td>
                    </tr>`;
                });

                const uploadTypeLabel = secData.months.size <= 6 ? "6-Month" : "Annual";

                const subject = `📊 ${uploadTypeLabel} Requirements for Approval — ${secName}`;

                const tkn = `ACT_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 10)}`.toUpperCase();

                await createRequirementTokenSafe({
                    token: tkn,
                    uploadBatchId,
                    sectionCode: secCode,
                    sectionName: secName,
                    recipientEmail: secHeads[0].email,
                    senderEmail: req.user?.email || "admin@furukawa.com",
                    expiresAt: new Date(Date.now() + 24 * 3600000),
                    status: "pending",
                });

                const BASE_URL =
                    process.env.BASE_URL ||
                    process.env.APP_BASE_URL ||
                    `${req.protocol}://${req.get("host")}`;

                const approveUrl = `${BASE_URL}/api/requirements/approve-batch?token=${tkn}&action=approve`;
                const rejectUrl = `${BASE_URL}/api/requirements/approve-batch?token=${tkn}&action=reject`;

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
        New <strong>${uploadTypeLabel}</strong> manpower requirements have been uploaded for section <strong>${secName}</strong>.
        These requirements are currently <strong style="color:#dc2626;">pending approval</strong>.
        If no action is taken within 24 hours, they will be marked as <strong>Approved by System</strong>.
    </p>
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
${showButtons ? `
<tr>
<td style="padding:10px 36px 24px;text-align:center;">
    <a href="${approveUrl}" style="background:#16a34a;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;margin-right:10px;">
        ✅ APPROVE
    </a>
    <a href="${rejectUrl}" style="background:#dc2626;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">
        ❌ REJECT
    </a>
</td>
</tr>
` : ''}
<tr>
<td style="padding:0 36px 24px;">
    <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 10px;">Month-wise Breakdown:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
        <tr>
            <th style="padding:10px 14px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Month</th>
            <th style="padding:10px 14px;background:#1e3a5f;color:#fff;text-align:center;border:1px solid #1e3a5f;">Sales Plan</th>
            <th style="padding:10px 14px;background:#1e3a5f;color:#fff;text-align:center;border:1px solid #1e3a5f;">Production Plan</th>
        </tr>
        ${monthRows}
    </table>
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

                for (const head of secHeads) {
                    const recipientName = head.name || "Section Head";
                    const htmlMsgWithButtons = getHtmlMsg(recipientName, true);

                    await sendMail(head.email, subject, htmlMsgWithButtons, [], "")
                        .then(() =>
                            console.log(
                                `[UPLOAD-EMAIL] Sent to ${head.email} for section: ${secName}`
                            )
                        )
                        .catch((e) =>
                            console.error(
                                `[UPLOAD-EMAIL] Failed for ${head.email}:`,
                                e.message
                            )
                        );
                }

                if (ccEmails) {
                    const ccRecipientName = secHeads[0]?.name || "Section Head";
                    const htmlMsgWithoutButtons = getHtmlMsg(ccRecipientName, false);
                    const senderEmail = req.user?.email || "admin@furukawa.com";
                    await sendMail(senderEmail, subject, htmlMsgWithoutButtons, [], ccEmails)
                        .then(() =>
                            console.log(
                                `[UPLOAD-EMAIL-CC] Sent to CC recipients: ${ccEmails} for section: ${secName}`
                            )
                        )
                        .catch((e) =>
                            console.error(
                                `[UPLOAD-EMAIL-CC] Failed for CC recipients ${ccEmails}:`,
                                e.message
                            )
                        );
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

export const getRequirements = asyncHandler(async (req, res) => {
    await autoApproveExpiredRequirements();

    const { section, sub_section, startDate, endDate, search } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    let countSql = "SELECT COUNT(r.id) AS total FROM requirements r WHERE 1=1";
    let sql = "SELECT r.*, (SELECT TOP 1 category FROM [sections] sec WHERE r.sectionCode = sec.uniCode OR r.sectionName = sec.name) AS sectionCategory FROM requirements r WHERE 1=1";
    const params = [];

    if (section && String(section).toLowerCase() !== "all") {
        const cond = " AND r.sectionName = ?";
        countSql += cond;
        sql += cond;
        params.push(section);
    }

    if (sub_section && String(sub_section).toLowerCase() !== "all") {
        const cond = " AND r.lineDescription = ?";
        countSql += cond;
        sql += cond;
        params.push(sub_section);
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

    const data = results.map((row) => ({
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
    }));

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
                    section: section || "All",
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

    res.status(200).json(
        new ApiResponse(200, rows, "Requirement logs fetched successfully")
    );
});

export const getRequirementFilters = asyncHandler(async (req, res) => {
    const [sections] = await executeSql(`
        SELECT DISTINCT sectionName AS section
        FROM requirements
        WHERE sectionName IS NOT NULL
          AND LTRIM(RTRIM(sectionName)) != ''
        ORDER BY sectionName
    `);

    const [subSections] = await executeSql(`
        SELECT DISTINCT lineDescription AS sub_section
        FROM requirements
        WHERE lineDescription IS NOT NULL
          AND LTRIM(RTRIM(lineDescription)) != ''
        ORDER BY lineDescription
    `);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                sections: sections.map((s) => s.section),
                subSections: subSections.map((s) => s.sub_section),
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

    // Find section_id
    let sectionIdToLog = null;
    try {
        const [sectionRows] = await executeSql(
            `
            SELECT id FROM sections 
            WHERE name = ? AND uniCode = ?
            `,
            [newReq.sectionName, newReq.lineCode]
        );
        if (sectionRows.length > 0) {
            sectionIdToLog = sectionRows[0].id;
        } else {
            // fallback
            const [fallbackRows] = await executeSql(
                `
                SELECT id FROM sections 
                WHERE name = ?
                `,
                [newReq.sectionName]
            );
            if (fallbackRows.length > 0) {
                sectionIdToLog = fallbackRows[0].id;
            }
        }
    } catch (err) {
        console.error("Failed to find section for log:", err.message);
    }

    try {
        await RequirementLog.create({
            requirement_id: id,
            section_id: sectionIdToLog,
            old_values: oldReq,
            new_values: newReq,
            employee_id: req.user?._id || req.user?.id || null,
            employee_role: req.user?.role || "Admin",
        });
    } catch (logErr) {
        console.error("Failed to log requirement update:", logErr.message);
    }

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

    await executeSql("DELETE FROM requirements WHERE id = ?", [id]);

    res.status(200).json(
        new ApiResponse(200, null, "Requirement deleted successfully")
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
                const { accessToken, refreshToken } = await generateAuthTokens(foundUser.id);
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
                rejectedBy = NULL,
                rejectedAt = NULL
            WHERE id = ?
            `,
            [recipientEmail || "Section Head", recipientEmail || "", requirementId]
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
                const { accessToken, refreshToken } = await generateAuthTokens(foundUser.id);
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
                rejectedBy = NULL,
                rejectedAt = NULL
            WHERE LTRIM(RTRIM(uploadBatchId)) = LTRIM(RTRIM(?))
              AND LTRIM(RTRIM(sectionCode)) = LTRIM(RTRIM(?))
              AND (approvalStatus IS NULL OR LTRIM(RTRIM(approvalStatus)) = '' OR LTRIM(RTRIM(approvalStatus)) = 'pending')
            `,
            [
                recipientEmail || "Section Head",
                recipientEmail || "",
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