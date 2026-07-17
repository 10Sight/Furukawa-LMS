import { executeQuery } from "../db/mssqlHelper.js";

const parseJSON = (data, fallback = {}) => {
    if (typeof data === "string") {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

// One-time cleanup for skill_matrices.entries[].stations[].curr values polluted by a
// frontend bug: unassigned stations used to fall back to the operator's global
// currentLevel instead of staying blank, and every save persisted that fallback
// verbatim into skill_matrices.entries. This resets curr back to null for any
// saved station where the operator is neither assigned to that sub-section nor has
// a matching currentSkill[subSectionId] entry — i.e. exactly what a fresh
// (never-saved) sheet would compute today. Mirrors the isAssigned/hasSkill logic
// in admin/src/pages/Admin/SkillMatrix.jsx so cleaned sheets render identically to
// how a brand-new sheet would.
//
// Usage:
//   node scripts/fix_stale_skill_matrix_curr.js          (dry run, logs only)
//   node scripts/fix_stale_skill_matrix_curr.js --apply  (writes changes)

async function run() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "=== APPLY MODE: changes will be written ===" : "=== DRY RUN: no changes will be written (pass --apply to write) ===");

    // 1. machine -> subSectionId map
    const [machineRows] = await executeQuery("SELECT id, subSectionId FROM [machines]");
    const machineSubSectionMap = {};
    machineRows.forEach(m => {
        if (m.subSectionId != null) machineSubSectionMap[String(m.id)] = String(m.subSectionId);
    });

    // 2. per-user assigned sub-sections (primary station + machine_assignments, resolved to subSectionId) and currentSkill map
    const [userRows] = await executeQuery("SELECT id, stationId, currentSkill FROM users WHERE isDeleted = 0 OR isDeleted IS NULL");
    const [assignmentRows] = await executeQuery("SELECT user_id, machine_id FROM machine_assignments");

    const userAssignedSubSections = {}; // userId -> Set(subSectionId)
    const userSkillMap = {}; // userId -> currentSkill object

    userRows.forEach(u => {
        userAssignedSubSections[u.id] = new Set();
        if (u.stationId != null) {
            const subId = machineSubSectionMap[String(u.stationId)];
            if (subId) userAssignedSubSections[u.id].add(subId);
        }
        userSkillMap[u.id] = parseJSON(u.currentSkill, {});
    });
    assignmentRows.forEach(a => {
        const subId = machineSubSectionMap[String(a.machine_id)];
        if (!subId) return;
        if (!userAssignedSubSections[a.user_id]) userAssignedSubSections[a.user_id] = new Set();
        userAssignedSubSections[a.user_id].add(subId);
    });

    // 3. scan all saved matrices
    const [matrices] = await executeQuery("SELECT id, department, line, month, entries FROM skill_matrices");
    console.log(`Scanning ${matrices.length} saved skill matrix sheet(s)...`);

    let sheetsChanged = 0;
    let cellsCleared = 0;

    for (const matrix of matrices) {
        const entriesList = parseJSON(matrix.entries, []);
        if (!Array.isArray(entriesList)) continue;

        let sheetChanged = false;

        for (const entry of entriesList) {
            if (!entry.userId || entry.isManual) continue;
            const userId = entry.userId;
            const assignedSubSections = userAssignedSubSections[userId] || new Set();
            const skillMap = userSkillMap[userId] || {};

            if (!Array.isArray(entry.stations)) continue;

            for (const station of entry.stations) {
                if (!station.curr || station.curr === '-' || station.curr === 'L-0') continue;

                const machineIdStr = String(station.machineId || "");
                const subSectionIdStr = machineSubSectionMap[machineIdStr];

                const isAssigned = subSectionIdStr && assignedSubSections.has(subSectionIdStr);
                const matchesSkill = subSectionIdStr && skillMap[subSectionIdStr] === station.curr;

                if (!isAssigned && !matchesSkill) {
                    console.log(`  Sheet #${matrix.id} (${matrix.department}/${matrix.line}/${matrix.month}): user ${userId} station ${machineIdStr} curr '${station.curr}' -> null (not assigned, no matching skill)`);
                    station.curr = null;
                    sheetChanged = true;
                    cellsCleared++;
                }
            }
        }

        if (sheetChanged) {
            sheetsChanged++;
            if (apply) {
                await executeQuery("UPDATE skill_matrices SET entries = ? WHERE id = ?", [JSON.stringify(entriesList), matrix.id]);
            }
        }
    }

    console.log(`\nDone. Sheets ${apply ? 'updated' : 'that would be updated'}: ${sheetsChanged}, cells cleared: ${cellsCleared}.`);
    if (!apply) {
        console.log("Dry run completed. No database writes were performed. Pass '--apply' to write.");
    }
    process.exit(0);
}

run().catch(err => {
    console.error("Cleanup failed:", err);
    process.exit(1);
});
