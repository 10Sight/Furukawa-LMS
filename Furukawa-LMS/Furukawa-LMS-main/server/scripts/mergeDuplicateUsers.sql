/*
  mergeDuplicateUsers.sql  —  folds duplicate user rows into the user that is kept.

  BEFORE RUNNING
    1. Take a full database backup.
    2. Run auditDuplicateEmpIds.sql and decide, per duplicate group, which id to KEEP
       (normally the row with the most mandatory fields filled, i.e. the properly registered one).
    3. Fill the #merge INSERT below. Leave @DryRun = 1 for the first run: every change is made
       inside a transaction, counts are printed, and the transaction is rolled back.
    4. Review the output, then set @DryRun = 0 and run again to commit.

  WHAT IT DOES (all in one transaction, XACT_ABORT ON — any error undoes everything)
    - Re-points every column that references users.id (foreign keys + the conventional
      student / studentId / userId / ... columns; INT and NVARCHAR) from dropId to keepId.
    - attempted_quizzes: if both users attempted the same quiz, the dropped user's attempts are
      renumbered after the kept user's, so the (quiz, student, attemptNumber) unique index holds.
    - Rewrites the Employee Code snapshots (attempted_quizzes.studentEmpId,
      user_hierarchy_snapshots.employeeid) from the dropped code to the canonical code.
    - Soft-deletes the dropped user (isDeleted = 1). Nothing is hard-deleted.
    - Logs every update in dbo.user_merge_log.

  If a re-point violates another unique constraint (e.g. both users have a row in a
  one-row-per-user table), the run stops with that error and nothing is changed: resolve that
  table by hand, then rerun.

  AFTER COMMITTING
    - Re-sync hierarchy user lists for the kept users' sub-sections / lines from the app
      (SubSection.syncUserList / Line.syncUserList), since the dropped id may still be in them.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun BIT = 1;   -- 1 = report and roll back, 0 = commit

IF OBJECT_ID('tempdb..#merge') IS NOT NULL DROP TABLE #merge;
CREATE TABLE #merge (
    dropId         INT NOT NULL PRIMARY KEY,
    keepId         INT NOT NULL,
    canonicalEmpId NVARCHAR(50) NOT NULL,
    dropEmpId      NVARCHAR(255) NULL,
    dropUserName   NVARCHAR(255) NULL
);

-- ===== FILL FROM THE AUDIT: (dropId, keepId, canonicalEmpId) =====
INSERT INTO #merge (dropId, keepId, canonicalEmpId)
SELECT 20051, id, 'TR081053' FROM users WHERE empId = 'TR081053' AND ISNULL(isDeleted, 0) = 0;
-- INSERT INTO #merge (dropId, keepId, canonicalEmpId) VALUES (<dropId>, <keepId>, '<CODE>');
-- ================================================================

-- ---------- Sanity checks ----------
UPDATE m SET dropEmpId = u.empId, dropUserName = u.userName
FROM #merge m JOIN users u ON u.id = m.dropId;

IF NOT EXISTS (SELECT 1 FROM #merge)
    THROW 50000, 'No merge pairs given.', 1;
IF EXISTS (SELECT 1 FROM #merge WHERE dropId = keepId)
    THROW 50001, 'A pair keeps and drops the same id.', 1;
IF EXISTS (SELECT 1 FROM #merge m LEFT JOIN users u ON u.id = m.dropId WHERE u.id IS NULL)
    THROW 50002, 'A dropId does not exist in users.', 1;
IF EXISTS (SELECT 1 FROM #merge m LEFT JOIN users u ON u.id = m.keepId AND ISNULL(u.isDeleted, 0) = 0 WHERE u.id IS NULL)
    THROW 50003, 'A keepId does not exist or is deleted.', 1;
IF EXISTS (SELECT 1 FROM #merge a JOIN #merge b ON a.keepId = b.dropId)
    THROW 50004, 'A keepId is also listed as a dropId; merge chains are not supported.', 1;
IF (SELECT COUNT(*) FROM #merge) <> (SELECT COUNT(*) FROM #merge m JOIN users u ON u.id = m.dropId)
    THROW 50005, 'Duplicate rows matched; check the #merge INSERT.', 1;

SELECT 'PAIRS' AS section, m.dropId, d.fullName AS dropName, d.empId AS dropEmpId,
       m.keepId, k.fullName AS keepName, k.empId AS keepEmpId, m.canonicalEmpId
FROM #merge m JOIN users d ON d.id = m.dropId JOIN users k ON k.id = m.keepId;

-- ---------- Columns that reference users.id ----------
IF OBJECT_ID('tempdb..#refs') IS NOT NULL DROP TABLE #refs;
SELECT DISTINCT s.name AS schemaName, t.name AS tableName, c.name AS columnName,
       IIF(TYPE_NAME(c.user_type_id) IN ('int', 'bigint', 'smallint'), 0, 1) AS isText
INTO #refs
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
LEFT JOIN sys.foreign_key_columns fk
       ON fk.parent_object_id = c.object_id AND fk.parent_column_id = c.column_id
      AND fk.referenced_object_id = OBJECT_ID('dbo.users')
WHERE t.name NOT IN ('users', 'user_merge_log')
  AND TYPE_NAME(c.user_type_id) IN ('int', 'bigint', 'smallint', 'nvarchar', 'varchar')
  AND (fk.parent_object_id IS NOT NULL
       OR LOWER(c.name) IN ('student', 'studentid', 'userid', 'user_id', 'candidateid',
                            'operatorid', 'traineeid', 'menteeid', 'employeeuserid'));

IF OBJECT_ID('dbo.user_merge_log') IS NULL
    CREATE TABLE dbo.user_merge_log (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        dropId      INT NOT NULL,
        keepId      INT NOT NULL,
        tableName   NVARCHAR(256) NOT NULL,
        columnName  NVARCHAR(256) NOT NULL,
        rowsUpdated INT NOT NULL,
        mergedAt    DATETIME NOT NULL DEFAULT GETDATE()
    );

IF OBJECT_ID('tempdb..#log') IS NOT NULL DROP TABLE #log;
CREATE TABLE #log (dropId INT, keepId INT, tableName NVARCHAR(256), columnName NVARCHAR(256), rowsUpdated INT);

BEGIN TRANSACTION;

-- ---------- attempted_quizzes: renumber clashing attempts first ----------
IF OBJECT_ID('dbo.attempted_quizzes') IS NOT NULL
BEGIN
    ;WITH dropAttempts AS (
        SELECT aq.id, m.keepId,
               ROW_NUMBER() OVER (PARTITION BY aq.quiz, m.keepId ORDER BY aq.attemptNumber, aq.id) AS seq,
               (SELECT MAX(k.attemptNumber) FROM attempted_quizzes k
                 WHERE k.quiz = aq.quiz AND k.student = CAST(m.keepId AS NVARCHAR(255))) AS keepMax
        FROM attempted_quizzes aq
        JOIN #merge m ON aq.student = CAST(m.dropId AS NVARCHAR(255))
    )
    UPDATE aq SET attemptNumber = d.keepMax + d.seq
    OUTPUT 'RENUMBERED ATTEMPT' AS section, inserted.id, inserted.quiz, deleted.attemptNumber AS oldNumber, inserted.attemptNumber AS newNumber
    FROM attempted_quizzes aq
    JOIN dropAttempts d ON d.id = aq.id
    WHERE d.keepMax IS NOT NULL;
END

-- ---------- Re-point every reference column ----------
DECLARE @schema SYSNAME, @table SYSNAME, @column SYSNAME, @isText BIT, @sql NVARCHAR(MAX), @rows INT;
DECLARE refCursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT schemaName, tableName, columnName, isText FROM #refs ORDER BY tableName, columnName;
OPEN refCursor;
FETCH NEXT FROM refCursor INTO @schema, @table, @column, @isText;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'UPDATE t SET ' + QUOTENAME(@column) + N' = '
             + IIF(@isText = 1, N'CAST(m.keepId AS NVARCHAR(50))', N'm.keepId')
             + N' FROM ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table) + N' t JOIN #merge m ON t.'
             + QUOTENAME(@column) + N' = '
             + IIF(@isText = 1, N'CAST(m.dropId AS NVARCHAR(50))', N'm.dropId')
             + N'; SET @rows = @@ROWCOUNT;';
    EXEC sp_executesql @sql, N'@rows INT OUTPUT', @rows = @rows OUTPUT;
    IF @rows > 0
        INSERT INTO #log (dropId, keepId, tableName, columnName, rowsUpdated)
        SELECT NULL, NULL, @table, @column, @rows;  -- per-column total across all pairs
    FETCH NEXT FROM refCursor INTO @schema, @table, @column, @isText;
END
CLOSE refCursor;
DEALLOCATE refCursor;

-- ---------- Employee Code snapshots ----------
IF COL_LENGTH('dbo.attempted_quizzes', 'studentEmpId') IS NOT NULL
BEGIN
    UPDATE aq SET studentEmpId = m.canonicalEmpId
    FROM attempted_quizzes aq
    JOIN #merge m ON aq.studentEmpId IN (m.dropEmpId, m.dropUserName);
    SET @rows = @@ROWCOUNT;
    IF @rows > 0 INSERT INTO #log VALUES (NULL, NULL, 'attempted_quizzes', 'studentEmpId', @rows);
END

IF OBJECT_ID('dbo.user_hierarchy_snapshots') IS NOT NULL
BEGIN
    UPDATE s SET employeeid = m.canonicalEmpId
    FROM user_hierarchy_snapshots s
    JOIN #merge m ON s.employeeid IN (m.dropEmpId, m.dropUserName);
    SET @rows = @@ROWCOUNT;
    IF @rows > 0 INSERT INTO #log VALUES (NULL, NULL, 'user_hierarchy_snapshots', 'employeeid', @rows);
END

-- ---------- Soft-delete the duplicates ----------
UPDATE u SET isDeleted = 1, updatedAt = GETDATE()
FROM users u JOIN #merge m ON u.id = m.dropId;
SET @rows = @@ROWCOUNT;
INSERT INTO #log VALUES (NULL, NULL, 'users', 'isDeleted', @rows);

-- Per-pair log rows for the permanent table (column totals are shared across pairs).
INSERT INTO dbo.user_merge_log (dropId, keepId, tableName, columnName, rowsUpdated)
SELECT m.dropId, m.keepId, l.tableName, l.columnName, l.rowsUpdated
FROM #log l CROSS JOIN #merge m;

SELECT 'UPDATED' AS section, tableName, columnName, rowsUpdated FROM #log ORDER BY tableName, columnName;

IF @DryRun = 1
BEGIN
    ROLLBACK TRANSACTION;
    PRINT 'DRY RUN: all changes rolled back. Set @DryRun = 0 to commit.';
END
ELSE
BEGIN
    COMMIT TRANSACTION;
    PRINT 'Merge committed.';
END
