import 'dotenv/config';
import connectDB from '../db/connectDB.js';
import { executeQuery } from '../db/mssqlHelper.js';
import logger from '../logger/winston.logger.js';

const checkIsRowFilled = (data, index) => {
    if (!data) return false;
    return !!(
        data[`rec_${index}_Line`] || 
        data[`rec_${index}_OpName`] || 
        data[`rec_${index}_StationMC`] || 
        data[`rec_${index}_OperatorName`]
    );
};

const cleanup = async () => {
    try {
        logger.info('Connecting to the database for Daily 5M cleanup...');
        await connectDB();
        logger.info('Database connection established.');

        logger.info('Fetching all daily 5M records...');
        const [records] = await executeQuery("SELECT id, recordData, date, departmentId FROM daily_5m_records");
        logger.info(`Fetched ${records.length} records.`);

        const emptyIds = [];

        for (const record of records) {
            let data = {};
            if (record.recordData) {
                try {
                    data = typeof record.recordData === 'string' 
                        ? JSON.parse(record.recordData) 
                        : record.recordData;
                } catch (e) {
                    logger.warn(`Failed to parse recordData for record ID ${record.id}: ${e.message}`);
                }
            }

            let hasActiveRow = false;
            for (let i = 0; i < 20; i++) {
                if (checkIsRowFilled(data, i)) {
                    hasActiveRow = true;
                    break;
                }
            }

            if (!hasActiveRow) {
                emptyIds.push(record.id);
            }
        }

        logger.info(`Found ${emptyIds.length} empty stub records to delete.`);

        if (emptyIds.length > 0) {
            // Delete in chunks if there are too many, to avoid MSSQL parameter limit
            const chunkSize = 1000;
            for (let i = 0; i < emptyIds.length; i += chunkSize) {
                const chunk = emptyIds.slice(i, i + chunkSize);
                logger.info(`Deleting chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(emptyIds.length / chunkSize)} (${chunk.length} records)...`);
                await executeQuery(`DELETE FROM daily_5m_records WHERE id IN (?)`, [chunk]);
            }
            logger.info('Successfully cleaned up all empty stub records.');
        } else {
            logger.info('No empty stub records found.');
        }

        process.exit(0);
    } catch (error) {
        logger.error('CRITICAL: Cleanup failed:', error);
        process.exit(1);
    }
};

cleanup();
