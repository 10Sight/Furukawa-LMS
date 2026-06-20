import mssql from "mssql";
import { poolPromise } from "../db/connectDB.js";

/*
|--------------------------------------------------------------------------
| RequirementLog Model
|--------------------------------------------------------------------------
| This model is mapped with the new SQL Server table:
| RequirementUpdateLogs
|
| Table columns:
| log_id, requirement_id, section_id, subsection_id, action_type,
| old_salesPlan, new_salesPlan,
| old_prodPlan, new_prodPlan,
| old_prodPlanFN01, new_prodPlanFN01,
| old_prodPlanFN02, new_prodPlanFN02,
| old_values, new_values,
| employee_id, employee_role, updated_by_name, updated_at
|--------------------------------------------------------------------------
*/

const safeJson = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;

    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
};

const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
};

const getValue = (obj, key) => {
    if (!obj || typeof obj !== "object") return null;
    return obj[key] !== undefined ? obj[key] : null;
};

const getRequest = async (transactionOrPool = null) => {
    const activeConn = transactionOrPool || await poolPromise;
    const request = activeConn.request();
    request.timeout = 300000;
    return request;
};

const RequirementLog = {
    async create(data = {}, transactionOrPool = null) {
        const oldValues = data.old_values || data.oldValues || null;
        const newValues = data.new_values || data.newValues || null;

        const oldSalesPlan = data.old_salesPlan ?? getValue(oldValues, "salesPlan");
        const newSalesPlan = data.new_salesPlan ?? getValue(newValues, "salesPlan");

        const oldProdPlan = data.old_prodPlan ?? getValue(oldValues, "prodPlan");
        const newProdPlan = data.new_prodPlan ?? getValue(newValues, "prodPlan");

        const oldProdPlanFN01 = data.old_prodPlanFN01 ?? getValue(oldValues, "prodPlanFN01");
        const newProdPlanFN01 = data.new_prodPlanFN01 ?? getValue(newValues, "prodPlanFN01");

        const oldProdPlanFN02 = data.old_prodPlanFN02 ?? getValue(oldValues, "prodPlanFN02");
        const newProdPlanFN02 = data.new_prodPlanFN02 ?? getValue(newValues, "prodPlanFN02");

        const actionType =
            data.action_type ||
            data.actionType ||
            (!oldValues && newValues ? "INSERT" : oldValues && !newValues ? "DELETE" : "UPDATE");

        const request = await getRequest(transactionOrPool);

        request.input("requirement_id", mssql.Int, data.requirement_id || data.requirementId || null);
        request.input("section_id", mssql.Int, data.section_id || data.sectionId || null);
        request.input("subsection_id", mssql.Int, data.subsection_id || data.subsectionId || null);
        request.input("action_type", mssql.NVarChar(50), actionType);

        request.input("old_salesPlan", mssql.Float, toNumberOrNull(oldSalesPlan));
        request.input("new_salesPlan", mssql.Float, toNumberOrNull(newSalesPlan));

        request.input("old_prodPlan", mssql.Float, toNumberOrNull(oldProdPlan));
        request.input("new_prodPlan", mssql.Float, toNumberOrNull(newProdPlan));

        request.input("old_prodPlanFN01", mssql.Float, toNumberOrNull(oldProdPlanFN01));
        request.input("new_prodPlanFN01", mssql.Float, toNumberOrNull(newProdPlanFN01));

        request.input("old_prodPlanFN02", mssql.Float, toNumberOrNull(oldProdPlanFN02));
        request.input("new_prodPlanFN02", mssql.Float, toNumberOrNull(newProdPlanFN02));

        request.input("old_values", mssql.NVarChar(mssql.MAX), safeJson(oldValues));
        request.input("new_values", mssql.NVarChar(mssql.MAX), safeJson(newValues));

        request.input("employee_id", mssql.Int, data.employee_id || data.employeeId || null);
        request.input("employee_role", mssql.NVarChar(200), data.employee_role || data.employeeRole || null);
        request.input("updated_by_name", mssql.NVarChar(510), data.updated_by_name || data.updatedByName || null);

        const result = await request.query(`
            INSERT INTO RequirementUpdateLogs
            (
                requirement_id,
                section_id,
                subsection_id,
                action_type,
                old_salesPlan,
                new_salesPlan,
                old_prodPlan,
                new_prodPlan,
                old_prodPlanFN01,
                new_prodPlanFN01,
                old_prodPlanFN02,
                new_prodPlanFN02,
                old_values,
                new_values,
                employee_id,
                employee_role,
                updated_by_name,
                updated_at
            )
            OUTPUT INSERTED.*
            VALUES
            (
                @requirement_id,
                @section_id,
                @subsection_id,
                @action_type,
                @old_salesPlan,
                @new_salesPlan,
                @old_prodPlan,
                @new_prodPlan,
                @old_prodPlanFN01,
                @new_prodPlanFN01,
                @old_prodPlanFN02,
                @new_prodPlanFN02,
                @old_values,
                @new_values,
                @employee_id,
                @employee_role,
                @updated_by_name,
                GETDATE()
            )
        `);

        return result.recordset?.[0] || null;
    },

    async getLogs(filters = {}, options = {}) {
        const limit = Math.max(parseInt(options.limit, 10) || 100, 1);
        const offset = Math.max(parseInt(options.offset, 10) || 0, 0);

        const request = await getRequest();

        request.input("limit", mssql.Int, limit);
        request.input("offset", mssql.Int, offset);

        const where = [];

        if (filters.requirement_id !== undefined && filters.requirement_id !== null && filters.requirement_id !== "") {
            request.input("requirement_id", mssql.Int, Number(filters.requirement_id));
            where.push("l.requirement_id = @requirement_id");
        }

        if (filters.section_id !== undefined && filters.section_id !== null && filters.section_id !== "") {
            request.input("section_id", mssql.Int, Number(filters.section_id));
            where.push("l.section_id = @section_id");
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const result = await request.query(`
            SELECT
                l.*,

                r.sectionCode,
                r.sectionName,
                r.lineCode,
                r.lineDescription,
                r.monthName,
                r.monthNumber,
                r.year,

                s.name AS section_name,
                ss.name AS subsection_name
            FROM RequirementUpdateLogs l WITH (NOLOCK)
            LEFT JOIN requirements r WITH (NOLOCK)
                ON r.id = l.requirement_id
            LEFT JOIN sections s WITH (NOLOCK)
                ON s.id = l.section_id
            LEFT JOIN sub_sections ss WITH (NOLOCK)
                ON ss.id = l.subsection_id
            ${whereSql}
            ORDER BY l.updated_at DESC, l.log_id DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `);

        return result.recordset || [];
    },
};

export default RequirementLog;
