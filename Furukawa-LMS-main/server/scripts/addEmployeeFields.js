import { pool } from "../db/connectDB.js";

/**
 * Migration script to add new employee fields to users table
 * Run this script once to update the database schema
 */
async function addEmployeeFields() {
    try {
        console.log("Starting migration: Adding employee fields to users table...");

        // Check if columns already exist
        const [columns] = await pool.query(`
      SHOW COLUMNS FROM users LIKE 'empId'
    `);

        if (columns.length > 0) {
            console.log("✓ Employee fields already exist. Skipping migration.");
            process.exit(0);
        }

        // Add new columns
        await pool.query(`
      ALTER TABLE users
      ADD COLUMN empId VARCHAR(255) AFTER unit,
      ADD COLUMN isEmployee BOOLEAN DEFAULT FALSE AFTER empId,
      ADD COLUMN isAdmin BOOLEAN DEFAULT FALSE AFTER isEmployee,
      ADD COLUMN isTrainer BOOLEAN DEFAULT FALSE AFTER isAdmin,
      ADD COLUMN shift VARCHAR(100) AFTER isTrainer,
      ADD COLUMN idCard VARCHAR(255) AFTER shift,
      ADD COLUMN privileges VARCHAR(255) AFTER idCard,
      ADD COLUMN joiningDate VARCHAR(255) AFTER privileges,
      ADD COLUMN leavingDate VARCHAR(255) AFTER joiningDate
    `);

        console.log("✓ Successfully added employee fields to users table:");
        console.log("  - empId (VARCHAR 255)");
        console.log("  - isEmployee (BOOLEAN, default: FALSE)");
        console.log("  - isAdmin (BOOLEAN, default: FALSE)");
        console.log("  - isTrainer (BOOLEAN, default: FALSE)");
        console.log("  - shift (VARCHAR 100)");
        console.log("  - idCard (VARCHAR 255)");
        console.log("  - privileges (VARCHAR 255)");
        console.log("  - joiningDate (VARCHAR 255)");
        console.log("  - leavingDate (VARCHAR 255)");

        console.log("\n✓ Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("✗ Migration failed:", error.message);
        console.error("Error details:", error);
        process.exit(1);
    }
}

// Run migration
addEmployeeFields();
