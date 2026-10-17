import RevisionRecord from "../models/revisionRecord.model.js";
import RevisionHistory from "../models/revisionHistory.model.js";
import RevisionPropagationService from "./revisionPropagation.service.js";
import { ApiError } from "../utils/ApiError.js";
import logger from "../logger/winston.logger.js";

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
    // and not changed here), rewrites the doc/revision copy on every saved form it
    // governs, then writes an immutable snapshot into revision_history attributed
    // to the acting user. Returns the record plus `propagatedCount`.
    static async updateRecord(id, updateData, user) {
        const existing = await RevisionRecord.findById(id);
        if (!existing) throw new ApiError("Revision record not found", 404);

        const updated = await RevisionRecord.update(id, updateData);
        return this._propagateAndLog(updated, user);
    }

    // Saved forms a record at this scope governs — shown to the admin before
    // saving so the reach of an edit is visible up front.
    static async previewPropagation(sheetKey, departmentId = null, sectionId = null) {
        return {
            sheetKey,
            propagated: RevisionPropagationService.isPropagated(sheetKey),
            affectedCount: await RevisionPropagationService.countAffected(sheetKey, departmentId, sectionId),
        };
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

        return this._propagateAndLog(saved, user);
    }

    // If propagation fails the record itself is already saved; the history row
    // still records the edit (propagatedCount NULL) and the caller gets an error
    // telling them to save again — propagation is idempotent, so a re-save fixes it.
    static async _propagateAndLog(record, user) {
        let propagatedCount = null;
        let propagationError = null;
        try {
            propagatedCount = await RevisionPropagationService.propagate(record);
        } catch (error) {
            propagationError = error;
            logger.error(`Revision propagation failed for ${record.sheetKey} (record ${record.id}): ${error.message}`);
        }

        await this._logHistory(record, user, propagatedCount);

        if (propagationError) {
            throw new ApiError("Revision saved, but updating already-saved sheets failed. Please save again to retry.", 500);
        }
        return { ...record, propagatedCount };
    }

    static async _logHistory(record, user, propagatedCount = null) {
        await RevisionHistory.create({
            revisionRecordId: record.id,
            sheetKey: record.sheetKey,
            sheetName: record.sheetName,
            departmentId: record.departmentId,
            sectionId: record.sectionId,
            docNo: record.docNo,
            revNo: record.revNo,
            issueDate: record.issueDate,
            revDate: record.revDate,
            affectedSrNoPage: record.affectedSrNoPage,
            affectedSrNoPageHi: record.affectedSrNoPageHi,
            changeDetails: record.changeDetails,
            changeDetailsHi: record.changeDetailsHi,
            updatedBy: user?.id ?? null,
            updatedByName: user?.fullName ?? null,
            propagatedCount,
        });
    }
}

export default RevisionRecordService;
