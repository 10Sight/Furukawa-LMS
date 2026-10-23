import { executeQuery } from "../../db/mssqlHelper.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const ensureDefaultMailTable = async () => {
  await executeQuery(`
    IF OBJECT_ID('dbo.lpa_default_mail_recipients', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.lpa_default_mail_recipients (
        userId NVARCHAR(255) NOT NULL PRIMARY KEY,
        emailAddresses NVARCHAR(MAX) NOT NULL,
        updatedAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    END
  `);
};

const getUserId = (req) => req.user?.id ?? req.user?._id ?? req.user?.userId;
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const readDefaultMailLists = async (userId) => {
  await ensureDefaultMailTable();
  const [rows] = await executeQuery("SELECT emailAddresses FROM dbo.lpa_default_mail_recipients WHERE userId = ?", [String(userId)]);
  let stored = {};
  try { stored = rows[0]?.emailAddresses ? JSON.parse(rows[0].emailAddresses) : {}; } catch { stored = {}; }
  // Older saved data was a single To list; continue to expose it as To defaults.
  const toSource = Array.isArray(stored) ? stored : (Array.isArray(stored.to) ? stored.to : []);
  const ccSource = Array.isArray(stored.cc) ? stored.cc : [];
  const normalize = (addresses) => [...new Map(addresses
    .map(email => String(email).trim())
    .filter(email => validEmail(email))
    .map(email => [email.toLowerCase(), email])).values()];
  return { to: normalize(toSource), cc: normalize(ccSource) };
};

export const getDefaultMailRecipients = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) throw new ApiError("A signed-in user is required to access default mail addresses.", 401);
  const { to, cc } = await readDefaultMailLists(userId);
  res.json(new ApiResponse(200, { to, cc, emails: to }, "Default mail addresses fetched."));
});

// Return the configured recipient lists for the popup's explicit Attach action.
// This does not modify saved configuration or any manually selected recipients.
export const attachDefaultMailRecipients = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) throw new ApiError("A signed-in user is required to attach default mail addresses.", 401);
  const { to, cc } = await readDefaultMailLists(userId);
  res.json(new ApiResponse(200, { to, cc, emails: to }, "Default mail addresses ready to attach."));
});

export const saveDefaultMailRecipients = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) throw new ApiError("A signed-in user is required to save default mail addresses.", 401);
  const toIncoming = req.body?.to ?? req.body?.emails;
  const ccIncoming = req.body?.cc ?? [];
  if (!Array.isArray(toIncoming) || !Array.isArray(ccIncoming)) throw new ApiError("To and CC email addresses must be provided as lists.", 400);
  const normalize = (addresses) => [...new Set(addresses.map((email) => String(email).trim().toLowerCase()).filter(Boolean))];
  const to = normalize(toIncoming);
  const cc = normalize(ccIncoming);
  if ([...to, ...cc].some((email) => !validEmail(email))) throw new ApiError("Enter valid email addresses before saving.", 400);
  const emailLists = JSON.stringify({ to, cc });

  await ensureDefaultMailTable();
  const [existing] = await executeQuery("SELECT userId FROM dbo.lpa_default_mail_recipients WHERE userId = ?", [String(userId)]);
  if (existing.length) {
    await executeQuery("UPDATE dbo.lpa_default_mail_recipients SET emailAddresses = ?, updatedAt = GETDATE() WHERE userId = ?", [emailLists, String(userId)]);
  } else {
    await executeQuery("INSERT INTO dbo.lpa_default_mail_recipients (userId, emailAddresses) VALUES (?, ?)", [String(userId), emailLists]);
  }
  res.json(new ApiResponse(200, { to, cc, emails: to }, "Default mail addresses saved."));
});
