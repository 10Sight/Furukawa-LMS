import { executeQuery } from "./db/mssqlHelper.js";
import dotenv from "dotenv";
dotenv.config();

async function test() {
    try {
        console.log("Fetching student users...");
        const [rows] = await executeQuery("SELECT id, fullName, empId, role, subSectionId, targetSubSectionId, currentEffeciency, skillEffeciency, currentLevel FROM users WHERE id IN (13057, 14535)");
        console.log("Students:", JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error("Test failed with error:", e);
    } finally {
        process.exit(0);
    }
}

test();
