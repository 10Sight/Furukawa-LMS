import { executeQuery } from "../db/mssqlHelper.js";

async function main() {
    try {
        console.log("=== COURSE LEVEL CONFIGS ===");
        const [configs] = await executeQuery("SELECT TOP 5 * FROM course_level_configs");
        configs.forEach(c => {
            console.log(`Config: ${c.name}, levels =`, c.levels);
        });

        console.log("=== USERS FROM MATRIX 16 ===");
        const [users] = await executeQuery("SELECT id, fullName, currentLevel, currentSkill, subSectionId, targetSubSectionId FROM users WHERE id IN (17489, 17483, 16803, 15056, 14656)");
        if (users.length > 0) {
            users.forEach(u => {
                console.log(`User ${u.id} (${u.fullName}): currentLevel = ${u.currentLevel}, activeSubSecId = ${u.subSectionId || u.targetSubSectionId}, currentSkill =`, u.currentSkill);
            });
        }

        console.log("=== SKILL MATRICES ENTRIES ===");
        const [matrices] = await executeQuery("SELECT id, department, line, month, entries FROM skill_matrices");
        matrices.forEach(m => {
            console.log(`\nMatrix ID: ${m.id} | Department: ${m.department} | Line: ${m.line} | Month: ${m.month}`);
            const entriesList = typeof m.entries === 'string' ? JSON.parse(m.entries) : m.entries;
            (entriesList || []).forEach(e => {
                if (!e.isManual) {
                    console.log(`  - User ${e.userId || e._id} (${e.name}): stations =`, JSON.stringify(e.stations));
                } else {
                    console.log(`  - Manual Entry (${e.manualName || e.name})`);
                }
            });
        });

        console.log("=== ALL USERS WITH SKILLS (IN USERS TABLE) ===");
        const [allUsers] = await executeQuery("SELECT TOP 5 id, fullName, currentLevel, currentSkill, subSectionId, targetSubSectionId FROM users WHERE currentSkill IS NOT NULL AND currentSkill != '{}'");
        console.log(allUsers.map(u => ({ ...u, currentSkill: JSON.parse(u.currentSkill) })));

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

main();
