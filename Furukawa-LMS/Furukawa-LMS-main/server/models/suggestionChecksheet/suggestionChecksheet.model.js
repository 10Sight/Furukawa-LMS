import { readSuggestionStore, writeSuggestionStore } from "../../db/suggestionChecksheet/suggestionChecksheetDb.js";
import logger from "../../logger/winston.logger.js";

class SuggestionChecksheetModel {
  static async getAll({ unit = "", search = "", status = "" } = {}) {
    let records = readSuggestionStore();

    if (unit && unit !== "All Units" && unit !== "All") {
      records = records.filter((r) => r.unit === unit);
    }

    if (status && status !== "All") {
      records = records.filter((r) => r.status === status || r.rejectedAccepted === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter((r) =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.submittedBy || "").toLowerCase().includes(q) ||
        (r.id || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        (r.section || "").toLowerCase().includes(q)
      );
    }

    return records;
  }

  static async getById(id) {
    const records = readSuggestionStore();
    return records.find((r) => r.id === id) || null;
  }

  static async create(data) {
    const records = readSuggestionStore();
    const unitCode = (data.unit || "BWL").substring(0, 3).toUpperCase();
    const newId = data.id || `SC-${unitCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    records.unshift(newRecord);
    writeSuggestionStore(records);
    logger.info(`Created Suggestion Checksheet: ${newId}`);
    return newRecord;
  }

  static async update(id, updateData) {
    const records = readSuggestionStore();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      // If not existing, insert as new record
      return this.create({ ...updateData, id });
    }

    const updated = {
      ...records[index],
      ...updateData,
      id,
      updatedAt: new Date().toISOString(),
    };

    records[index] = updated;
    writeSuggestionStore(records);
    logger.info(`Updated Suggestion Checksheet: ${id}`);
    return updated;
  }

  static async delete(id) {
    let records = readSuggestionStore();
    const initialLength = records.length;
    records = records.filter((r) => r.id !== id);
    writeSuggestionStore(records);
    logger.info(`Deleted Suggestion Checksheet: ${id}`);
    return records.length < initialLength;
  }
}

export default SuggestionChecksheetModel;

