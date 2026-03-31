import { pool } from "../db/connectDB.js";

/**
 * Migration script to add currentLevel column to users table
 */
async function addCurrentLevelColumn() {
    try {
        console.log("Starting migration: Adding currentLevel column to users table...");

        // Check if column already exists
        const [columns] = await pool.query(`
      SHOW COLUMNS FROM users LIKE 'currentLevel'
    `);

        if (columns.length > 0) {
            console.log("✓ currentLevel column already exists. Skipping migration.");
            process.exit(0);
        }

        // Add currentLevel column
        await pool.query(`
      ALTER TABLE users
      ADD COLUMN currentLevel VARCHAR(255) AFTER leavingDate
    `);

        console.log("✓ Successfully added currentLevel column to users table");
        console.log("\n✓ Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("✗ Migration failed:", error.message);
        console.error("Error details:", error);
        process.exit(1);
    }
}

// Run migration
addCurrentLevelColumn();
