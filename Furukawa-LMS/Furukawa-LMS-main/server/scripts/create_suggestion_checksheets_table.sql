-- ==============================================================================
-- Table: suggestion_checksheets
-- Module: CMS Portal - Suggestion Check Sheet
-- Database: Microsoft SQL Server (MSSQL - dojo)
-- ==============================================================================

USE dojo;
GO

-- 1. If table does not exist, create it cleanly with createdBy at the end
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'suggestion_checksheets' AND xtype = 'U')
BEGIN
    CREATE TABLE suggestion_checksheets (
        id INT IDENTITY(1,1) PRIMARY KEY,
        checksheetId NVARCHAR(100) NOT NULL,
        date NVARCHAR(50) NULL,
        unit NVARCHAR(100) NOT NULL DEFAULT 'Bawal',
        department NVARCHAR(255) NULL,
        departmentId NVARCHAR(100) NULL,
        section NVARCHAR(255) NULL,
        sectionId NVARCHAR(100) NULL,
        lineArea NVARCHAR(255) NULL,
        lineAreaId NVARCHAR(100) NULL,
        title NVARCHAR(500) NULL,
        problemText NVARCHAR(MAX) NULL,
        suggestionText NVARCHAR(MAX) NULL,
        submittedBy NVARCHAR(255) NULL,
        employeeName NVARCHAR(255) NULL,
        status NVARCHAR(100) NOT NULL DEFAULT 'Pending',
        isBlank BIT NOT NULL DEFAULT 1,
        isBest BIT NOT NULL DEFAULT 0,
        defectPreventionRank INT NULL,
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
        updatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        createdBy NVARCHAR(255) NULL
    );

    PRINT 'Created table suggestion_checksheets successfully.';
END
ELSE
BEGIN
    PRINT 'Table suggestion_checksheets exists. Removing deprecated columns and adding createdBy at the end...';

    -- --------------------------------------------------------------------------
    -- 1. Remove Priority (drop any default constraints first)
    -- --------------------------------------------------------------------------
    DECLARE @dropPriorityConstraintSql NVARCHAR(MAX) = '';
    SELECT @dropPriorityConstraintSql += 'ALTER TABLE suggestion_checksheets DROP CONSTRAINT ' + QUOTENAME(d.name) + ';' + CHAR(10)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID('suggestion_checksheets') AND c.name = 'priority';

    IF @dropPriorityConstraintSql <> '' 
        EXEC sp_executesql @dropPriorityConstraintSql;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'priority')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN priority;
        PRINT 'Removed column: priority';
    END

    -- --------------------------------------------------------------------------
    -- 2. Remove Description (drop any constraints first if present)
    -- --------------------------------------------------------------------------
    DECLARE @dropDescConstraintSql NVARCHAR(MAX) = '';
    SELECT @dropDescConstraintSql += 'ALTER TABLE suggestion_checksheets DROP CONSTRAINT ' + QUOTENAME(d.name) + ';' + CHAR(10)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID('suggestion_checksheets') AND c.name = 'description';

    IF @dropDescConstraintSql <> '' 
        EXEC sp_executesql @dropDescConstraintSql;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'description')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN description;
        PRINT 'Removed column: description';
    END

    -- --------------------------------------------------------------------------
    -- 3. Remove Categories / Category (drop any constraints first)
    -- --------------------------------------------------------------------------
    DECLARE @dropCatConstraintSql NVARCHAR(MAX) = '';
    SELECT @dropCatConstraintSql += 'ALTER TABLE suggestion_checksheets DROP CONSTRAINT ' + QUOTENAME(d.name) + ';' + CHAR(10)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID('suggestion_checksheets') AND c.name IN ('category', 'categories');

    IF @dropCatConstraintSql <> '' 
        EXEC sp_executesql @dropCatConstraintSql;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'category')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN category;
        PRINT 'Removed column: category';
    END

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'categories')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN categories;
        PRINT 'Removed column: categories';
    END

    -- --------------------------------------------------------------------------
    -- 4. Remove Employee Code (drop any constraints first)
    -- --------------------------------------------------------------------------
    DECLARE @dropEmpConstraintSql NVARCHAR(MAX) = '';
    SELECT @dropEmpConstraintSql += 'ALTER TABLE suggestion_checksheets DROP CONSTRAINT ' + QUOTENAME(d.name) + ';' + CHAR(10)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID('suggestion_checksheets') AND c.name IN ('employeeCode', 'employee_code');

    IF @dropEmpConstraintSql <> '' 
        EXEC sp_executesql @dropEmpConstraintSql;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'employeeCode')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN employeeCode;
        PRINT 'Removed column: employeeCode';
    END

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'employee_code')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN employee_code;
        PRINT 'Removed column: employee_code';
    END

    -- --------------------------------------------------------------------------
    -- 5. Remove rejectAccepted / rejectedAccepted (drop any constraints first)
    -- --------------------------------------------------------------------------
    DECLARE @dropRejConstraintSql NVARCHAR(MAX) = '';
    SELECT @dropRejConstraintSql += 'ALTER TABLE suggestion_checksheets DROP CONSTRAINT ' + QUOTENAME(d.name) + ';' + CHAR(10)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID('suggestion_checksheets') AND c.name IN ('rejectedAccepted', 'rejectAccepted');

    IF @dropRejConstraintSql <> '' 
        EXEC sp_executesql @dropRejConstraintSql;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'rejectedAccepted')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN rejectedAccepted;
        PRINT 'Removed column: rejectedAccepted';
    END

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'rejectAccepted')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN rejectAccepted;
        PRINT 'Removed column: rejectAccepted';
    END

    -- --------------------------------------------------------------------------
    -- 6. Add Created by at the end of the table
    -- --------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'createdBy')
    BEGIN
        ALTER TABLE suggestion_checksheets ADD createdBy NVARCHAR(255) NULL;
        PRINT 'Added column: createdBy at the end of suggestion_checksheets.';
    END
END
GO

-- ==============================================================================
-- Indexes for Performance & Search Optimization
-- ==============================================================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_suggestion_checksheetId' AND object_id = OBJECT_ID('suggestion_checksheets'))
BEGIN
    CREATE UNIQUE INDEX idx_suggestion_checksheetId ON suggestion_checksheets(checksheetId);
    PRINT 'Created unique index idx_suggestion_checksheetId.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_suggestion_unit_status' AND object_id = OBJECT_ID('suggestion_checksheets'))
BEGIN
    CREATE INDEX idx_suggestion_unit_status ON suggestion_checksheets(unit, status);
    PRINT 'Created index idx_suggestion_unit_status.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_suggestion_isBest' AND object_id = OBJECT_ID('suggestion_checksheets'))
BEGIN
    CREATE INDEX idx_suggestion_isBest ON suggestion_checksheets(isBest);
    PRINT 'Created index idx_suggestion_isBest.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_suggestion_defectRank' AND object_id = OBJECT_ID('suggestion_checksheets'))
BEGIN
    CREATE INDEX idx_suggestion_defectRank ON suggestion_checksheets(defectPreventionRank);
    PRINT 'Created index idx_suggestion_defectRank.';
END
GO

-- Check columns in suggestion_checksheets
SELECT column_id, name AS [Column Name], type_name(user_type_id) AS [Data Type], max_length, is_nullable
FROM sys.columns
WHERE object_id = OBJECT_ID('suggestion_checksheets')
ORDER BY column_id ASC;
GO

SELECT * FROM suggestion_checksheets;
GO
