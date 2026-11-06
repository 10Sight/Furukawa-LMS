/**
 * ==============================================================================
 * Script: remove_suggestion_columns.js
 * Module: Suggestion Check Sheet - SQL Table Schema Update
 * Directory: Furukawa-LMS/Furukawa-LMS-main/server/scripts/
 * 
 * Purpose:
 *   Removes specified columns from the 'suggestion_checksheets' table:
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
 *   node scripts/remove_suggestion_columns.js
 * 
 * Optional CLI arguments:
 *   node scripts/remove_suggestion_columns.js --server=127.0.0.1 --database=dojo
 * ==============================================================================
 */

import sql from "mssql";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env and root .env
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

// Candidate databases to target
const CLI_DB = getArg("database", getArg("db", null));
const TARGET_DATABASES = CLI_DB 
  ? [CLI_DB] 
  : Array.from(new Set([process.env.DB_NAME, "dojo", "FurukawaLMS"].filter(Boolean)));

console.log("==============================================================================");
console.log("       SUGGESTION CHECKSHEETS SQL TABLE COLUMN REMOVAL SCRIPT                 ");
console.log("==============================================================================");
console.log(`Server Host : ${DB_HOST}`);
console.log(`Port        : ${DB_PORT}`);
console.log(`User        : ${DB_USER}`);
console.log(`Target DB(s): ${TARGET_DATABASES.join(", ")}`);
console.log("Columns to Remove: Description, Employee Code, Priority, rejectAccepted, Categories");
console.log("Column to Add    : Created by (createdBy) at the end of table");
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
    PRINT '[✓] Table suggestion_checksheets found in [${dbName}]. Starting cleanup...';

    -- 1. Drop all default constraints on target columns
    DECLARE @dropConstraints NVARCHAR(MAX) = N'';
    SELECT @dropConstraints += N'ALTER TABLE [dbo].[suggestion_checksheets] DROP CONSTRAINT [' + d.name + N'];' + CHAR(10)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
      AND c.name IN (N'description', N'employeeCode', N'employee_code', N'priority', N'rejectAccepted', N'rejectedAccepted', N'category', N'categories');

    -- 2. Drop all check constraints on target columns
    SELECT @dropConstraints += N'ALTER TABLE [dbo].[suggestion_checksheets] DROP CONSTRAINT [' + cc.name + N'];' + CHAR(10)
    FROM sys.check_constraints cc
    JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
    WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
      AND c.name IN (N'description', N'employeeCode', N'employee_code', N'priority', N'rejectAccepted', N'rejectedAccepted', N'category', N'categories');

    -- 3. Drop all non-PK indexes on target columns
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
        PRINT '  [✓] Successfully removed dependent constraints and indexes.';
    END

    -- 4. Drop the columns
    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'description') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [description];
        PRINT '  [✓] Dropped column: Description';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'employeeCode') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [employeeCode];
        PRINT '  [✓] Dropped column: Employee Code (employeeCode)';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'employee_code') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [employee_code];
        PRINT '  [✓] Dropped column: Employee Code (employee_code)';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'priority') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [priority];
        PRINT '  [✓] Dropped column: Priority';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'rejectAccepted') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [rejectAccepted];
        PRINT '  [✓] Dropped column: rejectAccepted';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'rejectedAccepted') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [rejectedAccepted];
        PRINT '  [✓] Dropped column: rejectedAccepted';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'category') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [category];
        PRINT '  [✓] Dropped column: category';
    END

    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'categories') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] DROP COLUMN [categories];
        PRINT '  [✓] Dropped column: categories';
    END

    -- 5. Add Created by at the end of the table
    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'createdBy') IS NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] ADD [createdBy] NVARCHAR(255) NULL;
        PRINT '  [✓] Added column: Created by (createdBy NVARCHAR(255) NULL) at the end of table.';
    END
    ELSE
    BEGIN
        PRINT '  [i] Column [createdBy] is already present at the end of table.';
    END
END
`;
}

async function migrateDatabase(dbName) {
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
    console.log(`\nConnecting to database [${dbName}] on [${DB_HOST}]...`);
    pool = await sql.connect(config);
    console.log(`[✓] Connected to [${dbName}].`);

    const sqlScript = buildMigrationSql(dbName);
    await pool.request().query(sqlScript);

    const colsResult = await pool.request().query(`
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

    if (colsResult.recordset && colsResult.recordset.length > 0) {
      console.log(`\nFinal Columns in [${dbName}].[dbo].[suggestion_checksheets]:`);
      console.table(colsResult.recordset);
      console.log(`[SUCCESS] Database [${dbName}] migration complete!\n`);
      return true;
    } else {
      console.log(`[!] Table suggestion_checksheets does not exist in [${dbName}].`);
      return false;
    }
  } catch (err) {
    console.warn(`[!] Connection or execution error for [${dbName}]: ${err.message}`);
    return false;
  } finally {
    if (pool) {
      try { await pool.close(); } catch {}
    }
  }
}

async function main() {
  let anySuccess = false;

  for (const dbName of TARGET_DATABASES) {
    const ok = await migrateDatabase(dbName);
    if (ok) anySuccess = true;
  }

  if (!anySuccess) {
    console.log("\n------------------------------------------------------------------------------");
    console.log("If your local Node script could not connect directly to SQL Server port,");
    console.log("you can execute the companion SQL script directly in SSMS on your machine:");
    console.log(`  File: Furukawa-LMS/Furukawa-LMS-main/server/scripts/remove_suggestion_columns.sql`);
    console.log("or run with command line flags:");
    console.log("  node scripts/remove_suggestion_columns.js --server=localhost --database=dojo");
    console.log("------------------------------------------------------------------------------\n");
  } else {
    console.log("\n==============================================================================");
    console.log("Table 'suggestion_checksheets' updated successfully!");
    console.log("==============================================================================\n");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("Migration fatal error:", e);
  process.exit(1);
});

