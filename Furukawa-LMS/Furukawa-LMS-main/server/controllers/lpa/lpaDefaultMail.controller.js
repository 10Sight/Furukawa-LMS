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
const getDepartment = (value) => {
  const department = String(value || 'assembly').trim().toLowerCase();
  if (!['assembly', 'cc'].includes(department)) {
    throw new ApiError("Department must be either 'assembly' or 'cc'.", 400);
  }
  return department;
};

const readDefaultMailConfiguration = async (userId) => {
  await ensureDefaultMailTable();
  const [rows] = await executeQuery("SELECT emailAddresses FROM dbo.lpa_default_mail_recipients WHERE userId = ?", [String(userId)]);
  let stored = {};
  try { stored = rows[0]?.emailAddresses ? JSON.parse(rows[0].emailAddresses) : {}; } catch { stored = {}; }
  if (!stored || typeof stored !== 'object') stored = {};
  const normalize = (addresses) => [...new Map(addresses
    .map(email => String(email).trim())
    .filter(email => validEmail(email))
    .map(email => [email.toLowerCase(), email])).values()];
  const normalizeDepartment = (value) => ({
    to: normalize(Array.isArray(value?.to) ? value.to : []),
    cc: normalize(Array.isArray(value?.cc) ? value.cc : [])
  });

  // Migrate the previous shared format to Assembly only, so legacy recipients
  // remain available without exposing them in C&C.
  if (Array.isArray(stored) || Array.isArray(stored.to) || Array.isArray(stored.cc)) {
    return {
      assembly: normalizeDepartment({ to: Array.isArray(stored) ? stored : stored.to, cc: stored.cc }),
      cc: { to: [], cc: [] }
    };
  }
  return {
    assembly: normalizeDepartment(stored.assembly),
    cc: normalizeDepartment(stored.cc)
  };
};

export const getDefaultMailRecipients = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) throw new ApiError("A signed-in user is required to access default mail addresses.", 401);
  const department = getDepartment(req.query?.department);
  const { to, cc } = (await readDefaultMailConfiguration(userId))[department];
  res.json(new ApiResponse(200, { to, cc, emails: to }, "Default mail addresses fetched."));
});

// Return the configured recipient lists for the popup's explicit Attach action.
// This does not modify saved configuration or any manually selected recipients.
export const attachDefaultMailRecipients = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) throw new ApiError("A signed-in user is required to attach default mail addresses.", 401);
  const department = getDepartment(req.body?.department);
  const { to, cc } = (await readDefaultMailConfiguration(userId))[department];
  res.json(new ApiResponse(200, { to, cc, emails: to }, "Default mail addresses ready to attach."));
});

export const saveDefaultMailRecipients = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) throw new ApiError("A signed-in user is required to save default mail addresses.", 401);
  const department = getDepartment(req.body?.department);
  const toIncoming = req.body?.to ?? req.body?.emails;
  const ccIncoming = req.body?.cc ?? [];
  if (!Array.isArray(toIncoming) || !Array.isArray(ccIncoming)) throw new ApiError("To and CC email addresses must be provided as lists.", 400);
  const normalize = (addresses) => [...new Set(addresses.map((email) => String(email).trim().toLowerCase()).filter(Boolean))];
  const to = normalize(toIncoming);
  const cc = normalize(ccIncoming);
  if ([...to, ...cc].some((email) => !validEmail(email))) throw new ApiError("Enter valid email addresses before saving.", 400);
  const configuration = await readDefaultMailConfiguration(userId);
  configuration[department] = { to, cc };
  const emailLists = JSON.stringify(configuration);
  await ensureDefaultMailTable();
  const [existing] = await executeQuery("SELECT userId FROM dbo.lpa_default_mail_recipients WHERE userId = ?", [String(userId)]);
  if (existing.length) {
    await executeQuery("UPDATE dbo.lpa_default_mail_recipients SET emailAddresses = ?, updatedAt = GETDATE() WHERE userId = ?", [emailLists, String(userId)]);
  } else {
    await executeQuery("INSERT INTO dbo.lpa_default_mail_recipients (userId, emailAddresses) VALUES (?, ?)", [String(userId), emailLists]);
  }
  res.json(new ApiResponse(200, { to, cc, emails: to }, "Default mail addresses saved."));
});
