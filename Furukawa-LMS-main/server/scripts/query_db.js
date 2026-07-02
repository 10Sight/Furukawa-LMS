import { executeQuery } from "../db/mssqlHelper.js";

async function main() {
    try {
        console.log("=== COURSE LEVEL CONFIGS ===");
        const [configs] = await executeQuery("SELECT TOP 5 * FROM course_level_configs");
        configs.forEach(c => {
            console.log(`Config: ${c.name}, levels =`, c.levels);
        });

        console.log("=== USER 14900 ===");
        const [users] = await executeQuery("SELECT id, fullName, currentLevel, currentSkill, subSectionId, targetSubSectionId FROM users WHERE id = 14900");
        console.log(users);
        if (users.length > 0) {
            users.forEach(u => {
                console.log(`User ${u.id} (${u.fullName}): currentSkill =`, u.currentSkill);
            });
        }

        console.log("=== ALL USERS WITH SKILLS ===");
        const [allUsers] = await executeQuery("SELECT TOP 5 id, fullName, currentLevel, currentSkill, subSectionId, targetSubSectionId FROM users WHERE currentSkill IS NOT NULL AND currentSkill != '{}'");
        console.log(allUsers.map(u => ({ ...u, currentSkill: JSON.parse(u.currentSkill) })));

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

main();
