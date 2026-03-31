import { executeQuery } from "../server/db/mssqlHelper.js";

async function dropSubSectionUniqueConstraint() {
    console.log("Starting database fix for sub_sections table...");

    try {
        // 1. Find the name of the unique constraint on uniCode
        // In MSSQL, system-generated unique constraint names look like UQ__sub_sect__...
        const [constraints] = await executeQuery(`
            SELECT name 
            FROM sys.key_constraints 
            WHERE type = 'UQ' AND parent_object_id = OBJECT_ID('sub_sections')
        `);

        if (constraints.length > 0) {
            for (const constraint of constraints) {
                console.log(`Found unique constraint: ${constraint.name}. Dropping...`);
                await executeQuery(`ALTER TABLE [sub_sections] DROP CONSTRAINT [${constraint.name}]`);
                console.log(`Dropped constraint ${constraint.name}`);
            }
        } else {
            console.log("No unique constraints found on sub_sections table.");
        }

        // 2. Also check for unique indexes that might not be constraints
        const [indexes] = await executeQuery(`
            SELECT name 
            FROM sys.indexes 
            WHERE is_unique = 1 AND object_id = OBJECT_ID('sub_sections') AND is_primary_key = 0
        `);

        if (indexes.length > 0) {
            for (const index of indexes) {
                console.log(`Found unique index: ${index.name}. Dropping...`);
                await executeQuery(`DROP INDEX [${index.name}] ON [sub_sections]`);
                console.log(`Dropped index ${index.name}`);
            }
        }

        // 3. Drop the uniCode column if it exists
        const [columns] = await executeQuery(`
            SELECT name FROM sys.columns 
            WHERE object_id = OBJECT_ID('sub_sections') AND name = 'uniCode'
        `);

        if (columns.length > 0) {
            console.log("Dropping uniCode column...");
            await executeQuery("ALTER TABLE [sub_sections] DROP COLUMN [uniCode]");
            console.log("Dropped uniCode column.");
        }

        console.log("Database fix completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error during database fix:", error.message);
        process.exit(1);
    }
}

dropSubSectionUniqueConstraint();
