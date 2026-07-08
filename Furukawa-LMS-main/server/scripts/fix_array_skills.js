import { executeQuery } from "../db/mssqlHelper.js";

const parseJSON = (data) => {
    if (typeof data !== "string") return data;
    try { return JSON.parse(data); } catch (e) { return null; }
};

// Converts a corrupted array-shaped skill map (e.g. [null, null, "L3"]) into the
// object shape keyed by index (subSectionId) that the rest of the app expects
// (e.g. {"2": "L3"}). Null/undefined slots are dropped rather than kept as "null" keys.
const arrayToObject = (arr) => {
    const obj = {};
    arr.forEach((val, idx) => {
        if (val !== null && val !== undefined) {
            obj[String(idx)] = val;
        }
    });
    return obj;
};

async function fixArraySkills() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "=== RUNNING IN APPLY MODE (CHANGES WILL BE WRITTEN TO DATABASE) ===" : "=== RUNNING IN DRY RUN MODE (NO CHANGES WILL BE WRITTEN) ===");

    try {
        const [users] = await executeQuery(
            "SELECT id, fullName, currentSkill, skillEffeciency FROM users WHERE currentSkill IS NOT NULL OR skillEffeciency IS NOT NULL"
        );
        console.log(`Loaded ${users.length} users with a currentSkill or skillEffeciency value to inspect.`);

        let affectedCount = 0;

        for (const user of users) {
            const parsedCurrentSkill = parseJSON(user.currentSkill);
            const parsedSkillEffeciency = parseJSON(user.skillEffeciency);

            const currentSkillIsArray = Array.isArray(parsedCurrentSkill);
            const skillEffeciencyIsArray = Array.isArray(parsedSkillEffeciency);

            if (!currentSkillIsArray && !skillEffeciencyIsArray) continue;

            const fixedCurrentSkill = currentSkillIsArray ? arrayToObject(parsedCurrentSkill) : parsedCurrentSkill;
            const fixedSkillEffeciency = skillEffeciencyIsArray ? arrayToObject(parsedSkillEffeciency) : parsedSkillEffeciency;

            affectedCount++;
            console.log(`- User ${user.id} (${user.fullName}):`);
            if (currentSkillIsArray) {
                console.log(`    currentSkill: ${JSON.stringify(parsedCurrentSkill)} -> ${JSON.stringify(fixedCurrentSkill)}`);
            }
            if (skillEffeciencyIsArray) {
                console.log(`    skillEffeciency: ${JSON.stringify(parsedSkillEffeciency)} -> ${JSON.stringify(fixedSkillEffeciency)}`);
            }

            if (apply) {
                await executeQuery(
                    "UPDATE users SET currentSkill = ?, skillEffeciency = ? WHERE id = ?",
                    [JSON.stringify(fixedCurrentSkill || {}), JSON.stringify(fixedSkillEffeciency || {}), user.id]
                );
            }
        }

        console.log(`\nAnalysis finished. Total users with array-shaped skill data: ${affectedCount}`);
        if (!apply) {
            console.log("Dry run completed. No database writes were performed. Pass '--apply' to run and fix the database.");
        } else {
            console.log(`Successfully repaired database records for ${affectedCount} users.`);
        }
    } catch (err) {
        console.error("Error during array skill repair:", err);
    }
    process.exit(0);
}

fixArraySkills();
