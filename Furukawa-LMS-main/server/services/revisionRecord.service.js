import RevisionRecord from "../models/revisionRecord.model.js";
import RevisionHistory from "../models/revisionHistory.model.js";
import { ApiError } from "../utils/ApiError.js";

class RevisionRecordService {
    static async getAllRecords() {
        return RevisionRecord.findAll();
    }

    static async getHistoryLogs() {
        return RevisionHistory.findAll();
    }

    static async getLatestForSheet(sheetKey) {
        return RevisionRecord.findBySheetKey(sheetKey);
    }

    // Updates the active record, then writes an immutable snapshot of the new state
    // into revision_history attributed to the acting user.
    static async updateRecord(id, updateData, user) {
        const existing = await RevisionRecord.findById(id);
        if (!existing) throw new ApiError("Revision record not found", 404);

        const updated = await RevisionRecord.update(id, updateData);

        await RevisionHistory.create({
            revisionRecordId: updated.id,
            sheetKey: updated.sheetKey,
            sheetName: updated.sheetName,
            docNo: updated.docNo,
            revNo: updated.revNo,
            revDate: updated.revDate,
            affectedSrNoPage: updated.affectedSrNoPage,
            affectedSrNoPageHi: updated.affectedSrNoPageHi,
            changeDetails: updated.changeDetails,
            changeDetailsHi: updated.changeDetailsHi,
            updatedBy: user?.id ?? null,
            updatedByName: user?.fullName ?? null,
        });

        return updated;
    }
}

export default RevisionRecordService;
