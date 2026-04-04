import { executeQuery } from './db/mssqlHelper.js';
import fs from 'fs';

async function run() {
    const [usersCols] = await executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users'");
    const [reqCols] = await executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='requirements'");
    fs.writeFileSync('cols.json', JSON.stringify({
        users: usersCols.map(c => c.COLUMN_NAME),
        reqs: reqCols.map(c => c.COLUMN_NAME)
    }, null, 2));
    process.exit(0);
}
run().catch(console.error);
