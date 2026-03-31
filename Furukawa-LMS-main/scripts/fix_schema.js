
import { pool } from "../server/db/connectDB.js";

async function fix() {
    console.log("Fixing Schema...");

    // Fix Lines
    try {
        console.log("Checking 'lines' table for sectionId...");
        await pool.query(`ALTER TABLE \`lines\` ADD COLUMN sectionId INT`);
        console.log("Added sectionId to lines.");
    } catch (e) {
        console.log("Error adding sectionId to lines (might exist):", e.message);
    }

    try {
        await pool.query(`ALTER TABLE \`lines\` ADD CONSTRAINT fk_line_section FOREIGN KEY (sectionId) REFERENCES departments(id) ON DELETE SET NULL`);
        console.log("Added FK to lines.");
    } catch (e) {
        console.log("Error adding FK to lines (might exist):", e.message);
    }

    process.exit(0);
}

fix();
