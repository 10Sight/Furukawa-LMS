import { executeQuery } from "./db/mssqlHelper.js";
import dotenv from "dotenv";
dotenv.config();

async function test() {
    try {
        console.log("Fetching existing evaluations...");
        const [rows] = await executeQuery("SELECT TOP 10 * FROM skill_matrix_evaluations ORDER BY updatedAt DESC");
        console.log("Rows count:", rows.length);
        console.log("Evaluations:", JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error("Test failed with error:", e);
    } finally {
        process.exit(0);
    }
}

test();
