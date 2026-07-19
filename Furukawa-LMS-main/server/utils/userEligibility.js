/**
 * Bare boolean condition (no leading AND) — safe to embed inside a WHERE
 * clause or a CASE WHEN expression.
 */
export const getDesignationShutterExclusionCondition = (alias = "u") => `
    NOT EXISTS (
        SELECT 1
        FROM designation_shutters ds
        WHERE ds.designation IS NOT NULL
          AND ds.designation = ${alias}.designation
    )
`;

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
