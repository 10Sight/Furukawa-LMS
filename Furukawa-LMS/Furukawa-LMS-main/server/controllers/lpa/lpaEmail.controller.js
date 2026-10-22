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

const cellText = cell => cell?.formatted ?? cell?.text ?? cell?.value ?? "";

const renderLpaTable = (sheet, title) => {
  if (!sheet || !Array.isArray(sheet.rows) || !sheet.rows.length) throw new ApiError(`The selected ${title} has no saved table data.`, 422);
  const covered = new Set();
  const mergeByAnchor = new Map();
  for (const merge of sheet.merges || []) {
    const start = merge.s || { r: merge.start?.row, c: merge.start?.col };
    const end = merge.e || { r: merge.end?.row, c: merge.end?.col };
    if (!Number.isInteger(start.r) || !Number.isInteger(start.c) || !Number.isInteger(end.r) || !Number.isInteger(end.c)) continue;
    mergeByAnchor.set(`${start.r}:${start.c}`, { rows: end.r - start.r + 1, cols: end.c - start.c + 1, start });
    for (let r = start.r; r <= end.r; r++) for (let c = start.c; c <= end.c; c++) {
      if (r !== start.r || c !== start.c) covered.add(`${r}:${c}`);
    }
  }
  const rows = sheet.rows.map((row, r) => `<tr>${(Array.isArray(row) ? row : []).map((cell, c) => {
    if (covered.has(`${r}:${c}`)) return "";
    const merge = mergeByAnchor.get(`${r}:${c}`);
    const value = escapeHtml(cellText(cell)).replace(/\r?\n/g, "<br>");
    const style = cell?.style || {};
    const colorHex = String(style.font?.color?.rgb || "").replace(/^#/, "").slice(-6);
    const fillHex = String(style.fill?.fgColor?.rgb || "").replace(/^#/, "").slice(-6);
    const bold = style.font?.bold ? "font-weight:bold;" : "";
    const italic = style.font?.italic ? "font-style:italic;" : "";
    const color = /^[0-9a-f]{6}$/i.test(colorHex) ? `color:#${colorHex};` : "";
    const fill = /^[0-9a-f]{6}$/i.test(fillHex) ? `background-color:#${fillHex};` : "";
    const fontSize = Number(style.font?.sz);
    const size = Number.isFinite(fontSize) && fontSize >= 8 && fontSize <= 24 ? `font-size:${fontSize}px;` : "";
    const align = ["left", "center", "right"].includes(style.alignment?.horizontal) ? `text-align:${style.alignment.horizontal};` : "";
    const span = merge ? ` rowspan="${merge.rows}" colspan="${merge.cols}"` : "";
    return `<td${span} style="${bold}${italic}${color}${fill}${size}${align}padding:5px 7px;border:1px solid #9ca3af;vertical-align:top;white-space:pre-wrap;">${value || "&nbsp;"}</td>`;
  }).join("")}</tr>`).join("");
  return `<h3 style="margin:20px 0 8px;font:600 16px Arial,sans-serif;">${escapeHtml(title)} · ${escapeHtml(sheet.name || "Worksheet")}</h3><table role="presentation" style="border-collapse:collapse;border:1px solid #9ca3af;font:12px Arial,sans-serif;width:100%;">${rows}</table>`;
};

const renderPdcaTable = (sheet, title) => {
  if (!sheet || !Array.isArray(sheet.rows) || !sheet.rows.length) throw new ApiError(`The selected ${title} has no saved table data.`, 422);
  const headers = ["Date", "Shift", "S.No", "Status", "Unit", "Department", "Section", "Line/Area", "Observation", "Image Before", "Root Cause", "Counter Measure", "Image After", "Std. Duration in min", "Response Date", "No. of time Revised", "Responsible Person Unit", "Responsible Person Department", "Staff Name", "CFT", "Responsible Person Confirmation"];
  const rows = sheet.rows.map((sourceRow, index) => {
    const row = sourceRow || {};
    const cells = [row.date, row.shift, index + 1, row.status, row.unit, Array.isArray(row.departments) ? row.departments.join(", ") : row.department, Array.isArray(row.sections) ? row.sections.map(item => item?.section || item).join(", ") : row.section, Array.isArray(row.lineAreas) ? row.lineAreas.map(item => item?.lineArea || item).join(", ") : row.lineArea, row.observation, row.imageBeforeName || (row.imageBefore ? "Image available" : ""), row.rootCause, row.counterMeasure, row.imageAfterName || (row.imageAfter ? "Image available" : ""), row.stdDurationMin ?? row.stdDuration, row.responseDate, Array.isArray(row.revisedDates) ? row.revisedDates.map((item, i) => `${i + 1}) ${typeof item === "string" ? item : `${item?.date || ""}${item?.reason ? ` — ${item.reason}` : ""}`}`).join("; ") : "", row.respUnit || row.responsiblePersonUnit, row.responsiblePersonDept, row.staffEmployee || (row.staffEmployees || []).map(employee => employee.name).filter(Boolean).join(", "), row.cftTopic || row.cftSelectedName, row.confirmation || row.responsiblePersonConfirmation || row.instruction];
    return `<tr>${cells.map(value => `<td style="padding:5px 7px;border:1px solid #9ca3af;vertical-align:top;white-space:pre-wrap;">${escapeHtml(value)}</td>`).join("")}</tr>`;
  }).join("");
  const header = headers.map(value => `<th style="padding:6px 7px;border:1px solid #64748b;background:#e2e8f0;text-align:left;">${escapeHtml(value)}</th>`).join("");
  return `<h3 style="margin:20px 0 8px;font:600 16px Arial,sans-serif;">${escapeHtml(title)}</h3><table role="presentation" style="border-collapse:collapse;border:1px solid #9ca3af;font:12px Arial,sans-serif;width:100%;"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
};

const hasSavedPdcaRows = sheet => sheet.rows.some(row => row && [
  row.date, row.shift, row.unit, row.department, row.section, row.lineArea, row.observation,
  row.rootCause, row.counterMeasure, row.stdDurationMin, row.responseDate, row.instruction,
  row.responsiblePersonDept, row.staffEmployee, row.cftTopic, row.responsiblePersonConfirmation,
  row.confirmation, row.imageBefore, row.imageAfter
].some(value => value !== undefined && value !== null && String(value).trim() !== ""));

const buildSheetEmail = (assembly, pdca, portalBaseUrl = ENV.ADMIN_URL || ENV.FRONTEND_URL, remarks = "", assemblySheetData, pdcaSheetData) => {
  const baseUrl = portalBaseUrl;
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new ApiError("The CMS Portal URL is not configured for email links.", 503);
  }
  if (!/^https?:$/.test(base.protocol)) throw new ApiError("The CMS Portal URL is not configured for email links.", 503);

  const assemblyParams = new URLSearchParams({
    viewWorkbookId: String(assembly.workbookId),
    sheetIndex: String(assembly.sheetIndex)
  });
  const assemblyUrl = new URL(`/cms/lpa?${assemblyParams}`, base).toString();
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

  const assemblyName = escapeHtml(assembly.name || "Assembly sheet");
  const pdcaName = escapeHtml(pdca.name || "LPA Observation PDCA sheet");
  const moduleName = pdca.source === "lpa" && pdca.section === "cc" ? "C&C" : "Assembly";
  const assemblyTitle = assembly.section === "cc" ? "LPA C&C Sheet" : "LPA Assembly Sheet";
  const pdcaTitle = pdca.source === "lpa" ? `${moduleName} LPA Observation PDCA` : "PDCA Sheet";
  const html = [
    `<p><strong>Remarks:</strong> ${escapeHtml(remarks).replace(/\r?\n/g, "<br>") || "-"}</p>`,
    `<p><a href="${escapeHtml(assemblyUrl)}">View ${assemblyName}</a> · <a href="${escapeHtml(pdcaUrl)}">View ${pdcaName}</a></p>`,
    ...(assemblySheetData ? [renderLpaTable(assemblySheetData, assemblyTitle)] : []),
    ...(pdcaSheetData ? [pdca.source === "lpa" ? renderPdcaTable(pdcaSheetData, `${pdcaTitle} · ${pdcaName}`) : renderPdcaTable(pdcaSheetData, pdcaTitle)] : [])
  ].join("");
  return { html, assemblyUrl, pdcaUrl };
};

function pruneAttempts(attemptStore, now = Date.now()) {
  for (const [key, entry] of attemptStore) {
    if (entry.expiresAt <= now) attemptStore.delete(key);
  }
}

export const createSendLpaEmailHandler = ({ sendMailFn = sendMail, log = logger, attemptStore = attempts, portalBaseUrl, getLpaRecord = LpaRecord.getRecordById.bind(LpaRecord), getPdcaRecord = PDCAModel.findByRecordId.bind(PDCAModel), getPdcaSheet = PDCAModel.getSheet.bind(PDCAModel) } = {}) => asyncHandler(async (req, res) => {
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
  if (!assembly?.workbookId || !Number.isInteger(Number(assembly.sheetIndex)) || Number(assembly.sheetIndex) < 0) {
    attemptStore.delete(attemptKey);
    throw new ApiError("Select a valid Assembly sheet before sending.", 400);
  }
  if (!pdca?.id || !["lpa", "pdca"].includes(pdca.source)) {
    throw new ApiError("Select a valid PDCA sheet before sending.", 400);
  }
  const section = assembly.section === "cc" ? "cc" : "assembly";
  if (pdca.source === "lpa" && pdca.section && pdca.section !== section) {
    throw new ApiError("The selected LPA sheets must belong to the same module.", 400);
  }

  // Reserve the idempotency key before SMTP begins so rapid duplicate requests cannot send twice.
  const pending = { status: 409, body: new ApiResponse(409, { pending: true }, "This email request is already being processed."), expiresAt: Date.now() + ATTEMPT_TTL_MS };
  attemptStore.set(attemptKey, pending);

  try {
    const workbook = await getLpaRecord(String(assembly.workbookId), req.user);
    if (!workbook || workbook.section !== section) throw new ApiError(`The selected ${section === "cc" ? "LPA C&C" : "LPA Assembly"} sheet is unavailable or no longer accessible.`, 404);
    const assemblySheetData = workbook.sheets?.[Number(assembly.sheetIndex)];
    if (!assemblySheetData?.rows?.length) throw new ApiError("The selected LPA sheet has no saved table data. Save the sheet before sending.", 422);

    const pdcaRecord = await getPdcaRecord(String(pdca.id));
    if (!pdcaRecord) {
      const name = pdca.source === "lpa" ? "LPA Observation PDCA" : "PDCA";
      throw new ApiError(`The selected ${name} sheet has no saved backend data. Save the sheet before sending.`, 422);
    }
    if (pdca.source === "lpa" && !String(pdca.id).startsWith("PDCA-LPA")) {
      throw new ApiError("The selected LPA Observation PDCA sheet is invalid.", 400);
    }
    const pdcaSheetData = pdcaRecord.sheet || await getPdcaSheet(pdcaRecord.id || pdcaRecord.recordId || pdca.id);
    if (!Array.isArray(pdcaSheetData?.rows) || !pdcaSheetData.rows.length || !hasSavedPdcaRows(pdcaSheetData)) {
      throw new ApiError(`The selected ${pdca.source === "lpa" ? "LPA Observation PDCA" : "PDCA"} sheet has no saved table data. Save the sheet before sending.`, 422);
    }

    const subject = `${section === "cc" ? "LPA C&C Sheet" : "LPA Assembly Sheet"} and ${pdca.source === "lpa" ? "LPA Observation PDCA" : "PDCA Sheet"}`;
    const { html, assemblyUrl, pdcaUrl } = buildSheetEmail(assembly, pdca, portalBaseUrl, remarks, assemblySheetData, pdcaSheetData);
    const info = await sendMailFn(to, subject, html, [], cc);
    const accepted = Array.isArray(info?.accepted) ? info.accepted.map(String) : [];
    const rejected = Array.isArray(info?.rejected) ? info.rejected.map(String) : [];
    const acceptedSet = new Set(accepted.map(address => address.toLowerCase()));
    const unaccepted = to.filter(address => !acceptedSet.has(address.toLowerCase()));
    const rejectedAddresses = [...new Set([...rejected, ...unaccepted])];

    if (rejectedAddresses.length) {
      const body = new ApiResponse(502, { accepted, rejected: rejectedAddresses }, "The email service rejected one or more recipients.");
      attemptStore.set(attemptKey, { status: 502, body, expiresAt: Date.now() + ATTEMPT_TTL_MS });
      log.error(`[LPA_EMAIL] Provider rejected recipients user=${userId} accepted=${accepted.length} rejected=${rejectedAddresses.length} responseCode=${info?.responseCode || "unknown"}`);
      return res.status(502).json(body);
    }

    const body = new ApiResponse(200, {
      messageId: info?.messageId || null,
      accepted,
      links: { assembly: assemblyUrl, pdca: pdcaUrl }
    }, "Email accepted by the configured mail service.");
    attemptStore.set(attemptKey, { status: 200, body, expiresAt: Date.now() + ATTEMPT_TTL_MS });
    log.info(`[LPA_EMAIL] Provider accepted email user=${userId} recipients=${accepted.length} messageId=${info?.messageId || "unknown"}`);
    return res.status(200).json(body);
  } catch (error) {
    if (error?.statuscode && error.statuscode < 500) {
      attemptStore.delete(attemptKey);
      return res.status(error.statuscode).json(new ApiResponse(error.statuscode, null, error.message));
    }
    const code = error?.code || "unknown";
    const responseCode = error?.responseCode || "unknown";
    const command = String(error?.command || "unknown").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
    log.error(`[LPA_EMAIL] Send failed user=${userId} code=${code} responseCode=${responseCode} command=${command}`);
    const body = new ApiResponse(502, null, error?.code === "SMTP_NOT_CONFIGURED"
      ? "Email service is not configured. Contact your administrator."
      : "The email service could not accept this message. Please try again later.");
    attemptStore.set(attemptKey, { status: 502, body, expiresAt: Date.now() + ATTEMPT_TTL_MS });
    return res.status(502).json(body);
  }
});

export const sendLpaEmail = createSendLpaEmailHandler();

export const __emailTestUtils = { buildSheetEmail, parseAddresses, attempts };
