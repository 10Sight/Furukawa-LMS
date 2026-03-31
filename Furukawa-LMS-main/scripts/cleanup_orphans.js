
import { executeQuery } from "../server/db/mssqlHelper.js";

async function cleanupOrphans() {
    console.log("Cleaning up orphaned lines...");
    
    const query = `
        DELETE l
        FROM [lines] l
        LEFT JOIN [sections] s ON l.sectionId = s.id
        WHERE s.id IS NULL
    `;
    
    try {
        await executeQuery(query);
        console.log("Orphaned lines cleaned up successfully.");
    } catch (error) {
        console.error("Error cleaning up orphans:", error);
    }
    process.exit(0);
}

cleanupOrphans();
