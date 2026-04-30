import { executeQuery } from "../db/mssqlHelper.js";
import validator from "validator";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { saveToLocal, deleteFromLocal } from "../utils/fileStorage.util.js";
import { AvailableUserRoles, AvailableUnits } from "../constants.js";
import logAudit from "../utils/auditLogger.js";
import sendMail from "../utils/mail.util.js";
import { generateWelcomeEmail } from "../utils/emailTemplates.js";
import ENV from "../configs/env.config.js";

// Helper to safely parse JSON
const parseJSON = (data, fallback = null) => {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch (e) { return fallback; }
  }
  return data || fallback;
};

// --- Helpers ---

const handleInstructorAssignments = async (userId, departmentIds) => {
  const [departments] = await executeQuery("SELECT * FROM departments");
  const userIdStr = String(userId);
  const targetDepartmentIds = (departmentIds || []).map(String);

  for (const dept of departments) {
    let instructors = [];
    try {
      instructors = typeof dept.instructor === 'string' ? JSON.parse(dept.instructor) : (dept.instructor || []);
      if (!Array.isArray(instructors)) instructors = [instructors].filter(Boolean);
    } catch (e) { instructors = []; }

    instructors = instructors.map(String);
    const originalInstructors = [...instructors];
    const isTarget = targetDepartmentIds.includes(String(dept.id));
    const isAssigned = instructors.includes(userIdStr);

    if (isTarget && !isAssigned) instructors.push(userIdStr);
    else if (!isTarget && isAssigned) instructors = instructors.filter(id => id !== userIdStr);

    if (JSON.stringify(originalInstructors.sort()) !== JSON.stringify(instructors.sort())) {
      await executeQuery("UPDATE departments SET instructor = ? WHERE id = ?", [JSON.stringify(instructors), dept.id]);
    }
  }
};

const getHierarchyJoinSQL = `
  OUTER APPLY (
    SELECT TOP 1 ss.name as subSectionName, ss.lineId as ssLineId 
    FROM sub_sections ss WHERE ss.id = u.subSectionId
  ) ss_res
  OUTER APPLY (
    SELECT TOP 1 l.name as lineName, l.sectionId as lSectionId, l.department as lDeptId
    FROM [lines] l WHERE l.id = COALESCE(u.lineId, ss_res.ssLineId)
  ) l_res
  OUTER APPLY (
    SELECT TOP 1 s.name as sectionName, s.departmentId as sDeptId, s.id as sectionId
    FROM [sections] s WHERE s.id = COALESCE(u.sectionId, l_res.lSectionId)
  ) s_res
  OUTER APPLY (
    -- Optimize by checking ID directly first, then falling back to name/string comparison if needed
    SELECT TOP 1 d.id, d.name as deptName, d.instructor as deptInstructor
    FROM departments d 
    WHERE d.id = COALESCE(u.departmentId, s_res.sDeptId, l_res.lDeptId)
       OR (u.departmentId IS NULL AND (u.department = d.name OR TRY_CAST(u.department AS INT) = d.id))
  ) d
  OUTER APPLY (
    SELECT TOP 1 name as stationName FROM machines WHERE id = u.stationId
  ) st
   OUTER APPLY (
    SELECT 
        (SELECT 
             data.machineId, data.stationName, 
             data.subSectionId, data.subSectionName, 
             data.lineId, data.lineName, 
             data.sectionId, data.sectionName, 
             data.departmentId, data.deptName,
             data.assigned_at
         FROM (
            -- Current Primary Station
            SELECT 
                m2.id as machineId, m2.name as stationName, 
                ss2.id as subSectionId, ss2.name as subSectionName, 
                l2.id as lineId, l2.name as lineName, 
                COALESCE(s_res.sectionId, s2.id) as sectionId, 
                COALESCE(s_res.sectionName, s2.name) as sectionName, 
                COALESCE(d.id, d2.id) as departmentId, 
                COALESCE(d.deptName, d2.name) as deptName,
                u.updatedAt as assigned_at
            FROM machines m2
            LEFT JOIN sub_sections ss2 ON m2.subSectionId = ss2.id
            LEFT JOIN [lines] l2 ON ss2.lineId = l2.id
            LEFT JOIN [sections] s2 ON l2.sectionId = s2.id
            LEFT JOIN departments d2 ON s2.departmentId = d2.id
            WHERE m2.id = u.stationId AND u.stationId IS NOT NULL

            UNION ALL

            -- Junction Table Assignments (Secondary stations)
            -- For secondary stations, we stick to the machine's actual hierarchy
            SELECT 
                m.id as machineId, m.name as stationName, 
                ss.id as subSectionId, ss.name as subSectionName, 
                l.id as lineId, l.name as lineName, 
                s.id as sectionId, s.name as sectionName, 
                d_inner.id as departmentId, d_inner.name as deptName,
                ma.assigned_at
            FROM machine_assignments ma
            JOIN machines m ON ma.machine_id = m.id
            LEFT JOIN sub_sections ss ON m.subSectionId = ss.id
            LEFT JOIN [lines] l ON ss.lineId = l.id
            LEFT JOIN [sections] s ON l.sectionId = s.id
            LEFT JOIN departments d_inner ON s.departmentId = d_inner.id
            WHERE ma.user_id = u.id
            -- Avoid duplicates if the stationId is already the primary
            AND NOT (m.id = u.stationId AND u.stationId IS NOT NULL)
         ) data
         ORDER BY data.assigned_at ASC
         FOR JSON PATH) as assignments
  ) ma
`;

const sanitize = (val) => (val && val !== "N/A" && val.toLowerCase() !== "none") ? val : null;

export const formatUser = (u) => {
  const assignments = parseJSON(u.assignments, []);
  const formatted = {
    ...u,
    _id: u.id,
    avatar: parseJSON(u.avatar),
    assignments,
    department: u.deptName ? { _id: String(u.actualDeptId || u.departmentId), name: u.deptName, instructor: u.deptInstructor } : (sanitize(u.department) ? { _id: String(u.department), name: u.department } : null),
    deptName: u.deptName || sanitize(u.department) || "",
    sectionName: u.sectionName || sanitize(u.section) || "",
    lineName: u.lineName || sanitize(u.line) || "",
    subSectionName: u.subSectionName || sanitize(u.sub_section) || "",
    stationName: assignments?.length > 1 
      ? assignments.map(a => a.stationName).join(', ') 
      : (u.stationName || sanitize(u.stationNo) || ""),
    fromInfo: [u.deptName || sanitize(u.department), u.sectionName || sanitize(u.section), u.lineName || sanitize(u.line), u.subSectionName || sanitize(u.sub_section), u.stationName || sanitize(u.stationNo)].filter(Boolean).join(' / ')
  };
  delete formatted.password;
  delete formatted.refreshToken;
  return formatted;
};

// --- Controllers ---

/**
 * Get All Users (Paginated & Filtered)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  let whereClauses = ["(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
  let params = [];

  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.email LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t, t);
  }

  if (req.query.unit) { whereClauses.push("u.unit = ?"); params.push(req.query.unit); }
  if (req.query.departmentId) { whereClauses.push("d.id = ?"); params.push(req.query.departmentId); }
  if (req.query.sectionId) {
    whereClauses.push("(u.sectionId = ? OR u.lineId IN (SELECT id FROM [lines] WHERE sectionId = ?) OR u.subSectionId IN (SELECT id FROM sub_sections WHERE lineId IN (SELECT id FROM [lines] WHERE sectionId = ?)))");
    params.push(req.query.sectionId, req.query.sectionId, req.query.sectionId);
  }
  if (req.query.lineId) {
    whereClauses.push("(u.lineId = ? OR u.subSectionId IN (SELECT id FROM sub_sections WHERE lineId = ?))");
    params.push(req.query.lineId, req.query.lineId);
  }
  if (req.query.subSectionId) { whereClauses.push("u.subSectionId = ?"); params.push(req.query.subSectionId); }
  if (req.query.stationId) { whereClauses.push("u.stationId = ?"); params.push(req.query.stationId); }
  if (req.query.role) { whereClauses.push("u.role = ?"); params.push(req.query.role); }
  if (req.query.customRoleId) { whereClauses.push("u.customRoleId = ?"); params.push(req.query.customRoleId); }
  if (req.query.isEmployee === "true") { whereClauses.push("u.isEmployee = 1"); }
  if (req.query.isTrainer === "true") { whereClauses.push("u.isTrainer = 1"); }
  
  if (req.query.excludeRoles) {
    const roles = req.query.excludeRoles.split(",");
    whereClauses.push(`u.role NOT IN (${roles.map(() => "?").join(",")})`);
    params.push(...roles);
  }

  if (req.query.isStaff === "true") {
    whereClauses.push("(u.isMentor = 1 OR u.isSupervisor = 1 OR u.isIncharge = 1 OR u.isTrainer = 1)");
  }

  if (req.query.roleManagerFilters === "true") {
    whereClauses.push("(u.isEmployee = 1 OR u.isTrainer = 1 OR u.role = 'CUSTOM')");
  }

  if (req.query.excludeTrainers === "true") {
    whereClauses.push("(u.isTrainer = 0 OR u.isTrainer IS NULL)");
  }

  if (req.query.excludeAdmins === "true") {
    whereClauses.push("(u.isAdmin = 0 OR u.isAdmin IS NULL) AND u.role NOT IN ('ADMIN', 'SUPERADMIN')");
  }

  const { dateFrom, dateTo, status, shift, date } = req.query;

  const upperStatus = (status || "").toUpperCase();

  let attendanceJoinSQL = "";
  let attendanceParams = [];

  if (dateFrom || dateTo || (date && date !== "all")) {
    let start = dateFrom || date || dateTo;
    let end = dateTo || date || dateFrom;

    // Optimization: If filtering for 'PRESENT', push the filter into the subquery
    const subqueryStatusFilter = upperStatus === "PRESENT" ? "AND status = 'Present'" : "";

    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT userId, 
               MAX(status) as logStatus, 
               MAX(shift) as logShift,
               MAX([date]) as logDate,
               COUNT(CASE WHEN status = 'Present' THEN 1 END) as presentDaysCount
        FROM attendance_logs 
        WHERE [date] BETWEEN ? AND ? ${subqueryStatusFilter}
        GROUP BY userId
      ) al ON u.id = al.userId
    `;
    attendanceParams = [start, end];
  } else {
    // Ensure al alias exists even if no date filter is applied to avoid SQL errors in WHERE clause
    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT NULL as logStatus, NULL as logShift, NULL as logDate, 0 as presentDaysCount, NULL as userId
      ) al ON 1=0
    `;
  }

  if (upperStatus === "PRESENT") {
    if (dateFrom && dateTo) {
      whereClauses.push("al.presentDaysCount > 0");
    } else {
      whereClauses.push("al.logStatus = 'Present'");
    }
  } else if (upperStatus === "ABSENT") {
    if (dateFrom && dateTo) {
      whereClauses.push("(al.userId IS NULL OR al.presentDaysCount = 0)");
    } else {
      whereClauses.push("(al.userId IS NULL OR al.logStatus = 'Absent' OR al.logStatus != 'Present')");
    }
  } else if (status) {
    whereClauses.push("u.status = ?");
    params.push(status);
  }

  if (shift) {
    if (dateFrom || date) {
      whereClauses.push("al.logShift = ?");
    } else {
      whereClauses.push("u.shift = ?");
    }
    params.push(shift);
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

  // --- NEW: Calculate Present/Absent counts for the cards ---
  // Create a version of where clauses that omits the specific status filter
  const countsWhereClauses = whereClauses.filter(c =>
    !c.includes("al.logStatus") &&
    !c.includes("al.presentDaysCount") &&
    !c.includes("(al.userId IS NULL")
  );
  const countsWhereSQL = `WHERE ${countsWhereClauses.join(' AND ')}`;

  const [countsData] = await executeQuery(`
    SELECT 
      SUM(CASE WHEN al.logStatus = 'Present' THEN 1 ELSE 0 END) as presentCount,
      SUM(CASE WHEN al.logStatus != 'Present' OR al.userId IS NULL THEN 1 ELSE 0 END) as absentCount
    FROM users u 
    ${getHierarchyJoinSQL} 
    ${attendanceJoinSQL}
    ${countsWhereSQL}
  `, [...attendanceParams, ...params]); // We use the same params as the filters built so far

  const presentCount = countsData[0]?.presentCount || 0;
  const absentCount = countsData[0]?.absentCount || 0;
  // ----------------------------------------------------------

  const [cnt] = await executeQuery(`
    SELECT COUNT(*) as total 
    FROM users u ${getHierarchyJoinSQL} 
    ${attendanceJoinSQL}
    ${whereSQL}
  `, [...attendanceParams, ...params]);
  const totalUsers = cnt[0].total;

  const [users] = await executeQuery(`
    SELECT u.*, 
           d.id as actualDeptId, d.deptName, d.deptInstructor,
           s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName, ma.assignments,
           cr.name as customRoleName,
           al.logShift,
           al.logStatus,
           al.logDate
    FROM users u
    ${getHierarchyJoinSQL}
    LEFT JOIN custom_roles cr ON u.customRoleId = cr.id
    ${attendanceJoinSQL}
    ${whereSQL}
    ORDER BY u.createdAt DESC
    OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
  `, [...attendanceParams, ...params, offset, limit]);

  res.json(new ApiResponse(200, {
    users: users.map(formatUser),
    totalUsers,
    presentCount,
    absentCount,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: page,
    limit
  }, "Users fetched successfully"));
});

/**
 * Get User by ID
 */
export const getUserById = asyncHandler(async (req, res) => {
  const rawId = String(req.params.id || "");
  const term = rawId.toLowerCase();

  let query = `
    SELECT u.*, 
           d.id as actualDeptId, d.deptName, d.deptInstructor,
           s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName, ma.assignments,
           cr.name as customRoleName, cr.color as customRoleColor, cr.allowedPages as customRoleAllowedPages
    FROM users u
    ${getHierarchyJoinSQL}
    LEFT JOIN custom_roles cr ON u.customRoleId = cr.id
    WHERE `;

  let params = [];
  if (!isNaN(rawId)) {
    query += "u.id = ?";
    params.push(rawId);
  } else {
    query += "(u.slug = ? OR u.userName = ? OR u.empId = ?)";
    params.push(term, term, term);
  }

  const [rows] = await executeQuery(query, params);
  if (rows.length === 0) throw new ApiError("User not found!", 404);

  const user = formatUser(rows[0]);
  user.customRole = rows[0].customRoleId ? {
    id: rows[0].customRoleId,
    name: rows[0].customRoleName,
    color: rows[0].customRoleColor,
    allowedPages: parseJSON(rows[0].customRoleAllowedPages, []),
  } : null;

  res.json(new ApiResponse(200, user, "User fetched successfully!"));
});

/**
 * Create User
 */
export const createUser = asyncHandler(async (req, res) => {
  const data = req.body;
  if (!data.fullName || !data.userName || !data.email || !data.password || !data.unit) {
    throw new ApiError("Missing required fields", 400);
  }

  // Duplicate Check
  let dupQuery = "SELECT id FROM users WHERE userName = ?";
  let dupParams = [data.userName.toLowerCase()];
  if (data.phoneNumber) {
    dupQuery += " OR phoneNumber = ?";
    dupParams.push(data.phoneNumber);
  }
  const [dupes] = await executeQuery(dupQuery, dupParams);
  if (dupes.length > 0) throw new ApiError("Username or Phone number already in use", 400);

  const bcrypt = (await import("bcryptjs")).default;
  const hashedPassword = await bcrypt.hash(data.password, 10);
  const slug = data.userName.toLowerCase().replace(/ /g, '-');

  // Sync department name
  let departmentName = data.department;
  if (data.departmentId) {
    const [dept] = await executeQuery("SELECT name FROM departments WHERE id = ?", [data.departmentId]);
    if (dept.length) departmentName = dept[0].name;
  }

  const fields = [
    "fullName", "userName", "slug", "email", "phoneNumber", "role", "password", "unit", "status",
    "empId", "isEmployee", "isAdmin", "isTrainer", "shift", "idCard", "privileges", "joiningDate", "leavingDate",
    "sectionId", "subSectionId", "lineId", "stationId", "departmentId", "department",
    "fatherHusbandName", "gender", "dob", "education", "district", "state", "pin", "busRoute",
    "reasonOfLeaving", "mentor", "designation", "supervisor", "incharge", "isMentor", "isSupervisor", "isIncharge",
    "currentLevel", "createdAt", "updatedAt"
  ];

  const values = fields.map(f => {
    if (f === 'password') return hashedPassword;
    if (f === 'userName' || f === 'email') return data[f].toLowerCase();
    if (f === 'slug') return slug;
    if (f === 'department') return departmentName;
    if (f === 'createdAt' || f === 'updatedAt') return new Date();
    if (['isEmployee', 'isAdmin', 'isTrainer', 'isMentor', 'isSupervisor', 'isIncharge'].includes(f)) return data[f] ? 1 : 0;
    return data[f] || null;
  });

  const placeholders = fields.map(() => "?").join(",");
  const [result] = await executeQuery(`INSERT INTO users (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`, values);

  const newUserId = result[0].id;
  if (data.departments && Array.isArray(data.departments)) {
    await handleInstructorAssignments(newUserId, data.departments);
  }

  // Fetch created user with joins
  const [newUser] = await executeQuery(`
    SELECT u.*, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName, ma.assignments
    FROM users u ${getHierarchyJoinSQL} WHERE u.id = ?
  `, [newUserId]);

  res.status(201).json(new ApiResponse(201, formatUser(newUser[0]), "User created successfully"));
});

/**
 * Update User
 */
export const updateUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const data = req.body;

  const [rows] = await executeQuery("SELECT * FROM users WHERE id = ?", [userId]);
  if (rows.length === 0) throw new ApiError("User not found", 404);

  let updates = ["updatedAt = GETDATE()"];
  let values = [];

  const fieldsToUpdate = [
    "fullName", "userName", "email", "phoneNumber", "role", "status", "unit",
    "empId", "isEmployee", "isAdmin", "isTrainer", "shift", "idCard", "privileges", "joiningDate", "leavingDate",
    "sectionId", "subSectionId", "lineId", "stationId", "departmentId",
    "fatherHusbandName", "gender", "dob", "education", "district", "state", "pin", "busRoute",
    "reasonOfLeaving", "mentor", "designation", "supervisor", "incharge", "isMentor", "isSupervisor", "isIncharge",
    "customRoleId", "currentLevel"
  ];

  for (const f of fieldsToUpdate) {
    if (data[f] !== undefined) {
      if (f === "userName") {
        const [ex] = await executeQuery("SELECT id FROM users WHERE userName = ? AND id != ?", [data[f].toLowerCase(), userId]);
        if (ex.length) throw new ApiError("Username already in use", 400);
        updates.push("userName = ?"); values.push(data[f].toLowerCase());
      } else if (f === "phoneNumber" && data[f]) {
        const [ex] = await executeQuery("SELECT id FROM users WHERE phoneNumber = ? AND id != ?", [data[f], userId]);
        if (ex.length) throw new ApiError("Phone number already in use", 400);
        updates.push("phoneNumber = ?"); values.push(data[f]);
      } else if (f === "phoneNumber" && !data[f]) {
        updates.push("phoneNumber = NULL");
      } else if (f === "departmentId") {
        updates.push("departmentId = ?"); values.push(data[f] || null);
        if (data[f]) {
          const [dept] = await executeQuery("SELECT name FROM departments WHERE id = ?", [data[f]]);
          if (dept.length) { updates.push("department = ?"); values.push(dept[0].name); }
        } else {
          updates.push("department = NULL");
        }
      } else {
        updates.push(`${f} = ?`);
        values.push(['isEmployee', 'isAdmin', 'isTrainer', 'isMentor', 'isSupervisor', 'isIncharge'].includes(f) ? (data[f] ? 1 : 0) : (data[f] || null));
      }
    }
  }

  if (updates.length > 1) {
    await executeQuery(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [...values, userId]);
  }

  // Sync stationId to machine_assignments to support multi-station assignment history
  if (data.stationId) {
    try {
      const [existing] = await executeQuery(
        "SELECT id FROM machine_assignments WHERE user_id = ? AND machine_id = ?",
        [userId, data.stationId]
      );
      if (existing.length === 0) {
        await executeQuery(
          "INSERT INTO machine_assignments (user_id, machine_id, assigned_by) VALUES (?, ?, ?)",
          [userId, data.stationId, req.user?.id || null]
        );
      }
    } catch (e) {
      console.error("Error syncing station assignment in updateUser:", e.message);
    }
  }

  if (data.departments && Array.isArray(data.departments)) {
    await handleInstructorAssignments(userId, data.departments);
  }

  const [updated] = await executeQuery(`
    SELECT u.*, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName, ma.assignments,
           cr.name as customRoleName, cr.color as customRoleColor, cr.allowedPages as customRoleAllowedPages
    FROM users u 
    ${getHierarchyJoinSQL}
    LEFT JOIN custom_roles cr ON u.customRoleId = cr.id
    WHERE u.id = ?
  `, [userId]);

  const finalUser = formatUser(updated[0]);
  if (updated[0].customRoleId) {
    finalUser.customRole = {
      id: updated[0].customRoleId,
      name: updated[0].customRoleName,
      color: updated[0].customRoleColor,
      allowedPages: parseJSON(updated[0].customRoleAllowedPages, []),
    };
  }

  res.json(new ApiResponse(200, finalUser, "User updated successfully"));
});

/**
 * Delete User
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const [rows] = await executeQuery("SELECT id, avatar FROM users WHERE id = ?", [userId]);
  if (rows.length === 0) throw new ApiError("User not found", 404);

  const avatar = parseJSON(rows[0].avatar);
  if (avatar?.url && avatar.url.startsWith('/uploads/')) {
    await deleteFromLocal(avatar.url);
  }

  if (req.user.role === "SUPERADMIN" || req.user.role === "ADMIN") {
    // Before permanent delete, get department to cleanup
    const [user] = await executeQuery("SELECT departmentId FROM users WHERE id = ?", [userId]);
    if (user.length && user[0].departmentId) {
      const deptId = user[0].departmentId;
      const [dept] = await executeQuery("SELECT students FROM departments WHERE id = ?", [deptId]);
      if (dept.length) {
        let students = [];
        try { students = JSON.parse(dept[0].students || "[]"); } catch (e) { }
        if (Array.isArray(students)) {
          students = students.filter(id => String(id) !== String(userId));
          await executeQuery("UPDATE departments SET students = ? WHERE id = ?", [JSON.stringify(students), deptId]);
        }
      }
    }
    await executeQuery("DELETE FROM users WHERE id = ?", [userId]);
    await logAudit(req.user.id, "DELETE_USER_PERMANENT", { userId });
  } else {
    await executeQuery("UPDATE users SET isDeleted = 1 WHERE id = ?", [userId]);
    await logAudit(req.user.id, "DELETE_USER_SOFT", { userId });
  }

  res.json(new ApiResponse(200, null, "User deleted successfully"));
});

/**
 * Update Profile (Self)
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phoneNumber, email } = req.body;
  const userId = req.user.id;

  const [rows] = await executeQuery("SELECT id, phoneNumber FROM users WHERE id = ?", [userId]);
  if (rows.length === 0) throw new ApiError("User not found", 404);

  if (phoneNumber && phoneNumber !== rows[0].phoneNumber) {
    const [exist] = await executeQuery("SELECT id FROM users WHERE phoneNumber = ? AND id != ?", [phoneNumber, userId]);
    if (exist.length > 0) throw new ApiError("Phone number already in use", 400);
  }

  let updates = ["updatedAt = GETDATE()"];
  let values = [];
  if (fullName) { updates.push("fullName = ?"); values.push(fullName); }
  if (phoneNumber !== undefined) { updates.push("phoneNumber = ?"); values.push(phoneNumber || null); }
  if (email && validator.isEmail(email)) { updates.push("email = ?"); values.push(email.toLowerCase()); }

  if (updates.length > 1) {
    await executeQuery(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...values, userId]);
  }

  const [updated] = await executeQuery("SELECT id, fullName, email, phoneNumber, role, department, createdAt, avatar FROM users WHERE id = ?", [userId]);
  res.json(new ApiResponse(200, formatUser(updated[0]), "Profile updated successfully!"));
});

/**
 * Update Avatar
 */
export const updateAvatar = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [rows] = await executeQuery("SELECT id, avatar FROM users WHERE id = ?", [userId]);
  if (rows.length === 0) throw new ApiError("User not found", 404);

  let user = rows[0];
  const oldAvatar = parseJSON(user.avatar);

  if (req.file) {
    if (oldAvatar?.url && oldAvatar.url.startsWith('/uploads/')) {
      await deleteFromLocal(oldAvatar.url);
    }

    const result = await saveToLocal(req.file, 'avatars');
    if (!result.success) throw new ApiError(result.error, 500);

    const newAvatar = { url: result.url };
    await executeQuery("UPDATE users SET avatar = ? WHERE id = ?", [JSON.stringify(newAvatar), userId]);

    res.json(new ApiResponse(200, { avatar: newAvatar }, "Avatar updated successfully"));
  } else {
    throw new ApiError("No file provided", 400);
  }
});

/**
 * Get All Instructors
 */
export const getAllInstructors = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  let whereClauses = ["u.isTrainer = 1", "(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
  let params = [];
  const { dateFrom, dateTo, status, shift, date } = req.query;

  const upperStatus = (status || "").toUpperCase();

  let attendanceJoinSQL = "";
  let attendanceParams = [];

  if (dateFrom || dateTo || (date && date !== "all")) {
    let start = dateFrom || date || dateTo;
    let end = dateTo || date || dateFrom;

    // Optimization: Push status filter into subquery
    const subqueryStatusFilter = upperStatus === "PRESENT" ? "AND status = 'Present'" : "";

    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT userId, 
               MAX(status) as logStatus, 
               MAX(shift) as logShift,
               MAX([date]) as logDate,
               COUNT(CASE WHEN status = 'Present' THEN 1 END) as presentDaysCount
        FROM attendance_logs 
        WHERE [date] BETWEEN ? AND ? ${subqueryStatusFilter}
        GROUP BY userId
      ) al ON u.id = al.userId
    `;
    attendanceParams = [start, end];
  } else {
    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT NULL as logStatus, NULL as logShift, NULL as logDate, 0 as presentDaysCount, NULL as userId
      ) al ON 1=0
    `;
  }

  if (upperStatus === "PRESENT") {
    if (dateFrom && dateTo) whereClauses.push("al.presentDaysCount > 0");
    else whereClauses.push("al.logStatus = 'Present'");
  } else if (upperStatus === "ABSENT") {
    if (dateFrom && dateTo) whereClauses.push("(al.userId IS NULL OR al.presentDaysCount = 0)");
    else whereClauses.push("(al.userId IS NULL OR al.logStatus = 'Absent' OR al.logStatus != 'Present')");
  } else if (status) {
    whereClauses.push("u.status = ?");
    params.push(status);
  }

  if (shift) {
    if (dateFrom || date) whereClauses.push("al.logShift = ?");
    else whereClauses.push("u.shift = ?");
    params.push(shift);
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

  const [cnt] = await executeQuery(`SELECT COUNT(*) as total FROM users u ${getHierarchyJoinSQL} ${attendanceJoinSQL} ${whereSQL}`, [...attendanceParams, ...params]);
  const [instructors] = await executeQuery(`
    SELECT u.*, d.id as actualDeptId, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName,
           al.logShift, al.logStatus, al.logDate
    FROM users u ${getHierarchyJoinSQL} ${attendanceJoinSQL} ${whereSQL}
    ORDER BY u.createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
  `, [...attendanceParams, ...params, offset, limit]);

  res.json(new ApiResponse(200, {
    users: instructors.map(formatUser),
    totalUsers: cnt[0].total,
    totalPages: Math.ceil(cnt[0].total / limit)
  }, "Instructors fetched successfully"));
});

/**
 * Get All Students/Operators
 */
export const getAllStudents = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  let whereClauses = [
    "((u.isEmployee = 1) OR (u.role = 'CUSTOM' AND (u.isTrainer = 0 OR u.isTrainer IS NULL)))",
    "(u.isTrainer = 0 OR u.isTrainer IS NULL)",
    "(u.isDeleted = 0 OR u.isDeleted IS NULL)"
  ];
  let params = [];
  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t);
  }
  if (req.query.departmentId) { whereClauses.push("d.id = ?"); params.push(req.query.departmentId); }
  if (req.query.sectionId) {
    whereClauses.push("(u.sectionId = ? OR u.lineId IN (SELECT id FROM [lines] WHERE sectionId = ?) OR u.subSectionId IN (SELECT id FROM sub_sections WHERE lineId IN (SELECT id FROM [lines] WHERE sectionId = ?)))");
    params.push(req.query.sectionId, req.query.sectionId, req.query.sectionId);
  }
  if (req.query.lineId) {
    whereClauses.push("(u.lineId = ? OR u.subSectionId IN (SELECT id FROM sub_sections WHERE lineId = ?))");
    params.push(req.query.lineId, req.query.lineId);
  }
  if (req.query.subSectionId) { whereClauses.push("u.subSectionId = ?"); params.push(req.query.subSectionId); }
  if (req.query.stationId) { whereClauses.push("u.stationId = ?"); params.push(req.query.stationId); }

  const { dateFrom, dateTo, status, shift, date } = req.query;

  const upperStatus = (status || "").toUpperCase();

  let attendanceJoinSQL = "";
  let attendanceParams = [];

  if (dateFrom || dateTo || (date && date !== "all")) {
    let start = dateFrom || date || dateTo;
    let end = dateTo || date || dateFrom;

    // Optimization: Push status filter into subquery
    const subqueryStatusFilter = upperStatus === "PRESENT" ? "AND status = 'Present'" : "";

    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT userId, 
               MAX(status) as logStatus, 
               MAX(shift) as logShift,
               MAX([date]) as logDate,
               COUNT(CASE WHEN status = 'Present' THEN 1 END) as presentDaysCount
        FROM attendance_logs 
        WHERE [date] BETWEEN ? AND ? ${subqueryStatusFilter}
        GROUP BY userId
      ) al ON u.id = al.userId
    `;
    attendanceParams = [start, end];
  } else {
    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT NULL as logStatus, NULL as logShift, NULL as logDate, 0 as presentDaysCount, NULL as userId
      ) al ON 1=0
    `;
  }

  if (upperStatus === "PRESENT") {
    if (dateFrom && dateTo) whereClauses.push("al.presentDaysCount > 0");
    else whereClauses.push("al.logStatus = 'Present'");
  } else if (upperStatus === "ABSENT") {
    if (dateFrom && dateTo) whereClauses.push("(al.userId IS NULL OR al.presentDaysCount = 0)");
    else whereClauses.push("(al.userId IS NULL OR al.logStatus = 'Absent' OR al.logStatus != 'Present')");
  } else if (status) {
    whereClauses.push("u.status = ?");
    params.push(status);
  }

  if (shift) {
    if (dateFrom || date) whereClauses.push("al.logShift = ?");
    else whereClauses.push("u.shift = ?");
    params.push(shift);
  }

  if (req.user.role === "INSTRUCTOR") {
    const [iDepts] = await executeQuery("SELECT id FROM departments WHERE instructor = ?", [req.user.id]);
    if (iDepts.length) {
      const ids = iDepts.map(d => d.id).join(',');
      whereClauses.push(`(u.departmentId IN (${ids}) OR u.department IN (${ids}))`);
    } else whereClauses.push("1=0");
  } else if (req.user.role === "CUSTOM") {
    let allowedDepts = [];
    if (req.user.departmentId) allowedDepts.push(String(req.user.departmentId));
    
    try {
      const parsedDepts = typeof req.user.departments === 'string' ? JSON.parse(req.user.departments) : (req.user.departments || []);
      if (Array.isArray(parsedDepts)) {
        parsedDepts.forEach(d => allowedDepts.push(String(d)));
      }
    } catch (e) {}

    allowedDepts = [...new Set(allowedDepts)].filter(Boolean);

    if (allowedDepts.length > 0) {
      const ids = allowedDepts.map(d => `'${d}'`).join(',');
      whereClauses.push(`(u.departmentId IN (${ids}) OR u.department IN (${ids}))`);
    }
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;
  const [cnt] = await executeQuery(`
    SELECT COUNT(*) as total 
    FROM users u ${getHierarchyJoinSQL} 
    ${attendanceJoinSQL}
    ${whereSQL}
  `, [...attendanceParams, ...params]);
  const [students] = await executeQuery(`
    SELECT u.*, d.id as actualDeptId, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName,
           al.logShift, al.logStatus, al.logDate
    FROM users u ${getHierarchyJoinSQL} 
    ${attendanceJoinSQL}
    ${whereSQL}
    ORDER BY u.createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
  `, [...attendanceParams, ...params, offset, limit]);

  res.json(new ApiResponse(200, {
    users: students.map(formatUser),
    totalUsers: cnt[0].total,
    totalPages: Math.ceil(cnt[0].total / limit)
  }, "Students fetched successfully"));
});

// Other specialized fetches (Mentors, Supervisors, Incharges) can be added similarly using formatUser

export const getAllMentors = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  let whereClauses = ["u.isMentor = 1", "(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
  let params = [];
  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t);
  }

  const { dateFrom, dateTo, status, shift, date } = req.query;

  const upperStatus = (status || "").toUpperCase();

  let attendanceJoinSQL = "";
  let attendanceParams = [];

  if (dateFrom || dateTo || (date && date !== "all")) {
    let start = dateFrom || date || dateTo;
    let end = dateTo || date || dateFrom;

    // Optimization: Push status filter into subquery
    const subqueryStatusFilter = upperStatus === "PRESENT" ? "AND status = 'Present'" : "";

    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT userId, 
               MAX(status) as logStatus, 
               MAX(shift) as logShift,
               MAX([date]) as logDate,
               COUNT(CASE WHEN status = 'Present' THEN 1 END) as presentDaysCount
        FROM attendance_logs 
        WHERE [date] BETWEEN ? AND ? ${subqueryStatusFilter}
        GROUP BY userId
      ) al ON u.id = al.userId
    `;
    attendanceParams = [start, end];
  } else {
    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT NULL as logStatus, NULL as logShift, NULL as logDate, 0 as presentDaysCount, NULL as userId
      ) al ON 1=0
    `;
  }

  if (upperStatus === "PRESENT") {
    if (dateFrom && dateTo) whereClauses.push("al.presentDaysCount > 0");
    else whereClauses.push("al.logStatus = 'Present'");
  } else if (upperStatus === "ABSENT") {
    if (dateFrom && dateTo) whereClauses.push("(al.userId IS NULL OR al.presentDaysCount = 0)");
    else whereClauses.push("(al.userId IS NULL OR al.logStatus = 'Absent' OR al.logStatus != 'Present')");
  } else if (status) {
    whereClauses.push("u.status = ?");
    params.push(status);
  }

  if (shift) {
    if (dateFrom || date) whereClauses.push("al.logShift = ?");
    else whereClauses.push("u.shift = ?");
    params.push(shift);
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;
  const [cnt] = await executeQuery(`SELECT COUNT(*) as total FROM users u ${getHierarchyJoinSQL} ${attendanceJoinSQL} ${whereSQL}`, [...attendanceParams, ...params]);
  const [users] = await executeQuery(`
    SELECT u.*, d.id as actualDeptId, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName,
           al.logShift, al.logStatus, al.logDate
    FROM users u ${getHierarchyJoinSQL} ${attendanceJoinSQL} ${whereSQL}
    ORDER BY u.createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
  `, [...attendanceParams, ...params, offset, limit]);

  res.json(new ApiResponse(200, {
    users: users.map(formatUser),
    totalUsers: cnt[0].total,
    totalPages: Math.ceil(cnt[0].total / limit),
    currentPage: page,
    limit
  }, "Mentors fetched successfully"));
});

export const getAllSupervisors = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  let whereClauses = ["u.isSupervisor = 1", "(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
  let params = [];
  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t);
  }

  const { dateFrom, dateTo, status, shift, date } = req.query;

  const upperStatus = (status || "").toUpperCase();

  let attendanceJoinSQL = "";
  let attendanceParams = [];

  if (dateFrom || dateTo || (date && date !== "all")) {
    let start = dateFrom || date || dateTo;
    let end = dateTo || date || dateFrom;

    // Optimization: Push status filter into subquery
    const subqueryStatusFilter = upperStatus === "PRESENT" ? "AND status = 'Present'" : "";

    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT userId, 
               MAX(status) as logStatus, 
               MAX(shift) as logShift,
               MAX([date]) as logDate,
               COUNT(CASE WHEN status = 'Present' THEN 1 END) as presentDaysCount
        FROM attendance_logs 
        WHERE [date] BETWEEN ? AND ? ${subqueryStatusFilter}
        GROUP BY userId
      ) al ON u.id = al.userId
    `;
    attendanceParams = [start, end];
  } else {
    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT NULL as logStatus, NULL as logShift, NULL as logDate, 0 as presentDaysCount, NULL as userId
      ) al ON 1=0
    `;
  }

  if (upperStatus === "PRESENT") {
    if (dateFrom && dateTo) whereClauses.push("al.presentDaysCount > 0");
    else whereClauses.push("al.logStatus = 'Present'");
  } else if (upperStatus === "ABSENT") {
    if (dateFrom && dateTo) whereClauses.push("(al.userId IS NULL OR al.presentDaysCount = 0)");
    else whereClauses.push("(al.userId IS NULL OR al.logStatus = 'Absent' OR al.logStatus != 'Present')");
  } else if (status) {
    whereClauses.push("u.status = ?");
    params.push(status);
  }

  if (shift) {
    if (dateFrom || date) whereClauses.push("al.logShift = ?");
    else whereClauses.push("u.shift = ?");
    params.push(shift);
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;
  const [cnt] = await executeQuery(`SELECT COUNT(*) as total FROM users u ${getHierarchyJoinSQL} ${attendanceJoinSQL} ${whereSQL}`, [...attendanceParams, ...params]);
  const [users] = await executeQuery(`
    SELECT u.*, d.id as actualDeptId, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName,
           al.logShift, al.logStatus, al.logDate
    FROM users u ${getHierarchyJoinSQL} ${attendanceJoinSQL} ${whereSQL}
    ORDER BY u.createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
  `, [...attendanceParams, ...params, offset, limit]);

  res.json(new ApiResponse(200, {
    users: users.map(formatUser),
    totalUsers: cnt[0].total,
    totalPages: Math.ceil(cnt[0].total / limit),
    currentPage: page,
    limit
  }, "Supervisors fetched successfully"));
});

export const getAllIncharges = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  let whereClauses = ["u.isIncharge = 1", "(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
  let params = [];
  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t);
  }

  const { dateFrom, dateTo, status, shift, date } = req.query;

  const upperStatus = (status || "").toUpperCase();

  let attendanceJoinSQL = "";
  let attendanceParams = [];

  if (dateFrom || dateTo || (date && date !== "all")) {
    let start = dateFrom || date || dateTo;
    let end = dateTo || date || dateFrom;

    // Optimization: Push status filter into subquery
    const subqueryStatusFilter = upperStatus === "PRESENT" ? "AND status = 'Present'" : "";

    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT userId, 
               MAX(status) as logStatus, 
               MAX(shift) as logShift,
               MAX([date]) as logDate,
               COUNT(CASE WHEN status = 'Present' THEN 1 END) as presentDaysCount
        FROM attendance_logs 
        WHERE [date] BETWEEN ? AND ? ${subqueryStatusFilter}
        GROUP BY userId
      ) al ON u.id = al.userId
    `;
    attendanceParams = [start, end];
  } else {
    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT NULL as logStatus, NULL as logShift, NULL as logDate, 0 as presentDaysCount, NULL as userId
      ) al ON 1=0
    `;
  }

  if (upperStatus === "PRESENT") {
    if (dateFrom && dateTo) whereClauses.push("al.presentDaysCount > 0");
    else whereClauses.push("al.logStatus = 'Present'");
  } else if (upperStatus === "ABSENT") {
    if (dateFrom && dateTo) whereClauses.push("(al.userId IS NULL OR al.presentDaysCount = 0)");
    else whereClauses.push("(al.userId IS NULL OR al.logStatus = 'Absent' OR al.logStatus != 'Present')");
  } else if (status) {
    whereClauses.push("u.status = ?");
    params.push(status);
  }

  if (shift) {
    if (dateFrom || date) whereClauses.push("al.logShift = ?");
    else whereClauses.push("u.shift = ?");
    params.push(shift);
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;
  const [cnt] = await executeQuery(`SELECT COUNT(*) as total FROM users u ${getHierarchyJoinSQL} ${attendanceJoinSQL} ${whereSQL}`, [...attendanceParams, ...params]);
  const [users] = await executeQuery(`
    SELECT u.*, d.id as actualDeptId, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName,
           al.logShift, al.logStatus, al.logDate
    FROM users u ${getHierarchyJoinSQL} ${attendanceJoinSQL} ${whereSQL}
    ORDER BY u.createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
  `, [...attendanceParams, ...params, offset, limit]);

  res.json(new ApiResponse(200, {
    users: users.map(formatUser),
    totalUsers: cnt[0].total,
    totalPages: Math.ceil(cnt[0].total / limit),
    currentPage: page,
    limit
  }, "Incharges fetched successfully"));
});

export const getEmployees = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const [users] = await executeQuery(`SELECT u.* FROM users u WHERE u.isEmployee = 1 ORDER BY u.id OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`, [offset, limit]);
  res.json(new ApiResponse(200, users.map(formatUser), "Employees fetched"));
});

export const getEmployeeById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await executeQuery(`SELECT u.*, d.name as deptName, s.name as sectionName FROM users u LEFT JOIN departments d ON u.departmentId = d.id LEFT JOIN sections s ON u.sectionId = s.id WHERE u.id = ?`, [id]);
  if (!rows.length) throw new ApiError("Employee not found", 404);
  res.json(new ApiResponse(200, formatUser(rows[0]), "Employee fetched"));
});

export const getSoftDeletedUsers = asyncHandler(async (req, res) => {
  const [users] = await executeQuery(`SELECT * FROM users WHERE isDeleted = 1`);
  res.json(new ApiResponse(200, users.map(formatUser), "Soft deleted users fetched"));
});

export const restoreUser = asyncHandler(async (req, res) => {
  await executeQuery(`UPDATE users SET isDeleted = 0 WHERE id = ?`, [req.params.id]);
  res.json(new ApiResponse(200, null, "User restored"));
});

export const bulkDeleteUsers = asyncHandler(async (req, res) => {
  const { ids, isAllSelected, filters } = req.body;

  if (isAllSelected) {
    // Handle filtered bulk delete (all matching records)
    let whereClauses = ["isEmployee = 1", "(isTrainer = 0 OR isTrainer IS NULL)", "(isDeleted = 0 OR isDeleted IS NULL)"];
    let params = [];

    if (filters?.search) {
      const t = `%${filters.search}%`;
      whereClauses.push("(fullName LIKE ? OR userName LIKE ? OR empId LIKE ?)");
      params.push(t, t, t);
    }
    if (filters?.status && filters.status !== "ALL") {
      whereClauses.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.unit && filters.unit !== "ALL") {
      whereClauses.push("unit = ?");
      params.push(filters.unit);
    }
    if (filters?.departmentId && filters.departmentId !== "ALL") {
      whereClauses.push("(departmentId = ? OR department = ?)");
      params.push(filters.departmentId, filters.departmentId);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : "";
    await executeQuery(`UPDATE users SET isDeleted = 1 ${whereSQL}`, params);

    await logAudit(req.user.id, "BULK_DELETE_USERS_FILTERED", { filters });
    return res.json(new ApiResponse(200, null, "All matching users deleted"));
  }

  if (!ids?.length) throw new ApiError("No IDs provided", 400);

  // Cleanup from departments students list
  try {
    const placeholders = ids.map(() => "?").join(",");
    const [usersWithDepts] = await executeQuery(`SELECT id, departmentId FROM users WHERE id IN (${placeholders}) AND departmentId IS NOT NULL`, ids);
    
    // Group by department to minimize updates
    const deptMap = {};
    usersWithDepts.forEach(u => {
      if (!deptMap[u.departmentId]) deptMap[u.departmentId] = [];
      deptMap[u.departmentId].push(String(u.id));
    });

    for (const [deptId, userIdsToRemove] of Object.entries(deptMap)) {
      const [dept] = await executeQuery("SELECT students FROM departments WHERE id = ?", [deptId]);
      if (dept.length) {
        let students = [];
        try { students = JSON.parse(dept[0].students || "[]"); } catch (e) { }
        if (Array.isArray(students)) {
          const updated = students.filter(id => !userIdsToRemove.includes(String(id)));
          await executeQuery("UPDATE departments SET students = ? WHERE id = ?", [JSON.stringify(updated), deptId]);
        }
      }
    }
  } catch (err) {
    console.error("Bulk delete department cleanup error:", err);
  }

  // Generate the placeholders for the IN clause
  const placeholders = ids.map(() => "?").join(",");
  await executeQuery(`UPDATE users SET isDeleted = 1 WHERE id IN (${placeholders})`, ids);

  await logAudit(req.user.id, "BULK_DELETE_USERS_LIST", { count: ids.length });
  res.json(new ApiResponse(200, null, "Selected users deleted"));
});

export const checkAndProcessLevelUpgrades = async (userId) => {
  // Background logic - intentionally left empty or simplified if not critical right now
};
