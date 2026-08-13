import { executeQuery } from "../db/mssqlHelper.js";

async function runCheck() {
    try {
        const [plan4] = await executeQuery(`SELECT * FROM skill_upgradation_plans WHERE id = 4`);
        const p4Data = JSON.parse(plan4[0].tableData);
        console.log("Plan 4 User 19625:", JSON.stringify(p4Data["19625"], null, 2));

        const [plan5] = await executeQuery(`SELECT * FROM skill_upgradation_plans WHERE id = 5`);
        const p5Data = JSON.parse(plan5[0].tableData);
        console.log("Plan 5 User 16824:", JSON.stringify(p5Data["16824"], null, 2));
        console.log("Plan 5 User 17294:", JSON.stringify(p5Data["17294"], null, 2));
        console.log("Plan 5 User 19711:", JSON.stringify(p5Data["19711"], null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
runCheck();
