import { executeQuery } from "../db/mssqlHelper.js";

async function runCheck() {
    try {
        const [rows] = await executeQuery("SELECT * FROM headcount_reports");
        console.log(`Found ${rows.length} headcount reports`);
        rows.forEach(r => {
            console.log(`Report ID: ${r.id}, Department: ${r.departmentId}, Month: ${r.month}, Year: ${r.year}`);
            try {
                const data = JSON.parse(r.tableData);
                console.log("Keys starting with 'Present in Training Cell':");
                const matchedKeys = Object.keys(data).filter(k => k.startsWith("Present in Training Cell")).sort();
                matchedKeys.forEach(k => {
                    console.log(`  ${k}: ${data[k]}`);
                });
            } catch (err) {
                console.error("Error parsing tableData", err);
            }
        });
    } catch (e) {
        console.error("Error running script:", e);
    }
}

runCheck();
