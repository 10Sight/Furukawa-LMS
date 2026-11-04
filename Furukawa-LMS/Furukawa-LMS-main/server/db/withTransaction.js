import { pool } from "./connectDB.js";

/**
 * Runs fn(conn) inside one transaction: commits when fn resolves, rolls back when it throws.
 * conn.query(sql, params) has the same signature and return shape as executeQuery.
 */
export const withTransaction = async (fn, options = {}) => {
    const conn = await pool.getConnection(options);
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback().catch(() => {});
        throw error;
    }
};

export default withTransaction;
