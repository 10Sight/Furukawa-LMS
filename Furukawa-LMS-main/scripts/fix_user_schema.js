
import { pool } from "../server/db/connectDB.js";

async function fixUserSchema() {
    console.log("Checking User Schema...");

    const newColumns = [
        { name: "isTemporary", type: "BOOLEAN DEFAULT FALSE" },
        { name: "sectionId", type: "INT" },
        { name: "subSectionId", type: "INT" },
        { name: "lineId", type: "INT" }
    ];

    for (const col of newColumns) {
        try {
            await pool.query(`SELECT ${col.name} FROM users LIMIT 1`);
            console.log(`Column ${col.name} exists.`);
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                console.log(`Column ${col.name} missing. Adding...`);
                try {
                    await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`Added ${col.name}.`);

                    // Add FK if ID column
                    if (col.name.endsWith('Id')) {
                        let refTable = '';
                        if (col.name === 'sectionId') refTable = 'departments';
                        if (col.name === 'subSectionId') refTable = 'lines'; // careful with `lines` keyword
                        if (col.name === 'lineId') refTable = 'machines';

                        if (refTable) {
                            // Use safe table names
                            const safeRef = refTable === 'lines' ? '`lines`' : refTable;
                            try {
                                const constraintName = `fk_users_${col.name}`;
                                await pool.query(`ALTER TABLE users ADD CONSTRAINT ${constraintName} FOREIGN KEY (${col.name}) REFERENCES ${safeRef}(id) ON DELETE SET NULL`);
                                console.log(`Added FK for ${col.name}.`);
                            } catch (fke) {
                                console.log(`FK for ${col.name} might already exist or failed: ${fke.message}`);
                            }
                        }
                    }

                } catch (addError) {
                    console.error(`Failed to add ${col.name}:`, addError.message);
                }
            } else {
                console.error(`Error checking ${col.name}:`, e.message);
            }
        }
    }

    console.log("User Schema Check Complete.");
    process.exit(0);
}

fixUserSchema();
