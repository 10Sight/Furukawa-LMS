import { poolPromise } from "../db/connectDB.js";
import logger from "../logger/winston.logger.js";

const executeSql = async (queryStr, params = []) => {
    const activeConn = await poolPromise;
    const request = activeConn.request();
    let formattedQuery = queryStr;
    for (let i = 0; i < params.length; i++) {
        const paramName = `p${i}`;
        request.input(paramName, params[i]);
        formattedQuery = formattedQuery.replace('?', `@${paramName}`);
    }
    const result = await request.query(formattedQuery);
    return [result.recordset || [], {
        affectedRows: result.rowsAffected ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0,
        insertId: result.recordset && result.recordset.length > 0 && result.recordset[0].log_id ? result.recordset[0].log_id : null
    }];
};

// Renamed the object to match your table for your peace of mind
const RequirementUpdateLogs = {
    
    async create(logData) {
        let { requirement_id, old_value, new_value } = logData;
        const safeJson = (val) => (typeof val === 'string' ? val : JSON.stringify(val || {}));

        const query = `
            INSERT INTO RequirementUpdateLogs 
            (requirement_id, old_value, new_value, updated_at)
            OUTPUT INSERTED.log_id
            VALUES (?, ?, ?, GETDATE())
        `;

        try {
            const [result, meta] = await executeSql(query, [
                requirement_id,
                safeJson(old_value),
                safeJson(new_value)
            ]);
            return { log_id: meta.insertId, ...logData };
        } catch (error) {
            logger.error("Failed to create record in RequirementUpdateLogs", error);
            throw error;
        }
    },

    async getLogs(filters = {}, options = {}) {
        const { requirement_id } = filters;
        const limit = Number(options.limit ?? 100);
        const offset = Number(options.offset ?? 0);

        let query = `
            SELECT 
                l.log_id,
                l.requirement_id,
                l.old_value,
                l.new_value,
                l.updated_at
            FROM RequirementUpdateLogs l
            WHERE 1=1
        `;

        const params = [];
        if (requirement_id) {
            query += ` AND l.requirement_id = ?`;
            params.push(requirement_id);
        }

        // Using updated_at to fix your "Invalid column name 'created_at'" error
        query += ` ORDER BY l.updated_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
        params.push(offset, limit);

        try {
            const [rows] = await executeSql(query, params);
            return rows.map(r => {
                let oldV = r.old_value;
                let newV = r.new_value;
                try { if (typeof oldV === 'string') oldV = JSON.parse(oldV); } catch (e) { }
                try { if (typeof newV === 'string') newV = JSON.parse(newV); } catch (e) { }

                return {
                    ...r,
                    old_values: oldV, 
                    new_values: newV,
                    created_at: r.updated_at // Maps DB updated_at to created_at for the UI
                };
            });
        } catch (error) {
            logger.error("Failed to fetch logs from RequirementUpdateLogs", error);
            throw error;
        }
    }
};

export default RequirementUpdateLogs;