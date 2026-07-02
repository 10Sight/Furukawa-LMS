import { executeQuery } from "../db/mssqlHelper.js";

const parseJSON = (data, fallback = {}) => {
    if (typeof data === "string") {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

// Helper to parse and compare levels
const getLevelWeight = (levelStr, activeLevels) => {
    if (!levelStr) return -99;
    const cleanLevel = String(levelStr).trim().toUpperCase();

    const match = cleanLevel.match(/-?\d+/);
    if (match) return parseInt(match[0]);

    if (activeLevels && Array.isArray(activeLevels)) {
        const found = activeLevels.find(l => l.name.toUpperCase() === cleanLevel);
        if (found && found.order !== undefined) return found.order;
    }

    return -99;
};

async function repair() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "=== RUNNING IN APPLY MODE (CHANGES WILL BE WRITTEN TO DATABASE) ===" : "=== RUNNING IN DRY RUN MODE (NO CHANGES WILL BE WRITTEN) ===");

    try {
        // 1. Fetch active level configuration
        let [configRows] = await executeQuery("SELECT TOP 1 * FROM course_level_configs WHERE isActive = 1 AND isDefault = 1");
        if (configRows.length === 0) {
            [configRows] = await executeQuery("SELECT TOP 1 * FROM course_level_configs WHERE isActive = 1 ORDER BY createdAt DESC");
        }
        const activeLevels = configRows.length > 0 ? parseJSON(configRows[0].levels, []) : [];
        console.log(`Loaded active levels:`, activeLevels.map(l => `${l.name}(order:${l.order})`).join(", "));

        // 2. Fetch machineId -> subSectionId mapping
        const [mRows] = await executeQuery("SELECT id, subSectionId FROM [machines]");
        const machineSubSectionMap = {};
        mRows.forEach(m => {
            if (m.subSectionId != null) {
                machineSubSectionMap[String(m.id)] = String(m.subSectionId);
            }
        });
        console.log(`Loaded ${mRows.length} machines mapping to sub-sections.`);

        // 3. Fetch all saved skill matrices
        const [matrices] = await executeQuery("SELECT id, department, line, month, entries FROM skill_matrices");
        console.log(`Loaded ${matrices.length} skill matrix sheets to analyze.`);

        // Keep track of user updates to avoid redundant writes and show summary
        const userUpdates = {};

        for (const matrix of matrices) {
            const entriesList = parseJSON(matrix.entries, []);
            if (!Array.isArray(entriesList)) continue;

            for (const entry of entriesList) {
                if (entry.userId && !entry.isManual) {
                    const userId = entry.userId;
                    
                    // Fetch user from DB if not already fetched in this run
                    if (!userUpdates[userId]) {
                        const [uRows] = await executeQuery(
                            "SELECT id, fullName, currentLevel, currentSkill, subSectionId, targetSubSectionId FROM users WHERE id = ?",
                            [userId]
                        );
                        if (uRows.length > 0) {
                            const u = uRows[0];
                            userUpdates[userId] = {
                                id: u.id,
                                fullName: u.fullName,
                                dbLevel: u.currentLevel,
                                dbSkillMap: parseJSON(u.currentSkill, {}),
                                subSectionId: u.subSectionId,
                                targetSubSectionId: u.targetSubSectionId,
                                calculatedSkillMap: {}, // we will aggregate from all matching matrices
                                maxWeights: []
                            };
                        }
                    }

                    const uData = userUpdates[userId];
                    if (!uData) continue;

                    // Aggregate station levels from this matrix entry
                    if (entry.stations && Array.isArray(entry.stations)) {
                        entry.stations.forEach(s => {
                            const levelStr = s.curr || "L-1";
                            const stationIdStr = String(s.machineId || "");
                            const subSectionIdStr = machineSubSectionMap[stationIdStr];
                            const weight = getLevelWeight(levelStr, activeLevels);

                            uData.maxWeights.push(weight);

                            if (subSectionIdStr) {
                                const currentMax = uData.calculatedSkillMap[subSectionIdStr];
                                if (!currentMax || weight > getLevelWeight(currentMax, activeLevels)) {
                                    uData.calculatedSkillMap[subSectionIdStr] = levelStr;
                                }
                            }
                        });
                    }
                }
            }
        }

        // Apply changes
        let repairedUsersCount = 0;

        for (const [userId, uData] of Object.entries(userUpdates)) {
            let userChanged = false;
            const finalSkillMap = { ...uData.dbSkillMap };

            // 1. Merge calculated skills into dbSkillMap
            for (const [subSecId, maxLevel] of Object.entries(uData.calculatedSkillMap)) {
                if (finalSkillMap[subSecId] !== maxLevel) {
                    console.log(`  - User ${userId} (${uData.fullName}): skill[${subSecId}] '${finalSkillMap[subSecId] || 'none'}' -> '${maxLevel}' (from matrix entries)`);
                    finalSkillMap[subSecId] = maxLevel;
                    userChanged = true;
                }
            }

            // 2. Resolve target global level
            const activeSubSecId = uData.subSectionId || uData.targetSubSectionId;
            let resolvedLevel = uData.dbLevel;

            if (activeSubSecId) {
                resolvedLevel = finalSkillMap[String(activeSubSecId)] || uData.dbLevel || "L1";
            } else {
                const maxWeight = uData.maxWeights.length > 0 ? Math.max(...uData.maxWeights, 1) : 1;
                resolvedLevel = `L${maxWeight}`;
            }

            if (resolvedLevel !== uData.dbLevel) {
                console.log(`  - User ${userId} (${uData.fullName}): currentLevel '${uData.dbLevel || 'none'}' -> '${resolvedLevel}'`);
                userChanged = true;
            }

            if (userChanged) {
                repairedUsersCount++;
                if (apply) {
                    await executeQuery(
                        "UPDATE users SET currentLevel = ?, currentSkill = ?, updatedAt = GETDATE() WHERE id = ?",
                        [resolvedLevel, JSON.stringify(finalSkillMap), userId]
                    );
                }
            }
        }

        console.log(`\nAnalysis finished. Total users with skill mismatch: ${repairedUsersCount}`);
        if (!apply) {
            console.log("Dry run completed. No database writes were performed. Pass '--apply' parameter to run and fix the database.");
        } else {
            console.log(`Successfully repaired database records for ${repairedUsersCount} users.`);
        }

    } catch (err) {
        console.error("Error during database repair:", err);
    }
    process.exit(0);
}

repair();
