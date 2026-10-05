
import { executeQuery } from "../db/mssqlHelper.js";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

async function migrateDates() {
    try {
        console.log("Fetching users with non-normalized joiningDate...");
        const [users] = await executeQuery("SELECT id, joiningDate, dob, leavingDate FROM users");
        
        console.log(`Found ${users.length} users. Checking dates...`);
        
        let updatedCount = 0;

        for (const user of users) {
            const updates = [];
            const params = [];

            const normalize = (val) => {
                if (!val || val === "NULL" || val === "null") return null;
                const d = new Date(val);
                if (isNaN(d.getTime())) return null;
                
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const newJoiningDate = normalize(user.joiningDate);
            const newDob = normalize(user.dob);
            const newLeavingDate = normalize(user.leavingDate);

            if (newJoiningDate && newJoiningDate !== user.joiningDate) {
                updates.push("joiningDate = ?");
                params.push(newJoiningDate);
            }
            if (newDob && newDob !== user.dob) {
                updates.push("dob = ?");
                params.push(newDob);
            }
            if (newLeavingDate && newLeavingDate !== user.leavingDate) {
                updates.push("leavingDate = ?");
                params.push(newLeavingDate);
            }

            if (updates.length > 0) {
                const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
                params.push(user.id);
                await executeQuery(query, params);
                updatedCount++;
                console.log(`Updated user ID ${user.id}: ${user.joiningDate} -> ${newJoiningDate}`);
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} users.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrateDates();
