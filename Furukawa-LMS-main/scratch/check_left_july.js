import { executeQuery } from "../server/db/mssqlHelper.js";

function safeYMD(dateVal) {
    if (!dateVal) return null;
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return d.toISOString().split('T')[0];
    } catch (e) {
        return String(dateVal);
    }
}

async function run() {
    console.log("Checking all users with leavingDate in July 2026...");
    
    const [users] = await executeQuery(`
        SELECT id, empId, fullName, status, isEmployee, isTemporary, isDeleted, designation,
               joiningDate, leavingDate, updatedAt
        FROM users
        WHERE leavingDate >= '2026-07-01' AND leavingDate <= '2026-07-31'
    `);
    
    console.log(`Total users found: ${users.length}`);
    users.forEach(u => {
        console.log({
            id: u.id,
            empId: u.empId,
            fullName: u.fullName,
            status: u.status,
            isEmployee: u.isEmployee,
            isTemporary: u.isTemporary,
            isDeleted: u.isDeleted,
            designation: u.designation,
            joiningDate: safeYMD(u.joiningDate),
            leavingDate: safeYMD(u.leavingDate),
            updatedAt: safeYMD(u.updatedAt)
        });
    });

    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
