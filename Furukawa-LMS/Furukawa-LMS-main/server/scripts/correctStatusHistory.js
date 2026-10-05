import { executeQuery } from "../db/mssqlHelper.js";

// One-time utility script to clean up users statusHistory column entries.
// Specifically, merges adjacent entries with the same joiningDate where the 
// second entry marks the user's exit (status: "LEFT").
//
// Usage:
//   node scripts/correctStatusHistory.js          (dry run, logs only)
//   node scripts/correctStatusHistory.js --apply  (writes changes to database)

const parseJSON = (data, fallback) => {
    if (typeof data === "string") {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

async function runCleanup() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "Running in APPLY mode — changes will be written to the DB." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

    try {
        console.log("Fetching users with statusHistory entries...");
        const [users] = await executeQuery(`
            SELECT id, empId, fullName, statusHistory 
            FROM users 
            WHERE statusHistory IS NOT NULL AND statusHistory <> '[]'
        `);

        console.log(`Scanning ${users.length} user(s).`);
        let usersUpdated = 0;
        let entriesMergedCount = 0;

        for (const user of users) {
            let history = parseJSON(user.statusHistory, []);
            if (!Array.isArray(history) || history.length < 2) continue;

            let userChanged = false;

            // Iterate and merge adjacent entries with matching joiningDate where the second is 'LEFT'
            for (let i = 0; i < history.length - 1; i++) {
                const current = history[i];
                const next = history[i + 1];

                if (
                    current && next &&
                    current.joiningDate &&
                    current.joiningDate === next.joiningDate &&
                    current.status !== 'LEFT' &&
                    next.status === 'LEFT'
                ) {
                    console.log(`[user ${user.id} (${user.empId} - ${user.fullName})] Merging statusHistory stint entries:`);
                    console.log(`  Current:`, JSON.stringify(current));
                    console.log(`  Next (LEFT):`, JSON.stringify(next));

                    // Merge next's leaving info into current
                    current.status = 'LEFT';
                    current.leavingDate = next.leavingDate;
                    current.changedBy = next.changedBy ?? current.changedBy;
                    current.changedByName = next.changedByName ?? current.changedByName;
                    current.changedAt = next.changedAt ?? current.changedAt;

                    // Remove the redundant next entry
                    history.splice(i + 1, 1);
                    userChanged = true;
                    entriesMergedCount++;
                    
                    // Adjust index to re-evaluate after array shift
                    i--;
                }
            }

            if (userChanged) {
                usersUpdated++;
                if (apply) {
                    await executeQuery(
                        "UPDATE users SET statusHistory = ? WHERE id = ?",
                        [JSON.stringify(history), user.id]
                    );
                }
            }
        }

        console.log(`\n${apply ? "Updated" : "Would update"} ${usersUpdated} user(s), merging ${entriesMergedCount} redundant 'LEFT' entry/entries.`);
        console.log("Done.");
        process.exit(0);
    } catch (error) {
        console.error("Cleanup failed:", error);
        process.exit(1);
    }
}

runCleanup();
