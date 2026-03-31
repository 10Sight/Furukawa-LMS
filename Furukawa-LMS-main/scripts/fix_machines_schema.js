
import { pool } from "../server/db/connectDB.js";

async function fixMachinesSchema() {
    console.log("Checking Machines Schema...");

    const newColumns = [
        { name: "subSectionId", type: "INT" }
    ];

    for (const col of newColumns) {
        try {
            await pool.query(`SELECT ${col.name} FROM machines LIMIT 1`);
            console.log(`Column ${col.name} exists.`);
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                console.log(`Column ${col.name} missing. Adding...`);
                try {
                    await pool.query(`ALTER TABLE machines ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`Added ${col.name}.`);

                    // Add FK 
                    try {
                        const constraintName = `fk_machines_${col.name}`;
                        await pool.query(`ALTER TABLE machines ADD CONSTRAINT ${constraintName} FOREIGN KEY (${col.name}) REFERENCES \`lines\`(id) ON DELETE SET NULL`);
                        console.log(`Added FK for ${col.name}.`);
                    } catch (fke) {
                        console.log(`FK for ${col.name} might already exist or failed: ${fke.message}`);
                    }

                } catch (addError) {
                    console.error(`Failed to add ${col.name}:`, addError.message);
                }
            } else {
                console.error(`Error checking ${col.name}:`, e.message);
            }
        }
    }

    // Also remove uniCode if it exists as per plan
    try {
        await pool.query("SELECT uniCode FROM machines LIMIT 1");
        console.log("Column uniCode exists. Dropping...");
        await pool.query("ALTER TABLE machines DROP COLUMN uniCode");
        console.log("Dropped uniCode.");
    } catch (e) {
        // Ignore if missing
    }

    console.log("Machines Schema Check Complete.");
    process.exit(0);
}

fixMachinesSchema();
