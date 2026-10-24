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

const buildSheetEmail = (assembly, pdca, portalBaseUrl = ENV.ADMIN_URL || ENV.FRONTEND_URL, remarks = "", { pdcaOnly = false, pdcaPoints = [] } = {}) => {
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
  const assemblyTitle = assembly?.section === "cc" ? "LPA C&C Sheet" : "LPA Assembly Sheet";
  const assemblyLabel = assembly?.name ? (assembly.name.includes("LPA") ? `${assembly.name}:` : `${assemblyTitle}: ${assembly.name}`) : `${assemblyTitle}:`;
  const pdcaTitle = isLpaPdca
    ? `LPA Observation ${moduleName} PDCA`
    : (pdcaOnly ? "PDCA Sheet" : `${moduleName} PDCA Sheet`);

  const pointsListHtml = (Array.isArray(pdcaPoints) && pdcaPoints.length > 0)
    ? `<div style="margin-top:8px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#334155;">
        <ol style="margin:4px 0 0;padding-left:18px;">
          ${pdcaPoints.map(point => `<li style="margin-bottom:3px;color:#334155;">${escapeHtml(point)}</li>`).join("")}
        </ol>
       </div>`
    : "";

  const sheetButtonRow = (label, url, subContent = "") => `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;table-layout:fixed;margin:0 0 12px;"><tr><td width="65%" valign="top" style="width:65%;padding:8px 10px 8px 0;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#334155;word-break:break-word;"><strong>${escapeHtml(label)}</strong>${subContent}</td><td width="35%" align="center" valign="top" style="width:35%;padding:8px 0;text-align:center;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr><td align="center" bgcolor="#2563eb" style="background-color:#2563eb;border:1px solid #2563eb;border-radius:6px;"><a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:18px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;white-space:nowrap;">Click Here to Open</a></td></tr></table></td></tr></table>`;
  const remarksHtml = remarks
    ? `<p style="margin:16px 0;font:14px Arial,sans-serif;color:#334155;"><strong>Remarks:</strong> ${escapeHtml(remarks).replace(/\r?\n/g, "<br>")}</p>`
    : "";
  const html = [
    `<p style="margin:0 0 12px;font:14px Arial,sans-serif;color:#1e293b;">Dear Sir,</p>`,
    `<p style="margin:0 0 18px;font:700 15px Arial,sans-serif;color:#1e293b;">Safety First</p>`,
    ...(assembly ? [sheetButtonRow(assemblyLabel, assemblyUrl)] : []),
    sheetButtonRow(pdcaOnly ? `${pdcaTitle}:` : `${pdcaTitle}: ${moduleName} -`, pdcaUrl, pointsListHtml),
    remarksHtml
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
    if (!pdcaOnly) {
      const workbook = await getLpaRecord(String(assembly.workbookId), req.user);
      if (!workbook || workbook.section !== section) throw new ApiError(`The selected ${section === "cc" ? "LPA C&C" : "LPA Assembly"} sheet is unavailable or no longer accessible.`, 404);
      const assemblySheetData = workbook.sheets?.[Number(assembly.sheetIndex)];
      if (!assemblySheetData?.rows?.length) throw new ApiError("The selected LPA sheet has no saved table data. Save the sheet before sending.", 422);
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
    const pdcaPoints = clientPoints.length ? clientPoints : extractPdcaPoints(pdcaSheetData);

    const effectiveBaseUrl = portalBaseUrl || req.body?.portalBaseUrl || req.headers?.origin || ENV.ADMIN_URL || ENV.FRONTEND_URL || "http://localhost:5173";
    const { html, assemblyUrl, pdcaUrl } = buildSheetEmail(assembly || null, pdca, effectiveBaseUrl, remarks, { pdcaOnly, pdcaPoints });
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
