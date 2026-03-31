import { pool } from "../db/connectDB.js";
import logger from "../logger/winston.logger.js";
import dotenv from "dotenv";

dotenv.config();

const addLevelStartDate = async () => {
    try {
        console.log("Adding levelStartDate column to progress table...");

        // Check if column exists
        const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
      AND TABLE_NAME = 'progress' 
      AND COLUMN_NAME = 'levelStartDate'
    `);

        if (columns.length > 0) {
            console.log("Column levelStartDate already exists.");
            return;
        }

        // Add column
        await pool.query("ALTER TABLE progress ADD COLUMN levelStartDate DATETIME DEFAULT NULL AFTER currentLevel");

        // Update existing records: default to createdAt
        await pool.query("UPDATE progress SET levelStartDate = createdAt WHERE levelStartDate IS NULL");

        console.log("Successfully added levelStartDate column.");
    } catch (error) {
        console.error("Error adding levelStartDate column:", error);
    } finally {
        process.exit();
    }
};

addLevelStartDate();
