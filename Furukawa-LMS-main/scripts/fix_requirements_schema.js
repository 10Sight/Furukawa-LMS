
import { pool } from "../server/db/connectDB.js";

async function fixRequirementsSchema() {
    console.log("Checking Requirements Schema...");

    const newColumns = [
        { name: "sectionId", type: "INT" },
        { name: "sectionName", type: "VARCHAR(255)" },
        { name: "subSectionId", type: "INT" },
        { name: "subSectionName", type: "VARCHAR(255)" },
        { name: "lineId", type: "INT" },
        { name: "lineName", type: "VARCHAR(255)" }, // Ensuring lineName exists too as alias often used
        { name: "lineArea", type: "VARCHAR(255)" }
    ];

    for (const col of newColumns) {
        try {
            await pool.query(`SELECT ${col.name} FROM requirements LIMIT 1`);
            console.log(`Column ${col.name} exists.`);
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                console.log(`Column ${col.name} missing. Adding...`);
                try {
                    await pool.query(`ALTER TABLE requirements ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`Added ${col.name}.`);

                    // Add FK if ID column
                    if (col.name.endsWith('Id')) {
                        let refTable = '';
                        if (col.name === 'sectionId') refTable = 'departments';
                        if (col.name === 'subSectionId') refTable = 'lines';
                        if (col.name === 'lineId') refTable = 'machines';

                        if (refTable) {
                            const safeRef = refTable === 'lines' ? '`lines`' : refTable;
                            try {
                                const constraintName = `fk_requirements_${col.name}`;
                                await pool.query(`ALTER TABLE requirements ADD CONSTRAINT ${constraintName} FOREIGN KEY (${col.name}) REFERENCES ${safeRef}(id) ON DELETE SET NULL`);
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

    console.log("Requirements Schema Check Complete.");
    process.exit(0);
}

fixRequirementsSchema();
