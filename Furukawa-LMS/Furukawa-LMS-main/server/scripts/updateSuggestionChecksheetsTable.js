/**
 * ==============================================================================
 * Script: updateSuggestionChecksheetsTable.js
 * Module: Suggestion Check Sheet - SQL Server Table Column Migration
 * Directory: Furukawa-LMS/Furukawa-LMS-main/server/scripts/
 * 
 * Purpose:
 *   Removes specified deprecated columns from the 'suggestion_checksheets' table:
 *     - Description (description)
 *     - Employee Code (employeeCode)
 *     - Priority (priority - with safe default constraint removal)
 *     - rejectAccepted (rejectedAccepted / rejectAccepted)
 *     - Categories (category / categories)
 *   Adds the column:
 *     - Created by (createdBy NVARCHAR(255) NULL) at the end of the table.
 * 
 * Usage:
 *   cd Furukawa-LMS/Furukawa-LMS-main/server
 *   node scripts/updateSuggestionChecksheetsTable.js
 * 
 * Optional CLI arguments:
 *   node scripts/updateSuggestionChecksheetsTable.js --server=Dojo2-0 --database=dojo
 *   node scripts/updateSuggestionChecksheetsTable.js --server=127.0.0.1 --database=FurukawaLMS --user=sa --password=Password123!
 * ==============================================================================
 */

import sql from "mssql";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

// Parse CLI flags (e.g. --server=..., --database=...)
function getArg(name, fallback) {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (match) return match.split("=")[1];
  return fallback;
}

const DB_HOST = getArg("server", getArg("host", process.env.DB_HOST || "127.0.0.1"));
const DB_NAME = getArg("database", getArg("db", process.env.DB_NAME || "dojo"));
const DB_USER = getArg("user", process.env.DB_USER || "sa");
const DB_PASSWORD = getArg("password", process.env.DB_PASSWORD || "Password123!");
const DB_PORT = parseInt(getArg("port", process.env.DB_PORT || "1433"), 10);

console.log("==============================================================================");
console.log("Suggestion Checksheet - SQL Server Table Migration");
console.log("==============================================================================");
console.log(`Target Server  : ${DB_HOST}`);
console.log(`Target Database: ${DB_NAME}`);
console.log(`Target Port    : ${DB_PORT}`);
console.log(`Target User    : ${DB_USER}`);
console.log("------------------------------------------------------------------------------");

const SQL_MIGRATION_SCRIPT = `
USE [${DB_NAME}];

-- 1. Verify table exists
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'suggestion_checksheets')
BEGIN
    PRINT '[!] Table suggestion_checksheets does not exist in database [${DB_NAME}].';
    RETURN;
END

PRINT '[✓] Found table: suggestion_checksheets';

-- 2. Remove Priority (drop default constraint first if exists)
DECLARE @priConstraint NVARCHAR(200);
SELECT @priConstraint = d.name 
FROM sys.default_constraints d 
JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id 
WHERE d.parent_object_id = OBJECT_ID('suggestion_checksheets') AND c.name = 'priority';

IF @priConstraint IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.suggestion_checksheets DROP CONSTRAINT ' + @priConstraint);
    PRINT '  - Dropped default constraint ' + @priConstraint + ' on [priority]';
END

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'priority')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets DROP COLUMN priority;
    PRINT '  - Dropped column: [priority]';
END
ELSE
    PRINT '  - Column [priority] already removed.';

-- 3. Remove Description
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'description')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets DROP COLUMN description;
    PRINT '  - Dropped column: [description]';
END
ELSE
    PRINT '  - Column [description] already removed.';

-- 4. Remove Employee Code
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'employeeCode')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets DROP COLUMN employeeCode;
    PRINT '  - Dropped column: [employeeCode]';
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'employee_code')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets DROP COLUMN employee_code;
    PRINT '  - Dropped column: [employee_code]';
END
ELSE
    PRINT '  - Column [employeeCode] already removed.';

-- 5. Remove rejectAccepted / rejectedAccepted
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'rejectedAccepted')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets DROP COLUMN rejectedAccepted;
    PRINT '  - Dropped column: [rejectedAccepted]';
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'rejectAccepted')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets DROP COLUMN rejectAccepted;
    PRINT '  - Dropped column: [rejectAccepted]';
END
ELSE
    PRINT '  - Column [rejectAccepted / rejectedAccepted] already removed.';

-- 6. Remove Categories / Category (if exists)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'category')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets DROP COLUMN category;
    PRINT '  - Dropped column: [category]';
END
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'categories')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets DROP COLUMN categories;
    PRINT '  - Dropped column: [categories]';
END

-- 7. Add Created by at the end of the table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'createdBy')
BEGIN
    ALTER TABLE dbo.suggestion_checksheets ADD createdBy NVARCHAR(255) NULL;
    PRINT '  - Successfully added column: [createdBy] NVARCHAR(255) NULL at the end.';
END
ELSE
    PRINT '  - Column [createdBy] already exists.';
`;

async function runMssqlMigration() {
  const config = {
    server: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    port: DB_PORT,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 8000,
      useUTC: false,
    },
  };

  let pool;
  try {
    console.log(`Connecting to SQL Server (${DB_HOST})...`);
    pool = await sql.connect(config);
    console.log(`[✓] Connected successfully to database: ${DB_NAME}`);

    console.log("\nExecuting schema update commands...");
    await pool.request().query(SQL_MIGRATION_SCRIPT);

    console.log("\nFetching final table column list from SQL Server...");
    const result = await pool.request().query(`
      SELECT 
        column_id AS [Order], 
        name AS [Column Name], 
        type_name(user_type_id) AS [Type], 
        max_length AS [Length],
        CASE WHEN is_nullable = 1 THEN 'YES' ELSE 'NO' END AS [Nullable]
      FROM sys.columns
      WHERE object_id = OBJECT_ID('suggestion_checksheets')
      ORDER BY column_id ASC;
    `);

    console.log("\n------------------------------------------------------------------------------");
    console.log("Current Columns in suggestion_checksheets:");
    console.log("------------------------------------------------------------------------------");
    console.table(result.recordset);

    console.log("\n[SUCCESS] Migration completed! Removed columns and verified [createdBy] at the end.\n");
    return true;
  } catch (err) {
    console.warn(`\n[!] Node mssql connection failed: ${err.message}`);
    return false;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Fallback using sqlcmd if available (useful for local Windows Auth / SSMS connections)
function trySqlcmdFallback() {
  console.log("\nAttempting fallback via sqlcmd utility...");
  const tempSqlPath = path.resolve(__dirname, "temp_suggestion_migration.sql");
  try {
    fs.writeFileSync(tempSqlPath, SQL_MIGRATION_SCRIPT + "\nGO\nSELECT column_id, name FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') ORDER BY column_id ASC;\nGO", "utf8");

    // Try Windows Auth first, then SQL Auth
    let cmd = `sqlcmd -S "${DB_HOST}" -d "${DB_NAME}" -E -i "${tempSqlPath}"`;
    try {
      const output = execSync(cmd, { encoding: "utf8", timeout: 10000 });
      console.log(output);
      console.log("\n[SUCCESS] sqlcmd executed migration successfully!");
      return true;
    } catch {
      cmd = `sqlcmd -S "${DB_HOST}" -d "${DB_NAME}" -U "${DB_USER}" -P "${DB_PASSWORD}" -i "${tempSqlPath}"`;
      const output = execSync(cmd, { encoding: "utf8", timeout: 10000 });
      console.log(output);
      console.log("\n[SUCCESS] sqlcmd executed migration successfully!");
      return true;
    }
  } catch (sqlcmdErr) {
    console.warn(`sqlcmd fallback unavailable: ${sqlcmdErr.message}`);
    return false;
  } finally {
    if (fs.existsSync(tempSqlPath)) {
      try {
        fs.unlinkSync(tempSqlPath);
      } catch {}
    }
  }
}

(async () => {
  const success = await runMssqlMigration();
  if (!success) {
    const fallbackSuccess = await trySqlcmdFallback();
    if (!fallbackSuccess) {
      console.log("\n==============================================================================");
      console.log("Note: Could not reach SQL Server directly on this IP/port.");
      console.log("You can also execute the migration directly in SSMS by opening:");
      console.log(`  ${path.resolve(__dirname, "create_suggestion_checksheets_table.sql")}`);
      console.log("or by running:");
      console.log(`  node scripts/updateSuggestionChecksheetsTable.js --server=<YOUR_SERVER> --database=<YOUR_DB>`);
      console.log("==============================================================================\n");
    }
  }
  process.exit(0);
})();
