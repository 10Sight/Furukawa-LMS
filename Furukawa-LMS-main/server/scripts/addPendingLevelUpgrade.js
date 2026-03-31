import { pool } from "../db/connectDB.js";
import logger from "../logger/winston.logger.js";
import dotenv from "dotenv";

dotenv.config();

const addPendingLevelColumn = async () => {
    try {
        console.log("Adding pendingLevelUpgrade column to progress table...");

        const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
      AND TABLE_NAME = 'progress' 
      AND COLUMN_NAME = 'pendingLevelUpgrade'
    `);

        if (columns.length > 0) {
            console.log("Column pendingLevelUpgrade already exists.");
            return;
        }

        await pool.query("ALTER TABLE progress ADD COLUMN pendingLevelUpgrade VARCHAR(50) DEFAULT NULL AFTER levelStartDate");
        console.log("Successfully added pendingLevelUpgrade column.");
    } catch (error) {
        console.error("Error adding pendingLevelUpgrade column:", error);
    } finally {
        process.exit();
    }
};

addPendingLevelColumn();
