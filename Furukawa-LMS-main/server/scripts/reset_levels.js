import { executeQuery } from '../db/mssqlHelper.js';

async function reset() {
    try {
        console.log('Connecting to database and resetting levels...');
        // Correctly identifying affected rows based on mssqlHelper return format [rows, metadata]
        const [rows, metadata] = await executeQuery("UPDATE users SET currentLevel = NULL WHERE currentLevel = 'L1'");
        console.log('Successfully reset L1 levels to NULL.');
        console.log('Affected rows:', metadata.affectedRows);
        process.exit(0);
    } catch (error) {
        console.error('Error resetting levels:', error);
        process.exit(1);
    }
}

reset();
