import { executeQuery } from "../db/mssqlHelper.js";

async function runCheck() {
    try {
        console.log("Fetching all skill upgradation plans...");
        const [plans] = await executeQuery(`SELECT id, departmentId, sectionId, year, tableData FROM skill_upgradation_plans`);
        console.log(`Found ${plans.length} plans.`);

        let mismatchCount = 0;
        for (const plan of plans) {
            const tableData = typeof plan.tableData === "string" ? JSON.parse(plan.tableData) : plan.tableData || {};
            const year = plan.year;

            for (const [userId, userPlan] of Object.entries(tableData)) {
                if (userId === "__removedUserIds") continue;

                // Check quarters
                const quarters = ["q1", "q2", "q3", "q4"];
                const quarterMonths = {
                    q1: [1, 2, 3],
                    q2: [4, 5, 6],
                    q3: [7, 8, 9],
                    q4: [10, 11, 12]
                };

                for (const q of quarters) {
                    const planDate = userPlan[`${q}Date`];
                    const actualDate = userPlan[`${q}DateActual`];

                    const checkDate = (dateVal, fieldName) => {
                        if (!dateVal) return;
                        const [y, m, d] = dateVal.split("-").map(Number);
                        if (!y || !m) {
                            console.log(`[MISMATCH Format] Plan ID: ${plan.id}, Year: ${year}, User: ${userId}, Field: ${fieldName}, Value: ${dateVal}`);
                            mismatchCount++;
                            return;
                        }
                        // Check year mismatch
                        if (y !== year) {
                            console.log(`[MISMATCH Year] Plan ID: ${plan.id}, Plan Year: ${year}, Date: ${dateVal}, User: ${userId}, Field: ${fieldName}`);
                            mismatchCount++;
                        }
                        // Check quarter mismatch
                        const allowedMonths = quarterMonths[q];
                        if (!allowedMonths.includes(m)) {
                            console.log(`[MISMATCH Quarter] Plan ID: ${plan.id}, Plan Year: ${year}, Date: ${dateVal}, User: ${userId}, Field: ${fieldName} (Expected Quarter: ${q})`);
                            mismatchCount++;
                        }
                    };

                    checkDate(planDate, `${q}Date`);
                    checkDate(actualDate, `${q}DateActual`);
                }
            }
        }

        console.log(`Total mismatching dates found: ${mismatchCount}`);
    } catch (error) {
        console.error("Error running check:", error);
    } finally {
        process.exit(0);
    }
}

runCheck();
