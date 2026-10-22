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

export const getDefaultMailRecipients = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) throw new ApiError("A signed-in user is required to access default mail addresses.", 401);
  await ensureDefaultMailTable();
  const [rows] = await executeQuery("SELECT emailAddresses FROM dbo.lpa_default_mail_recipients WHERE userId = ?", [String(userId)]);
  let emails = [];
  try { emails = rows[0]?.emailAddresses ? JSON.parse(rows[0].emailAddresses) : []; } catch { emails = []; }
  res.json(new ApiResponse(200, { emails: Array.isArray(emails) ? emails : [] }, "Default mail addresses fetched."));
});

export const saveDefaultMailRecipients = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) throw new ApiError("A signed-in user is required to save default mail addresses.", 401);
  const incoming = req.body?.emails;
  if (!Array.isArray(incoming)) throw new ApiError("Email addresses must be provided as a list.", 400);
  const emails = [...new Set(incoming.map((email) => String(email).trim().toLowerCase()).filter(Boolean))];
  if (emails.some((email) => !validEmail(email))) throw new ApiError("Enter valid email addresses before saving.", 400);

  await ensureDefaultMailTable();
  const [existing] = await executeQuery("SELECT userId FROM dbo.lpa_default_mail_recipients WHERE userId = ?", [String(userId)]);
  if (existing.length) {
    await executeQuery("UPDATE dbo.lpa_default_mail_recipients SET emailAddresses = ?, updatedAt = GETDATE() WHERE userId = ?", [JSON.stringify(emails), String(userId)]);
  } else {
    await executeQuery("INSERT INTO dbo.lpa_default_mail_recipients (userId, emailAddresses) VALUES (?, ?)", [String(userId), JSON.stringify(emails)]);
  }
  res.json(new ApiResponse(200, { emails }, "Default mail addresses saved."));
});
