/*
  auditDuplicateEmpIds.sql  —  READ-ONLY. Run in SSMS before mergeDuplicateUsers.sql.

  Lists every group of active users whose Employee Codes collide once normalised the same way
  as server/utils/employeeFields.js normalizeEmpId (trim, upper-case, "TRO#####" -> "TR0#####").
  The normalised code is compared against both empId and userName, because quiz/import
  lookups match on either.

  Sections:
    1. Duplicate groups (one row per user, with how many mandatory fields each has filled)
    2. Users whose stored empId is not in canonical form
    3. Users with isDeleted = NULL (must be 0 before the unique index can protect them)
    4. Columns that reference users.id (what mergeDuplicateUsers.sql will re-point)
*/
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#codes') IS NOT NULL DROP TABLE #codes;

SELECT
    u.id,
    u.fullName,
    u.empId,
    u.userName,
    u.role,
    u.createdAt,
    src.source,
    CASE
        WHEN UPPER(LTRIM(RTRIM(src.code))) LIKE 'TRO[0-9][0-9][0-9][0-9][0-9]'
            THEN 'TR0' + SUBSTRING(UPPER(LTRIM(RTRIM(src.code))), 4, 5)
        ELSE UPPER(LTRIM(RTRIM(src.code)))
    END AS normCode,
    -- Mandatory employee fields that are filled (max 11; status is not counted)
      IIF(NULLIF(LTRIM(RTRIM(u.idCard)), '') IS NULL, 0, 1)
    + IIF(NULLIF(LTRIM(RTRIM(u.fatherHusbandName)), '') IS NULL, 0, 1)
    + IIF(NULLIF(LTRIM(RTRIM(u.gender)), '') IS NULL, 0, 1)
    + IIF(NULLIF(LTRIM(RTRIM(u.designation)), '') IS NULL, 0, 1)
    + IIF(u.contractorId IS NULL, 0, 1)
    + IIF(u.dob IS NULL, 0, 1)
    + IIF(u.joiningDate IS NULL, 0, 1)
    + IIF(NULLIF(LTRIM(RTRIM(u.education)), '') IS NULL, 0, 1)
    + IIF(NULLIF(LTRIM(RTRIM(u.phoneNumber)), '') IS NULL, 0, 1)
    + IIF(NULLIF(LTRIM(RTRIM(u.fullName)), '') IS NULL, 0, 1)
    + IIF(NULLIF(LTRIM(RTRIM(u.empId)), '') IS NULL, 0, 1) AS filledMandatory
INTO #codes
FROM users u
CROSS APPLY (VALUES (u.empId, 'empId'), (u.userName, 'userName')) AS src(code, source)
WHERE ISNULL(u.isDeleted, 0) = 0
  AND NULLIF(LTRIM(RTRIM(src.code)), '') IS NOT NULL;

-- One row per (user, code) — a user whose empId and userName normalise alike appears once.
WITH distinctCodes AS (
    SELECT DISTINCT id, fullName, empId, userName, role, createdAt, normCode, filledMandatory FROM #codes
),
groups AS (
    SELECT normCode FROM distinctCodes GROUP BY normCode HAVING COUNT(DISTINCT id) > 1
)
SELECT '1. DUPLICATE GROUP' AS section, d.normCode, d.id, d.fullName, d.empId, d.userName, d.role,
       d.filledMandatory, d.createdAt
FROM distinctCodes d
JOIN groups g ON g.normCode = d.normCode
ORDER BY d.normCode, d.filledMandatory DESC, d.createdAt;

-- Case-sensitive, length-aware compare so lower-case codes, stray spaces and the O/0 typo all show.
SELECT '2. NON-CANONICAL empId' AS section, id, fullName, empId, normCode
FROM #codes
WHERE source = 'empId'
  AND (normCode <> empId COLLATE Latin1_General_CS_AS OR DATALENGTH(normCode) <> DATALENGTH(empId))
ORDER BY empId;

SELECT '3. isDeleted IS NULL' AS section, COUNT(*) AS users FROM users WHERE isDeleted IS NULL;

-- Columns mergeDuplicateUsers.sql re-points: real foreign keys to users(id), plus the
-- un-constrained id columns this app uses by convention.
SELECT DISTINCT '4. USER REFERENCE' AS section, t.name AS tableName, c.name AS columnName,
       TYPE_NAME(c.user_type_id) AS dataType,
       IIF(fk.parent_object_id IS NULL, 'by name', 'foreign key') AS foundBy
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
LEFT JOIN sys.foreign_key_columns fk
       ON fk.parent_object_id = c.object_id AND fk.parent_column_id = c.column_id
      AND fk.referenced_object_id = OBJECT_ID('dbo.users')
WHERE t.name <> 'users'
  AND (fk.parent_object_id IS NOT NULL
       OR LOWER(c.name) IN ('student', 'studentid', 'userid', 'user_id', 'candidateid',
                            'operatorid', 'traineeid', 'menteeid', 'employeeuserid'))
ORDER BY tableName, columnName;
