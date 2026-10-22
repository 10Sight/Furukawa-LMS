import sendMail from "../../utils/mail.util.js";
import ENV from "../../configs/env.config.js";
import logger from "../../logger/winston.logger.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

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

const buildSheetEmail = (assembly, pdca, portalBaseUrl = ENV.ADMIN_URL || ENV.FRONTEND_URL) => {
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
  const html = [
    "<p>The selected CMS Portal sheets are ready to view:</p>",
    `<ul><li><strong>Assembly:</strong> <a href="${escapeHtml(assemblyUrl)}">${assemblyName}</a></li>`,
    `<li><strong>${escapeHtml(pdca.source === "lpa" ? `${moduleName} LPA Observation PDCA` : "PDCA")}:</strong> <a href="${escapeHtml(pdcaUrl)}">${pdcaName}</a></li></ul>`
  ].join("");
  return { html, assemblyUrl, pdcaUrl };
};

function pruneAttempts(attemptStore, now = Date.now()) {
  for (const [key, entry] of attemptStore) {
    if (entry.expiresAt <= now) attemptStore.delete(key);
  }
}

export const createSendLpaEmailHandler = ({ sendMailFn = sendMail, log = logger, attemptStore = attempts, portalBaseUrl } = {}) => asyncHandler(async (req, res) => {
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
  const subject = String(req.body?.subject || "").trim();
  if (!subject || subject.length > 200 || /[\r\n]/.test(subject)) {
    attemptStore.delete(attemptKey);
    throw new ApiError("Enter a valid email subject (maximum 200 characters).", 400);
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

  // Reserve the idempotency key before SMTP begins so rapid duplicate requests cannot send twice.
  const pending = { status: 409, body: new ApiResponse(409, { pending: true }, "This email request is already being processed."), expiresAt: Date.now() + ATTEMPT_TTL_MS };
  attemptStore.set(attemptKey, pending);

  try {
    const { html, assemblyUrl, pdcaUrl } = buildSheetEmail(assembly, pdca, portalBaseUrl);
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
