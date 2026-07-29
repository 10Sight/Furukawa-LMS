import RevisionRecord from "../models/revisionRecord.model.js";
import RevisionHistory from "../models/revisionHistory.model.js";
import { ApiError } from "../utils/ApiError.js";

class RevisionRecordService {
    // Every row that exists (global defaults + all department/section overrides),
    // optionally narrowed by department/section/sheetKey, or restricted to just
    // the global rows via isGlobal. The admin directory list passes isGlobal so
    // it shows one row per sheet; the per-sheet detail page passes sheetKey so it
    // shows that sheet's global row plus all of its overrides.
    static async getAllRecords(departmentId = null, sectionId = null, sheetKey = null, isGlobal = false) {
        return RevisionRecord.findAll({ departmentId, sectionId, sheetKey, isGlobal });
    }

    static async getHistoryLogs(departmentId = null, sectionId = null, sheetKey = null) {
        return RevisionHistory.findAll({ departmentId, sectionId, sheetKey });
    }

    // Most-specific match for a sheet given a department/section context — what a
    // form should actually display. Falls back department+section -> department-only
    // -> global default.
    static async getLatestForSheet(sheetKey, departmentId = null, sectionId = null) {
        return RevisionRecord.findLatestForScope(sheetKey, departmentId, sectionId);
    }

    // Updates an existing record by id (its own department/section scope is fixed
    // and not changed here), then writes an immutable snapshot into revision_history
    // attributed to the acting user.
    static async updateRecord(id, updateData, user) {
        const existing = await RevisionRecord.findById(id);
        if (!existing) throw new ApiError("Revision record not found", 404);

        const updated = await RevisionRecord.update(id, updateData);
        await this._logHistory(updated, user);
        return updated;
    }

    // Saves a department/section-specific override: updates the exact-scope row if
    // one already exists, otherwise creates it. Used by the Revision Table's "Add
    // Department Override" flow.
    static async upsertForScope(sheetKey, departmentId, sectionId, updateData, user) {
        const existing = await RevisionRecord.findExactScope(sheetKey, departmentId, sectionId);

        let saved;
        if (existing) {
            saved = await RevisionRecord.update(existing.id, updateData);
        } else {
            if (!updateData.sheetName) {
                throw new ApiError("sheetName is required to create a new revision record", 400);
            }
            saved = await RevisionRecord.create({
                sheetKey,
                sheetName: updateData.sheetName,
                departmentId,
                sectionId,
                ...updateData,
            });
        }

        await this._logHistory(saved, user);
        return saved;
    }

    static async _logHistory(record, user) {
        await RevisionHistory.create({
            revisionRecordId: record.id,
            sheetKey: record.sheetKey,
            sheetName: record.sheetName,
            departmentId: record.departmentId,
            sectionId: record.sectionId,
            docNo: record.docNo,
            revNo: record.revNo,
            revDate: record.revDate,
            affectedSrNoPage: record.affectedSrNoPage,
            affectedSrNoPageHi: record.affectedSrNoPageHi,
            changeDetails: record.changeDetails,
            changeDetailsHi: record.changeDetailsHi,
            updatedBy: user?.id ?? null,
            updatedByName: user?.fullName ?? null,
        });
    }
}

export default RevisionRecordService;
