import { executeQuery } from "../server/db/mssqlHelper.js";

async function migrateQuizzes() {
    console.log("Starting quiz migration...");
    try {
        const [result] = await executeQuery("UPDATE quizzes SET isDojo = 0 WHERE isDojo IS NULL");
        console.log(`Updated existing quizzes. Rows affected: ${result.rowsAffected}`);
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

migrateQuizzes();
