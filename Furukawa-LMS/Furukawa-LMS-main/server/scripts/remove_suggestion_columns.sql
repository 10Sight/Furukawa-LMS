-- ==============================================================================
-- SQL Script: remove_suggestion_columns.sql
-- Module: Suggestion Check Sheet - SQL Table Column Removal & Addition
-- Directory: Furukawa-LMS/Furukawa-LMS-main/server/scripts/
--
-- Instructions:
--   1. Open this file in SQL Server Management Studio (SSMS).
--   2. Click 'Execute' (or press F5).
--   3. It will safely drop all constraints and remove:
--        - Description
--        - Categories
--        - Employee Code
--        - Priority
--        - rejectAccepted
--      And ensure 'Created by' (createdBy) is added at the end.
-- ==============================================================================

USE [dojo];
GO

-- 1. Check if table exists
IF OBJECT_ID(N'[dbo].[suggestion_checksheets]', N'U') IS NULL
BEGIN
    PRINT '[!] Table suggestion_checksheets does not exist in database dojo.';
END
ELSE
BEGIN
    PRINT '[✓] Found table suggestion_checksheets in database dojo.';

    -- 2. Drop all default constraints referencing target columns
    DECLARE @dropConstraintSql NVARCHAR(MAX) = N'';

    SELECT @dropConstraintSql += N'ALTER TABLE [dbo].[suggestion_checksheets] DROP CONSTRAINT [' + d.name + N'];' + CHAR(10)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
      AND c.name IN (N'description', N'employeeCode', N'employee_code', N'priority', N'rejectAccepted', N'rejectedAccepted', N'category', N'categories');

    -- 3. Drop all check constraints referencing target columns
    SELECT @dropConstraintSql += N'ALTER TABLE [dbo].[suggestion_checksheets] DROP CONSTRAINT [' + cc.name + N'];' + CHAR(10)
    FROM sys.check_constraints cc
    JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
    WHERE cc.parent_object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
      AND c.name IN (N'description', N'employeeCode', N'employee_code', N'priority', N'rejectAccepted', N'rejectedAccepted', N'category', N'categories');

    -- 4. Drop all non-PK indexes referencing target columns
    SELECT @dropConstraintSql += N'DROP INDEX [' + i.name + N'] ON [dbo].[suggestion_checksheets];' + CHAR(10)
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID(N'[dbo].[suggestion_checksheets]')
      AND i.is_primary_key = 0
      AND c.name IN (N'description', N'employeeCode', N'employee_code', N'priority', N'rejectAccepted', N'rejectedAccepted', N'category', N'categories');

    IF @dropConstraintSql <> N''
    BEGIN
        EXEC sp_executesql @dropConstraintSql;
        PRINT '  [✓] Successfully dropped all dependent constraints and indexes.';
    END

    -- 5. Drop the specified columns
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

    -- 6. Add Created by at the end of the table
    IF COL_LENGTH(N'[dbo].[suggestion_checksheets]', N'createdBy') IS NULL
    BEGIN
        ALTER TABLE [dbo].[suggestion_checksheets] ADD [createdBy] NVARCHAR(255) NULL;
        PRINT '  [✓] Added column: [createdBy] NVARCHAR(255) NULL at the end of table.';
    END
    ELSE
    BEGIN
        PRINT '  [i] Column [createdBy] already exists.';
    END
END
GO

-- 7. Display the final list of columns
PRINT '------------------------------------------------------------------------------';
PRINT 'FINAL COLUMNS IN suggestion_checksheets:';
PRINT '------------------------------------------------------------------------------';
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
GO

SELECT * FROM [dbo].[suggestion_checksheets];
GO

