import mssql from "mssql";
import ExcelJS from "exceljs";
import crypto from "crypto";
import { poolPromise } from "../db/connectDB.js";
import Audit from "../models/audit.model.js";
import RequirementLog from "../models/requirementLogs.model.js";
import RequirementToken from "../models/requirementToken.model.js";
import sendMail from "../utils/mail.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
            sh.name
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

        const approveUrl = `${BASE_URL}/api/requirements/${requirementId}?token=${token}&action=approve`;
        const rejectUrl = `${BASE_URL}/api/requirements/${requirementId}?token=${token}&action=reject`;

        const updatedByName =
            req.user?.fullName ||
            req.user?.name ||
            req.user?.username ||
            "Admin";

        const updatedByRole = req.user?.role || "Admin";

        const oldSP = oldReq.salesPlan ?? "—";
        const oldPP = oldReq.prodPlan ?? "—";
        const newSP = newReq.salesPlan ?? "—";
        const newPP = newReq.prodPlan ?? "—";

        const sectionName = safeTrim(newReq.sectionName);
        const sectionCode = safeTrim(newReq.sectionCode);
        const lineDescription = safeTrim(newReq.lineDescription);

        const subject = `Requirement Approval Required — ${sectionName || sectionCode}`;

        const htmlMsg = `
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
        Dear <strong>${heads[0]?.name || "Section Head"}</strong>,
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
    </table>
</td>
</tr>

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

        const results = await Promise.allSettled(
            heads.map((h) => sendMail(h.email, subject, htmlMsg))
        );

        results.forEach((r, i) => {
            if (r.status === "fulfilled") {
                console.log(`[REQ-EDIT-MAIL] Sent to ${heads[i].email}`);
            } else {
                console.error(`[REQ-EDIT-MAIL] Failed for ${heads[i].email}:`, r.reason?.message);
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
            year,
            is_active,
            approvalStatus,
            createdAt
        )
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
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
        sectionDescUnicode: colOf("sectiondescunicode", "section desc unicode"),
        descriptionLine: colOf("description line", "description"),
        year: colOf("year"),
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
            } catch (_) {}

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
        const nextMonthStart =
            i + 1 < monthsSortedByCols.length
                ? monthStartColMap[monthsSortedByCols[i + 1]]
                : startCol + 6;

        let salesCol = null;
        let prodCol = null;

        for (let col = startCol; col < nextMonthStart; col++) {
            const role = subHeaderRoleMap[col];

            if (role === "sales" && salesCol === null) salesCol = col;
            if (role === "prod" && prodCol === null) prodCol = col;
            if (salesCol !== null && prodCol !== null) break;
        }

        if (salesCol === null && prodCol === null) {
            salesCol = startCol;
            prodCol = startCol + 1;
        } else if (salesCol === null) {
            salesCol = prodCol === startCol ? startCol + 1 : startCol;
        } else if (prodCol === null) {
            prodCol = salesCol === startCol ? startCol + 1 : startCol;
        }

        monthColMap[mk] = { salesCol, prodCol };
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
        const year = yearStr
            ? parseInt(String(yearStr).trim(), 10)
            : new Date().getFullYear();

        for (const mk of MONTH_KEYS) {
            const m = monthColMap[mk];
            if (!m) continue;

            const sp = safeNumber(readCell(row.getCell(m.salesCol)));
            const pp = safeNumber(readCell(row.getCell(m.prodCol)));

            if (sp === null && pp === null) continue;

            rowsToProcess.push({
                srNo,
                sectionCode: safeTrim(sectionCode) || null,
                sectionName: safeTrim(sectionName) || null,
                lineCode: safeTrim(sectionDescUnicode) || null,
                lineDescription: safeTrim(descriptionLine) || null,
                monthName: MONTH_FULL[mk],
                monthNumber: MONTH_KEYS.indexOf(mk) + 1,
                year,
                salesPlan: sp !== null ? sp : 0,
                prodPlan: pp !== null ? pp : 0,
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

    const invalidSections = new Set();

    for (const row of rowsToProcess) {
        const nameKey = normalizeUnicode(row.sectionName);
        const uniKey = normalizeUnicode(row.lineCode);
        const comboKey = `${nameKey}|${uniKey}`;
        const fallbackKey = `FALLBACK|${nameKey}`;

        if (!validSectionsMap.has(comboKey) && !validSectionsMap.has(fallbackKey)) {
            invalidSections.add(`${row.sectionName} (${row.lineCode})`);
        }
    }

    if (invalidSections.size > 0) {
        const errorList = Array.from(invalidSections).slice(0, 10).join("', '");
        throw new ApiError(
            `Validation Failed: The following Section names (with unicodes) do not exist in the system: '${errorList}'`,
            400
        );
    }

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
            SELECT id, srNo, sectionCode, lineCode, monthName, year
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
            existingMap.set(makeKey(r), r.id);
        });

        const rowsToInsert = [];
        const rowsToUpdate = [];

        rowsToProcess.forEach((r) => {
            const key = makeKey(r);
            const existingId = existingMap.get(key);

            if (existingId) {
                r.id = existingId;
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
                    row.year,
                    0,
                    uploadBatchId,
                    "pending"
                );
            });

            const placeholders = chunk
                .map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
                    year,
                    is_active,
                    uploadBatchId,
                    approvalStatus
                )
                VALUES ${placeholders}
            `;

            const [, meta] = await executeSql(
                insertQuery,
                paramsArray,
                transaction
            );

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
                    is_active = ?,
                    uploadBatchId = ?,
                    approvalStatus = ?,
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
                    0,
                    uploadBatchId,
                    "pending",
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
                    SELECT sh.email, sh.name
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
                        <td style="padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:700;">${totalPP}</td>
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

                for (const head of secHeads) {
                    const recipientName = head.name || "Section Head";

                    const htmlMsg = `
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

                    await sendMail(head.email, subject, htmlMsg)
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

    let countSql = "SELECT COUNT(*) AS total FROM requirements WHERE 1=1";
    let sql = "SELECT * FROM requirements WHERE 1=1";
    const params = [];

    if (section && String(section).toLowerCase() !== "all") {
        const cond = " AND sectionName = ?";
        countSql += cond;
        sql += cond;
        params.push(section);
    }

    if (sub_section && String(sub_section).toLowerCase() !== "all") {
        const cond = " AND lineDescription = ?";
        countSql += cond;
        sql += cond;
        params.push(sub_section);
    }

    if (search) {
        const searchPattern = `%${search}%`;
        const cond = `
            AND (
                sectionCode LIKE ?
                OR sectionName LIKE ?
                OR lineCode LIKE ?
                OR lineDescription LIKE ?
                OR monthName LIKE ?
                OR CAST(year AS NVARCHAR(20)) LIKE ?
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
                '01 ' + SUBSTRING(monthName, 1, 3) + ' ' + CAST(year AS VARCHAR)
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

    sql += " ORDER BY id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";

    const [results] = await executeSql(sql, [...params, offset, limit]);

    const data = results.map((row) => ({
        ...row,

        count: row.salesPlan,
        section: row.sectionName,
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
        "SELECT * FROM requirements WHERE id = ?",
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
    const { token, action, reason } = { ...req.query, ...req.body };

    if (token && action) {
        const tokenDoc = await findRequirementToken(token);

        const renderPage = (title, message) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
.card{background:#fff;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.10);padding:40px 36px;text-align:center;max-width:440px;width:100%;}
h2{color:#1e293b;margin:0 0 12px;font-size:22px;}
p{color:#475569;font-size:15px;line-height:1.6;margin:0;}
.icon{font-size:52px;margin-bottom:16px;}
</style>
</head>
<body>
<div class="card">
<div class="icon">ℹ️</div>
<h2>${title}</h2>
<p>${message}</p>
</div>
</body>
</html>`;

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

        const requirementId =
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

        if (!requirementId) {
            return res
                .status(400)
                .send(
                    renderPage(
                        "Invalid Link",
                        "Requirement ID was not found in this approval token."
                    )
                );
        }

        if (action === "approve") {
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
                    "Approved",
                    "You have successfully approved this requirement."
                )
            );
        }

        if (action === "reject") {
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
                    "Rejected",
                    "You have rejected this requirement."
                )
            );
        }

        return res.status(400).send(renderPage("Unknown Action", "Invalid action."));
    }

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

    try {
        await RequirementLog.create({
            requirement_id: id,
            old_values: oldReq,
            new_values: newReq,
            employee_id: req.user?._id || req.user?.id || null,
            employee_role: req.user?.role || "Admin",
            updated_by_name:
                req.user?.fullName || req.user?.name || req.user?.username || null,
        });
    } catch (logErr) {
        console.error("Failed to log requirement update:", logErr.message);
    }

const salesChanged =
    salesPlan !== undefined && !isSameNumber(oldReq.salesPlan, newReq.salesPlan);

const prodChanged =
    prodPlan !== undefined && !isSameNumber(oldReq.prodPlan, newReq.prodPlan);

if (!salesChanged && !prodChanged) {
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                ...newReq,
                mailSent: false,
                mailInfo: {
                    sent: false,
                    reason: "No SP/PP value changed, mail skipped.",
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

/* ============================================================
   APPROVE / REJECT UPLOAD BATCH FROM EMAIL
============================================================ */

export const approveBatchRequirements = asyncHandler(async (req, res) => {
    const { token, action } = req.query;

    if (!token || !action) {
        return res.status(400).send("Missing required parameters.");
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
        "uploadBatchId"
    );

    const sectionCode = getTokenField(
        tokenDoc,
        "sectionCode",
        "sectionCode"
    );

    const sectionName = getTokenField(
        tokenDoc,
        "sectionName",
        "sectionName"
    );

    const recipientEmail =
        getTokenField(tokenDoc, "recipientEmail", "recipient_email") ||
        getTokenField(tokenDoc, "recipient_email", "recipientEmail");

    if (!uploadBatchId || !sectionCode) {
        return res
            .status(400)
            .send("Invalid token data. Batch or section not found.");
    }

    const renderBatchResult = (success, title, message) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
.card{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.08);padding:48px 40px;text-align:center;max-width:480px;width:100%;}
.icon{font-size:64px;margin-bottom:20px;display:block;}
h1{color:#1e293b;margin:0 0 12px;font-size:24px;font-weight:800;}
p{color:#64748b;font-size:16px;line-height:1.6;margin:0;}
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

    if (action === "approve") {
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
            WHERE uploadBatchId = ?
              AND sectionCode = ?
              AND ISNULL(approvalStatus, 'pending') = 'pending'
            `,
            [
                recipientEmail || "Section Head",
                recipientEmail || "",
                uploadBatchId,
                sectionCode,
            ]
        );

        await updateRequirementToken(token, { status: "approved" });

        return res.send(
            renderBatchResult(
                true,
                "Requirements Approved!",
                `Successfully activated the new manpower requirements for <strong>${sectionName || sectionCode}</strong>.`
            )
        );
    }

    if (action === "reject") {
        await executeSql(
            `
            UPDATE requirements
            SET
                is_active = 0,
                approvalStatus = 'rejected',
                rejectedBy = ?,
                rejectedAt = GETDATE(),
                approvalSource = 'section_head'
            WHERE uploadBatchId = ?
              AND sectionCode = ?
              AND ISNULL(approvalStatus, 'pending') = 'pending'
            `,
            [
                recipientEmail || "Section Head",
                uploadBatchId,
                sectionCode,
            ]
        );

        await updateRequirementToken(token, { status: "rejected" });

        return res.send(
            renderBatchResult(
                true,
                "Requirements Rejected",
                `The uploaded requirements for <strong>${sectionName || sectionCode}</strong> have been rejected.`
            )
        );
    }

    return res.status(400).send("Invalid action requested.");
});