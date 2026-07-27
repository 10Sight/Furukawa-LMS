import { poolPromise } from "../server/db/connectDB.js";
import { executeQuery } from "../server/db/mssqlHelper.js";

async function runCheck() {
    try {
        console.log("Connecting...");
        await poolPromise;

        const [nullDeleted] = await executeQuery(`
            SELECT COUNT(*) AS cnt FROM users WHERE isDeleted IS NULL
        `);
        console.log("Users with isDeleted IS NULL:", nullDeleted[0].cnt);

        const [nullTemporary] = await executeQuery(`
            SELECT COUNT(*) AS cnt FROM users WHERE isTemporary IS NULL
        `);
        console.log("Users with isTemporary IS NULL:", nullTemporary[0].cnt);

        const [isDeletedMatch] = await executeQuery(`
            SELECT COUNT(*) AS cnt FROM users WHERE isDeleted = 0
        `);
        console.log("Users with isDeleted = 0:", isDeletedMatch[0].cnt);

        const [isNullDeletedMatch] = await executeQuery(`
            SELECT COUNT(*) AS cnt FROM users WHERE ISNULL(isDeleted, 0) = 0
        `);
        console.log("Users with ISNULL(isDeleted, 0) = 0:", isNullDeletedMatch[0].cnt);

        const [isTempMatch] = await executeQuery(`
            SELECT COUNT(*) AS cnt FROM users WHERE isTemporary = 0
        `);
        console.log("Users with isTemporary = 0:", isTempMatch[0].cnt);

        const [isNullTempMatch] = await executeQuery(`
            SELECT COUNT(*) AS cnt FROM users WHERE ISNULL(isTemporary, 0) = 0
        `);
        console.log("Users with ISNULL(isTemporary, 0) = 0:", isNullTempMatch[0].cnt);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

runCheck();
