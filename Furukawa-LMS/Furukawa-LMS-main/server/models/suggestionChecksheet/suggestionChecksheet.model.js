import {
  isDbConnected,
  executeQuery,
  initSuggestionChecksheetTables,
  readSuggestionStore,
  writeSuggestionStore
} from "../../db/suggestionChecksheet/suggestionChecksheetDb.js";
import logger from "../../logger/winston.logger.js";

function mapSqlRowToChecksheet(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.checksheetId || `SC-${row.id}`,
    createdBy: row.createdBy || row.submittedBy || '',
    isBlank: Boolean(row.isBlank),
    isBest: Boolean(row.isBest),
    defectPreventionRank: row.defectPreventionRank !== null ? Number(row.defectPreventionRank) : null,
    categoryP: Boolean(row.categoryP),
    categoryQ: Boolean(row.categoryQ),
    categoryC: Boolean(row.categoryC),
    categoryD: Boolean(row.categoryD),
    categoryM: Boolean(row.categoryM),
    categoryS: Boolean(row.categoryS),
    category5S: Boolean(row.category5S),
    isDeleted: Boolean(row.isDeleted),
  };
}

class SuggestionChecksheetModel {
  /**
   * Initializes SQL Server table and seeds schema on application boot
   */
  static async init() {
    await initSuggestionChecksheetTables();
  }

  static async getAll({ unit = "", search = "", status = "" } = {}) {
    const connected = await isDbConnected();
    if (connected) {
      try {
        let sql = `SELECT * FROM suggestion_checksheets WHERE isDeleted = 0`;
        const params = [];

        if (unit && unit !== "All Units" && unit !== "All") {
          sql += ` AND unit = ?`;
          params.push(unit);
        }

        if (status && status !== "All") {
          sql += ` AND status = ?`;
          params.push(status);
        }

        if (search && search.trim()) {
          const q = `%${search.trim()}%`;
          sql += ` AND (title LIKE ? OR submittedBy LIKE ? OR createdBy LIKE ? OR checksheetId LIKE ? OR department LIKE ? OR section LIKE ?)`;
          params.push(q, q, q, q, q, q);
        }

        sql += ` ORDER BY id DESC`;

        const [rows] = await executeQuery(sql, params);
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map(mapSqlRowToChecksheet);
        }
      } catch (err) {
        logger.warn("SQL Server getAll query failed, falling back to disk store:", err.message);
      }
    }

    // Fallback to disk JSON store
    let records = readSuggestionStore();

    if (unit && unit !== "All Units" && unit !== "All") {
      records = records.filter((r) => r.unit === unit);
    }

    if (status && status !== "All") {
      records = records.filter((r) => r.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter((r) =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.submittedBy || "").toLowerCase().includes(q) ||
        (r.createdBy || "").toLowerCase().includes(q) ||
        (r.id || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        (r.section || "").toLowerCase().includes(q)
      );
    }

    return records;
  }

  static async getById(id) {
    const connected = await isDbConnected();
    if (connected) {
      try {
        const [rows] = await executeQuery(
          `SELECT * FROM suggestion_checksheets WHERE (checksheetId = ? OR CAST(id AS NVARCHAR(100)) = ?) AND isDeleted = 0`,
          [id, id]
        );
        if (rows && rows[0]) {
          return mapSqlRowToChecksheet(rows[0]);
        }
      } catch (err) {
        logger.warn("SQL Server getById query failed, falling back to disk store:", err.message);
      }
    }

    const records = readSuggestionStore();
    return records.find((r) => r.id === id) || null;
  }

  static async create(data) {
    const unitCode = (data.unit || "BWL").substring(0, 3).toUpperCase();
    const newId = data.id || `SC-${unitCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord = {
      ...data,
      id: newId,
      createdBy: data.createdBy || data.submittedBy || data.employeeName || 'System User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Remove deprecated columns
    delete newRecord.description;
    delete newRecord.Description;
    delete newRecord.category;
    delete newRecord.Category;
    delete newRecord.categories;
    delete newRecord.Categories;
    delete newRecord.employeeCode;
    delete newRecord.EmployeeCode;
    delete newRecord.employee_code;
    delete newRecord['Employee Code'];
    delete newRecord.priority;
    delete newRecord.Priority;
    delete newRecord.rejectedAccepted;
    delete newRecord.RejectedAccepted;
    delete newRecord.rejectAccepted;
    delete newRecord.RejectAccepted;

    const connected = await isDbConnected();
    if (connected) {
      try {
        await executeQuery(`
          INSERT INTO suggestion_checksheets (
            checksheetId, date, unit, department, departmentId, section, sectionId, lineArea, lineAreaId,
            title, problemText, suggestionText, submittedBy, employeeName,
            status, isBlank, isBest, defectPreventionRank, reasonIfRejected,
            targetDate, dateOfImplementation, lineLeaderSign1, lineLeaderSign2, approvalDate, costSaving, benefitDetails,
            categoryP, categoryQ, categoryC, categoryD, categoryM, categoryS, category5S, isDeleted, createdBy
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, 0, ?
          )
        `, [
          newId,
          newRecord.date || null,
          newRecord.unit || 'Bawal',
          newRecord.department || null,
          newRecord.departmentId || null,
          newRecord.section || null,
          newRecord.sectionId || null,
          newRecord.lineArea || null,
          newRecord.lineAreaId || null,
          newRecord.title || null,
          newRecord.problemText || null,
          newRecord.suggestionText || null,
          newRecord.submittedBy || null,
          newRecord.employeeName || null,
          newRecord.status || 'Pending',
          newRecord.isBlank ? 1 : 0,
          newRecord.isBest ? 1 : 0,
          newRecord.defectPreventionRank || null,
          newRecord.reasonIfRejected || null,
          newRecord.targetDate || null,
          newRecord.dateOfImplementation || null,
          newRecord.lineLeaderSign1 || null,
          newRecord.lineLeaderSign2 || null,
          newRecord.approvalDate || null,
          newRecord.costSaving || null,
          newRecord.benefitDetails || null,
          newRecord.categoryP ? 1 : 0,
          newRecord.categoryQ ? 1 : 0,
          newRecord.categoryC ? 1 : 0,
          newRecord.categoryD ? 1 : 0,
          newRecord.categoryM ? 1 : 0,
          newRecord.categoryS ? 1 : 0,
          newRecord.category5S ? 1 : 0,
          newRecord.createdBy || null,
        ]);
        logger.info(`Inserted Suggestion Checksheet into SQL Server: ${newId}`);
      } catch (err) {
        logger.error("Failed inserting checksheet into SQL Server:", err.message);
      }
    }

    // Keep fallback store synchronized
    const records = readSuggestionStore();
    records.unshift(newRecord);
    writeSuggestionStore(records);

    return newRecord;
  }

  static async update(id, updateData) {
    const updated = {
      ...updateData,
      id,
      updatedAt: new Date().toISOString(),
    };

    // Remove deprecated columns
    delete updated.description;
    delete updated.Description;
    delete updated.category;
    delete updated.Category;
    delete updated.categories;
    delete updated.Categories;
    delete updated.employeeCode;
    delete updated.EmployeeCode;
    delete updated.employee_code;
    delete updated['Employee Code'];
    delete updated.priority;
    delete updated.Priority;
    delete updated.rejectedAccepted;
    delete updated.RejectedAccepted;
    delete updated.rejectAccepted;
    delete updated.RejectAccepted;

    const connected = await isDbConnected();
    if (connected) {
      try {
        await executeQuery(`
          UPDATE suggestion_checksheets SET
            date = ?,
            unit = ?,
            department = ?,
            section = ?,
            lineArea = ?,
            title = ?,
            problemText = ?,
            suggestionText = ?,
            submittedBy = ?,
            employeeName = ?,
            status = ?,
            isBlank = ?,
            isBest = ?,
            defectPreventionRank = ?,
            reasonIfRejected = ?,
            targetDate = ?,
            dateOfImplementation = ?,
            lineLeaderSign1 = ?,
            lineLeaderSign2 = ?,
            approvalDate = ?,
            costSaving = ?,
            benefitDetails = ?,
            categoryP = ?,
            categoryQ = ?,
            categoryC = ?,
            categoryD = ?,
            categoryM = ?,
            categoryS = ?,
            category5S = ?,
            createdBy = COALESCE(?, createdBy),
            updatedAt = GETDATE()
          WHERE checksheetId = ? OR CAST(id AS NVARCHAR(100)) = ?
        `, [
          updated.date || null,
          updated.unit || 'Bawal',
          updated.department || null,
          updated.section || null,
          updated.lineArea || null,
          updated.title || null,
          updated.problemText || null,
          updated.suggestionText || null,
          updated.submittedBy || null,
          updated.employeeName || null,
          updated.status || 'Pending',
          updated.isBlank ? 1 : 0,
          updated.isBest ? 1 : 0,
          updated.defectPreventionRank || null,
          updated.reasonIfRejected || null,
          updated.targetDate || null,
          updated.dateOfImplementation || null,
          updated.lineLeaderSign1 || null,
          updated.lineLeaderSign2 || null,
          updated.approvalDate || null,
          updated.costSaving || null,
          updated.benefitDetails || null,
          updated.categoryP ? 1 : 0,
          updated.categoryQ ? 1 : 0,
          updated.categoryC ? 1 : 0,
          updated.categoryD ? 1 : 0,
          updated.categoryM ? 1 : 0,
          updated.categoryS ? 1 : 0,
          updated.category5S ? 1 : 0,
          updated.createdBy || null,
          id,
          id,
        ]);
        logger.info(`Updated Suggestion Checksheet in SQL Server: ${id}`);
      } catch (err) {
        logger.error("Failed updating checksheet in SQL Server:", err.message);
      }
    }
        logger.error("Failed updating checksheet in SQL Server:", err.message);
      }
    }

    // Keep fallback store synchronized
    const records = readSuggestionStore();
    const index = records.findIndex((r) => r.id === id);
    if (index !== -1) {
      records[index] = { ...records[index], ...updated };
    } else {
      records.unshift(updated);
    }
    writeSuggestionStore(records);

    return updated;
  }

  static async delete(id) {
    const connected = await isDbConnected();
    if (connected) {
      try {
        await executeQuery(
          `UPDATE suggestion_checksheets SET isDeleted = 1, updatedAt = GETDATE() WHERE checksheetId = ? OR CAST(id AS NVARCHAR(100)) = ?`,
          [id, id]
        );
        logger.info(`Soft-deleted Suggestion Checksheet in SQL Server: ${id}`);
      } catch (err) {
        logger.error("Failed deleting checksheet from SQL Server:", err.message);
      }
    }

    // Also update fallback store
    let records = readSuggestionStore();
    const initialLen = records.length;
    records = records.filter((r) => r.id !== id);
    writeSuggestionStore(records);

    return true;
  }
}

export default SuggestionChecksheetModel;
