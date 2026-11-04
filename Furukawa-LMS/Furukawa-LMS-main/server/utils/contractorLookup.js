import { executeQuery } from "../db/mssqlHelper.js";

/**
 * Resolves a contractor by id (preferred) or by name to an active contractors row.
 * Returns { id, name } or null when no active contractor matches.
 */
export const resolveActiveContractor = async ({ contractorId, contractor } = {}) => {
    const id = Number(contractorId);
    let rows = [];
    if (Number.isInteger(id) && id > 0) {
        [rows] = await executeQuery(
            "SELECT id, name FROM contractors WHERE id = ? AND status = 'active'",
            [id]
        );
    } else if (contractor && String(contractor).trim()) {
        [rows] = await executeQuery(
            "SELECT id, name FROM contractors WHERE LOWER(LTRIM(RTRIM(name))) = LOWER(?) AND status = 'active'",
            [String(contractor).trim()]
        );
    }
    return rows && rows.length > 0 ? rows[0] : null;
};
