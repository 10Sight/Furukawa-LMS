import { executeQuery } from "./db/mssqlHelper.js";

const [lineRows] = await executeQuery("SELECT id, name, sectionId, department FROM [lines] WHERE id = ?", [106]);
console.log("Line 106:", lineRows);

const [candidates] = await executeQuery(`
  SELECT TOP 5 id, fullName, userName, role, departmentId, department, stationId, subSectionId
  FROM users
  WHERE role IN ('STUDENT','CUSTOM')
    AND departmentId = ?
    AND stationId IS NULL
    AND (isDeleted = 0 OR isDeleted IS NULL)
`, [lineRows[0].department]);
console.log("Candidates with matching departmentId and no station:", candidates);
process.exit(0);
