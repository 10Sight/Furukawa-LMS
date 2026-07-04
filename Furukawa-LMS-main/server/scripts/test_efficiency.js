import { executeQuery } from "../db/mssqlHelper.js";

async function main() {
    try {
        const sql = `
        SELECT 
            id,
            fullName,
            subSectionId,
            subSections
        FROM users
        WHERE (isDeleted = 0 OR isDeleted IS NULL)
          AND role IN ('STUDENT', 'CUSTOM')
          AND (status IS NULL OR status != 'LEFT')
        `;

        const [users] = await executeQuery(sql);
        console.log("Total users:", users.length);

        const nullSingularWithPlural = users.filter(u => u.subSectionId === null && u.subSections && u.subSections !== '[]' && u.subSections !== '""');
        console.log("Users with NULL subSectionId but populated subSections array:", nullSingularWithPlural.length);

        if (nullSingularWithPlural.length > 0) {
            nullSingularWithPlural.slice(0, 5).forEach(u => {
                console.log(`User: ${u.fullName} (ID: ${u.id}) | subSectionId: ${u.subSectionId} | subSections: ${u.subSections}`);
            });
        }
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

main();
