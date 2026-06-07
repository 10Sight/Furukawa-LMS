import { executeQuery } from "../server/db/mssqlHelper.js";
import SubSection from "../server/models/subSection.model.js";

async function forceSync() {
    console.log("Forcing hierarchy sync for all sub-sections...");
    const [subSections] = await executeQuery("SELECT id FROM [sub_sections]");
    for (const ss of subSections) {
        await SubSection.syncUserList(ss.id);
    }
    console.log("Sync complete.");
    process.exit(0);
}

forceSync();
