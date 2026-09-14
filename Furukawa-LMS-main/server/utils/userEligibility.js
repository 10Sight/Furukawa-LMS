/**
 * Bare boolean condition (no leading AND) — safe to embed inside a WHERE
 * clause or a CASE WHEN expression.
 *
 * Trims whitespace and compares case-insensitively, and matches a shutter
 * stored either by designation name or by designation_shutters.id, since
 * shutters may be recorded either way. Pass alias = "" for an unaliased
 * `designation` column.
 */
export const getDesignationShutterExclusionCondition = (alias = "u") => {
    const col = alias ? `${alias}.designation` : "designation";
    return `
    NOT EXISTS (
        SELECT 1
        FROM designation_shutters ds
        WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${col}))), '') IS NOT NULL
          AND (
                UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ds.designation))))
                    = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${col}))))
                OR UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ds.id))))
                    = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${col}))))
              )
    )
`;
};

export const getEligibleUserCondition = (alias = "u") => `
    ISNULL(${alias}.isDeleted, 0) = 0
    AND ISNULL(${alias}.isTemporary, 0) = 0
    AND ${alias}.empId IS NOT NULL
    AND ${alias}.empId != ''
    AND ${getDesignationShutterExclusionCondition(alias)}
`;

/**
 * WHERE-clause-ready fragments (leading AND) for appending directly after
 * an existing WHERE condition.
 */
export const getDesignationShutterExclusionSql = (alias = "u") =>
    `AND ${getDesignationShutterExclusionCondition(alias)}`;

export const getEligibleUserSql = (alias = "u") =>
    `AND ${getEligibleUserCondition(alias)}`;

/**
 * SQL Server does not allow a subquery (e.g. NOT EXISTS) inside an aggregate
 * function's argument (SUM(CASE WHEN ... END)) — "Cannot perform an
 * aggregate function on an expression containing an aggregate or a
 * subquery." For eligibility checks that need to live inside a CASE WHEN
 * nested in SUM()/COUNT(), LEFT JOIN designation_shutters up front and use
 * this join-based condition instead of the subquery-based one above.
 */
export const getDesignationShutterLeftJoinSql = (usersAlias = "u", shutterAlias = "ds") => `
    LEFT JOIN designation_shutters ${shutterAlias}
        ON NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${usersAlias}.designation))), '') IS NOT NULL
       AND (
             UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${shutterAlias}.designation))))
                 = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${usersAlias}.designation))))
          OR UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${shutterAlias}.id))))
                 = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${usersAlias}.designation))))
       )
`;

export const getEligibleUserConditionViaJoin = (usersAlias = "u", shutterAlias = "ds") => `
    ISNULL(${usersAlias}.isDeleted, 0) = 0
    AND ISNULL(${usersAlias}.isTemporary, 0) = 0
    AND ${usersAlias}.empId IS NOT NULL
    AND ${usersAlias}.empId != ''
    AND ${shutterAlias}.designation IS NULL
`;

/**
 * Canonical status enum. Every write path (manual create/update, bulk import,
 * bulk status update) must funnel through normalizeOperatorStatus() before the
 * value reaches the `users.status` column, so `status` only ever holds one of
 * these three values. Anything else ('ACTIVE', 'ON-LEAVE', 'Leave', 'Terminated',
 * stray casing/whitespace, etc.) is a legacy/import artifact that must be mapped
 * here rather than compared against ad-hoc string literals at query time.
 */
export const OPERATOR_STATUS = Object.freeze({
    PRESENT: "PRESENT",
    ON_LEAVE: "ON_LEAVE",
    LEFT: "LEFT",
});

/**
 * Maps any raw status string (fresh user input, an Excel import cell, or a
 * legacy DB row) to the canonical PRESENT | ON_LEAVE | LEFT enum. Unrecognized
 * or empty input defaults to PRESENT, mirroring the historical import behavior.
 */
export const normalizeOperatorStatus = (val) => {
    if (val === undefined || val === null) return OPERATOR_STATUS.PRESENT;
    const v = String(val).trim().toUpperCase().replace(/[\s\-_]+/g, "");
    if (!v) return OPERATOR_STATUS.PRESENT;
    if (v === "LEFT" || v === "LEAVING" || v === "RESIGNED" || v === "TERMINATED") return OPERATOR_STATUS.LEFT;
    if (v === "ONLEAVE" || v === "LEAVE") return OPERATOR_STATUS.ON_LEAVE;
    return OPERATOR_STATUS.PRESENT;
};

// Same mapping as normalizeOperatorStatus(), expressed as a SQL Server CASE expression so
// legacy rows that predate the healing migration still resolve to a canonical value at query
// time. `col` should already include the table alias (e.g. "u.status").
const getNormalizedStatusCaseSql = (col) => `
    CASE
        WHEN UPPER(LTRIM(RTRIM(REPLACE(REPLACE(ISNULL(CONVERT(NVARCHAR(50), ${col}), ''), '-', ''), '_', ''))))
            IN ('LEFT', 'LEAVING', 'RESIGNED', 'TERMINATED') THEN 'LEFT'
        WHEN UPPER(LTRIM(RTRIM(REPLACE(REPLACE(ISNULL(CONVERT(NVARCHAR(50), ${col}), ''), '-', ''), '_', ''))))
            IN ('ONLEAVE', 'LEAVE') THEN 'ON_LEAVE'
        ELSE 'PRESENT'
    END
`;

/**
 * Non-trainer condition shared by the Students page and the Dashboard manpower base
 * population — an "operator" excludes trainers regardless of isEmployee.
 */
export const getNonTrainerConditionSql = (alias = "u") =>
    `(${alias}.isTrainer = 0 OR ${alias}.isTrainer IS NULL)`;

/**
 * The single definition of "counts as a Present operator as of a given date", shared by
 * the Students page stat card, the Dashboard headcount snapshot, and any report/export that
 * needs a live (non-historical) present count. Tolerant of un-healed legacy status strings
 * via getNormalizedStatusCaseSql, and excludes pending joiners (joiningDate in the future) so
 * this always agrees with the statusHistory-interval reconstruction used by the Daily
 * Manpower Trend graph. Returns a bare boolean condition (no leading AND).
 *
 * asOfDateSql defaults to today (SQL Server CAST(GETDATE() AS DATE)); pass a parameter
 * placeholder or literal date expression to evaluate eligibility as of another date.
 */
export const getOperatorPresentCondition = (alias = "u", asOfDateSql = "CAST(GETDATE() AS DATE)") => `
    ${getNormalizedStatusCaseSql(`${alias}.status`)} = 'PRESENT'
    AND (${alias}.joiningDate IS NULL OR CAST(${alias}.joiningDate AS DATE) <= ${asOfDateSql})
    AND (${alias}.leavingDate IS NULL OR CAST(${alias}.leavingDate AS DATE) > ${asOfDateSql})
`;

export const getOperatorPresentSql = (alias = "u", asOfDateSql = "CAST(GETDATE() AS DATE)") =>
    `AND ${getOperatorPresentCondition(alias, asOfDateSql)}`;

/**
 * In-memory (JavaScript) equivalent of getOperatorPresentCondition(), for callers that
 * already have the row loaded rather than querying for it. asOfDateStr defaults to today,
 * as a "YYYY-MM-DD" string or Date.
 */
export const isOperatorActiveAsOfDate = (userObj = {}, asOfDateStr) => {
    const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
    asOf.setHours(0, 0, 0, 0);

    const status = normalizeOperatorStatus(userObj.status);
    if (status !== OPERATOR_STATUS.PRESENT) return false;

    if (userObj.joiningDate) {
        const joining = new Date(userObj.joiningDate);
        joining.setHours(0, 0, 0, 0);
        if (joining > asOf) return false;
    }

    if (userObj.leavingDate) {
        const leaving = new Date(userObj.leavingDate);
        leaving.setHours(0, 0, 0, 0);
        if (asOf >= leaving) return false;
    }

    return true;
};
