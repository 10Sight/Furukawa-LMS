import { pool } from "../server/db/connectDB.js";

const seedPrivileges = async () => {
    try {
        const privileges = ["email_reports"];

        for (const priv of privileges) {
            const [rows] = await pool.query("SELECT * FROM privileges WHERE name = ?", [priv]);
            if (rows.length === 0) {
                await pool.query("INSERT INTO privileges (name) VALUES (?)", [priv]);
                console.log(`Added privilege: ${priv}`);
            } else {
                console.log(`Privilege exists: ${priv}`);
            }
        }
        process.exit(0);
    } catch (error) {
        console.error("Privilege Seeding Failed:", error);
        process.exit(1);
    }
};

seedPrivileges();
