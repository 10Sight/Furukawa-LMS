
import { pool } from "../server/db/connectDB.js";
import { slugify } from "../server/utils/slugify.js";

const sections = [
    { code: "A001", name: "Assembly" },
    { code: "A002", name: "Assembly Quality" },
    { code: "A003", name: "C&C" },
    { code: "A004", name: "C&C Quality" },
    { code: "A005", name: "CSG" },
    { code: "A006", name: "D&D" },
    { code: "A007", name: "DOJO" },
    { code: "A008", name: "FG" },
    { code: "A009", name: "IT" },
    { code: "A010", name: "Maintenance" },
    { code: "A011", name: "NPD Lab" },
    { code: "A012", name: "PE" },
    { code: "A013", name: "PPC" },
    { code: "A014", name: "Safety" },
    { code: "A015", name: "Store" }
];

const subSections = [
    { name: "ASSY (sub ASSY + part + mounting + fixing)", code: "A001-01", sectionCode: "A001" },
    { name: "Assembly (Rework/Material Handler/Trainer/Support)", code: "A001-03", sectionCode: "A001" },
    { name: "Parts Cutting (VS, VO, COT)", code: "A001-04", sectionCode: "A001" },
    { name: "Air bag sub assembly", code: "A001-05", sectionCode: "A001" },
    { name: "Spare W/H", code: "A001-06", sectionCode: "A001" },
    { name: "Sub leader", code: "A001-07", sectionCode: "A001" },
    { name: "Support team", code: "A001-08", sectionCode: "A001" },
    { name: "SFG Confirmation _Air bag & part cutting", code: "A001-09", sectionCode: "A001" },
    { name: "Production Office ( Reports)", code: "A002-01", sectionCode: "A002" },
    { name: "Inspection (ASSY)", code: "A002-02", sectionCode: "A002" },
    { name: "Quality Assurance [Leader Assy+C&C]", code: "A002-03", sectionCode: "A002" },
    { name: "200% Manpower at MC21 Inspection", code: "A002-04", sectionCode: "A002" },
    { name: "Quality Office ( Reports) + Kaizen", code: "A002-05", sectionCode: "A002" },
    { name: "C&C machine", code: "A003-01", sectionCode: "A003" },
    { name: "C&C other", code: "A003-02", sectionCode: "A003" },
    { name: "C&C (Leader, rework, material handler, rolling,)", code: "A003-03", sectionCode: "A003" },
    { name: "SFG Confirmation _C&C & Document", code: "A003-04", sectionCode: "A003" },
    { name: "C&C QC", code: "A004-01", sectionCode: "A004" },
    { name: "CSG Quality [CSG, 3T, TTBIL Warehouse]", code: "A005-01", sectionCode: "A005" },
    { name: "Engineering", code: "A006-01", sectionCode: "A006" },
    { name: "Training center", code: "A007-01", sectionCode: "A007" },
    { name: "FG (Bawal +3T+TTIPL)", code: "A008-01", sectionCode: "A008" },
    { name: "Logstics", code: "A008-01", sectionCode: "A008" },
    { name: "F&A & IT", code: "A009-01", sectionCode: "A009" },
    { name: "Maintenance & Utility & Safety", code: "A010-01", sectionCode: "A010" },
    { name: "Quality (Testing lab,PI, Layout inspection, Wire Inspection)", code: "A011-01", sectionCode: "A011" },
    { name: "Process Engineering", code: "A012-01", sectionCode: "A012" },
    { name: "PPC (Name Tag Printing)", code: "A013-01", sectionCode: "A013" },
    { name: "Safety", code: "A014-01", sectionCode: "A014" },
    { name: "Stores", code: "A015-01", sectionCode: "A015" }
];

async function seed() {
    console.log("Starting Master Data Seed...");

    try {
        // 1. Seed Sections (Departments)
        console.log("Seeding Departments (Sections)...");
        for (const s of sections) {
            const slug = slugify(s.name);
            // Check existence
            const [rows] = await pool.query("SELECT id FROM departments WHERE uniCode = ?", [s.code]);
            if (rows.length > 0) {
                // Update
                await pool.query("UPDATE departments SET name = ?, slug = ? WHERE id = ?", [s.name, slug, rows[0].id]);
                console.log(`Updated Section: ${s.code} - ${s.name}`);
            } else {
                // Insert
                await pool.query(
                    "INSERT INTO departments (uniCode, name, slug, status, createdAt) VALUES (?, ?, ?, 'UPCOMING', NOW())",
                    [s.code, s.name, slug]
                );
                console.log(`Inserted Section: ${s.code} - ${s.name}`);
            }
        }

        // 2. Fetch all Sections to Map IDs
        console.log("Fetching Section IDs...");
        const [deptRows] = await pool.query("SELECT id, uniCode FROM departments");
        const deptMap = {};
        deptRows.forEach(d => deptMap[d.uniCode] = d.id);

        // 3. Seed SubSections (Lines)
        console.log("Seeding Lines (SubSections)...");
        for (const ss of subSections) {
            const sectionId = deptMap[ss.sectionCode];
            if (!sectionId) {
                console.warn(`Warning: Section Code ${ss.sectionCode} not found for SubSection ${ss.code}. Skipping.`);
                continue;
            }

            // Check existence
            const [rows] = await pool.query("SELECT id FROM \`lines\` WHERE uniCode = ?", [ss.code]);
            if (rows.length > 0) {
                // Update
                await pool.query(
                    "UPDATE \`lines\` SET name = ?, department = ?, sectionId = ? WHERE id = ?",
                    [ss.name, ss.sectionCode, sectionId, rows[0].id]
                ); // 'department' column in lines table seems to be legacy string code. Using sectionCode there.
                console.log(`Updated SubSection: ${ss.code} - ${ss.name}`);
            } else {
                // Insert
                await pool.query(
                    "INSERT INTO \`lines\` (uniCode, name, department, sectionId, isActive, createdAt) VALUES (?, ?, ?, ?, 1, NOW())",
                    [ss.code, ss.name, ss.sectionCode, sectionId]
                );
                console.log(`Inserted SubSection: ${ss.code} - ${ss.name}`);
            }
        }

        console.log("Master Data Seed Completed Successfully.");
        process.exit(0);

    } catch (error) {
        console.error("Seed Failed:", error);
        process.exit(1);
    }
}

seed();
