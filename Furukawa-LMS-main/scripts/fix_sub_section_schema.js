import { pool } from "../server/db/connectDB.js";

async function fixSubSectionSchema() {
    console.log("Fixing User Sub Section Schema...");

    try {
        // Check if sub_section column exists in users table
        const [result] = await pool.query("SHOW COLUMNS FROM users LIKE 'sub_section'");
        
        if (result.length === 0) {
            console.log("Column sub_section missing. Adding...");
            await pool.query(`ALTER TABLE users ADD COLUMN sub_section VARCHAR(255) DEFAULT NULL AFTER department`);
            console.log("Added sub_section column to users table.");
        } else {
            console.log("Column sub_section already exists.");
        }

        console.log("User Sub Section Schema Check Complete.");
        process.exit(0);
    } catch (error) {
        console.error("Error checking/adding sub_section column:", error.message);
        process.exit(1);
    }
}

fixSubSectionSchema();
