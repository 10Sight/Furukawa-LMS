import sendMail from "../../utils/mail.util.js";
import ENV from "../../configs/env.config.js";
import logger from "../../logger/winston.logger.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import LpaRecord from "../../models/lpa/lpaRecord.model.js";
import PDCAModel from "../../models/pdca/pdca.model.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map();
const ATTEMPT_TTL_MS = 10 * 60 * 1000;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

const parseAddresses = (value, field) => {
  const addresses = (Array.isArray(value) ? value : String(value || "").split(/[,;\s]+/))
    .map(address => String(address).trim())
    .filter(Boolean);
  if (!addresses.length && field === "To") throw new ApiError("Enter at least one recipient email address.", 400);
  if (addresses.some(address => !emailPattern.test(address))) {
    throw new ApiError(`One or more ${field} email addresses are invalid.`, 400);
  }
  const unique = new Map();
  for (const address of addresses) {
    const normalized = address.toLowerCase();
    if (!unique.has(normalized)) unique.set(normalized, address);
  }
  return [...unique.values()];
};

const hasSavedPdcaRows = sheet => sheet.rows.some(row => row && [
  row.date, row.shift, row.unit, row.department, row.section, row.lineArea, row.observation,
  row.rootCause, row.counterMeasure, row.stdDurationMin, row.responseDate, row.instruction,
  row.responsiblePersonDept, row.staffEmployee, row.cftTopic, row.responsiblePersonConfirmation,
  row.confirmation, row.imageBefore, row.imageAfter
].some(value => value !== undefined && value !== null && String(value).trim() !== ""));

const extractPdcaPoints = sheet => {
  if (!sheet || !Array.isArray(sheet.rows)) return [];
  const points = [];
  for (const row of sheet.rows) {
    if (!row) continue;
    const observation = String(row.observation || "").trim();
    if (observation) {
      points.push(observation);
    } else {
      const fallback = String(row.counterMeasure || row.rootCause || row.lineArea || "").trim();
      if (fallback) points.push(fallback);
    }
  }
  return points;
};

const extractPdcaSectionsAndPoints = (sheet, fallbackPoints = []) => {
  if (!sheet || !Array.isArray(sheet.rows)) {
    if (Array.isArray(fallbackPoints) && fallbackPoints.length > 0) {
      return [{ section: "", points: fallbackPoints.map(p => typeof p === "string" ? p : p.observation || p.text || String(p)) }];
    }
    return [];
  }
  const sectionMap = new Map();
  for (const row of sheet.rows) {
    if (!row) continue;
    const observation = String(row.observation || "").trim() || String(row.counterMeasure || row.rootCause || row.lineArea || "").trim();
    if (!observation) continue;
    const sectionName = String(row.section || row.lineArea || "").trim();
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, []);
    }
    sectionMap.get(sectionName).push(observation);
  }
  if (sectionMap.size === 0 && Array.isArray(fallbackPoints) && fallbackPoints.length > 0) {
    return [{ section: "", points: fallbackPoints.map(p => typeof p === "string" ? p : p.observation || p.text || String(p)) }];
  }
  return [...sectionMap.entries()].map(([section, points]) => ({ section, points }));
};

const calculateWorksheetScores = (sheet, record = null) => {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0) {
    return [{ label: "Level 3", percentage: "0%" }];
  }
  const isCc = String(record?.section || sheet.section || "").toLowerCase() === "cc";
  const startRow = isCc ? 4 : 3;
  const marksCol = isCc ? 6 : 4;
  const startAuditCol = isCc ? 7 : 5;
  const legendStart = sheet.merges?.find(merge => merge.s?.c === 0 && merge.e?.c <= 2 && merge.s?.r > 25)?.s?.r ?? -1;
  const endRow = legendStart > 0 ? Math.min(legendStart, 37) : (isCc ? 35 : 37);

  const headerRow = sheet.rows[isCc ? 2 : 1] || [];
  const colCount = Math.max(sheet.columnCount || 0, headerRow.length);
  const colPairs = [];
  for (let c = startAuditCol; c < colCount; c += 2) {
    const headerText = String(headerRow[c]?.value ?? headerRow[c]?.formatted ?? "").trim();
    let level = "L3";
    let shift = null;
    if (/l1/i.test(headerText) || /monthly/i.test(headerText) || /level\s*1/i.test(headerText)) level = "L1";
    else if (/l2/i.test(headerText) || /weekly/i.test(headerText) || /level\s*2/i.test(headerText)) level = "L2";
    else if (/l3/i.test(headerText) || /daily/i.test(headerText) || /level\s*3/i.test(headerText)) {
      level = "L3";
      const m = headerText.match(/shift\s*([ABC])/i);
      if (m) shift = m[1].toUpperCase();
    } else if (c === startAuditCol && record?.level) {
      level = record.level;
    }
    colPairs.push({ obsCol: c, scoreCol: c + 1, level, shift });
  }
  if (colPairs.length === 0) {
    colPairs.push({ obsCol: startAuditCol, scoreCol: startAuditCol + 1, level: record?.level || "L3", shift: record?.shift || null });
  }

  const results = [];
  for (const pair of colPairs) {
    let applicableMarks = 0;
    let scoreSum = 0;
    for (let r = startRow; r < endRow; r++) {
      const row = sheet.rows[r];
      if (!row || !Array.isArray(row)) continue;
      if (row.some(cell => /total/i.test(String(cell?.value ?? cell?.formatted ?? "")))) break;
      const marksVal = Number(row[marksCol]?.value ?? row[marksCol]?.formatted);
      const safeMarks = isCc
        ? (Number.isFinite(marksVal) && marksVal > 0 ? marksVal : 0)
        : (Number.isFinite(marksVal) && marksVal > 0 ? marksVal : 1);
      const obs = String(row[pair.obsCol]?.value ?? row[pair.obsCol]?.formatted ?? "").trim();
      const scoreVal = row[pair.scoreCol]?.value ?? row[pair.scoreCol]?.formatted;
      if (obs.toUpperCase() === "NA") continue;
      applicableMarks += safeMarks;
      if (scoreVal !== "" && scoreVal !== "NA" && scoreVal != null && Number.isFinite(Number(scoreVal))) {
        scoreSum += Number(scoreVal);
      }
    }
    const pct = applicableMarks > 0 ? Math.round((scoreSum / applicableMarks) * 100) : 0;
    const label = pair.level === "L3" ? "Level 3" : pair.level === "L2" ? "Level 2" : pair.level === "L1" ? "Level 1" : pair.level;
    results.push({ label, percentage: `${pct}%` });
  }
  return results.length > 0 ? results : [{ label: "Level 3", percentage: "0%" }];
};

const buildSheetEmail = (
  assembly,
  pdca,
  portalBaseUrl = ENV.ADMIN_URL || ENV.FRONTEND_URL,
  remarks = "",
  { pdcaOnly = false, pdcaPoints = [], pdcaSections = [], sheetDetails = null } = {}
) => {
  const baseUrl = portalBaseUrl;
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new ApiError("The CMS Portal URL is not configured for email links.", 503);
  }
  if (!/^https?:$/.test(base.protocol)) throw new ApiError("The CMS Portal URL is not configured for email links.", 503);

  const assemblyUrl = assembly ? (() => {
    const assemblyParams = new URLSearchParams({
      viewWorkbookId: String(assembly.workbookId),
      sheetIndex: String(assembly.sheetIndex)
    });
    return new URL(`/cms/lpa?${assemblyParams}`, base).toString();
  })() : null;
  const pdcaParams = new URLSearchParams({ viewPdcaSheetId: String(pdca.id) });
  let pdcaPath = "/cms/pdca";
  if (pdca.source === "lpa") {
    pdcaPath = "/cms/lpa";
    pdcaParams.set("section", pdca.section === "cc" ? "cc" : "assembly");
    if (pdca.unit) pdcaParams.set("unit", String(pdca.unit));
  } else {
    pdcaParams.set("sheet", String(pdca.id));
    pdcaParams.delete("viewPdcaSheetId");
  }
  const pdcaUrl = new URL(`${pdcaPath}?${pdcaParams}`, base).toString();

  const isLpaPdca = pdca.source === "lpa";
  const moduleName = assembly?.section === "cc" || (isLpaPdca && pdca.section === "cc") ? "C&C" : "Assembly";
  const isCc = moduleName === "C&C";

  // LPA Assembly / C&C Sheet Label
  const assemblyTitle = isCc ? "LPA C&C Sheet" : "LPA Assembly Sheet";
  let assemblyLabel = "";
  if (assembly) {
    const rawName = String(assembly.name || "").trim();
    if (rawName && rawName.toLowerCase().startsWith("lpa")) {
      assemblyLabel = rawName.endsWith(":") ? rawName.slice(0, -1) : rawName;
    } else if (rawName) {
      assemblyLabel = `${assemblyTitle}: ${rawName}`;
    } else {
      assemblyLabel = `${assemblyTitle}: ${isCc ? "C&C" : "Assembly"}`;
    }
  }

  // PDCA Sheet Label
  const pdcaLabel = isLpaPdca
    ? `LPA Observation ${moduleName} PDCA`
    : (pdcaOnly ? "PDCA Sheet" : `${moduleName} PDCA Sheet`);

  // Sheet Details Table data (fallback derivation if sheetDetails was not pre-populated)
  const details = sheetDetails || (assembly ? {
    unit: assembly.unit || "Bawal",
    auditor: assembly.auditor || "-",
    scoreHtml: assembly.score
      ? (String(assembly.score).includes(" - ")
        ? `<span style="color:#64748b;font-weight:600;">${escapeHtml(String(assembly.score).split(" - ")[0])} - </span><span style="font-weight:700;color:#0f172a;">${escapeHtml(String(assembly.score).split(" - ").slice(1).join(" - "))}</span>`
        : `<span style="font-weight:700;color:#0f172a;">${escapeHtml(assembly.score)}</span>`)
      : `<span style="color:#64748b;font-weight:600;">Level 3 - </span><span style="font-weight:700;color:#0f172a;">0%</span>`,
    department: assembly.department || (isCc ? "C&C" : "Assembly"),
    section: assembly.sectionName || assembly.section || (isCc ? "cc" : "assembly"),
    line: assembly.line || "-"
  } : null);

  const detailsTableHtml = details ? `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 20px 0;font-family:Arial,sans-serif;font-size:13px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
  <thead>
    <tr style="background-color:#f8fafc;border-bottom:2px solid #e2e8f0;">
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;">UNIT</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;">AUDITOR NAME</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;">SCORE</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;">DEPARTMENT</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;">SECTION</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;">LINE</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:12px 14px;color:#334155;font-size:13px;vertical-align:middle;border-bottom:1px solid #e2e8f0;">${escapeHtml(details.unit)}</td>
      <td style="padding:12px 14px;color:#1e293b;font-size:13px;font-weight:500;vertical-align:middle;border-bottom:1px solid #e2e8f0;">
        <span style="color:#94a3b8;margin-right:4px;">&#128100;</span>${escapeHtml(details.auditor)}
      </td>
      <td style="padding:12px 14px;color:#334155;font-size:13px;vertical-align:middle;border-bottom:1px solid #e2e8f0;">${details.scoreHtml}</td>
      <td style="padding:12px 14px;color:#334155;font-size:13px;vertical-align:middle;border-bottom:1px solid #e2e8f0;">${escapeHtml(details.department)}</td>
      <td style="padding:12px 14px;color:#334155;font-size:13px;vertical-align:middle;border-bottom:1px solid #e2e8f0;">${escapeHtml(details.section)}</td>
      <td style="padding:12px 14px;color:#334155;font-size:13px;vertical-align:middle;border-bottom:1px solid #e2e8f0;">${escapeHtml(details.line)}</td>
    </tr>
  </tbody>
</table>` : "";

  // Sections and Points HTML below the PDCA link
  let pointsHtml = "";
  const sectionsList = (Array.isArray(pdcaSections) && pdcaSections.length > 0)
    ? pdcaSections
    : ((Array.isArray(pdcaPoints) && pdcaPoints.length > 0) ? [{ section: "", points: pdcaPoints }] : []);

  if (sectionsList.length > 0) {
    const hasMultipleOrNamed = sectionsList.length > 1 || (sectionsList.length === 1 && sectionsList[0].section && sectionsList[0].section.toLowerCase() !== moduleName.toLowerCase());
    if (hasMultipleOrNamed) {
      pointsHtml = `
<div style="margin:0 0 16px 0;font-family:Arial,sans-serif;font-size:13px;line-height:22px;color:#334155;">
  ${sectionsList.map(sec => `
    <div style="margin:0 0 12px 0;">
      ${sec.section ? `<p style="margin:0 0 6px 0;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#1e293b;">${escapeHtml(sec.section)}:</p>` : ""}
      <ol style="margin:0;padding-left:20px;font-family:Arial,sans-serif;font-size:13px;line-height:22px;color:#334155;">
        ${(sec.points || []).map(p => `<li style="margin-bottom:3px;color:#334155;">${escapeHtml(p)}</li>`).join("")}
      </ol>
    </div>
  `).join("")}
</div>`;
    } else {
      const allPts = sectionsList[0].points || [];
      if (allPts.length > 0) {
        pointsHtml = `
<div style="margin:0 0 16px 0;font-family:Arial,sans-serif;font-size:13px;line-height:22px;color:#334155;">
  <ol style="margin:0;padding-left:20px;color:#334155;">
    ${allPts.map(p => `<li style="margin-bottom:3px;color:#334155;">${escapeHtml(p)}</li>`).join("")}
  </ol>
</div>`;
      }
    }
  }

  const remarksHtml = remarks
    ? `<p style="margin:16px 0;font:14px Arial,sans-serif;color:#334155;"><strong>Remarks:</strong> ${escapeHtml(remarks).replace(/\r?\n/g, "<br>")}</p>`
    : "";

  const html = [
    `<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;color:#1e293b;">`,
    `<p style="margin:0 0 10px 0;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#1e293b;">Dear Sir,</p>`,
    `<p style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;line-height:20px;color:#1e293b;">Safety First</p>`,
    ...(assembly && assemblyUrl ? [
      `<p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#1e293b;"><strong>${escapeHtml(assemblyLabel)}</strong> &mdash; <a href="${escapeHtml(assemblyUrl)}" target="_blank" style="color:#2563eb;text-decoration:underline;font-weight:bold;">Click here to open</a></p>`,
      detailsTableHtml
    ] : []),
    `<p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#1e293b;"><strong>${escapeHtml(pdcaLabel)}</strong> &mdash; <a href="${escapeHtml(pdcaUrl)}" target="_blank" style="color:#2563eb;text-decoration:underline;font-weight:bold;">Click here to open</a></p>`,
    pointsHtml,
    remarksHtml,
    `</div>`
  ].join("");

  return { html, ...(assemblyUrl ? { assemblyUrl } : {}), pdcaUrl };
};

function pruneAttempts(attemptStore, now = Date.now()) {
  for (const [key, entry] of attemptStore) {
    if (entry.expiresAt <= now) attemptStore.delete(key);
  }
}

export const createSendLpaEmailHandler = ({ sendMailFn = sendMail, log = logger, attemptStore = attempts, portalBaseUrl, getLpaRecord = (id, user) => LpaRecord.getRecordById(id, user, { authoritative: true }), getPdcaRecord = PDCAModel.findByRecordId.bind(PDCAModel), getPdcaSheet = PDCAModel.getSheet.bind(PDCAModel) } = {}) => asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const idempotencyKey = String(req.get("Idempotency-Key") || "").trim();
  if (!userId) throw new ApiError("You are not logged in.", 401);
  if (!idempotencyKey || idempotencyKey.length > 128) throw new ApiError("A valid email request key is required.", 400);

  pruneAttempts(attemptStore);
  const attemptKey = `${userId}:${idempotencyKey}`;
  const prior = attemptStore.get(attemptKey);
  if (prior) return res.status(prior.status).json(prior.body);

  const to = parseAddresses(req.body?.to, "To");
  const cc = parseAddresses(req.body?.cc, "CC");
  if (to.length > 50 || cc.length > 50) {
    attemptStore.delete(attemptKey);
    throw new ApiError("A maximum of 50 recipients is allowed per field.", 400);
  }
  const remarks = String(req.body?.remarks || "").trim();
  if (remarks.length > 5000) {
    attemptStore.delete(attemptKey);
    throw new ApiError("Remarks must be 5,000 characters or fewer.", 400);
  }
  const assembly = req.body?.assemblySheet;
  const pdca = req.body?.pdcaSheet;
  const pdcaOnly = req.body?.emailMode === "pdca-only";
  if (!pdcaOnly && (!assembly?.workbookId || !Number.isInteger(Number(assembly.sheetIndex)) || Number(assembly.sheetIndex) < 0)) {
    attemptStore.delete(attemptKey);
    throw new ApiError("Select a valid Assembly sheet before sending.", 400);
  }
  if (!pdca?.id || !["lpa", "pdca"].includes(pdca.source)) {
    throw new ApiError("Select a valid PDCA sheet before sending.", 400);
  }
  const section = assembly ? (assembly.section === "cc" ? "cc" : "assembly") : (pdca.section === "cc" ? "cc" : "assembly");
  if (!pdcaOnly && pdca.source === "lpa" && pdca.section && pdca.section !== section) {
    throw new ApiError("The selected LPA sheets must belong to the same module.", 400);
  }

  // Reserve the idempotency key before SMTP begins so rapid duplicate requests cannot send twice.
  const pending = { status: 409, body: new ApiResponse(409, { pending: true }, "This email request is already being processed."), expiresAt: Date.now() + ATTEMPT_TTL_MS };
  attemptStore.set(attemptKey, pending);

  try {
    let sheetDetails = null;
    if (!pdcaOnly) {
      const workbook = await getLpaRecord(String(assembly.workbookId), req.user);
      if (!workbook || workbook.section !== section) throw new ApiError(`The selected ${section === "cc" ? "LPA C&C" : "LPA Assembly"} sheet is unavailable or no longer accessible.`, 404);
      const assemblySheetData = workbook.sheets?.[Number(assembly.sheetIndex)];
      if (!assemblySheetData?.rows?.length) throw new ApiError("The selected LPA sheet has no saved table data. Save the sheet before sending.", 422);

      const unitVal = assembly.unit || assemblySheetData.unit || workbook.unit || "Bawal";
      const auditorVal = (assemblySheetData.auditors && assemblySheetData.auditors.length > 0 && assemblySheetData.auditors.some(Boolean))
        ? assemblySheetData.auditors.filter(Boolean).join(", ")
        : (assemblySheetData.auditor || (workbook.auditors && workbook.auditors.length > 0 && workbook.auditors.some(Boolean))
          ? workbook.auditors.filter(Boolean).join(", ")
          : workbook.auditor || assembly.auditor || workbook.createdBy || "-");

      const deptVal = assembly.department || assemblySheetData.department || workbook.department || (section === "cc" ? "C&C" : "Assembly");
      const secVal = assembly.sectionName || assembly.section || assemblySheetData.sectionName || assemblySheetData.section || workbook.sectionName || workbook.section || (section === "cc" ? "cc" : "assembly");
      const lineVal = assembly.line || assemblySheetData.line || workbook.line || "-";

      let scoreHtml = "";
      if (assembly.score) {
        const parts = String(assembly.score).split(" - ");
        if (parts.length > 1) {
          scoreHtml = `<span style="color:#64748b;font-weight:600;">${escapeHtml(parts[0])} - </span><span style="font-weight:700;color:#0f172a;">${escapeHtml(parts.slice(1).join(" - "))}</span>`;
        } else {
          scoreHtml = `<span style="font-weight:700;color:#0f172a;">${escapeHtml(assembly.score)}</span>`;
        }
      } else {
        const scores = calculateWorksheetScores(assemblySheetData, workbook);
        if (scores.length > 0) {
          scoreHtml = scores.map(s => `<div style="white-space:nowrap;line-height:1.4;"><span style="color:#64748b;font-weight:600;">${escapeHtml(s.label)} - </span><span style="font-weight:700;color:#0f172a;">${escapeHtml(s.percentage)}</span></div>`).join("");
        } else {
          const levelName = (workbook.level === "L3" ? "Level 3" : workbook.level === "L2" ? "Level 2" : workbook.level === "L1" ? "Level 1" : workbook.level) || "Level 3";
          const pct = assemblySheetData.scorePercentage || workbook.percentage || "0%";
          scoreHtml = `<span style="color:#64748b;font-weight:600;">${escapeHtml(levelName)} - </span><span style="font-weight:700;color:#0f172a;">${escapeHtml(pct)}</span>`;
        }
      }

      sheetDetails = {
        unit: unitVal,
        auditor: auditorVal,
        scoreHtml,
        department: deptVal,
        section: secVal,
        line: lineVal
      };
    }

    if (pdca.source === "lpa" && !String(pdca.id).startsWith("PDCA-LPA")) {
      throw new ApiError("The selected LPA Observation PDCA sheet is invalid.", 400);
    }
    const pdcaRecord = await getPdcaRecord(String(pdca.id));
    if (pdcaRecord?.isDeleted || (pdca.source === "pdca" && !pdcaRecord)) {
      throw new ApiError("The selected PDCA sheet is unavailable or has been deleted.", 404);
    }
    // LPA Observation PDCA sheets are stored as LPA snapshots (local saved
    // sheet data), rather than rows in the standard pdca_records table. Use
    // that selected snapshot only for LPA sheets when no backend PDCA record
    // exists; standard PDCA emails must continue to load exclusively by ID.
    const pdcaSheetData = pdcaRecord
      ? (pdcaRecord.sheet || await getPdcaSheet(pdcaRecord.id || pdcaRecord.recordId || pdca.id))
      : (pdca.source === "lpa" ? pdca.sheetData : null);
    if (!Array.isArray(pdcaSheetData?.rows) || !pdcaSheetData.rows.length || !hasSavedPdcaRows(pdcaSheetData)) {
      throw new ApiError(`The selected ${pdca.source === "lpa" ? "LPA Observation PDCA" : "PDCA"} sheet has no saved table data. Save the sheet before sending.`, 422);
    }

    const isLpaPdca = pdca.source === "lpa";
    const subject = pdcaOnly
      ? (isLpaPdca ? `LPA Observation ${section === "cc" ? "C&C" : "Assembly"} PDCA` : "PDCA Sheet")
      : `${section === "cc" ? "LPA C&C Sheet" : "LPA Assembly Sheet"} and ${isLpaPdca ? "LPA Observation PDCA" : "PDCA Sheet"}`;

    const clientPoints = Array.isArray(pdca.points)
      ? pdca.points.map(point => String(point || "").trim()).filter(Boolean)
      : [];
    const clientSections = Array.isArray(pdca.sections)
      ? pdca.sections.map(s => ({
          section: String(s?.section || "").trim(),
          points: Array.isArray(s?.points) ? s.points.map(p => String(p || "").trim()).filter(Boolean) : []
        })).filter(s => s.points.length > 0)
      : [];
    const pdcaSections = clientSections.length > 0
      ? clientSections
      : extractPdcaSectionsAndPoints(pdcaSheetData, clientPoints);
    const pdcaPoints = clientPoints.length ? clientPoints : extractPdcaPoints(pdcaSheetData);

    const effectiveBaseUrl = portalBaseUrl || req.body?.portalBaseUrl || req.headers?.origin || ENV.ADMIN_URL || ENV.FRONTEND_URL || "http://localhost:5173";
    const { html, assemblyUrl, pdcaUrl } = buildSheetEmail(assembly || null, pdca, effectiveBaseUrl, remarks, { pdcaOnly, pdcaPoints, pdcaSections, sheetDetails });
    const info = await sendMailFn(to, subject, html, [], cc);
    const accepted = Array.isArray(info?.accepted) ? info.accepted.map(String) : [];
    const rejected = Array.isArray(info?.rejected) ? info.rejected.map(String) : [];
    const acceptedSet = new Set(accepted.map(address => address.toLowerCase()));
    const unaccepted = to.filter(address => !acceptedSet.has(address.toLowerCase()));
    const rejectedAddresses = [...new Set([...rejected, ...unaccepted])];

    if (rejectedAddresses.length) {
      attemptStore.delete(attemptKey);
      const body = new ApiResponse(502, { accepted, rejected: rejectedAddresses }, "The email service rejected one or more recipients.");
      log.error(`[LPA_EMAIL] Provider rejected recipients user=${userId} accepted=${accepted.length} rejected=${rejectedAddresses.length} responseCode=${info?.responseCode || "unknown"}`);
      return res.status(502).json(body);
    }

    const body = new ApiResponse(200, {
      messageId: info?.messageId || null,
      accepted,
      links: { ...(assemblyUrl ? { assembly: assemblyUrl } : {}), pdca: pdcaUrl }
    }, "Email accepted by the configured mail service.");
    attemptStore.set(attemptKey, { status: 200, body, expiresAt: Date.now() + ATTEMPT_TTL_MS });
    log.info(`[LPA_EMAIL] Provider accepted email user=${userId} recipients=${accepted.length} messageId=${info?.messageId || "unknown"}`);
    return res.status(200).json(body);
  } catch (error) {
    attemptStore.delete(attemptKey);
    const statusCode = error?.statuscode || error?.statusCode || error?.status;
    if (statusCode && statusCode < 500) {
      return res.status(statusCode).json(new ApiResponse(statusCode, null, error.message));
    }
    const code = error?.code || "unknown";
    const responseCode = error?.responseCode || "unknown";
    const command = String(error?.command || "unknown").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
    log.error(`[LPA_EMAIL] Send failed user=${userId} code=${code} responseCode=${responseCode} command=${command} message=${error?.message}`);
    const errorMessage = error?.code === "SMTP_NOT_CONFIGURED"
      ? "Email service is not configured. Contact your administrator."
      : (error?.message && !error.message.includes("Object") ? error.message : "The email service could not accept this message. Please try again later.");
    const body = new ApiResponse(502, null, errorMessage);
    return res.status(502).json(body);
  }
});

export const sendLpaEmail = createSendLpaEmailHandler();

export const __emailTestUtils = { buildSheetEmail, parseAddresses, attempts };
