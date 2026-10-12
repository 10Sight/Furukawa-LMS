import { executeQuery } from "../mssqlHelper.js";
import migrationHelper from "../migrationHelper.js";
import { poolPromise } from "../connectDB.js";
import logger from "../../logger/winston.logger.js";
import fs from "fs";
import path from "path";

export const PDCA_STORE_PATH = path.join(process.cwd(), "db", "pdca", "pdca_persistence_store.json");

/**
 * Checks if the central MSSQL pool is connected and active
 */
export async function isDbConnected() {
    try {
        const pool = await poolPromise;
        return Boolean(pool);
    } catch {
        return false;
    }
}

/**
 * Reads PDCA fallback persistent data
 */
export function readPdcaStore() {
    try {
        if (fs.existsSync(PDCA_STORE_PATH)) {
            const raw = fs.readFileSync(PDCA_STORE_PATH, "utf-8");
            return JSON.parse(raw);
        }
    } catch (e) {
        logger.warn("Failed reading PDCA persistence store:", e.message);
    }
    return {
        records: [],
        sheets: {},
        cftTopics: [],
        attachments: [],
        auditLogs: []
    };
}

/**
 * Writes PDCA persistent data to disk
 */
export function writePdcaStore(store) {
    try {
        const dir = path.dirname(PDCA_STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PDCA_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
    } catch (e) {
        logger.error("Failed writing PDCA persistence store:", e.message);
    }
}

export { executeQuery, migrationHelper, poolPromise };
