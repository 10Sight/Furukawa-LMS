import { executeQuery } from "../db/mssqlHelper.js";
import Section from "../models/section.model.js";
import Line from "../models/line.model.js";
import SubSection from "../models/subSection.model.js";

// Section/Line/SubSection.syncUserList() each swallow their own errors internally (they only
// logger.error and never rethrow), so a failure inside them never surfaces to a script calling
// them - the caller sees a clean resolved promise either way. This script exists to make that
// visible: for every level it (1) runs the exact same aggregation query the model uses, as a
// plain SELECT, so a broken query throws here in plain sight instead of being swallowed, and
// (2) reads the cached `users` column before and after calling the real model method, so a
// silent internal failure shows up as "cache unchanged" instead of looking like success.
//
// Usage:
//   node scripts/resyncSectionHierarchy.js --sectionId <id>            (diagnostic + write)
//   node scripts/resyncSectionHierarchy.js --sectionId <id> --dryRun    (diagnostic only, no writes)

function parseArgs(argv) {
    const args = { dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--sectionId") args.sectionId = parseInt(argv[++i], 10);
        if (argv[i] === "--dryRun") args.dryRun = true;
    }
    return args;
}

const getCol = async (table, id, col = "users") => {
    const [rows] = await executeQuery(`SELECT ${col} FROM [${table}] WHERE id = ?`, [id]);
    return rows[0] ? rows[0][col] : null;
};

// Mirrors SubSection.syncUserList's aggregation query exactly, run standalone so a broken
// query throws here instead of being swallowed by the model method's internal try/catch.
async function computeSubSectionUsers(subSectionId) {
    const [rows] = await executeQuery(
        `SELECT DISTINCT u.id, u.fullName, u.role
         FROM users u
         LEFT JOIN machine_assignments ma ON u.id = ma.user_id
         LEFT JOIN machines m ON ma.machine_id = m.id
         WHERE (u.role IN ('STUDENT', 'CUSTOM') AND (u.isDeleted = 0 OR u.isDeleted IS NULL))
         AND (
             u.subSectionId = ?
             OR EXISTS (SELECT 1 FROM OPENJSON(ISNULL(u.subSections, '[]')) WHERE TRY_CAST([value] AS INT) = ?)
             OR m.subSectionId = ?
         )`,
        [subSectionId, subSectionId, subSectionId]
    );
    return rows;
}

// Diagnostic-only: users linked to this sub-section via subSectionId/subSections/machine
// assignment but excluded from the cache purely by the STUDENT/CUSTOM role filter above.
async function computeRoleExcluded(subSectionId) {
    const [rows] = await executeQuery(
        `SELECT DISTINCT u.id, u.fullName, u.role
         FROM users u
         LEFT JOIN machine_assignments ma ON u.id = ma.user_id
         LEFT JOIN machines m ON ma.machine_id = m.id
         WHERE NOT (u.role IN ('STUDENT', 'CUSTOM'))
         AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
         AND (
             u.subSectionId = ?
             OR EXISTS (SELECT 1 FROM OPENJSON(ISNULL(u.subSections, '[]')) WHERE TRY_CAST([value] AS INT) = ?)
             OR m.subSectionId = ?
         )`,
        [subSectionId, subSectionId, subSectionId]
    );
    return rows;
}

async function main() {
    const { sectionId, dryRun } = parseArgs(process.argv.slice(2));
    if (!sectionId) {
        console.error("Usage: node scripts/resyncSectionHierarchy.js --sectionId <id> [--dryRun]");
        process.exitCode = 1;
        return;
    }
    console.log(dryRun ? "=== DIAGNOSTIC ONLY - NO WRITES ===" : "=== DIAGNOSTIC + WRITE (cache columns will be updated) ===");

    const [sectionRows] = await executeQuery("SELECT id, name, users FROM [sections] WHERE id = ?", [sectionId]);
    if (sectionRows.length === 0) {
        console.error(`Section ${sectionId} does not exist.`);
        process.exitCode = 1;
        return;
    }
    console.log(`\nSection ${sectionId} ('${sectionRows[0].name}') - cache before: ${sectionRows[0].users}`);

    const [lines] = await executeQuery("SELECT id, name, users FROM [lines] WHERE sectionId = ?", [sectionId]);
    console.log(`Found ${lines.length} line(s) under section ${sectionId}.`);

    for (const line of lines) {
        console.log(`\n-- Line ${line.id} ('${line.name}') - cache before: ${line.users}`);

        const [subSections] = await executeQuery("SELECT id, name, users FROM [sub_sections] WHERE lineId = ?", [line.id]);
        console.log(`   ${subSections.length} sub-section(s) under line ${line.id}.`);

        for (const ss of subSections) {
            const computed = await computeSubSectionUsers(ss.id);
            const excluded = await computeRoleExcluded(ss.id);
            console.log(`   -- Sub-section ${ss.id} ('${ss.name}') - cache before: ${ss.users}`);
            console.log(`      linked users matching STUDENT/CUSTOM (will be cached): ${computed.length}${computed.length ? " -> " + computed.map(u => `${u.id}:${u.fullName}`).join(", ") : ""}`);
            if (excluded.length > 0) {
                console.log(`      linked users EXCLUDED by role filter (not STUDENT/CUSTOM, so never cached here): ${excluded.length} -> ${excluded.map(u => `${u.id}:${u.fullName}(${u.role})`).join(", ")}`);
            }

            if (!dryRun) {
                await SubSection.syncUserList(ss.id);
                const after = await getCol("sub_sections", ss.id);
                console.log(`      cache after:  ${after}`);
                if (after === ss.users && computed.length > 0) {
                    console.log(`      *** cache did not change despite ${computed.length} matching user(s) - check logs for a swallowed error in SubSection.syncUserList ***`);
                }
            }
        }

        if (!dryRun) {
            const before = line.users;
            await Line.syncUserList(line.id);
            const after = await getCol("lines", line.id);
            console.log(`   Line ${line.id} cache after: ${after}`);
            if (after === before && subSections.length > 0) {
                console.log(`   *** line cache unchanged - check logs for a swallowed error in Line.syncUserList ***`);
            }
        }
    }

    if (!dryRun) {
        const before = sectionRows[0].users;
        await Section.syncUserList(sectionId);
        const after = await getCol("sections", sectionId);
        console.log(`\nSection ${sectionId} cache after: ${after}`);
        if (after === before && lines.length > 0) {
            console.log(`*** section cache unchanged - check logs for a swallowed error in Section.syncUserList ***`);
        }
    }
}

main()
    .catch(error => {
        console.error("Error during hierarchy resync:", error);
        process.exitCode = 1;
    })
    .finally(() => process.exit(process.exitCode || 0));
