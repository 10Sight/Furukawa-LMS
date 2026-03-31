import { pool } from "../server/db/connectDB.js";

const listUsers = async () => {
    try {
        const [rows] = await pool.query("SELECT id, userName, email, privileges FROM users WHERE userName LIKE '%Jatin%'");
        console.table(rows);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

listUsers();
