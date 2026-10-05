import { executeQuery } from "../db/mssqlHelper.js";
import Section from "../models/section.model.js";
import Line from "../models/line.model.js";
import SubSection from "../models/subSection.model.js";

// Repairs references left dangling when a section row is deleted/recreated.
//
// Two modes:
//   Sync (default)  - the section still exists but under a NEW id (e.g. it was deleted then
//                      recreated). Rewrites references in users/lines/ten_cycle_sheets/etc.
//                      that still point at the OLD id so they point at the current one.
//   --recreate      - the section row itself is missing. Re-inserts it with its ORIGINAL id
//                      via IDENTITY_INSERT so every existing reference (which was never
//                      touched) becomes valid again without a single other row changing.
//
// Usage:
//   node scripts/recoverDeletedSection.js --sectionId <id>                       (dry run, sync mode)
//   node scripts/recoverDeletedSection.js --sectionId <id> --apply               (sync mode, writes)
//   node scripts/recoverDeletedSection.js --sectionId <id> --recreate            (dry run, restore mode)
//   node scripts/recoverDeletedSection.js --sectionId <id> --recreate --apply    (restore mode, writes)
//
// Optional overrides: --sectionName <name> --departmentId <id> --oldSectionId <id>

function parseArgs(argv) {
    const args = { apply: false, recreate: false };
    for (let i = 0; i < argv.length; i++) {
        switch (argv[i]) {
            case "--apply": args.apply = true; break;
            case "--recreate": args.recreate = true; break;
            case "--sectionId": args.sectionId = parseInt(argv[++i], 10); break;
            case "--oldSectionId": args.oldSectionId = parseInt(argv[++i], 10); break;
            case "--departmentId": args.departmentId = parseInt(argv[++i], 10); break;
            case "--sectionName": args.sectionName = argv[++i]; break;
            default: break;
        }
    }
    return args;
}

const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

// --- Restore mode: section row is gone, re-insert it with its original id -------------------

async function detectRecreateDefaults(sectionId) {
    const [byUsers] = await executeQuery(
        `SELECT TOP 1 section AS name, COUNT(*) as cnt
         FROM users
         WHERE sectionId = ? AND section IS NOT NULL AND section <> ''
         GROUP BY section ORDER BY cnt DESC`,
        [sectionId]
    );
    const [deptByUsers] = await executeQuery(
        `SELECT TOP 1 departmentId, COUNT(*) as cnt
         FROM users
         WHERE sectionId = ? AND departmentId IS NOT NULL
         GROUP BY departmentId ORDER BY cnt DESC`,
        [sectionId]
    );
    const [deptByLines] = await executeQuery(
        `SELECT TOP 1 department AS departmentId, COUNT(*) as cnt
         FROM [lines]
         WHERE sectionId = ?
         GROUP BY department ORDER BY cnt DESC`,
        [sectionId]
    );

    return {
        name: byUsers[0]?.name || null,
        departmentId: deptByUsers[0]?.departmentId || deptByLines[0]?.departmentId || null
    };
}

async function runRecreate(args) {
    const [existingRows] = await executeQuery("SELECT id FROM [sections] WHERE id = ?", [args.sectionId]);
    if (existingRows.length > 0) {
        console.error(`Section ${args.sectionId} already exists. Use sync mode (without --recreate) to align references instead.`);
        process.exitCode = 1;
        return;
    }

    let name = args.sectionName || null;
    let departmentId = args.departmentId || null;

    if (!name || !departmentId) {
        const detected = await detectRecreateDefaults(args.sectionId);
        if (!name) name = detected.name;
        if (!departmentId) departmentId = detected.departmentId;
    }

    if (!name) {
        console.error(`Could not auto-detect a name for section ${args.sectionId}. Pass --sectionName <name> explicitly.`);
        process.exitCode = 1;
        return;
    }
    if (!departmentId) {
        console.error(`Could not auto-detect a departmentId for section ${args.sectionId}. Pass --departmentId <id> explicitly.`);
        process.exitCode = 1;
        return;
    }

    const [deptRows] = await executeQuery("SELECT id FROM departments WHERE id = ?", [departmentId]);
    if (deptRows.length === 0) {
        console.error(`departmentId ${departmentId} does not exist in departments table.`);
        process.exitCode = 1;
        return;
    }

    const uniCode = `SEC-${args.sectionId}`;
    const [uniCodeClash] = await executeQuery("SELECT id FROM [sections] WHERE uniCode = ?", [uniCode]);
    if (uniCodeClash.length > 0) {
        console.error(`Generated uniCode '${uniCode}' is already used by section ${uniCodeClash[0].id}. Cannot auto-restore; resolve manually.`);
        process.exitCode = 1;
        return;
    }

    console.log(`Restore plan for section id ${args.sectionId}:`);
    console.log(`  name:         ${name}`);
    console.log(`  departmentId: ${departmentId}`);
    console.log(`  uniCode:      ${uniCode}`);
    console.log(`  category:     Not Applicable`);

    if (!args.apply) {
        console.log("\nDry run only. Pass --apply to insert this row.");
        return;
    }

    // SET IDENTITY_INSERT and the INSERT must run in the same batch/request - mssql pools hand
    // out a connection per request, so two separate executeQuery calls could land on different
    // connections and the session-scoped IDENTITY_INSERT flag wouldn't carry over.
    await executeQuery(
        `SET IDENTITY_INSERT [sections] ON;
         INSERT INTO [sections] (id, name, uniCode, category, daily5mFormType, tenCycleFormType, departmentId, isActive, users, createdAt, updatedAt)
         VALUES (?, ?, ?, 'Not Applicable', 'standard', 'form1', ?, 1, '[]', GETDATE(), GETDATE());
         SET IDENTITY_INSERT [sections] OFF;`,
        [args.sectionId, name, uniCode, departmentId]
    );
    console.log(`Inserted section ${args.sectionId}.`);

    await resyncHierarchy(args.sectionId);
    console.log("Restore applied successfully.");
}

// --- Sync mode: section exists under a new id, old references still point at the old id -----

async function detectOldSectionId(sectionId, sectionName) {
    const [rows] = await executeQuery(
        `SELECT TOP 1 sectionId, COUNT(*) as cnt
         FROM users
         WHERE section = ? AND sectionId IS NOT NULL AND sectionId <> ?
         GROUP BY sectionId ORDER BY cnt DESC`,
        [sectionName, sectionId]
    );
    return rows[0]?.sectionId || null;
}

async function gatherSyncStats(oldSectionId, sectionName, newSectionId) {
    const [lines] = await executeQuery("SELECT id, name FROM [lines] WHERE sectionId = ?", [oldSectionId]);
    const [users] = await executeQuery(
        `SELECT id, fullName, sectionId, section, sections FROM users
         WHERE sectionId = ? OR section = ?
         OR EXISTS (SELECT 1 FROM OPENJSON(ISNULL(sections, '[]')) WHERE TRY_CAST([value] AS INT) = ?)`,
        [oldSectionId, sectionName, oldSectionId]
    );
    const [tenCycleSheets] = await executeQuery("SELECT id FROM ten_cycle_sheets WHERE sectionId = ?", [oldSectionId]);
    const [skillPlans] = await executeQuery("SELECT id FROM skill_upgradation_plans WHERE sectionId = ?", [oldSectionId]);
    const [sectionHeads] = await executeQuery("SELECT id FROM section_heads WHERE sectionId = ?", [oldSectionId]);
    const [emailConfigs] = await executeQuery("SELECT id FROM email_configurations WHERE sectionId = ?", [oldSectionId]);

    return { lines, users, tenCycleSheets, skillPlans, sectionHeads, emailConfigs };
}

async function resyncHierarchy(sectionId) {
    const [lines] = await executeQuery("SELECT id FROM [lines] WHERE sectionId = ?", [sectionId]);
    for (const line of lines) {
        const [subSections] = await executeQuery("SELECT id FROM [sub_sections] WHERE lineId = ?", [line.id]);
        for (const ss of subSections) {
            await SubSection.syncUserList(ss.id);
        }
        await Line.syncUserList(line.id);
    }
    await Section.syncUserList(sectionId);
}

async function runSync(args) {
    const [sectionRows] = await executeQuery("SELECT id, name FROM [sections] WHERE id = ?", [args.sectionId]);
    if (sectionRows.length === 0) {
        console.error(`Section ${args.sectionId} does not exist. Pass --recreate to restore it with this id instead.`);
        process.exitCode = 1;
        return;
    }
    const sectionName = sectionRows[0].name;

    const oldSectionId = args.oldSectionId || await detectOldSectionId(args.sectionId, sectionName);
    if (!oldSectionId) {
        console.error(`Could not auto-detect an old section id for '${sectionName}' (${args.sectionId}). Pass --oldSectionId <id> explicitly.`);
        process.exitCode = 1;
        return;
    }
    if (oldSectionId === args.sectionId) {
        console.error("oldSectionId matches sectionId - nothing to sync.");
        process.exitCode = 1;
        return;
    }

    console.log(`Sync plan: section '${sectionName}' - old id ${oldSectionId} -> new id ${args.sectionId}`);

    const stats = await gatherSyncStats(oldSectionId, sectionName, args.sectionId);
    console.log(`  lines to repoint:               ${stats.lines.length}`);
    stats.lines.forEach(l => console.log(`    - line ${l.id}: ${l.name}`));
    console.log(`  users to repoint:                ${stats.users.length}`);
    stats.users.forEach(u => console.log(`    - user ${u.id}: ${u.fullName}`));
    console.log(`  ten_cycle_sheets to repoint:     ${stats.tenCycleSheets.length}`);
    console.log(`  skill_upgradation_plans to repoint: ${stats.skillPlans.length}`);
    console.log(`  section_heads to repoint:        ${stats.sectionHeads.length}`);
    console.log(`  email_configurations to repoint: ${stats.emailConfigs.length}`);

    if (!args.apply) {
        console.log("\nDry run only. Pass --apply to write these changes.");
        return;
    }

    await executeQuery("UPDATE [lines] SET sectionId = ? WHERE sectionId = ?", [args.sectionId, oldSectionId]);

    for (const user of stats.users) {
        const sectionsArray = parseJsonArray(user.sections).map(id => (Number(id) === oldSectionId ? args.sectionId : id));
        const dedupedSections = [...new Set(sectionsArray.map(String))];
        const newSectionIdScalar = (user.sectionId === oldSectionId || (!user.sectionId && user.section === sectionName))
            ? args.sectionId
            : user.sectionId;

        await executeQuery(
            "UPDATE users SET sectionId = ?, sections = ? WHERE id = ?",
            [newSectionIdScalar, JSON.stringify(dedupedSections), user.id]
        );
    }

    await executeQuery("UPDATE ten_cycle_sheets SET sectionId = ? WHERE sectionId = ?", [args.sectionId, oldSectionId]);

    try {
        await executeQuery("UPDATE skill_upgradation_plans SET sectionId = ? WHERE sectionId = ?", [args.sectionId, oldSectionId]);
    } catch (error) {
        console.error(`  Could not repoint skill_upgradation_plans (likely a unique constraint clash with an existing plan for the new section): ${error.message}`);
    }

    await executeQuery("UPDATE section_heads SET sectionId = ? WHERE sectionId = ?", [args.sectionId, oldSectionId]);
    await executeQuery("UPDATE email_configurations SET sectionId = ? WHERE sectionId = ?", [args.sectionId, oldSectionId]);

    console.log(`Repointed references from section ${oldSectionId} to ${args.sectionId}.`);

    await resyncHierarchy(args.sectionId);
    console.log("Sync applied successfully.");
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    console.log(args.apply ? "=== RUNNING IN APPLY MODE (CHANGES WILL BE WRITTEN TO DATABASE) ===" : "=== RUNNING IN DRY RUN MODE (NO CHANGES WILL BE WRITTEN) ===");

    if (!args.sectionId || Number.isNaN(args.sectionId)) {
        console.error("Usage: node recoverDeletedSection.js --sectionId <id> [--apply] [--recreate] [--sectionName <name>] [--departmentId <id>] [--oldSectionId <id>]");
        process.exitCode = 1;
        return;
    }

    if (args.recreate) {
        await runRecreate(args);
    } else {
        await runSync(args);
    }
}

main()
    .catch(error => {
        console.error("Error during section recovery:", error);
        process.exitCode = 1;
    })
    .finally(() => process.exit(process.exitCode || 0));
