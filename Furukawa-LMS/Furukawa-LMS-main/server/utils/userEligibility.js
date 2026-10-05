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
