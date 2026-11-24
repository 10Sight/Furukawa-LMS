import db from '../db/database.js';
import sendMail from '../../utils/mail.util.js';
import ENV from '../../configs/env.config.js';
import logger from '../../logger/winston.logger.js';
import { decodeTokenPayload } from '../utils/authCheck.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map();
const ATTEMPT_TTL_MS = 10 * 60 * 1000;

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));

function resolveUserId(req) {
  if (req.user?.id ?? req.user?._id ?? req.user?.userId) {
    return String(req.user.id ?? req.user._id ?? req.user.userId);
  }
  const xUserId = req.headers['x-user-id'];
  if (xUserId && String(xUserId).trim()) {
    return String(xUserId).trim();
  }
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    const decoded = decodeTokenPayload(token);
    if (decoded?.id ?? decoded?._id ?? decoded?.userId) {
      return String(decoded.id ?? decoded._id ?? decoded.userId);
    }
  }
  const xUserName = req.headers['x-user-name'];
  if (xUserName && String(xUserName).trim()) {
    return String(xUserName).trim().toLowerCase();
  }
  return 'default';
}

function normalizeEmailList(addresses = []) {
  const unique = new Map();
  for (const raw of addresses) {
    const email = String(raw || '').trim();
    if (email && EMAIL_PATTERN.test(email)) {
      const key = email.toLowerCase();
      if (!unique.has(key)) unique.set(key, email);
    }
  }
  return [...unique.values()];
}

function parseAddresses(value, field) {
  const addresses = (Array.isArray(value) ? value : String(value || '').split(/[,;\s]+/))
    .map((address) => String(address).trim())
    .filter(Boolean);
  if (!addresses.length && field === 'To') {
    const err = new Error('Enter at least one recipient email address.');
    err.statusCode = 400;
    throw err;
  }
  if (addresses.some((address) => !EMAIL_PATTERN.test(address))) {
    const err = new Error(`One or more ${field} email addresses are invalid.`);
    err.statusCode = 400;
    throw err;
  }
  const unique = new Map();
  for (const address of addresses) {
    const normalized = address.toLowerCase();
    if (!unique.has(normalized)) unique.set(normalized, address);
  }
  return [...unique.values()];
}

function pruneAttempts(now = Date.now()) {
  for (const [key, entry] of attempts) {
    if (entry.expiresAt <= now) attempts.delete(key);
  }
}

function hasSavedPtmRows(rows = []) {
  return Array.isArray(rows) && rows.some((row) =>
    row &&
    [
      row.phaseName,
      row.reqNo,
      row.customerEvent,
      row.activity,
      row.deliverable,
      row.startDatePlan,
      row.endDatePlan,
      row.startDateActual,
      row.endDateActual,
    ].some((v) => v !== undefined && v !== null && String(v).trim() !== '')
  );
}

function calculatePtmMetrics(rows = [], clientMetrics = null) {
  if (clientMetrics && typeof clientMetrics === 'object') {
    return {
      inProgress: Number(clientMetrics.inProgress) || 0,
      done: Number(clientMetrics.done) || 0,
      delay: Number(clientMetrics.delay) || 0,
      notStarted: Number(clientMetrics.notStarted) || 0,
    };
  }

  const counts = { inProgress: 0, done: 0, delay: 0, notStarted: 0 };
  if (!Array.isArray(rows)) return counts;

  for (const row of rows) {
    if (!row) continue;
    const hasData = [
      row.phaseName,
      row.reqNo,
      row.customerEvent,
      row.activity,
      row.deliverable,
      row.startDatePlan,
      row.endDatePlan,
      row.status,
    ].some((v) => v !== undefined && v !== null && String(v).trim() !== '');
    if (!hasData) continue;

    const rawStatus = String(row.status || '').trim().toLowerCase();
    const hitMiss = String(row.hitMiss || '').trim().toUpperCase();

    if (rawStatus === 'done' || rawStatus === 'closed') {
      counts.done += 1;
    } else if (rawStatus === 'delay' || rawStatus === 'delayed' || hitMiss === 'MISS') {
      counts.delay += 1;
    } else if (
      rawStatus === 'in-progress' ||
      rawStatus === 'in progress' ||
      rawStatus === 'in - progress' ||
      rawStatus === 'in- progress'
    ) {
      counts.inProgress += 1;
    } else {
      counts.notStarted += 1;
    }
  }

  return counts;
}

function buildPtmEmailHtml(ptmSheet, portalBaseUrl, remarks = '', ptmMetrics = null) {
  let base;
  try {
    base = new URL(portalBaseUrl);
  } catch {
    const err = new Error('The CMS Portal URL is not configured for email links.');
    err.statusCode = 503;
    throw err;
  }
  if (!/^https?:$/.test(base.protocol)) {
    const err = new Error('The CMS Portal URL is not configured for email links.');
    err.statusCode = 503;
    throw err;
  }

  const ptmParams = new URLSearchParams();
  if (ptmSheet?.id) ptmParams.set('sheet', String(ptmSheet.id));
  const queryStr = ptmParams.toString();
  const ptmUrl = new URL(`/cms/ptm${queryStr ? `?${queryStr}` : ''}`, base).toString();

  const ptmLabel = ptmSheet?.title || ptmSheet?.topic || 'PTM Sheet';
  const metrics = ptmMetrics || { inProgress: 0, done: 0, delay: 0, notStarted: 0 };

  const metricsHtml = `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:6px 0 18px 0;font-family:Arial,sans-serif;">
  <tr>
    <td style="padding:4px 14px 4px 0;vertical-align:middle;font-size:11px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;">
      METRICS:
    </td>
    <td style="padding:2px 8px 2px 0;vertical-align:middle;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color:#fef3c7;border:1px solid #fde047;border-radius:9999px;">
        <tr>
          <td style="padding:4px 12px;font-size:12px;font-weight:600;color:#78350f;white-space:nowrap;">
            <span style="display:inline-block;width:8px;height:8px;background-color:#f59e0b;border-radius:2px;margin-right:6px;vertical-align:middle;"></span>
            <span style="vertical-align:middle;">In-Progress</span>
            <span style="display:inline-block;background-color:#fde68a;border-radius:9999px;padding:1px 7px;font-size:11px;font-weight:700;color:#78350f;margin-left:6px;vertical-align:middle;">${metrics.inProgress}</span>
          </td>
        </tr>
      </table>
    </td>
    <td style="padding:2px 8px 2px 0;vertical-align:middle;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color:#d1fae5;border:1px solid #6ee7b7;border-radius:9999px;">
        <tr>
          <td style="padding:4px 12px;font-size:12px;font-weight:600;color:#065f46;white-space:nowrap;">
            <span style="display:inline-block;width:8px;height:8px;background-color:#059669;border-radius:2px;margin-right:6px;vertical-align:middle;"></span>
            <span style="vertical-align:middle;">Done</span>
            <span style="display:inline-block;background-color:#a7f3d0;border-radius:9999px;padding:1px 7px;font-size:11px;font-weight:700;color:#065f46;margin-left:6px;vertical-align:middle;">${metrics.done}</span>
          </td>
        </tr>
      </table>
    </td>
    <td style="padding:2px 8px 2px 0;vertical-align:middle;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color:#ffe4e6;border:1px solid #fda4af;border-radius:9999px;">
        <tr>
          <td style="padding:4px 12px;font-size:12px;font-weight:600;color:#9f1239;white-space:nowrap;">
            <span style="display:inline-block;width:8px;height:8px;background-color:#e11d48;border-radius:2px;margin-right:6px;vertical-align:middle;"></span>
            <span style="vertical-align:middle;">Delay</span>
            <span style="display:inline-block;background-color:#fecdd3;border-radius:9999px;padding:1px 7px;font-size:11px;font-weight:700;color:#9f1239;margin-left:6px;vertical-align:middle;">${metrics.delay}</span>
          </td>
        </tr>
      </table>
    </td>
    <td style="padding:2px 0;vertical-align:middle;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color:#dbeafe;border:1px solid #93c5fd;border-radius:9999px;">
        <tr>
          <td style="padding:4px 12px;font-size:12px;font-weight:600;color:#1e40af;white-space:nowrap;">
            <span style="display:inline-block;width:8px;height:8px;background-color:#2563eb;border-radius:2px;margin-right:6px;vertical-align:middle;"></span>
            <span style="vertical-align:middle;">Not-Started</span>
            <span style="display:inline-block;background-color:#bfdbfe;border-radius:9999px;padding:1px 7px;font-size:11px;font-weight:700;color:#1e40af;margin-left:6px;vertical-align:middle;">${metrics.notStarted}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  const remarksHtml = remarks
    ? `<p style="margin:16px 0;font:14px Arial,sans-serif;color:#334155;"><strong>Remarks:</strong> ${escapeHtml(remarks).replace(/\r?\n/g, '<br>')}</p>`
    : '';

  const html = [
    `<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;color:#1e293b;">`,
    `<p style="margin:0 0 10px 0;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#1e293b;">Dear Sir,</p>`,
    `<p style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;line-height:20px;color:#1e293b;">Safety First</p>`,
    `<p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#1e293b;"><strong>${escapeHtml(ptmLabel)}</strong> &mdash; <a href="${escapeHtml(ptmUrl)}" target="_blank" style="color:#2563eb;text-decoration:underline;font-weight:bold;">Click here to open</a></p>`,
    metricsHtml,
    remarksHtml,
    `</div>`,
  ].join('');

  return { html, ptmUrl };
}

function ensurePtmDefaultMailTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ptm_default_mail_recipients (
      user_id TEXT PRIMARY KEY,
      email_addresses TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function getPtmDefaultMails(req, res) {
  try {
    ensurePtmDefaultMailTable();
    const userId = resolveUserId(req);
    const row = db
      .prepare('SELECT email_addresses FROM ptm_default_mail_recipients WHERE user_id = ?')
      .get(userId);
    let stored = {};
    try {
      stored = row?.email_addresses ? JSON.parse(row.email_addresses) : {};
    } catch {
      stored = {};
    }
    const to = normalizeEmailList(Array.isArray(stored?.to) ? stored.to : []);
    const cc = normalizeEmailList(Array.isArray(stored?.cc) ? stored.cc : []);
    return res.json({
      success: true,
      data: { to, cc, emails: to },
      message: 'Default PTM mail addresses fetched.',
    });
  } catch (error) {
    logger.error(`[PTM_EMAIL] Failed to fetch default mails: ${error?.message}`);
    return res.status(500).json({ success: false, message: 'Could not load default mail addresses.' });
  }
}

export function savePtmDefaultMails(req, res) {
  try {
    ensurePtmDefaultMailTable();
    const userId = resolveUserId(req);
    const toIncoming = req.body?.to ?? req.body?.emails ?? [];
    const ccIncoming = req.body?.cc ?? [];
    if (!Array.isArray(toIncoming) || !Array.isArray(ccIncoming)) {
      return res.status(400).json({ success: false, message: 'To and CC email addresses must be provided as lists.' });
    }
    const to = [...new Set(toIncoming.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
    const cc = [...new Set(ccIncoming.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
    if ([...to, ...cc].some((email) => !EMAIL_PATTERN.test(email))) {
      return res.status(400).json({ success: false, message: 'Enter valid email addresses before saving.' });
    }

    const payload = JSON.stringify({ to, cc });
    const existing = db
      .prepare('SELECT user_id FROM ptm_default_mail_recipients WHERE user_id = ?')
      .get(userId);
    if (existing) {
      db.prepare('UPDATE ptm_default_mail_recipients SET email_addresses = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
        .run(payload, userId);
    } else {
      db.prepare('INSERT INTO ptm_default_mail_recipients (user_id, email_addresses) VALUES (?, ?)')
        .run(userId, payload);
    }

    return res.json({
      success: true,
      data: { to, cc, emails: to },
      message: 'Default PTM mail addresses saved.',
    });
  } catch (error) {
    logger.error(`[PTM_EMAIL] Failed to save default mails: ${error?.message}`);
    return res.status(500).json({ success: false, message: 'Could not save default mail addresses.' });
  }
}

export async function sendPtmEmail(req, res) {
  const userId = resolveUserId(req);
  const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return res.status(400).json({ success: false, message: 'A valid email request key is required.' });
  }

  pruneAttempts();
  const attemptKey = `${userId}:${idempotencyKey}`;
  const prior = attempts.get(attemptKey);
  if (prior) {
    return res.status(prior.status).json(prior.body);
  }

  let to = [];
  let cc = [];
  try {
    to = parseAddresses(req.body?.to, 'To');
    cc = parseAddresses(req.body?.cc, 'CC');
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }

  if (to.length > 50 || cc.length > 50) {
    return res.status(400).json({ success: false, message: 'A maximum of 50 recipients is allowed per field.' });
  }

  const remarks = String(req.body?.remarks || '').trim();
  if (remarks.length > 5000) {
    return res.status(400).json({ success: false, message: 'Remarks must be 5,000 characters or fewer.' });
  }

  const ptmSheet = req.body?.ptmSheet;
  if (!ptmSheet || (!ptmSheet.sheetKey && !ptmSheet.id)) {
    return res.status(400).json({ success: false, message: 'Select a valid PTM sheet before sending.' });
  }

  // Reserve idempotency key before SMTP send
  attempts.set(attemptKey, {
    status: 409,
    body: { success: false, data: { pending: true }, message: 'This email request is already being processed.' },
    expiresAt: Date.now() + ATTEMPT_TTL_MS,
  });

  try {
    let sheetRows = Array.isArray(ptmSheet.rows) ? ptmSheet.rows : null;
    if (ptmSheet.sheetKey) {
      const dbSheet = db
        .prepare('SELECT rows_data FROM ptm_sheets WHERE sheet_key = ?')
        .get(String(ptmSheet.sheetKey));
      if (dbSheet?.rows_data) {
        try {
          const parsedRows = JSON.parse(dbSheet.rows_data);
          if (Array.isArray(parsedRows)) sheetRows = parsedRows;
        } catch {
          // Fallback to client-provided rows if stored JSON is invalid
        }
      }
    }

    if (!hasSavedPtmRows(sheetRows)) {
      attempts.delete(attemptKey);
      return res.status(422).json({
        success: false,
        message: 'The selected PTM sheet has no saved table data. Save the sheet before sending.',
      });
    }

    const ptmMetrics = calculatePtmMetrics(sheetRows, ptmSheet.metrics);
    const effectiveBaseUrl =
      req.body?.portalBaseUrl ||
      req.headers?.origin ||
      ENV.ADMIN_URL ||
      ENV.FRONTEND_URL ||
      'http://localhost:5173';

    const { html, ptmUrl } = buildPtmEmailHtml(ptmSheet, effectiveBaseUrl, remarks, ptmMetrics);
    const subject = ptmSheet.title || ptmSheet.topic ? `PTM Sheet - ${ptmSheet.title || ptmSheet.topic}` : 'PTM Sheet';

    const info = await sendMail(to, subject, html, [], cc);
    const accepted = Array.isArray(info?.accepted) ? info.accepted.map(String) : [];
    const rejected = Array.isArray(info?.rejected) ? info.rejected.map(String) : [];
    const acceptedSet = new Set(accepted.map((address) => address.toLowerCase()));
    const unaccepted = to.filter((address) => !acceptedSet.has(address.toLowerCase()));
    const rejectedAddresses = [...new Set([...rejected, ...unaccepted])];

    if (rejectedAddresses.length) {
      attempts.delete(attemptKey);
      const body = {
        success: false,
        data: { accepted, rejected: rejectedAddresses },
        message: 'The email service rejected one or more recipients.',
      };
      logger.error(`[PTM_EMAIL] Provider rejected recipients user=${userId} accepted=${accepted.length} rejected=${rejectedAddresses.length}`);
      return res.status(502).json(body);
    }

    const body = {
      success: true,
      data: {
        messageId: info?.messageId || null,
        accepted,
        links: { ptm: ptmUrl },
      },
      message: 'Email accepted by the configured mail service.',
    };
    attempts.set(attemptKey, { status: 200, body, expiresAt: Date.now() + ATTEMPT_TTL_MS });
    logger.info(`[PTM_EMAIL] Provider accepted email user=${userId} recipients=${accepted.length} messageId=${info?.messageId || 'unknown'}`);
    return res.status(200).json(body);
  } catch (error) {
    attempts.delete(attemptKey);
    const statusCode = error?.statuscode || error?.statusCode || error?.status;
    if (statusCode && statusCode < 500) {
      return res.status(statusCode).json({ success: false, message: error.message });
    }
    logger.error(`[PTM_EMAIL] Send failed user=${userId} code=${error?.code || 'unknown'} message=${error?.message}`);
    const errorMessage =
      error?.code === 'SMTP_NOT_CONFIGURED'
        ? 'Email service is not configured. Contact your administrator.'
        : error?.message && !error.message.includes('Object')
        ? error.message
        : 'The email service could not accept this message. Please try again later.';
    return res.status(502).json({ success: false, message: errorMessage });
  }
}
