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
    );

    PRINT 'Created table suggestion_checksheets successfully.';
END
ELSE
BEGIN
    PRINT 'Table suggestion_checksheets already exists.';
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

