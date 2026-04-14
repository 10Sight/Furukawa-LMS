import mssql from "mssql";
import ExcelJS from "exceljs";
import crypto from "crypto";
import { poolPromise } from "../db/connectDB.js";
import Audit from "../models/audit.model.js";
import RequirementLog from "../models/requirementLogs.model.js";
import SectionHead from "../models/sectionHead.model.js";
import RequirementToken from "../models/requirementToken.model.js";
import sendMail from "../utils/mail.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Helper function to bridge MySQL "?" syntax to MSSQL "@param" syntax for Controllers
const executeSql = async (queryStr, params = [], transactionOrPool = null) => {
    // If conn is a transaction, .request() returns a transaction-scoped request
    const activeConn = transactionOrPool || await poolPromise;
    const request = activeConn.request();
    request.timeout = 300000; // 5 minute timeout for heavy merges
    let formattedQuery = queryStr;
    for (let i = 0; i < params.length; i++) {
        const paramName = `p${i}`;
        request.input(paramName, params[i]);
        formattedQuery = formattedQuery.replace('?', `@${paramName}`);
    }
    const result = await request.query(formattedQuery);
    return [result.recordset || [], {
        affectedRows: result.rowsAffected ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0,
        insertId: result.recordset && result.recordset.length > 0 && result.recordset[0].id ? result.recordset[0].id : null
    }];
};

// Helper to get ID from Name or just return ID
const getId = async (table, val) => {
    if (!val) return null;
    if (typeof val === 'number') return val;
    if (!isNaN(Number(val)) && String(val).trim() !== '') return Number(val);

    const col = (table === 'departments' || table === 'lines') ? 'uniCode' : 'name';
    const [rows] = await executeSql(`SELECT id FROM [${table}] WHERE [${col}] = ? OR name = ?`, [val, val]);
    return rows.length > 0 ? rows[0].id : null;
};

export const createRequirement = asyncHandler(async (req, res) => {
    const { section, sub_section, supervisorName, mentor, line_area, stationNo, month, year, salesPlan, prodPlan, count } = req.body;

    const sectionId = await getId('departments', section);

    const query = `
        INSERT INTO requirements
        (section_id, section_code, section_name, section_desc_unicode, description_line, station_no, supervisor_name, mentor, month_name, year_val, sales_plan, prod_plan)
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [rows, meta] = await executeSql(query, [
        sectionId, '', section,
        '', sub_section || '', // Mapping to both desc and unicode for fallback
        stationNo || '', supervisorName || '', mentor || '',
        month, year, salesPlan !== undefined ? salesPlan : (count || 0), prodPlan !== undefined ? prodPlan : (count || 0)
    ]);

    const requirementId = meta.insertId;

    try {
        await Audit.create({
            user: req.user?._id || req.user?.id,
            action: "CREATE_REQUIREMENT",
            resourceType: "Requirement",
            resourceId: String(requirementId),
            details: {
                new_values: { ...req.body, id: requirementId },
                section_name: section,
                subsection_name: sub_section
            }
        });
    } catch (logErr) {
        console.error("Failed to log requirement creation:", logErr.message);
    }

    res.status(201).json(
        new ApiResponse(201, { id: requirementId, ...req.body }, "Requirement created successfully")
    );
});

export const addRequirements = asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError("No file uploaded", 400);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const MONTH_FULL = {
        jan: "January", feb: "February", mar: "March", apr: "April",
        may: "May", jun: "June", jul: "July", aug: "August",
        sep: "September", oct: "October", nov: "November", dec: "December"
    };
    const MONTH_ABBR_MAP = {
        jan: "jan", january: "jan", feb: "feb", february: "feb", mar: "mar", march: "mar",
        apr: "apr", april: "apr", may: "may", jun: "jun", june: "jun", jul: "jul", july: "jul",
        aug: "aug", august: "aug", sep: "sep", sept: "sep", september: "sep",
        oct: "oct", october: "oct", nov: "nov", november: "nov", dec: "dec", december: "dec"
    };

    const norm = (s) => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");

    const readCell = (cell) => {
        if (!cell) return null;
        let val = (cell.isMerged && cell.master) ? cell.master.value : cell.value;
        if (val === null || val === undefined) return null;

        if (typeof val === "object") {
            if (val.result !== undefined) val = val.result;
            else if (val.text !== undefined) val = val.text;
            else if (val.richText) val = val.richText.map(x => x.text).join("");
            else if (val instanceof Date) val = val.toISOString();
            else val = val.toString();
        }
        if (val === null || val === undefined) return null;
        return String(val).trim();
    };

    const parseNumberNullable = (val) => {
        if (val === null || val === undefined || val === "") return null;
        const cleaned = String(val).replace(/,/g, "").trim();
        if (cleaned === "" || cleaned === "-") return null;
        const num = Number(cleaned);
        if (Number.isNaN(num)) return null;
        return Math.round(num);
    };

    const isSalesHeader = (txt) => norm(txt).includes("sales");
    const isProdHeader = (txt) => norm(txt).includes("prod");

    let targetSheet = workbook.worksheets[0];
    if (!targetSheet) throw new ApiError("Invalid file format. No worksheet found.", 400);

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

    if (headerRowIdx === -1) throw new ApiError("Invalid file format. Header row missing.", 400);

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
        supervisor: colOf("supervisor name", "supervisor"),
        mentor: colOf("mentor"),
        // Custom logic needed for second "Section" column
        stationNo: colOf("station no.", "station no", "station"),
        year: colOf("year"),
    };

    // Find the second "Section" column if it exists
    let secAttrColIdx = -1;
    let sectionCount = 0;
    targetSheet.getRow(headerRowIdx).eachCell((c, i) => {
        if (norm(readCell(c)) === 'section') {
            sectionCount++;
            if (sectionCount === 2) secAttrColIdx = i;
        }
    });
    COL.sectionAttribute = secAttrColIdx !== -1 ? secAttrColIdx : null;

    const getCellVal = (row, colIdx) => (colIdx ? readCell(row.getCell(colIdx)) : null);

    const subHeaderRoleMap = {};
    const allMonthCols = Object.values(monthStartColMap).filter(Boolean);

    if (allMonthCols.length > 0) {
        const scanStart = Math.min(...allMonthCols);
        const maxScanCol = Math.max(...allMonthCols) + 24;

        for (let colNum = scanStart; colNum <= maxScanCol; colNum++) {
            const cell = subHeaderRow.getCell(colNum);
            let effectiveCell = cell;
            try {
                if (cell.isMerged && cell.master && cell.master !== cell) effectiveCell = cell.master;
            } catch (_) { }

            const rawVal = readCell(effectiveCell);
            if (!rawVal) subHeaderRoleMap[colNum] = "unknown";
            else if (isSalesHeader(rawVal)) subHeaderRoleMap[colNum] = "sales";
            else if (isProdHeader(rawVal)) subHeaderRoleMap[colNum] = "prod";
            else subHeaderRoleMap[colNum] = "unknown";
        }
    }

    const monthsSortedByCols = MONTH_KEYS
        .filter(mk => monthStartColMap[mk] != null)
        .sort((a, b) => monthStartColMap[a] - monthStartColMap[b]);

    const monthColMap = {};

    for (let i = 0; i < monthsSortedByCols.length; i++) {
        const mk = monthsSortedByCols[i];
        const startCol = monthStartColMap[mk];
        const nextMonthStart = (i + 1 < monthsSortedByCols.length) ? monthStartColMap[monthsSortedByCols[i + 1]] : startCol + 6;

        let salesCol = null, prodCol = null;

        for (let col = startCol; col < nextMonthStart; col++) {
            const role = subHeaderRoleMap[col];
            if (role === "sales" && salesCol === null) salesCol = col;
            if (role === "prod" && prodCol === null) prodCol = col;
            if (salesCol !== null && prodCol !== null) break;
        }

        if (salesCol === null && prodCol === null) {
            salesCol = startCol; prodCol = startCol + 1;
        } else if (salesCol === null) {
            salesCol = (prodCol === startCol) ? startCol + 1 : startCol;
        } else if (prodCol === null) {
            prodCol = (salesCol === startCol) ? startCol + 1 : startCol;
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

        const srNo = parseNumberNullable(getCellVal(row, COL.srNo)) || null;
        const sectionDescUnicode = getCellVal(row, COL.sectionDescUnicode) || "";
        const descriptionLine = getCellVal(row, COL.descriptionLine) || "";
        const supervisor = getCellVal(row, COL.supervisor) || "";
        const mentor = getCellVal(row, COL.mentor) || "";
        const sectionAttribute = getCellVal(row, COL.sectionAttribute) || "";
        const stationNoRaw = getCellVal(row, COL.stationNo) || "";
        const stationNo = stationNoRaw ? String(stationNoRaw).trim() : "";

        const yearStr = getCellVal(row, COL.year);
        const year = yearStr ? parseInt(String(yearStr).trim(), 10) : new Date().getFullYear();

        for (const mk of MONTH_KEYS) {
            const m = monthColMap[mk];
            if (!m) continue;

            const sp = parseNumberNullable(readCell(row.getCell(m.salesCol)));
            const pp = parseNumberNullable(readCell(row.getCell(m.prodCol)));

            if (sp === null && pp === null) continue;

            rowsToProcess.push({
                srNo: srNo,
                sectionCode: sectionCode ? String(sectionCode).trim() : null,
                sectionName: sectionName ? String(sectionName).trim() : null,
                lineCode: sectionDescUnicode ? String(sectionDescUnicode).trim() : null,
                lineDescription: descriptionLine ? String(descriptionLine).trim() : null,
                monthName: MONTH_FULL[mk],
                monthNumber: MONTH_KEYS.indexOf(mk) + 1,
                year: year,
                salesPlan: sp !== null ? sp : 0,
                prodPlan: pp !== null ? pp : 0
            });
        }
    });

    if (rowsToProcess.length === 0) throw new ApiError("No valid data found in the Excel file.", 400);

    // Context & Validation: Verify Section Name and Unicode exist in 'sections' table
    const [dbSections] = await executeSql("SELECT id, name, uniCode FROM [sections]");

    // Normalize unicode to avoid mismatch due to different string representations
    const normalizeUnicode = (str) => {
        if (!str) return "";
        return str.toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remove diacritics
            .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // remove non-printable characters
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    };

    const validSectionsMap = new Map();
    dbSections.forEach(s => {
        if (s.name) {
            const nameKey = normalizeUnicode(s.name);
            const uniKey = normalizeUnicode(s.uniCode);
            // Store mapping by name+unicode string combo
            validSectionsMap.set(`${nameKey}|${uniKey}`, s.id);
            // Also keep a fallback by just name (first encountered)
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

        if (validSectionsMap.has(comboKey)) {
            // Note: DB schema does not have a section_id, so we just log or omit
            // We will save to DB without `section_id` since it's missing from target table.
        } else if (validSectionsMap.has(fallbackKey)) {
            // Valid fallback mapped
        } else {
            invalidSections.add(`${row.sectionName} (${row.lineCode})`);
        }
    }

    if (invalidSections.size > 0) {
        const errorList = Array.from(invalidSections).slice(0, 10).join("', '");
        throw new ApiError(`Validation Failed: The following Section names (with unicodes) do not exist in the system: '${errorList}'`, 400);
    }

    const conn = await poolPromise;
    const transaction = new mssql.Transaction(conn);
    let totalInsertedRows = 0;

    try {
        await transaction.begin();

        console.log(`[UPLOAD v3] Starting bulk transaction for ${rowsToProcess.length} rows`);
        const yearsToUpdate = [...new Set(rowsToProcess.map(r => r.year))];

        console.log(`[UPLOAD v3] Fetching existing records for years: ${yearsToUpdate.join(',')}`);
        const [existingReqs] = await executeSql(`SELECT id, sectionCode, lineCode, monthName, year FROM requirements WITH (NOLOCK) WHERE year IN (${yearsToUpdate.join(',')})`, [], transaction);

        console.log(`[UPLOAD v3] Found ${existingReqs.length} existing records in DB`);
        // Key includes srNo to allow multiple entries with the same Unicode/Section but different Serial Numbers
        const makeKey = (r) => `${r.srNo}|${r.sectionCode || ''}|${r.lineCode || ''}|${r.monthName || ''}|${r.year || ''}`;

        const existingMap = new Map();
        existingReqs.forEach(r => {
            existingMap.set(makeKey(r), r.id);
        });

        // Separate into batches
        const rowsToInsert = [];
        const rowsToUpdate = [];

        rowsToProcess.forEach(r => {
            const key = makeKey(r);
            const existingId = existingMap.get(key);
            if (existingId) {
                r.id = existingId;
                rowsToUpdate.push(r);
            } else {
                rowsToInsert.push(r);
            }
        });

        console.log(`[UPLOAD v3] Separation complete. Inserts: ${rowsToInsert.length}, Updates: ${rowsToUpdate.length}`);
        const chunkSize = 50;

        // Perform INSERTS
        console.log(`[UPLOAD v3] Executing INSERTS in chunks of ${chunkSize}...`);
        for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
            const chunk = rowsToInsert.slice(i, i + chunkSize);
            let paramsArray = [];
            chunk.forEach(row => {
                paramsArray.push(
                    row.srNo, row.sectionCode, row.sectionName,
                    row.lineCode, row.lineDescription, row.monthName,
                    row.monthNumber, row.salesPlan, row.prodPlan, row.year
                );
            });
            const placeholders = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(', ');
            const insertQuery = `
                INSERT INTO requirements 
                (srNo, sectionCode, sectionName, lineCode, lineDescription, monthName, monthNumber, salesPlan, prodPlan, year)
                VALUES ${placeholders}
            `;
            const [, meta] = await executeSql(insertQuery, paramsArray, transaction);
            totalInsertedRows += (meta?.affectedRows || chunk.length);
        }

        console.log(`[UPLOAD v3] INSERTS finished. Executing UPDATES continuously (1-by-1 to avoid compilation limits)...`);

        // Perform UPDATES (Sequentially to avoid SQL statement compilation timeouts)
        let updateCount = 0;
        for (const row of rowsToUpdate) {
            const updateQuery = `UPDATE requirements SET srNo=?, sectionCode=?, sectionName=?, lineCode=?, lineDescription=?, monthNumber=?, salesPlan=?, prodPlan=? WHERE id=?`;
            const paramsArray = [row.srNo, row.sectionCode, row.sectionName, row.lineCode, row.lineDescription, row.monthNumber, row.salesPlan, row.prodPlan, row.id];

            await executeSql(updateQuery, paramsArray, transaction);
            updateCount++;

            // Print progress cleanly
            if (updateCount % 100 === 0) console.log(`[UPLOAD v3] ...Updated ${updateCount} rows`);
        }
        totalInsertedRows += updateCount;
        console.log(`[UPLOAD v3] All UPDATES finished. Committing transaction...`);

        await transaction.commit();
        console.log(`[UPLOAD v3] Transaction successfully committed.`);

        try {
            await Audit.create({
                user: req.user?._id || req.user?.id,
                action: "UPLOAD_REQUIREMENTS_V2",
                resourceType: "Requirement",
                details: {
                    count: totalInsertedRows,
                    message: `Uploaded/Updated ${totalInsertedRows} requirements via Excel.`
                }
            });
        } catch (logErr) {
            console.error("Failed to log requirement upload:", logErr.message);
        }

        // ── Feature 1: Send section-specific emails after upload ──────────────
        try {
            // Group uploaded rows by sectionName
            const sectionDataMap = new Map();
            for (const r of rowsToProcess) {
                const secName = (r.sectionName || "").trim();
                if (!secName) continue;
                if (!sectionDataMap.has(secName)) {
                    sectionDataMap.set(secName, { rows: [], months: new Set(), salesCount: 0, prodCount: 0 });
                }
                const entry = sectionDataMap.get(secName);
                entry.rows.push(r);
                if (r.monthName) entry.months.add(r.monthName);
                if (r.salesPlan !== null && r.salesPlan !== undefined) entry.salesCount++;
                if (r.prodPlan !== null && r.prodPlan !== undefined) entry.prodCount++;
            }

            const uploadedByName = req.user?.fullName || req.user?.name || req.user?.username || "Admin";
            const uploadedByRole = req.user?.role || "Admin";
            const uploadedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

            for (const [secName, secData] of sectionDataMap.entries()) {
                // Find section heads for this section (match by name or uniCode)
                const [secHeads] = await executeSql(
                    `SELECT sh.email, sh.name
                     FROM section_heads sh
                     LEFT JOIN sections s ON sh.sectionId = s.id
                     WHERE s.name = ? OR s.uniCode = ?`,
                    [secName, secName]
                );

                if (!secHeads || secHeads.length === 0) {
                    console.log(`[UPLOAD-EMAIL] No section head found for section: ${secName}`);
                    continue;
                }

                const monthsList = Array.from(secData.months).sort().join(", ") || "N/A";
                const monthCount = secData.months.size;

                // Build months details table rows
                let monthRows = "";
                const monthOrder = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
                const sortedMonths = Array.from(secData.months).sort(
                    (a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)
                );
                sortedMonths.forEach(month => {
                    const monthRows_ = secData.rows.filter(r => r.monthName === month);
                    const totalSP = monthRows_.reduce((s, r) => s + (r.salesPlan || 0), 0);
                    const totalPP = monthRows_.reduce((s, r) => s + (r.prodPlan || 0), 0);
                    monthRows += `
                    <tr>
                      <td style="padding:8px 14px;border:1px solid #e2e8f0;font-weight:600;color:#1e293b;">${month}</td>
                      <td style="padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#2563eb;font-weight:600;">${totalSP}</td>
                      <td style="padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#16a34a;font-weight:600;">${totalPP}</td>
                    </tr>`;
                });

                const subject = `📊 Requirements Uploaded — ${secName} (${monthCount} Month${monthCount !== 1 ? 's' : ''})`;

                for (const head of secHeads) {
                    const recipientName = head.name || "Section Head";
                    const htmlMsg = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0"
    style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 36px;text-align:center;">
    <div style="font-size:40px;margin-bottom:10px;">📊</div>
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Requirements Upload Summary</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">New manpower requirements have been uploaded for your section</p>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:28px 36px 8px;">
    <p style="font-size:15px;color:#334155;margin:0 0 6px;">Dear <strong>${recipientName}</strong>,</p>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">
      New manpower requirements have been uploaded for your section <strong>${secName}</strong>.
      Please review the details below.
    </p>
  </td></tr>

  <!-- Summary Cards -->
  <tr><td style="padding:16px 36px;">
    <table width="100%" cellpadding="0" cellspacing="8">
      <tr>
        <td width="33%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#2563eb;">${monthCount}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:600;">MONTHS UPLOADED</div>
        </td>
        <td width="2%"></td>
        <td width="33%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#16a34a;">${secData.salesCount}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:600;">SALES PLAN ENTRIES</div>
        </td>
        <td width="2%"></td>
        <td width="30%" style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#d97706;">${secData.prodCount}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:600;">PROD PLAN ENTRIES</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Month Details Table -->
  <tr><td style="padding:0 36px 24px;">
    <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 10px;">Month-wise Requirement Summary:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
      <tr>
        <th style="padding:10px 14px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Month</th>
        <th style="padding:10px 14px;background:#1e3a5f;color:#fff;text-align:center;border:1px solid #1e3a5f;">Sales Plan</th>
        <th style="padding:10px 14px;background:#1e3a5f;color:#fff;text-align:center;border:1px solid #1e3a5f;">Production Plan</th>
      </tr>
      ${monthRows}
    </table>
  </td></tr>

  <!-- Uploaded By -->
  <tr><td style="padding:0 36px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#64748b;">📤 <strong>Uploaded By</strong></td>
        <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;">${uploadedByName} (${uploadedByRole})</td>
        <td style="padding:10px 14px;font-size:13px;color:#64748b;">🕒 <strong>Date / Time</strong></td>
        <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;">${uploadedAt}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 36px;text-align:center;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">Automated notification from <strong>Furukawa LMS</strong>. Please do not reply.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

                    await sendMail(head.email, subject, htmlMsg)
                        .then(() => console.log(`[UPLOAD-EMAIL] ✅ Sent to ${head.email} for section: ${secName}`))
                        .catch(e => console.error(`[UPLOAD-EMAIL] ❌ Failed for ${head.email}:`, e.message));
                }
            }
        } catch (emailErr) {
            console.error("[UPLOAD-EMAIL] Error sending upload summary emails:", emailErr.message);
        }
        // ── End upload email block ────────────────────────────────────────────

        res.status(201).json(new ApiResponse(201, {
            totalExcelMonthRows: rowsToProcess.length,
            insertedRows: totalInsertedRows
        }, "Requirements uploaded successfully."));

    } catch (err) {
        console.error("EXCEL UPLOAD FATAL ERROR V3:", err);
        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error("Rollback also failed:", rollbackErr);
        }
        throw new ApiError(`Database Error during upload: ${err.message}`, 500);
    }
});

export const getRequirements = asyncHandler(async (req, res) => {
    const { section, sub_section, startDate, endDate, search } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    let countSql = "SELECT COUNT(*) as total FROM requirements WHERE 1=1";
    let sql = "SELECT * FROM requirements WHERE 1=1";
    const params = [];

    if (section && section.toLowerCase() !== 'all') {
        const isNumeric = !isNaN(Number(section)) && String(section).trim() !== '';
        const cond = isNumeric ? " AND (section_name = ? OR section_id = ?)" : " AND section_name = ?";
        countSql += cond; sql += cond;
        if (isNumeric) params.push(section, section);
        else params.push(section);
    }
    // Mapping sub_section to description_line
    if (sub_section && sub_section.toLowerCase() !== 'all') {
        const cond = " AND (description_line = ?)";
        countSql += cond; sql += cond;
        params.push(sub_section);
    }

    if (search) {
        const searchPattern = `%${search}%`;
        const searchCondition = " AND (section_name LIKE ? OR description_line LIKE ? OR month_name LIKE ?)";
        countSql += searchCondition; sql += searchCondition;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    if (startDate || endDate) {
        const dateConstruction = "TRY_CAST('01 ' + SUBSTRING(month_name, 1, 3) + ' ' + CAST(year_val AS VARCHAR) AS DATE)";

        if (startDate) {
            countSql += ` AND ${dateConstruction} >= ?`;
            sql += ` AND ${dateConstruction} >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            countSql += ` AND ${dateConstruction} <= ?`;
            sql += ` AND ${dateConstruction} <= ?`;
            params.push(endDate);
        }
    }

    const [countResult] = await executeSql(countSql, params);
    const totalItems = countResult[0].total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    sql += " ORDER BY id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
    const mainParams = [...params, offset, limit];

    const [results] = await executeSql(sql, mainParams);

    // Map new db column names back to what the frontend expects
    const data = results.map(row => ({
        ...row,
        count: row.sales_plan,
        section: row.section_name,
        sub_section: row.description_line,
        line_area: "N/A"
    }));

    const totalManpower = results.reduce((sum, row) => sum + (parseFloat(row.sales_plan || 0)), 0);

    res.status(200).json(
        new ApiResponse(200, {
            pagination: { totalItems, totalPages, currentPage: page, limit },
            totalManpower,
            filtersApplied: { section: section || "All", line: sub_section || "All", dateMode: (startDate || endDate) ? "Range" : "Current Month" },
            data
        }, "Requirements fetched successfully")
    );
});

export const getRequirementLogs = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const filters = {};
    if (id && id !== 'logs') {
        filters.requirement_id = id;
    }

    const rows = await RequirementLog.getLogs(filters, { limit, offset });

    const monthToNum = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };

    const buildSixMonthWindow = () => {
        const now = new Date();
        const items = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            items.push({ month: d.getMonth() + 1, year: d.getFullYear() });
        }
        return items;
    };

    const sixMonthWindow = buildSixMonthWindow();
    const minYear = Math.min(...sixMonthWindow.map(x => x.year));
    const maxYear = Math.max(...sixMonthWindow.map(x => x.year));

    const logs = rows.map(row => ({
        ...row,
        created_at: row.created_at || row.updated_at || row.update_at, // Map varied timestamp names
        section_name: row.section_name || "N/A",
        subsection_name: row.subsection_name || "N/A",
        six_month_counts: null
    }));

    for (const log of logs) {
        if (log.six_month_counts) continue;

        const oldVals = log.old_values || {};
        const newVals = log.new_values || {};
        const mentorChanged = oldVals.mentor !== undefined && newVals.mentor !== undefined && oldVals.mentor !== newVals.mentor;
        const supervisorChanged = oldVals.supervisorName !== undefined && newVals.supervisorName !== undefined && oldVals.supervisorName !== newVals.supervisorName;

        if (!mentorChanged && !supervisorChanged) continue;

        const reqId = log.requirement_id ? String(log.requirement_id) : null;
        if (!reqId) continue;

        const [reqRows] = await executeSql("SELECT * FROM requirements WHERE id = ?", [reqId]);
        if (!reqRows || reqRows.length === 0) continue;
        const reqRow = reqRows[0];

        const sectionId = reqRow.sectionId ?? null;
        const subSectionId = reqRow.subSectionId ?? null;
        const lineId = reqRow.lineId ?? null;
        const stationNo = reqRow.stationNo ?? null;

        const [reqs] = await executeSql(
            `SELECT month, year, salesPlan as count FROM requirements
             WHERE sectionId = ?
               AND subSectionId = ?
               AND ((? IS NULL AND lineId IS NULL) OR lineId = ?)
               AND ((? IS NULL AND (stationNo IS NULL OR stationNo = '')) OR stationNo = ?)
               AND year BETWEEN ? AND ?`,
            [sectionId, subSectionId, lineId, lineId, stationNo, stationNo, minYear, maxYear]
        );

        const countsByKey = {};
        for (const r of reqs || []) {
            const mRaw = String(r.month || "").trim().toLowerCase();
            const mNum = monthToNum[mRaw] || null;
            if (!mNum || !r.year) continue;
            const key = `${r.year}-${mNum}`;
            countsByKey[key] = (countsByKey[key] || 0) + (parseFloat(r.count) || 0);
        }

        const sixMonthCounts = sixMonthWindow.map(({ month, year }) => {
            const key = `${year}-${month}`;
            return { month, year, count: countsByKey[key] || 0 };
        });

        log.six_month_counts = sixMonthCounts;
    }

    res.status(200).json(new ApiResponse(200, logs, "Requirement logs fetched successfully"));
});

export const getRequirementFilters = asyncHandler(async (req, res) => {
    const [sections] = await executeSql("SELECT DISTINCT section_name as section FROM requirements WHERE section_name IS NOT NULL AND section_name != '' ORDER BY section_name");
    const [subSections] = await executeSql("SELECT DISTINCT description_line as sub_section FROM requirements WHERE description_line IS NOT NULL AND description_line != '' ORDER BY description_line");

    res.status(200).json(new ApiResponse(200, {
        sections: sections.map(s => s.section),
        subSections: subSections.map(s => s.sub_section)
    }, "Filters fetched successfully"));
});

export const getRequirementById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [result] = await executeSql("SELECT * FROM requirements WHERE id = ?", [id]);

    if (result.length === 0) throw new ApiError("Requirement not found", 404);

    const reqData = result[0];
    reqData.section = reqData.section_name;
    reqData.sub_section = reqData.description_line;
    reqData.line_area = "N/A";
    reqData.count = reqData.sales_plan;

    res.status(200).json(new ApiResponse(200, reqData, "Requirement fetched successfully"));
});

export const updateRequirement = asyncHandler(async (req, res) => {

    // ══════════════════════════════════════════════════════════════
    //  BLOCK 1 — Approve / Reject action handler
    //  Triggered when email button link is clicked
    //  GET  /api/requirements/:id?token=xxx&action=approve
    //  GET  /api/requirements/:id?token=xxx&action=reject_page
    //  POST /api/requirements/:id  { token, action:"reject", reason }
    // ══════════════════════════════════════════════════════════════
    const { token, action, reason } = { ...req.query, ...req.body };

    if (token && action) {

        // ── Helper: simple HTML result page ──────────────────────
        const renderPage = (title, message) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;display:flex;
       align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
  .card{background:#fff;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.10);
        padding:40px 36px;text-align:center;max-width:440px;width:100%;}
  h2{color:#1e293b;margin:0 0 12px;font-size:22px;}
  p{color:#475569;font-size:15px;line-height:1.6;margin:0;}
  .icon{font-size:52px;margin-bottom:16px;}
</style></head>
<body><div class="card">
  <div class="icon">ℹ️</div>
  <h2>${title}</h2><p>${message}</p>
</div></body></html>`;

        // Token DB se fetch karo
        const tokenDoc = await RequirementToken.findOne({ token });

        if (!tokenDoc)
            return res.status(400).send(renderPage("❌ Invalid Link", "This link is invalid or has already been used."));

        if (new Date() > new Date(tokenDoc.expires_at))
            return res.status(400).send(renderPage("⏰ Link Expired", "This approval link has expired (valid for 24 hours only)."));

        if (tokenDoc.status !== "pending")
            return res.status(400).send(renderPage(
                "ℹ️ Already Processed",
                `This requirement was already <strong>${tokenDoc.status}</strong>. No further action needed.`
            ));

        // ── APPROVE ──────────────────────────────────────────────
        if (action === "approve") {
            await RequirementToken.update({ status: "approved" }, { where: { token } });
            await executeSql("UPDATE requirements SET approval_status = ? WHERE id = ?", ["approved", tokenDoc.requirement_id]);

            if (tokenDoc.sender_email) {
                const subject = `✅ Requirement Approved — ID #${tokenDoc.requirement_id}`;
                const html = `
<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;margin:0;padding:32px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#166534,#16a34a);padding:28px 32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">✅ Requirement Approved</h1>
  </td></tr>
  <tr><td style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.7;">
    <p>Requirement <strong>#${tokenDoc.requirement_id}</strong> has been
       <strong style="color:#166534;">approved</strong> by the department head.</p>
    <p style="color:#64748b;font-size:13px;">
      Approved on: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">Automated notification — Furukawa LMS</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
                await sendMail(tokenDoc.sender_email, subject, html)
                    .catch(e => console.error("Approve mail error:", e.message));
            }

            return res.send(renderPage(
                "✅ Approved!",
                "You have successfully <strong style='color:#166534;'>approved</strong> this requirement. The requester has been notified."
            ));
        }

        // ── REJECT PAGE — reason input form dikhao ────────────────
        if (action === "reject_page") {
            const { id } = req.params;
            return res.send(`
<!DOCTYPE html><html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Reject Requirement</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;display:flex;
       align-items:center;justify-content:center;min-height:100vh;padding:20px;}
  .card{background:#fff;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.10);
        width:100%;max-width:520px;overflow:hidden;}
  .header{background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:28px 32px;text-align:center;color:#fff;}
  .header h1{font-size:22px;font-weight:700;}
  .header p{font-size:14px;opacity:.85;margin-top:6px;}
  .body{padding:28px 32px;}
  .body p{font-size:14px;color:#475569;line-height:1.6;margin-bottom:18px;}
  textarea{width:100%;min-height:120px;border:1.5px solid #e2e8f0;border-radius:8px;
           padding:12px;font-size:14px;color:#1e293b;resize:vertical;outline:none;transition:border .2s;}
  textarea:focus{border-color:#dc2626;}
  .char-count{font-size:12px;color:#94a3b8;text-align:right;margin-top:4px;}
  .error{color:#dc2626;font-size:13px;margin-top:8px;display:none;}
  button{width:100%;margin-top:18px;padding:13px;background:#dc2626;color:#fff;border:none;
         border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:background .2s;}
  button:hover{background:#b91c1c;}
  button:disabled{background:#fca5a5;cursor:not-allowed;}
  .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;
          text-align:center;font-size:12px;color:#94a3b8;}
</style></head>
<body>
<div class="card">
  <div class="header">
    <h1>❌ Reject Requirement</h1>
    <p>Requirement #${tokenDoc.requirement_id} — Please provide a reason</p>
  </div>
  <div class="body">
    <p>You are about to <strong>reject</strong> this manpower requirement update.
       Please describe your reason clearly so the requester can make corrections.</p>
    <textarea id="reasonBox" placeholder="Enter your rejection reason here..."
              maxlength="500" oninput="updateCount()"></textarea>
    <div class="char-count"><span id="cnt">0</span> / 500</div>
    <div class="error" id="errMsg">⚠️ Please enter a reason before submitting.</div>
    <button id="submitBtn" onclick="submitReject()">Submit Rejection</button>
  </div>
  <div class="footer">Furukawa LMS — Automated Action Page</div>
</div>
<script>
  function updateCount(){
    document.getElementById('cnt').textContent = document.getElementById('reasonBox').value.length;
  }
  async function submitReject(){
    const reason = document.getElementById('reasonBox').value.trim();
    if(!reason){ document.getElementById('errMsg').style.display='block'; return; }
    document.getElementById('errMsg').style.display='none';
    const btn = document.getElementById('submitBtn');
    btn.disabled=true; btn.textContent='Submitting...';
    try{
      const resp = await fetch('/api/requirements/${id}', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ token:'${token}', action:'reject', reason })
      });
      const data = await resp.json();
      if(resp.ok){
        document.querySelector('.card').innerHTML=\`
          <div style="padding:40px 32px;text-align:center;">
            <div style="font-size:52px;margin-bottom:16px;">✅</div>
            <h2 style="color:#166534;margin-bottom:8px;">Rejection Submitted</h2>
            <p style="color:#475569;font-size:14px;">Your reason has been sent to the requester.</p>
          </div>\`;
      } else {
        btn.disabled=false; btn.textContent='Submit Rejection';
        alert(data.message || 'Something went wrong. Please try again.');
      }
    } catch(e){
      btn.disabled=false; btn.textContent='Submit Rejection';
      alert('Network error. Please try again.');
    }
  }
</script>
</body></html>`);
        }

        // ── REJECT submit (POST) ──────────────────────────────────
        if (action === "reject") {
            if (!reason || !reason.trim())
                return res.status(400).json({ message: "Rejection reason is required." });

            await RequirementToken.update(
                { status: "rejected", rejection_reason: reason.trim() },
                { where: { token } }
            );
            await executeSql("UPDATE requirements SET approval_status = ? WHERE id = ?", ["rejected", tokenDoc.requirement_id]);

            if (tokenDoc.sender_email) {
                const subject = `❌ Requirement Rejected — ID #${tokenDoc.requirement_id}`;
                const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0"
      style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr><td style="background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:32px 36px;text-align:center;">
      <div style="width:56px;height:56px;background:rgba(255,255,255,.15);border-radius:50%;
                  display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <span style="font-size:28px;">❌</span>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Requirement Rejected</h1>
      <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">
        Department Head has rejected the requirement update
      </p>
    </td></tr>
    <tr><td style="padding:28px 36px;">
      <p style="font-size:15px;color:#334155;margin:0 0 16px;">
        Your manpower requirement update for <strong>#${tokenDoc.requirement_id}</strong> has been
        <strong style="color:#dc2626;">rejected</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:8px;margin-bottom:20px;">
        <tr><td style="padding:16px 18px;">
          <p style="font-size:13px;font-weight:700;color:#991b1b;margin:0 0 8px;">📝 Reason for Rejection:</p>
          <p style="font-size:14px;color:#1e293b;margin:0;line-height:1.6;">${reason.trim()}</p>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#64748b;line-height:1.6;">
        Please review the feedback above and make necessary corrections before resubmitting.
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:12px;">
        Rejected on: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
      </p>
    </td></tr>
    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        Automated notification — <strong>Furukawa LMS</strong>. Do not reply.
      </p>
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>`;
                await sendMail(tokenDoc.sender_email, subject, html)
                    .catch(e => console.error("Reject mail error:", e.message));
            }

            return res.status(200).json({ message: "Rejection submitted successfully." });
        }

        return res.status(400).send(renderPage("❌ Unknown Action", "Invalid action parameter."));
    }

    // ══════════════════════════════════════════════════════════════
    //  BLOCK 2 — Normal requirement update flow (PUT request)
    // ══════════════════════════════════════════════════════════════
    const { id } = req.params;
    if (!id) throw new ApiError("Requirement ID is required", 400);

    const [existingRows] = await executeSql("SELECT * FROM requirements WHERE id = ?", [id]);
    if (existingRows.length === 0) throw new ApiError("Requirement not found", 404);
    const currentReq = existingRows[0];

    const isDifferent = (oldVal, newVal) => oldVal != newVal;
    const { section, sub_section, supervisorName, mentor, line_area, stationNo, month, year, salesPlan, prodPlan, count } = req.body;

    let fieldsToUpdate = [];
    let values = [];

    if (section !== undefined) {
        const sid = await getId('departments', section);
        if (isDifferent(currentReq.sectionName, section) || isDifferent(currentReq.sectionId, sid)) {
            fieldsToUpdate.push("sectionName = ?", "sectionId = ?");
            values.push(section, sid);
        }
    }
    if (sub_section !== undefined) {
        const ssid = await getId('lines', sub_section);
        if (isDifferent(currentReq.subSectionName, sub_section) || isDifferent(currentReq.subSectionId, ssid)) {
            fieldsToUpdate.push("subSectionName = ?", "subSectionId = ?");
            values.push(sub_section, ssid);
        }
    }
    if (line_area !== undefined) {
        const lid = await getId('machines', line_area);
        if (isDifferent(currentReq.lineArea, line_area) || isDifferent(currentReq.lineId, lid)) {
            fieldsToUpdate.push("lineArea = ?", "lineId = ?");
            values.push(line_area, lid);
        }
    }
    if (supervisorName !== undefined && isDifferent(currentReq.supervisorName, supervisorName)) { fieldsToUpdate.push("supervisorName = ?"); values.push(supervisorName); }
    if (mentor !== undefined && isDifferent(currentReq.mentor, mentor)) { fieldsToUpdate.push("mentor = ?"); values.push(mentor); }
    if (stationNo !== undefined && isDifferent(currentReq.stationNo, stationNo)) { fieldsToUpdate.push("stationNo = ?"); values.push(stationNo); }
    if (month !== undefined && isDifferent(currentReq.month, month)) { fieldsToUpdate.push("month = ?"); values.push(month); }
    if (year !== undefined && isDifferent(currentReq.year, year)) { fieldsToUpdate.push("year = ?"); values.push(year); }

    let newSalesPlan = salesPlan !== undefined ? salesPlan : count;
    if (newSalesPlan !== undefined && isDifferent(currentReq.salesPlan, newSalesPlan)) {
        fieldsToUpdate.push("salesPlan = ?"); values.push(newSalesPlan);
    }
    let newProdPlan = prodPlan !== undefined ? prodPlan : count;
    if (newProdPlan !== undefined && isDifferent(currentReq.prodPlan, newProdPlan)) {
        fieldsToUpdate.push("prodPlan = ?"); values.push(newProdPlan);
    }

    if (fieldsToUpdate.length === 0) {
        currentReq.section = currentReq.sectionName;
        currentReq.sub_section = currentReq.subSectionName;
        currentReq.line_area = currentReq.lineArea;
        currentReq.count = currentReq.salesPlan;
        return res.status(200).json(new ApiResponse(200, currentReq, "Requirement is already up to date"));
    }

    values.push(id);
    await executeSql(`UPDATE requirements SET ${fieldsToUpdate.join(", ")} WHERE id = ?`, values);

    const [updatedRows] = await executeSql("SELECT * FROM requirements WHERE id = ?", [id]);
    const updatedReq = updatedRows[0];

    updatedReq.supervisorName = supervisorName !== undefined ? supervisorName : updatedReq.supervisorName;
    updatedReq.mentor = mentor !== undefined ? mentor : updatedReq.mentor;
    updatedReq.lineArea = line_area !== undefined ? line_area : updatedReq.lineArea;
    updatedReq.stationNo = stationNo !== undefined ? stationNo : updatedReq.stationNo;

    try {
        await RequirementLog.create({
            requirement_id: id,
            section_id: currentReq.sectionId,
            old_values: currentReq,
            new_values: updatedReq,
            employee_id: req.user?._id || req.user?.id || null,
            employee_role: req.user?.role || "Admin",
            updated_by_name: req.user?.fullName || req.user?.name || req.user?.username || null
        });
    } catch (logErr) {
        console.error("Failed to log requirement update:", logErr.message);
    }

    updatedReq.section = updatedReq.sectionName;
    updatedReq.sub_section = updatedReq.subSectionName;
    updatedReq.line_area = updatedReq.lineArea;
    updatedReq.count = updatedReq.salesPlan;

    // ── Email Notification with Approve / Reject buttons ─────────
    try {
        console.log(`[EMAIL-DEBUG] Looking up recipients using database Unicodes...`);

        const headsQuery = `
            SELECT sh.email, sh.name 
            FROM section_heads sh
            LEFT JOIN sections s ON sh.sectionId = s.id
            WHERE s.uniCode = ? OR s.name = ?
        `;

        let heads = [];
        const [exactMatchHeads] = await executeSql(
            headsQuery,
            [currentReq.lineCode, currentReq.sectionName]
        );

        if (exactMatchHeads && exactMatchHeads.length > 0) {
            heads = exactMatchHeads;
        }

        if (!heads || heads.length === 0) {
            const [allHeads] = await executeSql("SELECT email, name FROM section_heads");
            console.log(`[EMAIL-DEBUG] No specific recipient found. Total global section_heads: ${allHeads.length}`);
        }

        if (heads && heads.length > 0) {
            const normalizeVal = (v) => (v === null || v === undefined || v === "") ? null : String(v).trim();
            const diffKeys = [
                { key: "supervisorName", label: "Supervisor Name" },
                { key: "mentor", label: "Mentor" },
                { key: "lineArea", label: "Line / Area" },
                { key: "stationNo", label: "Station No" },
                { key: "salesPlan", label: "Sales Plan" },
                { key: "prodPlan", label: "Production Plan" },
            ];

            let changesRows = "";
            diffKeys.forEach(({ key, label }) => {
                const oldV = normalizeVal(currentReq[key]);
                const newV = normalizeVal(updatedReq[key]);
                if (oldV !== newV) {
                    changesRows += `
                    <tr>
                      <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">${label}</td>
                      <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#991b1b;">${oldV ?? "—"}</td>
                      <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#166534;">${newV ?? "—"}</td>
                    </tr>`;
                }
            });

            if (changesRows) {
                const BASE_URL = process.env.APP_BASE_URL || "http://localhost:5000";
                const updatedByName = req.user?.name || "Admin";
                const updatedByRole = req.user?.role || "ADMIN";
                const senderEmail = req.user?.email || null;

                const emailResults = await Promise.allSettled(
                    heads.map(async (h) => {
                        // Secure one-time token banao
                        const tkn = crypto.randomBytes(32).toString("hex");
                        await RequirementToken.create({
                            token: tkn,
                            requirement_id: id,
                            recipient_email: h.email,
                            sender_email: senderEmail,
                            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                            status: "pending"
                        });

                        const approveUrl = `${BASE_URL}/api/requirements/${id}?token=${tkn}&action=approve`;
                        const rejectPageUrl = `${BASE_URL}/api/requirements/${id}?token=${tkn}&action=reject_page`;
                        const recipientName = h.name || "Manager";
                        const subject = `Requirement Action Required — ${updatedReq.sectionName} / ${updatedReq.subSectionName}`;

                        const htmlMsg = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
    style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 36px;text-align:center;">
    <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;
                display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
      <span style="font-size:28px;">📋</span>
    </div>
    <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Requirement Action Required</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Manpower Requirement Update Notification</p>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:28px 36px 0;">
    <p style="font-size:15px;color:#334155;margin:0 0 8px;">Dear <strong>${recipientName}</strong>,</p>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">
      The administration has modified the manpower requirements for your department.
      Please review the updates below and take action.
    </p>
  </td></tr>

  <!-- Info Cards -->
  <tr><td style="padding:20px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#64748b;">📂 <strong>Section</strong></td>
        <td style="padding:6px 12px;font-size:13px;color:#1e293b;font-weight:600;">${updatedReq.sectionName}</td>
        <td style="padding:6px 12px;font-size:13px;color:#64748b;">🏭 <strong>Sub-section</strong></td>
        <td style="padding:6px 12px;font-size:13px;color:#1e293b;font-weight:600;">${updatedReq.subSectionName}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#64748b;">📅 <strong>Month / Year</strong></td>
        <td style="padding:6px 12px;font-size:13px;color:#1e293b;font-weight:600;">${updatedReq.month} ${updatedReq.year}</td>
        <td style="padding:6px 12px;font-size:13px;color:#64748b;">👤 <strong>Updated By</strong></td>
        <td style="padding:6px 12px;font-size:13px;color:#1e293b;font-weight:600;">${updatedByName} (${updatedByRole})</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#64748b;">🕒 <strong>Date / Time</strong></td>
        <td colspan="3" style="padding:6px 12px;font-size:13px;color:#1e293b;font-weight:600;">
          ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Changes Table -->
  <tr><td style="padding:0 36px 24px;">
    <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 10px;">Changed Fields:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
      <tr>
        <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Field</th>
        <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Previous Value</th>
        <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">New Value</th>
      </tr>
      ${changesRows}
    </table>
  </td></tr>

  <!-- Approve / Reject Buttons -->
  <tr><td style="padding:0 36px 32px;">
    <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 14px;">Your Action:</p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="48%" align="center">
        <a href="${approveUrl}"
          style="display:inline-block;width:100%;padding:14px 0;
                 background:linear-gradient(135deg,#166534,#16a34a);color:#fff;
                 text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;
                 text-align:center;box-shadow:0 2px 8px rgba(22,101,52,0.3);">
          ✅ Approve
        </a>
      </td>
      <td width="4%"></td>
      <td width="48%" align="center">
        <a href="${rejectPageUrl}"
          style="display:inline-block;width:100%;padding:14px 0;
                 background:linear-gradient(135deg,#7f1d1d,#dc2626);color:#fff;
                 text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;
                 text-align:center;box-shadow:0 2px 8px rgba(220,38,38,0.3);">
          ❌ Reject
        </a>
      </td>
    </tr></table>
    <p style="font-size:12px;color:#94a3b8;margin:12px 0 0;text-align:center;">
      These links are valid for <strong>24 hours</strong> and can only be used once.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">
      Automated notification from <strong>Furukawa LMS</strong>. Please do not reply.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

                        return sendMail(h.email, subject, htmlMsg);
                    })
                );

                emailResults.forEach((result, i) => {
                    if (result.status === "fulfilled")
                        console.log(`[EMAIL-DEBUG] ✅ Sent to ${heads[i].email}`);
                    else
                        console.error(`[EMAIL-DEBUG] ❌ Failed ${heads[i].email}:`, result.reason?.message);
                });
            } else {
                console.log("[EMAIL-DEBUG] No changed fields — email skipped.");
            }
        }
    } catch (mailErr) {
        console.error("[EMAIL-DEBUG] Outer catch:", mailErr.message, mailErr.stack);
    }

    res.status(200).json(new ApiResponse(200, updatedReq, "Requirement updated successfully"));
});


// ══════════════════════════════════════════════════════════════
//  ROUTE SETUP  — router file mein ye 3 lines add karo
// ══════════════════════════════════════════════════════════════
//
//  import crypto from "crypto";
//  import { updateRequirement } from "../controllers/requirementController.js";
//
//  router.get( "/:id", updateRequirement);   // approve / reject_page (no JWT needed)
//  router.post("/:id", updateRequirement);   // reject form submit    (no JWT needed)
//  router.put( "/:id", verifyJWT, updateRequirement);  // normal update
//
// ══════════════════════════════════════════════════════════════
//  RequirementToken MODEL
// ══════════════════════════════════════════════════════════════
//
//  Mongoose:
//  const schema = new mongoose.Schema({
//    token:            { type: String, required: true, unique: true },
//    requirement_id:   { type: String, required: true },
//    recipient_email:  { type: String, required: true },
//    sender_email:     { type: String },
//    expires_at:       { type: Date,   required: true },
//    status:           { type: String, enum: ["pending","approved","rejected"], default: "pending" },
//    rejection_reason: { type: String },
//  }, { timestamps: true });
//  export const RequirementToken = mongoose.model("RequirementToken", schema);
//
//  SQL migration:
//  CREATE TABLE requirement_tokens (
//    token            VARCHAR(64)  PRIMARY KEY,
//    requirement_id   INT          NOT NULL,
//    recipient_email  VARCHAR(255) NOT NULL,
//    sender_email     VARCHAR(255),
//    expires_at       DATETIME     NOT NULL,
//    status           ENUM('pending','approved','rejected') DEFAULT 'pending',
//    rejection_reason TEXT,
//    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
//  );
//  ALTER TABLE requirements
//    ADD COLUMN approval_status ENUM('pending','approved','rejected') DEFAULT 'pending';
//
//  .env:
//  APP_BASE_URL=https://your-domain.com


export const batchUpdateRequirements = asyncHandler(async (req, res) => {
    const { ids, updates } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError("ids array is required", 400);
    if (!updates || typeof updates !== "object") throw new ApiError("updates object is required", 400);

    const updatedIds = [];
    // Track which section+subsection pairs we've already emailed (avoid duplicate emails)
    const emailedPairs = new Set();
    // Collect context for ONE email per unique section+subsection
    const emailContextMap = new Map(); // key: "sectionId|subSectionId" => { sectionId, subSectionId, currentReq, updatedReq }

    for (const id of ids) {
        const [existingRows] = await executeSql("SELECT * FROM requirements WHERE id = ?", [id]);
        if (existingRows.length === 0) continue;
        const currentReq = existingRows[0];

        const fieldsToUpdate = [];
        const values = [];

        const isDifferent = (oldVal, newVal) => oldVal != newVal;

        if ("supervisorName" in updates) {
            const newVal = updates.supervisorName ?? null;
            if (isDifferent(currentReq.supervisorName, newVal)) {
                fieldsToUpdate.push("supervisorName = ?");
                values.push(newVal);
            }
        }
        if ("mentor" in updates) {
            const newVal = updates.mentor ?? null;
            if (isDifferent(currentReq.mentor, newVal)) {
                fieldsToUpdate.push("mentor = ?");
                values.push(newVal);
            }
        }
        if ("lineArea" in updates || "lineName" in updates) {
            const lineArea = updates.lineArea ?? updates.lineName ?? null;
            let lineId = null;

            if (lineArea && currentReq.subSectionId) {
                const [rows] = await executeSql(
                    "SELECT id FROM machines WHERE name = ? AND subSectionId = ?",
                    [lineArea, currentReq.subSectionId]
                );
                if (rows.length > 0) lineId = rows[0].id;
            }

            if (isDifferent(currentReq.lineArea, lineArea) || isDifferent(currentReq.lineId, lineId)) {
                fieldsToUpdate.push("lineId = ?", "lineArea = ?");
                values.push(lineId, lineArea);
            }
        }

        // Build the updatedReq snapshot for email (use updates values directly)
        const updatedReqForEmail = { ...currentReq };
        if ("supervisorName" in updates) updatedReqForEmail.supervisorName = updates.supervisorName ?? null;
        if ("mentor" in updates) updatedReqForEmail.mentor = updates.mentor ?? null;
        if ("lineArea" in updates || "lineName" in updates) {
            updatedReqForEmail.lineArea = updates.lineArea ?? updates.lineName ?? null;
        }

        // Register for email (collect unique section+subsection context regardless of db change)
        const pairKey = `${currentReq.sectionId}|${currentReq.subSectionId}`;
        if (!emailContextMap.has(pairKey)) {
            emailContextMap.set(pairKey, { currentReq, updatedReq: updatedReqForEmail });
        }

        if (fieldsToUpdate.length === 0) continue;

        values.push(id);
        const sql = `UPDATE requirements SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
        await executeSql(sql, values);

        const [updatedRows] = await executeSql("SELECT * FROM requirements WHERE id = ?", [id]);
        const updatedReq = updatedRows[0];

        if ("supervisorName" in updates) updatedReq.supervisorName = updates.supervisorName !== undefined ? updates.supervisorName : updatedReq.supervisorName;
        if ("mentor" in updates) updatedReq.mentor = updates.mentor !== undefined ? updates.mentor : updatedReq.mentor;
        if ("lineArea" in updates || "lineName" in updates) {
            updatedReq.lineArea = updates.lineArea !== undefined ? updates.lineArea : (updates.lineName !== undefined ? updates.lineName : updatedReq.lineArea);
        }

        try {
            await RequirementLog.create({
                requirement_id: id,
                section_id: currentReq.sectionId,
                old_values: currentReq,
                new_values: updatedReq,
                employee_id: req.user?._id || req.user?.id || null,
                employee_role: req.user?.role || "Admin",
                updated_by_name: req.user?.fullName || req.user?.name || req.user?.username || null
            });
        } catch (logErr) {
            console.error("Failed to log requirement batch update:", logErr.message);
        }

        updatedIds.push(id);
    }

    // ── Send ONE email per unique section+subsection ──
    for (const [pairKey, { currentReq, updatedReq }] of emailContextMap.entries()) {
        if (emailedPairs.has(pairKey)) continue;
        emailedPairs.add(pairKey);

        try {
            console.log(`[BATCH-EMAIL-DEBUG] Looking up recipients using database Unicodes...`);

            const headsQuery = `
                SELECT sh.email, sh.name 
                FROM section_heads sh
                LEFT JOIN sections s ON sh.sectionId = s.id
                WHERE s.uniCode = ? OR s.name = ?
            `;

            let heads = [];
            const [exactMatchHeads] = await executeSql(
                headsQuery,
                [currentReq.lineCode, currentReq.sectionName]
            );

            if (exactMatchHeads && exactMatchHeads.length > 0) {
                heads = exactMatchHeads;
            }

            if (!heads || heads.length === 0) {
                const [allHeads] = await executeSql("SELECT email, name FROM section_heads");
                console.log(`[BATCH-EMAIL-DEBUG] No specific recipient found. Total global section_heads: ${allHeads.length}`);
                continue;
            }

            console.log(`[BATCH-EMAIL-DEBUG] Recipients: ${heads.map(h => h.email).join(', ')}`);

            const normalizeVal = (v) => (v === null || v === undefined || v === "") ? null : String(v).trim();
            const diffKeys = [
                { key: "supervisorName", label: "Supervisor Name" },
                { key: "mentor", label: "Mentor" },
                { key: "lineArea", label: "Line / Area" },
                { key: "stationNo", label: "Station No" },
                { key: "salesPlan", label: "Sales Plan" },
                { key: "prodPlan", label: "Production Plan" },
            ];

            let changesRows = "";
            diffKeys.forEach(({ key, label }) => {
                const oldV = normalizeVal(currentReq[key]);
                const newV = normalizeVal(updatedReq[key]);
                console.log(`[BATCH-EMAIL-DEBUG] key=${key}: old='${oldV}' new='${newV}' changed=${oldV !== newV}`);
                if (oldV !== newV) {
                    changesRows += `<tr>
                        <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">${label}</td>
                        <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#991b1b;">${oldV ?? "—"}</td>
                        <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#166534;">${newV ?? "—"}</td>
                    </tr>`;
                }
            });

            if (!changesRows) {
                console.log(`[BATCH-EMAIL-DEBUG] No changed fields for pair ${pairKey} — skipping email.`);
                continue;
            }

            const recipientName = heads[0]?.name || "Manager";
            const subject = `Requirement Action Required — ${updatedReq.sectionName} / ${updatedReq.subSectionName}`;
            const htmlMsg = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 36px;text-align:center;">
  <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Requirement Action Required</h1>
  <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Manpower Requirement Update Notification</p>
</td></tr>
<tr><td style="padding:28px 36px 0;">
  <p style="font-size:15px;color:#334155;margin:0 0 8px;">Dear <strong>${recipientName}</strong>,</p>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">The administration has modified the manpower requirements for your department. Please review the updates below.</p>
</td></tr>
<tr><td style="padding:20px 36px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#64748b;">Section</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;">${updatedReq.sectionName}</td>
      <td style="padding:8px 12px;font-size:13px;color:#64748b;">Sub-section</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;">${updatedReq.subSectionName}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#64748b;">Updated By</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;">${req.user?.name || "Admin"} (${req.user?.role || "ADMIN"})</td>
      <td style="padding:8px 12px;font-size:13px;color:#64748b;">Date / Time</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:0 36px 24px;">
  <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 10px;">Changed Fields:</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
    <tr>
      <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Field</th>
      <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">Previous Value</th>
      <th style="padding:10px 12px;background:#1e3a5f;color:#fff;text-align:left;border:1px solid #1e3a5f;">New Value</th>
    </tr>
    ${changesRows}
  </table>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 36px;text-align:center;">
  <p style="font-size:12px;color:#94a3b8;margin:0;">Automated notification from <strong>Furukawa LMS</strong>. Do not reply.</p>
</td></tr>
</table></td></tr></table></body></html>`;

            console.log(`[BATCH-EMAIL-DEBUG] Sending to ${heads.length} recipient(s)...`);
            const results = await Promise.allSettled(heads.map(h => sendMail(h.email, subject, htmlMsg)));
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') console.log(`[BATCH-EMAIL-DEBUG] ✅ Sent to ${heads[i].email}`);
                else console.error(`[BATCH-EMAIL-DEBUG] ❌ Failed for ${heads[i].email}:`, r.reason?.message);
            });

        } catch (mailErr) {
            console.error(`[BATCH-EMAIL-DEBUG] Outer catch for pair ${pairKey}:`, mailErr.message);
        }
    }
    // ── End email block ──

    res.status(200).json(
        new ApiResponse(200, { updatedCount: updatedIds.length, updatedIds }, "Batch update successful")
    );
});

export const deleteRequirement = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await executeSql("DELETE FROM requirements WHERE id = ?", [id]);
    res.status(200).json(new ApiResponse(200, null, "Requirement deleted successfully"));
});