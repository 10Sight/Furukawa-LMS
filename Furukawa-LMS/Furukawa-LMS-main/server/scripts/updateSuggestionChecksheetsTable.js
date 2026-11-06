/**
 * ==============================================================================
 * Script: updateSuggestionChecksheetsTable.js
 * Module: Suggestion Check Sheet - SQL Table Schema Migration
 * Directory: Furukawa-LMS/Furukawa-LMS-main/server/scripts/
 * 
 * Purpose:
 *   Removes specified deprecated columns from the 'suggestion_checksheets' table:
 *     - Description (description)
 *     - Employee Code (employeeCode / employee_code)
 *     - Priority (priority)
 *     - rejectAccepted (rejectAccepted / rejectedAccepted)
 *     - Categories (category / categories)
 *   Adds the column:
 *     - Created by (createdBy NVARCHAR(255) NULL) at the end of the table.
 * 
 * Usage:
 *   cd Furukawa-LMS/Furukawa-LMS-main/server
 *   node scripts/updateSuggestionChecksheetsTable.js
 * 
 * Optional CLI arguments:
 *   node scripts/updateSuggestionChecksheetsTable.js --server=127.0.0.1 --database=dojo
 * ==============================================================================
 */

import sql from "mssql";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

function getArg(name, fallback) {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (match) return match.split("=")[1];
  return fallback;
}

const DB_HOST = getArg("server", getArg("host", process.env.DB_HOST || "127.0.0.1"));
const DB_USER = getArg("user", process.env.DB_USER || "sa");
const DB_PASSWORD = getArg("password", process.env.DB_PASSWORD || "Password123!");
const DB_PORT = parseInt(getArg("port", process.env.DB_PORT || "1433"), 10);

const CLI_DB = getArg("database", getArg("db", null));
const TARGET_DATABASES = CLI_DB 
  ? [CLI_DB] 
  : Array.from(new Set([process.env.DB_NAME, "dojo", "FurukawaLMS"].filter(Boolean)));

console.log("==============================================================================");
console.log("       SUGGESTION CHECKSHEETS SQL TABLE MIGRATION (CLEANUP & ADD)             ");
console.log("==============================================================================");
console.log(`Server Host : ${DB_HOST}`);
console.log(`Port        : ${DB_PORT}`);
console.log(`User        : ${DB_USER}`);
console.log(`Target DB(s): ${TARGET_DATABASES.join(", ")}`);
console.log("------------------------------------------------------------------------------\n");

function buildMigrationSql(dbName) {
  return `
USE [${dbName}];

IF OBJECT_ID(N'[dbo].[suggestion_checksheets]', N'U') IS NULL
BEGIN
    PRINT '[!] Table suggestion_checksheets does not exist in [${dbName}].';
END
ELSE
BEGIN
    PRINT '[✓] Found table suggestion_checksheets in [${dbName}]. Cleaning up columns...';

    -- Drop constraints & indexes on target columns
    DECLARE @dropConstraints NVARCHAR(MAX) = N'';
    SELECT @dropConstraints += N'ALTER TABLE [dbo].[suggestion_checksheets] DROP CONSTRAINT [' + d.name + N'];' + CHAR(10)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
      AND c.name IN (N'description', N'employeeCode', N'employee_code', N'priority', N'rejectAccepted', N'rejectedAccepted', N'category', N'categories');

    SELECT @dropConstraints += N'ALTER TABLE [dbo].[suggestion_checksheets] DROP CONSTRAINT [' + cc.name + N'];' + CHAR(10)
    FROM sys.check_constraints cc
    JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
    WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
      AND c.name IN (N'description', N'employeeCode', N'employee_code', N'priority', N'rejectAccepted', N'rejectedAccepted', N'category', N'categories');

    SELECT @dropConstraints += N'DROP INDEX [' + i.name + N'] ON [dbo].[suggestion_checksheets];' + CHAR(10)
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
      AND i.is_primary_key = 0
      AND c.name IN (N'description', N'employeeCode', N'employee_code', N'priority', N'rejectAccepted', N'rejectedAccepted', N'category', N'categories');

    IF @dropConstraints <> N''
    BEGIN
        EXEC sp_executesql @dropConstraints;
        PRINT '  [✓] Constraints/indexes dropped.';
    END

    -- Drop columns
    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'description') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [description];
        PRINT '  [✓] Dropped column: [description]';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'employeeCode') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [employeeCode];
        PRINT '  [✓] Dropped column: [employeeCode]';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'employee_code') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [employee_code];
        PRINT '  [✓] Dropped column: [employee_code]';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'priority') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [priority];
        PRINT '  [✓] Dropped column: [priority]';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'rejectAccepted') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [rejectAccepted];
        PRINT '  [✓] Dropped column: [rejectAccepted]';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'rejectedAccepted') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [rejectedAccepted];
        PRINT '  [✓] Dropped column: [rejectedAccepted]';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'category') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [category];
        PRINT '  [✓] Dropped column: [category]';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'categories') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [categories];
        PRINT '  [✓] Dropped column: [categories]';
    END

    -- Add createdBy at end
    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'createdBy') IS NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] ADD [createdBy] NVARCHAR(255) NULL;
        PRINT '  [✓] Added column: [createdBy] at the end of table.';
    END
    ELSE
    BEGIN
        PRINT '  [i] Column [createdBy] already present.';
    END
END
`;
}

async function run() {
  let anySuccess = false;

  for (const dbName of TARGET_DATABASES) {
    const config = {
      server: DB_HOST,
      database: dbName,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 8000,
      },
    };

    let pool;
    try {
      console.log(`Connecting to [${dbName}]...`);
      pool = await sql.connect(config);
      await pool.request().query(buildMigrationSql(dbName));

      const cols = await pool.request().query(`
        SELECT 
          c.column_id AS [Order], 
          c.name AS [Column Name], 
          t.name AS [Data Type], 
          c.max_length AS [Length],
          CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS [Nullable]
        FROM sys.columns c
        JOIN sys.types t ON c.user_type_id = t.user_type_id
        WHERE c.object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
        ORDER BY c.column_id ASC;
      `);

      if (cols.recordset && cols.recordset.length > 0) {
        console.log(`\nColumns in [${dbName}].[dbo].[suggestion_checksheets]:`);
        console.table(cols.recordset);
        anySuccess = true;
      }
    } catch (e) {
      console.warn(`[Notice] Could not process [${dbName}]: ${e.message}`);
    } finally {
      if (pool) {
        try { await pool.close(); } catch {}
      }
    }
  }

  if (anySuccess) {
    console.log("\n[SUCCESS] Table schema migration completed successfully!\n");
  } else {
    console.log("\n[!] If connection timed out, run directly in SSMS using:");
    console.log(`    scripts/remove_suggestion_columns.sql\n`);
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
