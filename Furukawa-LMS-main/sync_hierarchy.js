import { executeQuery } from "./server/db/mssqlHelper.js";
import SubSection from "./server/models/subSection.model.js";
import Line from "./server/models/line.model.js";
import Section from "./server/models/section.model.js";

async function syncAll() {
    console.log("Starting full hierarchical sync...");

    // 1. Sync Sub-Sections
    const [subSections] = await executeQuery("SELECT id FROM sub_sections");
    console.log(`Syncing ${subSections.length} sub-sections...`);
    for (const ss of subSections) {
        await SubSection.syncUserList(ss.id);
    }

    // 2. Sync Lines
    const [lines] = await executeQuery("SELECT id FROM [lines]");
    console.log(`Syncing ${lines.length} lines...`);
    for (const l of lines) {
        await Line.syncUserList(l.id);
    }

    // 3. Sync Sections
    const [sections] = await executeQuery("SELECT id FROM [sections]");
    console.log(`Syncing ${sections.length} sections...`);
    for (const s of sections) {
        await Section.syncUserList(s.id);
    }

    console.log("Full sync completed successfully!");
    process.exit(0);
}

syncAll().catch(err => {
    console.error("Sync failed:", err);
    process.exit(1);
});
