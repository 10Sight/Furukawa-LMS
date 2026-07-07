import { executeQuery } from "../db/mssqlHelper.js";
import Section from "../models/section.model.js";
import Line from "../models/line.model.js";
import SubSection from "../models/subSection.model.js";

// SQL Server caps a single request at 2100 parameters; chunk large IN (...) lookups to stay under that.
const CHUNK_SIZE = 1000;
const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
};

// A user counts as "still a member" only if the row exists AND isn't soft-deleted -
// soft-deleted users stay in the users table (recoverable) but should disappear from
// every reference list, same as sections/lines/sub_sections already do via syncUserList.
const findExistingUserIds = async (ids) => {
    const existing = new Set();
    for (const batch of chunkArray(ids, CHUNK_SIZE)) {
        const placeholders = batch.map(() => "?").join(",");
        const [rows] = await executeQuery(
            `SELECT id FROM users WHERE id IN (${placeholders}) AND (isDeleted = 0 OR isDeleted IS NULL)`,
            batch
        );
        rows.forEach(r => existing.add(String(r.id)));
    }
    return existing;
};

// One-time repair for users that were deleted before deleteUser/bulkDeleteUsers started
// cleaning up machine_assignments and re-syncing the cached `users` JSON columns on
// sections/lines/sub_sections. Safe to re-run; only removes rows/ids that no longer exist.
async function cleanupOrphanedUserAssignments() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "=== RUNNING IN APPLY MODE (CHANGES WILL BE WRITTEN TO DATABASE) ===" : "=== RUNNING IN DRY RUN MODE (NO CHANGES WILL BE WRITTEN) ===");

    try {
        // 1. machine_assignments has no FK to users, so hard-deleted users leave orphaned rows behind
        const [orphanedAssignments] = await executeQuery(`
            SELECT ma.id, ma.user_id, ma.machine_id
            FROM machine_assignments ma
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ma.user_id)
        `);
        console.log(`Found ${orphanedAssignments.length} machine_assignments referencing deleted users.`);
        if (orphanedAssignments.length) {
            orphanedAssignments.forEach(a => console.log(`  - assignment ${a.id}: user ${a.user_id} -> machine ${a.machine_id}`));
        }
        if (apply && orphanedAssignments.length) {
            const ids = orphanedAssignments.map(r => r.id);
            await executeQuery(`DELETE FROM machine_assignments WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
        }

        // 2. departments.students and departments.instructor both hold JSON arrays of user ids
        //    (there's no separate department "users" column) - clean orphaned/duplicate/soft-deleted
        //    ids from both, so a "deleted" user disappears here the same way it already does from
        //    sections/lines/sub_sections.
        const [departments] = await executeQuery("SELECT id, students, instructor FROM departments");
        let deptFixed = 0;
        for (const dept of departments) {
            let students = [];
            try { students = JSON.parse(dept.students || "[]"); } catch (e) { students = []; }
            if (!Array.isArray(students)) students = [];

            let instructors = [];
            try {
                const parsed = typeof dept.instructor === 'string' ? JSON.parse(dept.instructor) : dept.instructor;
                instructors = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            } catch (e) {
                instructors = dept.instructor ? [dept.instructor] : [];
            }

            let changed = false;
            const logParts = [];

            if (students.length > 0) {
                const dedupedStudents = [...new Set(students.map(String))];
                const existingIds = await findExistingUserIds(dedupedStudents);
                const cleanedStudents = dedupedStudents.filter(id => existingIds.has(id));
                if (cleanedStudents.length !== students.length) {
                    changed = true;
                    logParts.push(`students ${students.length} -> ${cleanedStudents.length} (removed ${students.length - dedupedStudents.length} duplicate(s), ${dedupedStudents.length - cleanedStudents.length} orphaned id(s))`);
                    students = cleanedStudents;
                }
            }

            if (instructors.length > 0) {
                const dedupedInstructors = [...new Set(instructors.map(String))];
                const existingIds = await findExistingUserIds(dedupedInstructors);
                const cleanedInstructors = dedupedInstructors.filter(id => existingIds.has(id));
                if (cleanedInstructors.length !== instructors.length) {
                    changed = true;
                    logParts.push(`instructor ${instructors.length} -> ${cleanedInstructors.length} (removed ${instructors.length - dedupedInstructors.length} duplicate(s), ${dedupedInstructors.length - cleanedInstructors.length} orphaned id(s))`);
                    instructors = cleanedInstructors;
                }
            }

            if (changed) {
                deptFixed++;
                console.log(`- Department ${dept.id}: ${logParts.join("; ")}`);
                if (apply) {
                    await executeQuery("UPDATE departments SET students = ?, instructor = ? WHERE id = ?", [JSON.stringify(students), JSON.stringify(instructors), dept.id]);
                }
            }
        }
        console.log(`Departments with orphaned/duplicate ids: ${deptFixed}`);

        // 3. Re-sync cached `users` lists on sections/lines/sub_sections so any stale ids from
        //    soft- or hard-deleted users are dropped. SubSection.syncUserList cascades up to
        //    Line.syncUserList -> Section.syncUserList, so syncing sub-sections covers all three,
        //    but sections/lines with no sub-sections still need a direct pass.
        if (apply) {
            const [subSections] = await executeQuery("SELECT id FROM [sub_sections]");
            for (const ss of subSections) {
                await SubSection.syncUserList(ss.id);
            }
            const [lines] = await executeQuery("SELECT id FROM [lines]");
            for (const l of lines) {
                await Line.syncUserList(l.id);
            }
            const [sections] = await executeQuery("SELECT id FROM [sections]");
            for (const s of sections) {
                await Section.syncUserList(s.id);
            }
            console.log(`Re-synced ${subSections.length} sub-section(s), ${lines.length} line(s), ${sections.length} section(s).`);
        } else {
            console.log("Dry run: would re-sync all sub_sections/lines/sections cached user lists.");
        }

        if (!apply) {
            console.log("\nDry run completed. No database writes were performed. Pass '--apply' to run and fix the database.");
        } else {
            console.log("\nCleanup applied successfully.");
        }
    } catch (err) {
        console.error("Error during orphaned user assignment cleanup:", err);
    }
    process.exit(0);
}

cleanupOrphanedUserAssignments();
