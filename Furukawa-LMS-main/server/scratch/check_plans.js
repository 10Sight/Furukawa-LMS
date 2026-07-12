import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

async function run() {
    try {
        const [rows] = await executeQuery("SELECT * FROM skill_upgradation_plans");
        console.log("Found plans count:", rows.length);
        if (rows.length > 0) {
            console.log("Plans preview:", JSON.stringify(rows.slice(0, 5), null, 2));
        }
    } catch (err) {
        console.error("Error executing query:", err);
    }
    process.exit(0);
}

run();
