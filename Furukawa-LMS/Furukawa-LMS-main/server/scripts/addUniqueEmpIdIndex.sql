/*
  addUniqueEmpIdIndex.sql  —  run LAST, after mergeDuplicateUsers.sql has been committed and
  auditDuplicateEmpIds.sql section 1 comes back empty.

  1. Backfills users.isDeleted NULL -> 0 and gives the column a default, so the filtered index
     below covers every active user (a NULL row would otherwise slip past the filter).
  2. Creates a unique index on empId for active users, so the database itself refuses a second
     active user with the same Employee Code. The default collation is case-insensitive, so
     'tr081053' and 'TR081053' count as the same code.

  Note: the O/0 typo is not something an index can see ("TRO81053" and "TR081053" are different
  strings); the app's normalizeEmpId handles that before inserting.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
-- Required session settings for creating / writing through a filtered index.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

BEGIN TRANSACTION;

UPDATE users SET isDeleted = 0 WHERE isDeleted IS NULL;
PRINT CONCAT('isDeleted backfilled on ', @@ROWCOUNT, ' users.');

IF NOT EXISTS (
    SELECT 1 FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.users')
      AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.users'), 'isDeleted', 'ColumnId')
)
    ALTER TABLE dbo.users ADD CONSTRAINT DF_users_isDeleted DEFAULT 0 FOR isDeleted;

-- Stop with a readable list instead of a bare index-creation error.
IF EXISTS (
    SELECT empId FROM users
    WHERE empId IS NOT NULL AND isDeleted = 0
    GROUP BY empId HAVING COUNT(*) > 1
)
BEGIN
    SELECT 'STILL DUPLICATED' AS section, empId, COUNT(*) AS users
    FROM users WHERE empId IS NOT NULL AND isDeleted = 0
    GROUP BY empId HAVING COUNT(*) > 1;
    ROLLBACK TRANSACTION;
    THROW 50010, 'Active duplicate empIds remain; run mergeDuplicateUsers.sql for them first.', 1;
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_users_empId_active' AND object_id = OBJECT_ID('dbo.users'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_users_empId_active
        ON dbo.users (empId)
        WHERE empId IS NOT NULL AND isDeleted = 0;

COMMIT TRANSACTION;
PRINT 'UQ_users_empId_active is in place.';
