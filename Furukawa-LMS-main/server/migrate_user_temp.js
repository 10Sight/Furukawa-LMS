import { executeQuery } from "./server/db/mssqlHelper.js";

async function migrate() {
    try {
        console.log("Checking for isTemporary column...");
        const [columns] = await executeQuery("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'isTemporary'");
        
        if (columns.length === 0) {
            console.log("Adding isTemporary column to users table...");
            await executeQuery("ALTER TABLE users ADD isTemporary BIT DEFAULT 0");
            console.log("Column added successfully.");
        } else {
            console.log("isTemporary column already exists.");
        }
    } catch (error) {
        console.error("Migration failed:", error.message);
    } finally {
        process.exit();
    }
}

migrate();
