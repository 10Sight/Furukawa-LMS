
import { pool } from "../server/db/connectDB.js";
import bcrypt from "bcryptjs";
import logger from "../server/logger/winston.logger.js";

async function migrate() {
    console.log("Starting Database Migration...");

    try {
        // 1. Update Users Table
        console.log("Migrating 'users' table...");
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN isTemporary BOOLEAN DEFAULT FALSE`);
        } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') console.log("Note: isTemporary col exists or error"); }

        try {
            await pool.query(`ALTER TABLE users ADD COLUMN sectionId INT, ADD COLUMN subSectionId INT, ADD COLUMN lineId INT`);
        } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') console.log("Note: FK cols exist or error"); }

        try {
            await pool.query(`
                ALTER TABLE users 
                ADD CONSTRAINT fk_user_section FOREIGN KEY (sectionId) REFERENCES departments(id) ON DELETE SET NULL,
                ADD CONSTRAINT fk_user_sub_section FOREIGN KEY (subSectionId) REFERENCES \`lines\`(id) ON DELETE SET NULL,
                ADD CONSTRAINT fk_user_line FOREIGN KEY (lineId) REFERENCES machines(id) ON DELETE SET NULL
            `);
        } catch (e) { if (e.code !== 'ER_DUP_KEYNAME') console.log("Note: FKs might already exist"); }


        // 2. Update Lines Table
        console.log("Migrating 'lines' table...");
        try {
            await pool.query(`ALTER TABLE \`lines\` ADD COLUMN sectionId INT`);
            await pool.query(`ALTER TABLE \`lines\` ADD CONSTRAINT fk_line_section FOREIGN KEY (sectionId) REFERENCES departments(id) ON DELETE SET NULL`);
        } catch (e) { /* ignore dup */ }


        // 3. Update Machines Table
        console.log("Migrating 'machines' table...");
        try {
            await pool.query(`ALTER TABLE machines DROP COLUMN uniCode`);
        } catch (e) { /* ignore if missing */ }

        try {
            await pool.query(`ALTER TABLE machines ADD COLUMN subSectionId INT`);
            await pool.query(`ALTER TABLE machines ADD CONSTRAINT fk_machine_subsection FOREIGN KEY (subSectionId) REFERENCES \`lines\`(id) ON DELETE SET NULL`);
        } catch (e) { /* ignore dup */ }


        // 4. Update Requirements Table
        console.log("Migrating 'requirements' table...");
        try {
            await pool.query(`
                ALTER TABLE requirements 
                ADD COLUMN sectionId INT, 
                ADD COLUMN sectionName VARCHAR(255),
                ADD COLUMN subSectionId INT, 
                ADD COLUMN subSectionName VARCHAR(255),
                ADD COLUMN lineId INT, 
                ADD COLUMN lineName VARCHAR(255),
                ADD COLUMN lineArea VARCHAR(100)
            `);
        } catch (e) { /* ignore dup */ }

        try {
            await pool.query(`
                ALTER TABLE requirements
                ADD CONSTRAINT fk_req_section FOREIGN KEY (sectionId) REFERENCES departments(id) ON DELETE SET NULL,
                ADD CONSTRAINT fk_req_subsection FOREIGN KEY (subSectionId) REFERENCES \`lines\`(id) ON DELETE SET NULL,
                ADD CONSTRAINT fk_req_line FOREIGN KEY (lineId) REFERENCES machines(id) ON DELETE SET NULL
            `);
        } catch (e) { /* ignore dup */ }


        // 5. Create Mails Table
        console.log("Creating 'mails' table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mails (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                isDailyReport BOOLEAN DEFAULT FALSE,
                isMonthlyReport BOOLEAN DEFAULT FALSE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);


        // 6. Seed Admin User
        console.log("Seeding Admin User...");
        const adminUser = "admin123";
        const adminPass = "admin123";
        const hashedPassword = await bcrypt.hash(adminPass, 10);

        // Check if exists
        const [rows] = await pool.query("SELECT * FROM users WHERE userName = ?", [adminUser]);
        if (rows.length === 0) {
            await pool.query(`
                INSERT INTO users 
                (fullName, userName, email, password, role, status, isVerified, isAdmin, phoneNumber, unit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                "System Admin",
                adminUser,
                "admin@example.com",
                hashedPassword,
                "ADMIN",
                "PRESENT",
                1,
                1,
                "0000000000",
                "Unit1"
            ]);
            console.log("Admin user created: admin123 / admin123");
        } else {
            console.log("Admin user already exists.");
        }

        console.log("Migration Completed Successfully!");
        process.exit(0);

    } catch (error) {
        console.error("Migration Failed:", error);
        process.exit(1);
    }
}

migrate();
