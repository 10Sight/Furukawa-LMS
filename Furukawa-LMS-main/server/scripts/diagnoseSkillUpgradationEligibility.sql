-- Diagnoses why specific users are/aren't showing up as rows in the Skill
-- Upgradation Plan sheet (admin/src/components/departments/SkillUpgradationPlan.jsx)
-- for a given department/section/line.
--
-- Reproduces, per user, every condition that server/controllers/user.controller.js's
-- getAllStudents applies for this page (department/section/line resolution exactly
-- matches getHierarchyFilterJoinSQL's COALESCE chain, plus includeTemporary=false and
-- sixteenDayApprovedOnly=true), plus the extra client-side filter
-- SkillUpgradationWrapper.jsx applies after the API responds (status != LEFT).
-- One row per user; the *_OK columns tell you exactly which check failed.
--
-- Usage: set @departmentId / @sectionId / @lineId below, then run against
-- whichever DB server you're troubleshooting. To check one specific person,
-- add "AND r.empId = '...'" (or fullName LIKE) to the final WHERE clause.

DECLARE @departmentId INT = 0;      -- required
DECLARE @sectionId    INT = 0;      -- required
DECLARE @lineId       INT = NULL;   -- optional; leave NULL to ignore line scoping

;WITH ss_res AS (
    SELECT id AS subSectionId, lineId AS ssLineId FROM sub_sections
),
l_res AS (
    SELECT id AS lineId, sectionId AS lSectionId, department AS lDeptId FROM [lines]
),
s_res AS (
    SELECT id AS sectionId, departmentId AS sDeptId FROM [sections]
),
resolved AS (
    SELECT
        u.id, u.fullName, u.empId, u.status, u.joiningDate, u.department, u.departmentId, u.targetDeptId,
        u.isDeleted, u.isTemporary, u.isEmployee, u.isTrainer, u.role, u.designation,
        COALESCE(u.lineId, CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END, ssr.ssLineId) AS resLineId,
        COALESCE(u.sectionId, CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END, lr.lSectionId) AS resSectionId,
        COALESCE(u.departmentId, CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END, sr.sDeptId, lr.lDeptId) AS resDepartmentId
    FROM users u
    LEFT JOIN ss_res ssr ON ssr.subSectionId = COALESCE(u.subSectionId, CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END)
    LEFT JOIN l_res lr ON lr.lineId = COALESCE(u.lineId, CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END, ssr.ssLineId)
    LEFT JOIN s_res sr ON sr.sectionId = COALESCE(u.sectionId, CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END, lr.lSectionId)
)
SELECT
    r.id, r.fullName, r.empId, r.status, r.joiningDate,

    -- Mirrors getHierarchyFilterJoinSQL's `d` join: resolved dept id, OR (when the
    -- user has no departmentId/targetDeptId at all) a legacy free-text/id match
    -- against u.department.
    CASE WHEN r.resDepartmentId = @departmentId
      OR (r.departmentId IS NULL AND r.targetDeptId IS NULL AND (
            r.department = (SELECT name FROM departments WHERE id = @departmentId)
            OR TRY_CAST(r.department AS INT) = @departmentId
      ))
    THEN 'OK' ELSE 'FAIL — resolved department does not match' END AS deptMatch_OK,

    CASE WHEN r.resSectionId = @sectionId
    THEN 'OK' ELSE 'FAIL — resolved section does not match' END AS sectionMatch_OK,

    CASE WHEN @lineId IS NULL OR r.resLineId = @lineId
    THEN 'OK' ELSE 'FAIL — resolved line does not match' END AS lineMatch_OK,

    CASE WHEN (r.isEmployee = 1) OR (r.role = 'CUSTOM' AND (r.isTrainer = 0 OR r.isTrainer IS NULL))
    THEN 'OK' ELSE 'FAIL — not isEmployee=1 and not a non-trainer CUSTOM role' END AS employeeRole_OK,

    CASE WHEN (r.isTrainer = 0 OR r.isTrainer IS NULL)
    THEN 'OK' ELSE 'FAIL — isTrainer=1' END AS notTrainer_OK,

    CASE WHEN (r.isDeleted = 0 OR r.isDeleted IS NULL)
    THEN 'OK' ELSE 'FAIL — isDeleted=1' END AS notDeleted_OK,

    CASE WHEN (r.isTemporary = 0 OR r.isTemporary IS NULL)
    THEN 'OK' ELSE 'FAIL — isTemporary=1 (page requests includeTemporary=false)' END AS notTemporary_OK,

    CASE WHEN r.designation IS NULL OR r.designation = '' OR r.isTemporary = 1
      OR NOT EXISTS (
          SELECT 1 FROM designation_shutters ds
          WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(510), r.designation))), '') IS NOT NULL
            AND (UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ds.designation)))) = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), r.designation))))
                 OR UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ds.id)))) = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), r.designation)))))
      )
    THEN 'OK' ELSE 'FAIL — designation is shuttered (designation_shutters)' END AS designationShutter_OK,

    CASE WHEN EXISTS (
        SELECT 1 FROM (
            SELECT studentId, approvedBy,
                   ROW_NUMBER() OVER (PARTITION BY studentId ORDER BY attemptNumber DESC, createdAt DESC) AS rn
            FROM sixteen_day_monitorings
        ) latest_sdm
        WHERE latest_sdm.studentId = r.id AND latest_sdm.rn = 1
          AND latest_sdm.approvedBy LIKE '%Approved%' AND latest_sdm.approvedBy NOT LIKE '%Rejected%'
    ) THEN 'OK' ELSE 'FAIL — latest 16-Day sheet attempt is not approved (or none exists)' END AS sixteenDayApproved_OK,

    CASE WHEN UPPER(ISNULL(r.status, '')) <> 'LEFT'
    THEN 'OK' ELSE 'FAIL — status = LEFT (client-side filter in SkillUpgradationWrapper.jsx)' END AS clientNotLeft_OK

FROM resolved r
WHERE
    -- Broad candidate set: anyone whose resolved dept/section plausibly ties to
    -- this scope, ignoring the pass/fail checks above so you see everyone worth
    -- auditing, including people who fail one of the *_OK columns.
    r.resSectionId = @sectionId
    OR r.resDepartmentId = @departmentId
ORDER BY r.fullName;
