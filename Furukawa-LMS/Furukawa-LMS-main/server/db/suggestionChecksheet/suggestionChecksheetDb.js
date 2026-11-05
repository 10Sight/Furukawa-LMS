import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { executeQuery } from "../mssqlHelper.js";
import migrationHelper from "../migrationHelper.js";
import { poolPromise } from "../connectDB.js";
import logger from "../../logger/winston.logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SUGGESTION_STORE_PATH = path.join(__dirname, "suggestion_checksheet_store.json");

const DUMMY_RECORD_IDS = new Set([
  'SC-BWL-1021',
  'SC-BWL-1024',
  'SC-BWL-1029',
  'SC-GJT-2015',
  'SC-GJT-2018',
  'SC-GJR-2015',
]);

export const SEED_SUGGESTION_CHECKSHETS = [];

/**
 * Checks if central MSSQL pool is connected and active
 */
export async function isDbConnected() {
  try {
    const pool = await poolPromise;
    return Boolean(pool);
  } catch {
    return false;
  }
}

/**
 * Reads Suggestion Checksheet fallback JSON store from disk
 */
export function readSuggestionStore() {
  try {
    if (fs.existsSync(SUGGESTION_STORE_PATH)) {
      const raw = fs.readFileSync(SUGGESTION_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((r) => !DUMMY_RECORD_IDS.has(r?.id));
        if (clean.length !== parsed.length) {
          writeSuggestionStore(clean);
        }
        return clean;
      }
    }
  } catch (e) {
    logger.warn("Failed reading Suggestion Checksheet persistence store:", e.message);
  }
  return [];
}

/**
 * Writes Suggestion Checksheet persistent data to disk
 */
export function writeSuggestionStore(records) {
  try {
    const dir = path.dirname(SUGGESTION_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const clean = Array.isArray(records) ? records.filter((r) => !DUMMY_RECORD_IDS.has(r?.id)) : [];
    fs.writeFileSync(SUGGESTION_STORE_PATH, JSON.stringify(clean, null, 2), "utf-8");
  } catch (e) {
    logger.error("Failed writing Suggestion Checksheet persistence store:", e.message);
  }
}

/**
 * Ensures suggestion_checksheets table and indexes exist in SQL Server
 */
export async function initSuggestionChecksheetTables() {
  const connected = await isDbConnected();
  if (!connected) {
    logger.warn("MSSQL not connected; Suggestion Checksheet module will use fallback persistent disk store.");
    return;
  }

  try {
    const tableExists = await migrationHelper.tableExists('suggestion_checksheets');
    if (!tableExists) {
      await executeQuery(`
        CREATE TABLE suggestion_checksheets (
          id INT IDENTITY(1,1) PRIMARY KEY,
          checksheetId NVARCHAR(100) NOT NULL UNIQUE,
          date NVARCHAR(50) NULL,
          unit NVARCHAR(100) NOT NULL DEFAULT 'Bawal',
          department NVARCHAR(255) NULL,
          departmentId NVARCHAR(100) NULL,
          section NVARCHAR(255) NULL,
          sectionId NVARCHAR(100) NULL,
          lineArea NVARCHAR(255) NULL,
          lineAreaId NVARCHAR(100) NULL,
          title NVARCHAR(500) NULL,
          description NVARCHAR(MAX) NULL,
          problemText NVARCHAR(MAX) NULL,
          suggestionText NVARCHAR(MAX) NULL,
          category NVARCHAR(100) NULL,
          submittedBy NVARCHAR(255) NULL,
          employeeCode NVARCHAR(100) NULL,
          employeeName NVARCHAR(255) NULL,
          status NVARCHAR(100) NOT NULL DEFAULT 'Pending',
          priority NVARCHAR(50) NOT NULL DEFAULT 'Medium',
          isBlank BIT NOT NULL DEFAULT 1,
          isBest BIT NOT NULL DEFAULT 0,
          defectPreventionRank INT NULL,
          rejectedAccepted NVARCHAR(100) NULL,
          reasonIfRejected NVARCHAR(MAX) NULL,
          targetDate NVARCHAR(50) NULL,
          dateOfImplementation NVARCHAR(50) NULL,
          lineLeaderSign1 NVARCHAR(255) NULL,
          lineLeaderSign2 NVARCHAR(255) NULL,
          approvalDate NVARCHAR(50) NULL,
          costSaving NVARCHAR(255) NULL,
          benefitDetails NVARCHAR(MAX) NULL,
          categoryP BIT NOT NULL DEFAULT 0,
          categoryQ BIT NOT NULL DEFAULT 0,
          categoryC BIT NOT NULL DEFAULT 0,
          categoryD BIT NOT NULL DEFAULT 0,
          categoryM BIT NOT NULL DEFAULT 0,
          categoryS BIT NOT NULL DEFAULT 0,
          category5S BIT NOT NULL DEFAULT 0,
          isDeleted BIT NOT NULL DEFAULT 0,
          createdAt DATETIME NOT NULL DEFAULT GETDATE(),
          updatedAt DATETIME NOT NULL DEFAULT GETDATE()
        )
      `);
      logger.info("Successfully created 'suggestion_checksheets' table in SQL Server.");

      await migrationHelper.ensureIndexExists(
        'suggestion_checksheets',
        'idx_suggestion_checksheetId',
        'CREATE UNIQUE INDEX idx_suggestion_checksheetId ON suggestion_checksheets(checksheetId)'
      );

      await migrationHelper.ensureIndexExists(
        'suggestion_checksheets',
        'idx_suggestion_unit_status',
        'CREATE INDEX idx_suggestion_unit_status ON suggestion_checksheets(unit, status)'
      );

      await migrationHelper.ensureIndexExists(
        'suggestion_checksheets',
        'idx_suggestion_isBest',
        'CREATE INDEX idx_suggestion_isBest ON suggestion_checksheets(isBest)'
      );
    } else {
      // Ensure defectPreventionRank and other newly added columns exist
      await migrationHelper.ensureColumnExists('suggestion_checksheets', 'defectPreventionRank', 'INT NULL');
      await migrationHelper.ensureColumnExists('suggestion_checksheets', 'isBest', 'BIT NOT NULL DEFAULT 0');
      await migrationHelper.ensureColumnExists('suggestion_checksheets', 'problemText', 'NVARCHAR(MAX) NULL');
      await migrationHelper.ensureColumnExists('suggestion_checksheets', 'suggestionText', 'NVARCHAR(MAX) NULL');
    }

    // Seed existing disk store records into SQL table if not already present
    await seedJsonStoreToSql();
  } catch (error) {
    logger.error("Error initializing 'suggestion_checksheets' table in SQL Server:", error.message);
  }
}

/**
 * Seeds or syncs non-dummy records from JSON store into SQL Server table
 */
async function seedJsonStoreToSql() {
  try {
    const storeRecords = readSuggestionStore();
    if (!storeRecords || storeRecords.length === 0) return;

    for (const rec of storeRecords) {
      if (!rec.id || DUMMY_RECORD_IDS.has(rec.id)) continue;
      const [existing] = await executeQuery(
        "SELECT id FROM suggestion_checksheets WHERE checksheetId = ?",
        [rec.id]
      );

      if (!existing || existing.length === 0) {
        await executeQuery(`
          INSERT INTO suggestion_checksheets (
            checksheetId, date, unit, department, departmentId, section, sectionId, lineArea, lineAreaId,
            title, description, problemText, suggestionText, category, submittedBy, employeeCode, employeeName,
            status, priority, isBlank, isBest, defectPreventionRank, rejectedAccepted, reasonIfRejected,
            targetDate, dateOfImplementation, lineLeaderSign1, lineLeaderSign2, approvalDate, costSaving, benefitDetails,
            categoryP, categoryQ, categoryC, categoryD, categoryM, categoryS, category5S, isDeleted
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, 0
          )
        `, [
          rec.id,
          rec.date || null,
          rec.unit || 'Bawal',
          rec.department || null,
          rec.departmentId || null,
          rec.section || null,
          rec.sectionId || null,
          rec.lineArea || null,
          rec.lineAreaId || null,
          rec.title || null,
          rec.description || null,
          rec.problemText || null,
          rec.suggestionText || null,
          rec.category || null,
          rec.submittedBy || null,
          rec.employeeCode || null,
          rec.employeeName || null,
          rec.status || 'Pending',
          rec.priority || 'Medium',
          rec.isBlank ? 1 : 0,
          rec.isBest ? 1 : 0,
          rec.defectPreventionRank || null,
          rec.rejectedAccepted || null,
          rec.reasonIfRejected || null,
          rec.targetDate || null,
          rec.dateOfImplementation || null,
          rec.lineLeaderSign1 || null,
          rec.lineLeaderSign2 || null,
          rec.approvalDate || null,
          rec.costSaving || null,
          rec.benefitDetails || null,
          rec.categoryP ? 1 : 0,
          rec.categoryQ ? 1 : 0,
          rec.categoryC ? 1 : 0,
          rec.categoryD ? 1 : 0,
          rec.categoryM ? 1 : 0,
          rec.categoryS ? 1 : 0,
          rec.category5S ? 1 : 0,
        ]);
        logger.info(`Seeded suggestion checksheet ${rec.id} into SQL Server.`);
      }
    }
  } catch (err) {
    logger.warn("Syncing suggestion checksheet records to SQL Server:", err.message);
  }
}

export { executeQuery, migrationHelper, poolPromise };
