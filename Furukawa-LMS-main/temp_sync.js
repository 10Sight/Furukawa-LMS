
import { executeQuery } from "./server/db/mssqlHelper.js";
import Section from "./server/models/section.model.js";
import Line from "./server/models/line.model.js";
import SubSection from "./server/models/subSection.model.js";

async function runSync() {
    console.log("Starting full hierarchy sync (Strict Hierarchical)...");

    try {
        // 1. Sync SubSections (Leaf level - keeps machine assignments)
        const [subSections] = await executeQuery("SELECT id FROM sub_sections");
        console.log(`Syncing ${subSections.length} sub-sections...`);
        for (const ss of subSections) {
            await SubSection.syncUserList(ss.id);
        }

        // 2. Sync Lines (Strictly from sub-sections)
        const [lines] = await executeQuery("SELECT id FROM [lines]");
        console.log(`Syncing ${lines.length} lines...`);
        for (const l of lines) {
            await Line.syncUserList(l.id);
        }

        // 3. Sync Sections (Strictly from lines)
        const [sections] = await executeQuery("SELECT id FROM [sections]");
        console.log(`Syncing ${sections.length} sections...`);
        for (const s of sections) {
            await Section.syncUserList(s.id);
        }

        console.log("Strict hierarchy sync completed successfully!");
    } catch (error) {
        console.error("Sync failed:", error);
    } finally {
        process.exit(0);
    }
}

runSync();
