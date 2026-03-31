import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import logger from '../logger/winston.logger.js';
import connectDB from '../db/connectDB.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.join(__dirname, '../models');

// Priority models that should be initialized first to satisfy foreign key constraints
const PRIORITY_MODELS = [
    'auth.model.js',           // Creates 'users' table
    'department.model.js',     // Referenced by sections
    'section.model.js', 
    'customRole.model.js',        // Referenced by lines
    'line.model.js',           // Referenced by machines
    'machine.model.js',        // Referenced by requirements
    'course.model.js',         // Often referenced
    'module.model.js',         // Parent of lessons
    'lesson.model.js',         // Parent of assignments
    'assignment.model.js',     // Reference for submissions
    'quiz.model.js',           // Reference for attempts
    'daily5MConfig.model.js',  // Config for records
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const initTables = async () => {
    try {
        logger.info('Starting centralized database table initialization...');

        // Ensure connection is established first
        await connectDB();
        logger.info('Database connection established.');

        const files = fs.readdirSync(modelsDir);
        const allModelFiles = files.filter(file => file.endsWith('.model.js'));

        // Separate priority models from the rest
        const otherModelFiles = allModelFiles.filter(file => !PRIORITY_MODELS.includes(file));
        const orderedModelFiles = [...PRIORITY_MODELS.filter(f => allModelFiles.includes(f)), ...otherModelFiles];

        logger.info(`Found ${orderedModelFiles.length} model files to process.`);

        let successCount = 0;
        let failCount = 0;

        for (const file of orderedModelFiles) {
            const modelPath = path.join(modelsDir, file);
            // Convert to file:// URI for dynamic import on Windows
            const modelUri = `file://${modelPath.replace(/\\/g, '/')}`;

            try {
                // Importing the model usually triggers its static init() side effect.
                const model = await import(modelUri);

                // If the model has an init method, call it explicitly to ensure migrations run.
                if (model.default && typeof model.default.init === 'function') {
                    await model.default.init();
                    logger.info(`✅ Initialized/Updated: ${file}`);
                } else if (model.User && typeof model.User.init === 'function') {
                    // Special case for models that might export named
                    await model.User.init();
                    logger.info(`✅ Initialized/Updated (User): ${file}`);
                } else {
                    logger.info(`ℹ️ Processed (via import): ${file}`);
                }

                successCount++;
                // Small sleep to prevent overwhelming the connection pool
                await sleep(100);

            } catch (err) {
                failCount++;
                logger.error(`❌ Error processing ${file}:`, err.message);
            }
        }

        logger.info(`\nInitialization Summary:\n- Total: ${orderedModelFiles.length}\n- Success: ${successCount}\n- Failed: ${failCount}`);
        logger.info('Database table initialization completed.');
        process.exit(0);
    } catch (error) {
        logger.error('CRITICAL: Failed to initialize tables:', error);
        process.exit(1);
    }
};

initTables();
