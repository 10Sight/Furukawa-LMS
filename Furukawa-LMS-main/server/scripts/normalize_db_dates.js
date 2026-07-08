import { executeQuery } from "../db/mssqlHelper.js";

// Robust timezone-safe date parser matching frontend dateUtils logic
const parseCustomDate = (val) => {
  if (!val) return null;
  
  if (val instanceof Date) {
    return !isNaN(val.getTime()) ? val : null;
  }

  const str = String(val).trim();
  if (!str || str.toLowerCase() === "null") return null;

  // 1. Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (e.g. 20/04/1982)
  const dmyMatch = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1]);
    const p2 = parseInt(dmyMatch[2]);
    let year = parseInt(dmyMatch[3]);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    
    let day = p1;
    let month = p2;
    if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    }
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 2. Try YYYY-MM-DD or YYYY/MM/DD (e.g. 2013-03-01)
  const ymdMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})(?:T|\s|$)/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1]);
    const month = parseInt(ymdMatch[2]);
    const day = parseInt(ymdMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Fallback to native Date constructor
  const parsed = new Date(str);
  return !isNaN(parsed.getTime()) ? parsed : null;
};

const normalizeToYMD = (val) => {
    const date = parseCustomDate(val);
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

async function run() {
    console.log("Starting date normalization in users table...");
    try {
        const [users] = await executeQuery("SELECT id, fullName, empId, dob, joiningDate, leavingDate FROM users");
        console.log(`Fetched ${users.length} users to scan.`);

        let updatedCount = 0;

        for (const user of users) {
            const updates = {};
            
            if (user.dob) {
                const norm = normalizeToYMD(user.dob);
                if (norm && norm !== user.dob) {
                    updates.dob = norm;
                }
            }
            if (user.joiningDate) {
                const norm = normalizeToYMD(user.joiningDate);
                if (norm && norm !== user.joiningDate) {
                    updates.joiningDate = norm;
                }
            }
            if (user.leavingDate) {
                const norm = normalizeToYMD(user.leavingDate);
                if (norm && norm !== user.leavingDate) {
                    updates.leavingDate = norm;
                }
            }

            if (Object.keys(updates).length > 0) {
                const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(", ");
                const params = [...Object.values(updates), user.id];
                
                await executeQuery(`UPDATE users SET ${setClauses} WHERE id = ?`, params);
                console.log(`Updated operator ${user.fullName} (${user.empId || "no code"}):`, updates);
                updatedCount++;
            }
        }

        console.log(`Completed successfully. Total records corrected: ${updatedCount}`);
    } catch (error) {
        console.error("Failed to normalize database dates:", error);
    }
    process.exit(0);
}

run();
