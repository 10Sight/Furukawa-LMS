import { executeQuery } from './db/mssqlHelper.js';

async function run() {
    const [users] = await executeQuery("SELECT COUNT(*) as count FROM users");
    console.log("Total users in database:", users[0].count);
    process.exit(0);
}
run().catch(console.error);
