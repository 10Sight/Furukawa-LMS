import { executeQuery } from "./db/mssqlHelper.js";
import dotenv from "dotenv";
dotenv.config();

async function test() {
    try {
        console.log("Testing executeQuery with undefined...");
        const result = await executeQuery("SELECT ? as val", [undefined]);
        console.log("Result:", result);
    } catch (e) {
        console.error("Test failed with error:", e);
    } finally {
        process.exit(0);
    }
}

test();
