import { executeQuery } from "../db/mssqlHelper.js";

async function run() {
    try {
        const [rows] = await executeQuery("SELECT id, fullName, isDeleted, createdAt FROM users WHERE id IN (12860, 12861, 14535, 18998)");
        console.log("Users details:", JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error("Error executing query:", err);
    }
    process.exit(0);
}

run();
