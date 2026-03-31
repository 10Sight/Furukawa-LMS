import { pool } from "../server/db/connectDB.js";

async function fixDepartmentSchema() {
    console.log("Fixing Department Schema...");

    try {
        // Check if uniCode column exists
        const [result] = await pool.query("SHOW COLUMNS FROM departments LIKE 'uniCode'");
        
        if (result.length === 0) {
            console.log("Column uniCode missing. Adding...");
            await pool.query(`ALTER TABLE departments ADD COLUMN uniCode VARCHAR(255) UNIQUE AFTER name`);
            console.log("Added uniCode column to departments table.");
        } else {
            console.log("Column uniCode already exists.");
        }
    } catch (error) {
        console.error("Error checking/adding uniCode column:", error.message);
    }

    console.log("Department Schema Check Complete.");
    process.exit(0);
}

fixDepartmentSchema();
