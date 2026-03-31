import { pool } from "../server/db/connectDB.js";

const assignPrivilege = async () => {
    const targetEmail = 'jatin@gmail.com'; // Found via script
    const privilegeName = 'email_reports';

    try {
        // 1. Get Privilege ID
        const [privRows] = await pool.query("SELECT id FROM privileges WHERE name = ?", [privilegeName]);
        if (privRows.length === 0) {
            console.error(`Privilege '${privilegeName}' not found! Run seed script first.`);
            process.exit(1);
        }
        const privId = privRows[0].id;
        console.log(`Privilege '${privilegeName}' has ID: ${privId}`);

        // 2. Get User
        const [userRows] = await pool.query("SELECT id, privileges FROM users WHERE email = ?", [targetEmail]);
        if (userRows.length === 0) {
            console.error(`User '${targetEmail}' not found!`);
            process.exit(1);
        }
        const user = userRows[0];
        console.log(`User found. Current privileges: ${user.privileges}`);

        // 3. Update Privileges
        let currentPrivs = [];
        if (user.privileges) {
            if (typeof user.privileges === 'string') {
                currentPrivs = user.privileges.split(',').map(p => p.trim());
            } else if (Array.isArray(user.privileges)) {
                currentPrivs = user.privileges;
            }
        }

        // Check if already has it
        if (currentPrivs.includes(String(privId)) || currentPrivs.includes(privId)) {
            console.log("User already has this privilege.");
        } else {
            currentPrivs.push(privId);
            const newPrivsString = currentPrivs.join(',');

            await pool.query("UPDATE users SET privileges = ? WHERE id = ?", [newPrivsString, user.id]);
            console.log(`Successfully assigned privilege ${privId} to user ${targetEmail}`);
            console.log(`New privileges: ${newPrivsString}`);
        }

        process.exit(0);
    } catch (error) {
        console.error("Assignment Failed:", error);
        process.exit(1);
    }
};

assignPrivilege();
