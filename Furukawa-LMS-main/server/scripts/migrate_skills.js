import { executeQuery } from "../db/mssqlHelper.js";

async function migrateSkills() {
    console.log("Starting skill migration...");
    
    const [users] = await executeQuery("SELECT id, currentLevel, stationId, currentSkill FROM users");
    
    console.log(`Found ${users.length} users to process.`);
    
    let updatedCount = 0;
    
    for (const user of users) {
        if (!user.stationId) continue;
        
        let currentSkill = {};
        if (user.currentSkill) {
            try {
                currentSkill = typeof user.currentSkill === 'string' ? JSON.parse(user.currentSkill) : user.currentSkill;
            } catch (e) {
                currentSkill = {};
            }
        }
        
        // Only update if not already set or different
        if (!currentSkill[user.stationId] || currentSkill[user.stationId] !== user.currentLevel) {
            currentSkill[user.stationId] = user.currentLevel || "L1";
            
            await executeQuery(
                "UPDATE users SET currentSkill = ? WHERE id = ?",
                [JSON.stringify(currentSkill), user.id]
            );
            updatedCount++;
        }
    }
    
    console.log(`Skill migration completed. ${updatedCount} users updated.`);
    process.exit(0);
}

migrateSkills().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
