import { executeQuery } from "../db/mssqlHelper.js";

async function main() {
    try {
        const sql = `
        SELECT 
            id,
            fullName,
            role,
            status,
            isDeleted,
            subSectionId
        FROM users
        WHERE id IN (18649, 19134, 19167, 19174, 19179, 19201, 19207, 19208, 19211)
        `;

        const [rows] = await executeQuery(sql);
        console.log("Details for the 9 users:");
        rows.forEach(r => {
            console.log(`User: ${r.fullName} (ID: ${r.id}) | role: ${r.role} | status: ${r.status} | isDeleted: ${r.isDeleted} | subSectionId: ${r.subSectionId}`);
        });
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

main();
