-- ==============================================================================
-- Table: suggestion_checksheets
-- Module: CMS Portal - Suggestion Check Sheet
-- Database: Microsoft SQL Server (MSSQL)
-- ==============================================================================

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
    PRINT 'Table suggestion_checksheets already exists. Applying schema updates...';

    -- 1. Remove Description
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'description')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN description;
        PRINT 'Removed column description.';
    END

    -- 2. Remove Categories / Category
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'category')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN category;
        PRINT 'Removed column category.';
    END
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'categories')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN categories;
        PRINT 'Removed column categories.';
    END

    -- 3. Remove Employee Code
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'employeeCode')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN employeeCode;
        PRINT 'Removed column employeeCode.';
    END

    -- 4. Remove Priority (drop default constraint if present)
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'priority')
    BEGIN
        DECLARE @priConstraint NVARCHAR(200);
        SELECT @priConstraint = d.name 
        FROM sys.default_constraints d 
        JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id 
        WHERE d.parent_object_id = OBJECT_ID('suggestion_checksheets') AND c.name = 'priority';
        IF @priConstraint IS NOT NULL
            EXEC('ALTER TABLE suggestion_checksheets DROP CONSTRAINT ' + @priConstraint);

        ALTER TABLE suggestion_checksheets DROP COLUMN priority;
        PRINT 'Removed column priority.';
    END

    -- 5. Remove rejectAccepted / rejectedAccepted
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'rejectedAccepted')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN rejectedAccepted;
        PRINT 'Removed column rejectedAccepted.';
    END
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'rejectAccepted')
    BEGIN
        ALTER TABLE suggestion_checksheets DROP COLUMN rejectAccepted;
        PRINT 'Removed column rejectAccepted.';
    END

    -- 6. Add Created by at the end of the table
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('suggestion_checksheets') AND name = 'createdBy')
    BEGIN
        ALTER TABLE suggestion_checksheets ADD createdBy NVARCHAR(255) NULL;
        PRINT 'Added column createdBy at the end of suggestion_checksheets.';
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
