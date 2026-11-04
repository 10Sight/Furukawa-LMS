import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../logger/winston.logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SUGGESTION_STORE_PATH = path.join(__dirname, "suggestion_checksheet_store.json");

const DUMMY_RECORD_IDS = new Set([
  'SC-BWL-1021',
  'SC-BWL-1024',
  'SC-BWL-1029',
  'SC-GJT-2015',
  'SC-GJT-2018',
  'SC-GJR-2015',
]);

export const SEED_SUGGESTION_CHECKSHETS = [];

export function readSuggestionStore() {
  try {
    if (fs.existsSync(SUGGESTION_STORE_PATH)) {
      const raw = fs.readFileSync(SUGGESTION_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((r) => !DUMMY_RECORD_IDS.has(r?.id));
        if (clean.length !== parsed.length) {
          writeSuggestionStore(clean);
        }
        return clean;
      }
    }
  } catch (e) {
    logger.warn("Failed reading Suggestion Checksheet persistence store:", e.message);
  }
  return [];
}

export function writeSuggestionStore(records) {
  try {
    const dir = path.dirname(SUGGESTION_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const clean = Array.isArray(records) ? records.filter((r) => !DUMMY_RECORD_IDS.has(r?.id)) : [];
    fs.writeFileSync(SUGGESTION_STORE_PATH, JSON.stringify(clean, null, 2), "utf-8");
  } catch (e) {
    logger.error("Failed writing Suggestion Checksheet persistence store:", e.message);
  }
}
