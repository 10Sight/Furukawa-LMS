
import { executeQuery } from "../server/db/mssqlHelper.js";

async function checkOrphans() {
    console.log("Checking for orphaned lines...");
    
    const query = `
        SELECT l.id, l.name, l.sectionId, s.name as sectionName
        FROM [lines] l
        LEFT JOIN [sections] s ON l.sectionId = s.id
        WHERE s.id IS NULL
    `;
    
    try {
        const [rows] = await executeQuery(query);
        if (rows.length === 0) {
            console.log("No orphaned lines found.");
        } else {
            console.log(`Found ${rows.length} orphaned lines:`);
            rows.forEach(row => {
                console.log(`- ID: ${row.id}, Name: ${row.name}, sectionId: ${row.sectionId}`);
            });
        }
    } catch (error) {
        console.error("Error checking orphans:", error);
    }
    process.exit(0);
}

checkOrphans();
