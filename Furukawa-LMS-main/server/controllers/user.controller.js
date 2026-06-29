import { executeQuery } from "../db/mssqlHelper.js";
import UserHierarchySnapshot from "../models/userHierarchySnapshot.model.js";
import DesignationShutter from "../models/designationShutter.model.js";
import validator from "validator";
import { hasPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "./rolesPermissions.controller.js";
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

// Helper to safely parse arrays
const parseArray = (val) => {
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return val.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  if (Array.isArray(val)) return val;
  return [val];
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
    SELECT TOP 1 ss.id as subSectionId, ss.name as subSectionName, ss.lineId as ssLineId 
    FROM sub_sections ss 
    WHERE ss.id = COALESCE(u.subSectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END))
  ) ss_res
  OUTER APPLY (
    SELECT TOP 1 l.id as lineId, l.name as lineName, l.sectionId as lSectionId, l.department as lDeptId
    FROM [lines] l 
    WHERE l.id = COALESCE(u.lineId, (CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END), ss_res.ssLineId)
  ) l_res
  OUTER APPLY (
    SELECT TOP 1 s.id as sectionId, s.name as sectionName, s.departmentId as sDeptId
    FROM [sections] s 
    WHERE s.id = COALESCE(u.sectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END), l_res.lSectionId)
  ) s_res
  OUTER APPLY (
    SELECT TOP 1 d.id, d.name as deptName, d.instructor as deptInstructor
    FROM departments d 
    WHERE d.id = COALESCE(u.departmentId, (CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END), s_res.sDeptId, l_res.lDeptId)
       OR (u.departmentId IS NULL AND u.targetDeptId IS NULL AND (u.department = d.name OR TRY_CAST(u.department AS INT) = d.id))
  ) d
  OUTER APPLY (
    SELECT TOP 1 name as stationName FROM machines 
    WHERE id = COALESCE(u.stationId, (CASE WHEN u.isTemporary = 1 THEN u.targetStationId ELSE NULL END))
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
  const currentSkill = parseJSON(u.currentSkill, {});

  // Resolve TRUE primary level: Check against sub-section ID since currentSkill is keyed by subSectionId
  let resolvedPrimaryLevel = null;
  const subSecId = u.subSectionId || u.targetSubSectionId;
  if (subSecId && currentSkill[subSecId]) {
    resolvedPrimaryLevel = currentSkill[subSecId];
  } else {
    resolvedPrimaryLevel = u.currentLevel || null;
  }

  const formatted = {
    ...u,
    _id: u.id,
    avatar: parseJSON(u.avatar),
    assignments,
    sections: parseJSON(u.sections, []),
    lines: parseJSON(u.lines, []),
    subSections: parseJSON(u.subSections, []),
    primaryStationName: u.stationName || sanitize(u.stationNo) || "No Station",
    primaryLevel: resolvedPrimaryLevel,
    allStations: assignments?.length > 0
      ? assignments.map(a => a.stationName).join(', ')
      : (u.stationName || sanitize(u.stationNo) || "No Station"),
    department: u.deptName ? { _id: String(u.actualDeptId || u.departmentId || u.targetDeptId), name: u.deptName, instructor: u.deptInstructor } : (sanitize(u.department) ? { _id: String(u.department), name: u.department } : null),
    deptName: u.deptName || sanitize(u.department) || "",
    sectionName: u.sectionName || sanitize(u.section) || "",
    lineName: u.lineName || sanitize(u.line) || "",
    subSectionName: u.subSectionName || sanitize(u.sub_section) || "",
    stationName: assignments?.length > 0
      ? assignments.map(a => a.stationName).join(', ')
      : (u.stationName || sanitize(u.stationNo) || ""),
    fromInfo: [u.deptName || sanitize(u.department), u.sectionName || sanitize(u.section), u.lineName || sanitize(u.line), u.subSectionName || sanitize(u.sub_section), u.stationName || sanitize(u.stationNo)].filter(Boolean).join(' / '),
    currentSkill,
    shiftSchedule: parseJSON(u.shiftSchedule, {}),
    targetDeptId: u.targetDeptId,
    targetSectionId: u.targetSectionId,
    targetLineId: u.targetLineId,
    targetSubSectionId: u.targetSubSectionId,
    targetStationId: u.targetStationId
  };
  delete formatted.password;
  delete formatted.refreshToken;
  return formatted;
};

// --- Controllers ---

const normalizeParam = (val) => {
  if (!val || val === 'undefined' || val === 'null' || val === '' || val === '0' || val === 'all' || val === 'All') return null;
  return val;
};

// Returns a SQL WHERE fragment (no extra params) for assignment-level filtering.
// Relies on the aliases produced by getHierarchyJoinSQL being present in the query.
const buildAssignmentClause = (assignmentStatus, assignmentType) => {
  if (!assignmentStatus || !['assigned', 'unassigned'].includes(assignmentStatus)) return null;
  const is = assignmentStatus === 'assigned';
  switch ((assignmentType || 'department').toLowerCase()) {
    case 'section':
      return is ? 's_res.sectionId IS NOT NULL' : 's_res.sectionId IS NULL';
    case 'line':
      return is ? 'l_res.lineId IS NOT NULL' : 'l_res.lineId IS NULL';
    case 'subsection':
      return is ? 'ss_res.subSectionId IS NOT NULL' : 'ss_res.subSectionId IS NULL';
    case 'station':
      return is
        ? '(u.stationId IS NOT NULL OR EXISTS (SELECT 1 FROM machine_assignments WHERE user_id = u.id))'
        : '(u.stationId IS NULL AND NOT EXISTS (SELECT 1 FROM machine_assignments WHERE user_id = u.id))';
    case 'department':
    default:
      return is ? 'd.id IS NOT NULL' : 'd.id IS NULL';
  }
};

/**
 * Get All Users (Paginated & Filtered)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 10000);
  const offset = (page - 1) * limit;

  let whereClauses = [
    "(u.isDeleted = 0 OR u.isDeleted IS NULL)",
    "(u.designation IS NULL OR u.designation = '' OR u.designation NOT IN (SELECT designation FROM designation_shutters))"
  ];
  if (req.query.dojoHandoverPassedOnly === "true") {
    whereClauses.push(`(
      EXISTS (
        SELECT 1 FROM attempted_quizzes aq
        JOIN quizzes q ON aq.quiz = q.id
        WHERE (aq.student = CAST(u.id AS NVARCHAR(255)) OR aq.student = u.userName)
          AND q.isDojo = 1
          AND q.isHandover = 1
          AND aq.status = 'PASSED'
      )
      OR EXISTS (
        SELECT 1 FROM evaluation_test_attempts eta
        WHERE eta.userId = u.id AND eta.isHandoverEligible = 1
      )
    )`);
  }

  if (req.query.includeTemporary === "true") {
    whereClauses.push("((u.isTemporary = 0 OR u.isTemporary IS NULL) OR u.isTemporary = 1)");
  } else if (req.query.includeTemporary === "only") {
    whereClauses.push("(u.isTemporary = 1)");
  } else {
    whereClauses.push("(u.isTemporary = 0 OR u.isTemporary IS NULL)");
  }
  let params = [];

  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.email LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t, t);
  }

  if (req.query.unit) { whereClauses.push("u.unit = ?"); params.push(req.query.unit); }
  
  const deptId = normalizeParam(req.query.departmentId);
  const sectId = normalizeParam(req.query.sectionId);
  const lnId = normalizeParam(req.query.lineId);
  const subSectId = normalizeParam(req.query.subSectionId);
  const stnId = normalizeParam(req.query.stationId);

  if (deptId) {
    whereClauses.push("(u.departmentId = ? OR u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.departmentId = ?))");
    params.push(deptId, deptId);
  }
  if (sectId) {
    whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.id = ?)");
    params.push(sectId);
  }
  if (lnId) {
    whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [lines] l2 CROSS APPLY OPENJSON(ISNULL(l2.users, '[]')) u_inner WHERE l2.id = ?)");
    params.push(lnId);
  }
  if (subSectId) {
    whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sub_sections] ss2 CROSS APPLY OPENJSON(ISNULL(ss2.users, '[]')) u_inner WHERE ss2.id = ?)");
    params.push(subSectId);
  }
  if (stnId) {
    whereClauses.push("(u.stationId = ? OR (u.isTemporary = 1 AND u.targetStationId = ?) OR u.id IN (SELECT user_id FROM machine_assignments WHERE machine_id = ?))");
    params.push(stnId, stnId, stnId);
  }
  if (req.query.role) {
    const roles = req.query.role.split(",");
    whereClauses.push(`u.role IN (${roles.map(() => "?").join(",")})`);
    params.push(...roles);
  }
  if (req.query.customRoleId) { whereClauses.push("u.customRoleId = ?"); params.push(req.query.customRoleId); }
  if (req.query.designation) {
    const designations = req.query.designation.split(",").map(d => d.trim()).filter(Boolean);
    if (designations.length > 0) {
      whereClauses.push(`u.designation IN (${designations.map(() => "?").join(",")})`);
      params.push(...designations);
    }
  }
  if (req.query.isEmployee === "true") { whereClauses.push("u.isEmployee = 1"); }
  if (req.query.isTrainer === "true") { whereClauses.push("u.isTrainer = 1"); }
  if (req.query.passedQuizOnly === "true") {
    whereClauses.push("EXISTS (SELECT 1 FROM attempted_quizzes aq WHERE (aq.student = CAST(u.id AS NVARCHAR(255)) OR aq.student = u.userName) AND aq.status = 'PASSED')");
  }

  if (req.query.ojtApprovedToday === "true") {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM on_job_trainings ojt
      WHERE (
        ojt.student = CAST(u.id AS NVARCHAR(50))
        OR (ojt.attendanceRecords LIKE '%' + u.empId + '%' AND u.empId IS NOT NULL AND u.empId != '')
        OR (ojt.attendanceRecords LIKE '%' + u.userName + '%' AND u.userName IS NOT NULL AND u.userName != '')
      )
      AND (ojt.result = 'Pass' OR ojt.result = 'Approved')
      AND CAST(ojt.createdAt AS DATE) = CAST(GETDATE() AS DATE)
    )`);
  }

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

  const { dateFrom, dateTo, status, shift, attendanceShift, scheduleShift, date } = req.query;

  const upperStatus = (status || "").toUpperCase();

  let attendanceJoinSQL = "";
  let attendanceParams = [];

  if (dateFrom || dateTo || (date && date !== "all") || attendanceShift) {
    let start = dateFrom || date || dateTo;
    let end = dateTo || date || dateFrom;

    // Optimization: If filtering for 'PRESENT', push the filter into the subquery
    const subqueryStatusFilter = upperStatus === "PRESENT" ? "AND status = 'Present'" : "";

    let subqueryWhere;
    if (start && end) {
      subqueryWhere = `WHERE [date] BETWEEN ? AND ? ${subqueryStatusFilter}`;
      attendanceParams = [start, end];
    } else {
      subqueryWhere = `WHERE 1=1 ${subqueryStatusFilter}`;
      attendanceParams = [];
    }

    attendanceJoinSQL = `
      LEFT JOIN (
        SELECT userId,
               MAX(status) as logStatus,
               MAX(shift) as logShift,
               MAX([date]) as logDate,
               COUNT(CASE WHEN status = 'Present' THEN 1 END) as presentDaysCount
        FROM attendance_logs
        ${subqueryWhere}
        GROUP BY userId
      ) al ON u.id = al.userId
    `;
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
  } else if (req.query.includeLeft !== "true") {
    whereClauses.push("(u.status IS NULL OR u.status != 'LEFT')");
  }

  if (shift) {
    if (dateFrom || date) {
      whereClauses.push("al.logShift = ?");
    } else {
      whereClauses.push("u.shift = ?");
    }
    params.push(shift);
  }

  if (attendanceShift) {
    whereClauses.push("al.logShift = ?");
    params.push(attendanceShift);
  }

  if (scheduleShift) {
    const filterDate = normalizeParam(date) || normalizeParam(dateFrom) || new Date().toISOString().split('T')[0];
    whereClauses.push(`COALESCE(JSON_VALUE(u.shiftSchedule, CONCAT('$."', CAST(? AS VARCHAR(10)), '"')), u.shift) = ?`);
    params.push(filterDate, scheduleShift);
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
      SUM(CASE WHEN al.logStatus = 'Present' AND (u.status IS NULL OR u.status != 'LEFT') THEN 1 ELSE 0 END) as presentCount,
      SUM(CASE WHEN (al.logStatus != 'Present' OR al.userId IS NULL) AND (u.status IS NULL OR u.status != 'LEFT') THEN 1 ELSE 0 END) as absentCount,
      SUM(CASE WHEN u.status = 'LEFT' THEN 1 ELSE 0 END) as leftCount,
      AVG(CASE WHEN al.logStatus = 'Present' AND (u.status IS NULL OR u.status != 'LEFT') THEN u.currentEffeciency ELSE NULL END) as presentEfficiency,
      AVG(CASE WHEN al.logStatus = 'Present' AND (u.status IS NULL OR u.status != 'LEFT') THEN u.currentEffeciency WHEN u.currentEffeciency IS NOT NULL AND (u.status IS NULL OR u.status != 'LEFT') THEN 0 ELSE NULL END) as overallEfficiency,
      AVG(CASE WHEN (u.status IS NULL OR u.status != 'LEFT') THEN u.currentEffeciency ELSE NULL END) as systemEfficiency
    FROM users u 
    ${getHierarchyJoinSQL} 
    ${attendanceJoinSQL}
    ${countsWhereSQL}
  `, [...attendanceParams, ...params]); // We use the same params as the filters built so far

  const presentCount = countsData[0]?.presentCount || 0;
  const absentCount = countsData[0]?.absentCount || 0;
  const leftCount = countsData[0]?.leftCount || 0;
  const presentEfficiency = countsData[0]?.presentEfficiency || 0;
  const overallEfficiency = countsData[0]?.overallEfficiency || 0;
  const systemEfficiency = countsData[0]?.systemEfficiency || 0;
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
    leftCount,
    presentEfficiency: Math.round(presentEfficiency * 100) / 100,
    overallEfficiency: Math.round(overallEfficiency * 100) / 100,
    systemEfficiency: Math.round(systemEfficiency * 100) / 100,
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
  if (!data.fullName || !data.userName || !data.password || !data.unit) {
    throw new ApiError("Missing required fields (fullName, userName, password, unit)", 400);
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

  const departments = parseArray(data.departments);
  const stations = parseArray(data.stations);
  const sections = parseArray(data.sections);
  const lines = parseArray(data.lines);
  const subSections = parseArray(data.subSections);

  if (departments.length > 0 && !data.departmentId) {
    data.departmentId = parseInt(departments[0]);
  }
  if (stations.length > 0 && !data.stationId) {
    data.stationId = parseInt(stations[0]);
  }
  if (sections.length > 0 && !data.sectionId) {
    data.sectionId = parseInt(sections[0]);
  }
  if (lines.length > 0 && !data.lineId) {
    data.lineId = parseInt(lines[0]);
  }
  if (subSections.length > 0 && !data.subSectionId) {
    data.subSectionId = parseInt(subSections[0]);
  }

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
    "targetDeptId", "targetSectionId", "targetLineId", "targetSubSectionId", "targetStationId",
    "fatherHusbandName", "gender", "dob", "education", "district", "state", "pin", "busRoute",
    "reasonOfLeaving", "mentor", "designation", "supervisor", "incharge", "isMentor", "isSupervisor", "isIncharge",
    "currentLevel", "isTemporary", "createdAt", "updatedAt", "departments", "stations", "sections", "lines", "subSections", "contractorId", "shiftSchedule"
  ];

  const values = fields.map(f => {
    if (f === 'password') return hashedPassword;
    if (f === 'userName' || f === 'email') return data[f] ? data[f].toLowerCase() : null;
    if (f === 'slug') return slug;
    if (f === 'department') return departmentName;
    if (f === 'createdAt' || f === 'updatedAt') return new Date();
    if (f === 'departments') return JSON.stringify(departments);
    if (f === 'stations') return JSON.stringify(stations);
    if (f === 'sections') return JSON.stringify(sections);
    if (f === 'lines') return JSON.stringify(lines);
    if (f === 'subSections') return JSON.stringify(subSections);
    if (f === 'shiftSchedule') return JSON.stringify(typeof data[f] === 'object' && data[f] !== null ? data[f] : {});
    if (['isEmployee', 'isAdmin', 'isTrainer', 'isMentor', 'isSupervisor', 'isIncharge', 'isTemporary'].includes(f)) return data[f] ? 1 : 0;
    return data[f] || null;
  });

  const placeholders = fields.map(() => "?").join(",");
  const [result] = await executeQuery(`INSERT INTO users (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`, values);

  const newUserId = result[0].id;

  // Sync stations to machine_assignments
  const assignedBy = req.user?.id || null;
  for (const stationId of stations) {
    const parsedStationId = parseInt(stationId);
    if (!isNaN(parsedStationId)) {
      const [existing] = await executeQuery(
        "SELECT id FROM machine_assignments WHERE user_id = ? AND machine_id = ?",
        [newUserId, parsedStationId]
      );
      if (existing.length === 0) {
        await executeQuery(
          "INSERT INTO machine_assignments (user_id, machine_id, assigned_by) VALUES (?, ?, ?)",
          [newUserId, parsedStationId, assignedBy]
        );
      }
    }
  }

  // Trigger Hierarchy Sync for new user
  try {
    const SubSection = (await import("../models/subSection.model.js")).default;
    const Line = (await import("../models/line.model.js")).default;
    const Section = (await import("../models/section.model.js")).default;

    const affectedSubSectionIds = new Set();

    // All directly assigned sub-sections
    subSections.map(id => parseInt(id)).filter(id => !isNaN(id)).forEach(id => affectedSubSectionIds.add(id));
    if (data.subSectionId) affectedSubSectionIds.add(parseInt(data.subSectionId));

    // Sub-sections from assigned stations
    if (stations.length > 0) {
      const sanitizedStationIds = stations.map(id => parseInt(id)).filter(id => !isNaN(id));
      if (sanitizedStationIds.length > 0) {
        const [machines] = await executeQuery(
          `SELECT DISTINCT subSectionId FROM machines WHERE id IN (${sanitizedStationIds.join(',')})`
        );
        machines.forEach(m => {
          if (m.subSectionId) affectedSubSectionIds.add(m.subSectionId);
        });
      }
    }

    for (const subSecId of affectedSubSectionIds) {
      await SubSection.syncUserList(subSecId);
    }

    // Sync all directly assigned lines
    const affectedLineIds = new Set(lines.map(id => parseInt(id)).filter(id => !isNaN(id)));
    if (data.lineId) affectedLineIds.add(parseInt(data.lineId));
    for (const lineId of affectedLineIds) {
      await Line.syncUserList(lineId);
    }

    // Sync all directly assigned sections
    const affectedSectionIds = new Set(sections.map(id => parseInt(id)).filter(id => !isNaN(id)));
    if (data.sectionId) affectedSectionIds.add(parseInt(data.sectionId));
    for (const sectionId of affectedSectionIds) {
      await Section.syncUserList(sectionId);
    }
  } catch (error) {
    console.error(`Failed to trigger hierarchy sync in createUser: ${error.message}`);
  }

  if (departments.length > 0) {
    await handleInstructorAssignments(newUserId, departments);
  }

  // Fetch created user with joins
  const [newUser] = await executeQuery(`
    SELECT u.*, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName, ma.assignments
    FROM users u ${getHierarchyJoinSQL} WHERE u.id = ?
  `, [newUserId]);

  try {
    await UserHierarchySnapshot.syncFromUsers();
  } catch (syncErr) {
    console.error("Snapshot sync failed after createUser:", syncErr.message);
  }

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

  // Parse departments, stations, sections, lines, subSections if they exist in request body
  if (data.departments !== undefined) {
    const depts = parseArray(data.departments);
    if (data.departmentId === undefined) {
      data.departmentId = depts.length > 0 ? parseInt(depts[0]) : null;
    }
  }
  if (data.stations !== undefined) {
    const stns = parseArray(data.stations);
    if (data.stationId === undefined) {
      data.stationId = stns.length > 0 ? parseInt(stns[0]) : null;
    }
  }
  if (data.sections !== undefined) {
    const scts = parseArray(data.sections);
    if (data.sectionId === undefined) {
      data.sectionId = scts.length > 0 ? parseInt(scts[0]) : null;
    }
  }
  if (data.lines !== undefined) {
    const lns = parseArray(data.lines);
    if (data.lineId === undefined) {
      data.lineId = lns.length > 0 ? parseInt(lns[0]) : null;
    }
  }
  if (data.subSections !== undefined) {
    const sss = parseArray(data.subSections);
    if (data.subSectionId === undefined) {
      data.subSectionId = sss.length > 0 ? parseInt(sss[0]) : null;
    }
  }

  let updates = ["updatedAt = GETDATE()"];
  let values = [];

  const fieldsToUpdate = [
    "fullName", "userName", "email", "phoneNumber", "role", "status", "unit",
    "empId", "isEmployee", "isAdmin", "isTrainer", "shift", "idCard", "privileges", "joiningDate", "leavingDate",
    "sectionId", "subSectionId", "lineId", "stationId", "departmentId",
    "fatherHusbandName", "gender", "dob", "education", "district", "state", "pin", "busRoute",
    "reasonOfLeaving", "mentor", "designation", "supervisor", "incharge", "isMentor", "isSupervisor", "isIncharge",
    "contractor", "contractorId", "expectedHandover",
    "customRoleId", "currentLevel", "isTemporary",
    "targetDeptId", "targetSectionId", "targetLineId", "targetSubSectionId", "targetStationId",
    "departments", "stations", "sections", "lines", "subSections", "shiftSchedule"
  ];

  const oldUser = rows[0];

  // Enforce permission to change status
  if (data.status !== undefined && data.status !== oldUser.status) {
    if (!hasPermission(req.user, SYSTEM_PERMISSIONS.USER_CHANGE_STATUS)) {
      throw new ApiError("You do not have permission to change user status", 403);
    }
  }

  // If station is being updated, sync currentLevel with the skill level for that station's sub-section
  if (data.stationId && data.stationId !== oldUser.stationId) {
    let currentSkill = oldUser.currentSkill || {};
    if (typeof currentSkill === 'string') {
      try { currentSkill = JSON.parse(currentSkill); } catch (e) { currentSkill = {}; }
    }
    // Set currentLevel to the level associated with the new station's sub-section
    const [machRows] = await executeQuery("SELECT subSectionId FROM machines WHERE id = ?", [data.stationId]);
    if (machRows.length > 0) {
      const subSecId = machRows[0].subSectionId;
      data.currentLevel = (subSecId && currentSkill[subSecId]) || null;
    } else {
      data.currentLevel = null;
    }
  }

  // Auto-set leavingDate if status is changed to LEFT and no date is provided
  if (data.status === "LEFT" && !data.leavingDate && oldUser.status !== "LEFT") {
    data.leavingDate = new Date().toISOString().split('T')[0];
  }

  const cleanId = (val) => (val === "0" || val === 0 || !val || val === 'null' || val === 'undefined') ? null : parseInt(val);

  // Clean IDs in request data
  if (data.departmentId !== undefined) data.departmentId = cleanId(data.departmentId);
  if (data.sectionId !== undefined) data.sectionId = cleanId(data.sectionId);
  if (data.lineId !== undefined) data.lineId = cleanId(data.lineId);
  if (data.subSectionId !== undefined) data.subSectionId = cleanId(data.subSectionId);
  if (data.stationId !== undefined) data.stationId = cleanId(data.stationId);
  if (data.expectedHandover !== undefined) {
    data.expectedHandover = (data.expectedHandover === "" || !data.expectedHandover) ? null : data.expectedHandover;
  }

  // Promotion Logic: If transitioning from temporary to permanent
  if (oldUser.isTemporary && data.isTemporary === false) {
    // Copy target values to actual fields if they are not being explicitly overridden in the request
    data.departmentId = data.departmentId !== null && data.departmentId !== undefined ? data.departmentId : oldUser.targetDeptId;
    data.sectionId = data.sectionId !== null && data.sectionId !== undefined ? data.sectionId : oldUser.targetSectionId;
    data.lineId = data.lineId !== null && data.lineId !== undefined ? data.lineId : oldUser.targetLineId;
    data.subSectionId = data.subSectionId !== null && data.subSectionId !== undefined ? data.subSectionId : oldUser.targetSubSectionId;
    data.stationId = data.stationId !== null && data.stationId !== undefined ? data.stationId : oldUser.targetStationId;

    // Clear target fields
    data.targetDeptId = null;
    data.targetSectionId = null;
    data.targetLineId = null;
    data.targetSubSectionId = null;
    data.targetStationId = null;
  } else if (data.isTemporary || (data.isTemporary === undefined && oldUser.isTemporary)) {
    // If user is/remains temporary, ensure assignments go to target fields
    if (data.departmentId !== undefined) { data.targetDeptId = data.departmentId; data.departmentId = null; }
    if (data.sectionId !== undefined) { data.targetSectionId = data.sectionId; data.sectionId = null; }
    if (data.lineId !== undefined) { data.targetLineId = data.lineId; data.lineId = null; }
    if (data.subSectionId !== undefined) { data.targetSubSectionId = data.subSectionId; data.subSectionId = null; }
    if (data.stationId !== undefined) { data.targetStationId = data.stationId; data.stationId = null; }
  }

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
      } else if (f === "departments") {
        updates.push("departments = ?");
        values.push(JSON.stringify(parseArray(data[f])));
      } else if (f === "stations") {
        updates.push("stations = ?");
        values.push(JSON.stringify(parseArray(data[f])));
      } else if (f === "sections") {
        updates.push("sections = ?");
        values.push(JSON.stringify(parseArray(data[f])));
      } else if (f === "lines") {
        updates.push("lines = ?");
        values.push(JSON.stringify(parseArray(data[f])));
      } else if (f === "subSections") {
        updates.push("subSections = ?");
        values.push(JSON.stringify(parseArray(data[f])));
      } else if (f === "shiftSchedule") {
        updates.push("shiftSchedule = ?");
        values.push(JSON.stringify(typeof data[f] === 'object' && data[f] !== null ? data[f] : {}));
      } else {
        updates.push(`${f} = ?`);
        values.push(['isEmployee', 'isAdmin', 'isTrainer', 'isMentor', 'isSupervisor', 'isIncharge', 'isTemporary'].includes(f) ? (data[f] ? 1 : 0) : (data[f] === undefined ? null : data[f]));
      }
    }
  }

  if (updates.length > 1) {
    await executeQuery(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [...values, userId]);
  }

  // Trigger Hierarchy Sync
  if (data.lineId || data.subSectionId || data.stationId || data.lines !== undefined || data.subSections !== undefined || data.sections !== undefined || data.status !== undefined || data.isDeleted !== undefined) {
    try {
      const SubSection = (await import("../models/subSection.model.js")).default;
      const Line = (await import("../models/line.model.js")).default;
      const Section = (await import("../models/section.model.js")).default;

      const [u] = await executeQuery(
        "SELECT lineId, subSectionId, sectionId, lines, subSections, sections FROM users WHERE id = ?",
        [userId]
      );

      if (u.length > 0) {
        const affectedSubSectionIds = new Set();
        const affectedLineIds = new Set();
        const affectedSectionIds = new Set();

        if (u[0].subSectionId) affectedSubSectionIds.add(u[0].subSectionId);
        if (u[0].lineId) affectedLineIds.add(u[0].lineId);
        if (u[0].sectionId) affectedSectionIds.add(u[0].sectionId);

        // Include all IDs from the new JSON arrays
        parseArray(u[0].subSections).map(id => parseInt(id)).filter(id => !isNaN(id)).forEach(id => affectedSubSectionIds.add(id));
        parseArray(u[0].lines).map(id => parseInt(id)).filter(id => !isNaN(id)).forEach(id => affectedLineIds.add(id));
        parseArray(u[0].sections).map(id => parseInt(id)).filter(id => !isNaN(id)).forEach(id => affectedSectionIds.add(id));

        // Also sync old values from before the update (oldUser)
        if (oldUser.subSectionId) affectedSubSectionIds.add(parseInt(oldUser.subSectionId));
        if (oldUser.lineId) affectedLineIds.add(parseInt(oldUser.lineId));
        if (oldUser.sectionId) affectedSectionIds.add(parseInt(oldUser.sectionId));
        parseArray(oldUser.subSections).map(id => parseInt(id)).filter(id => !isNaN(id)).forEach(id => affectedSubSectionIds.add(id));
        parseArray(oldUser.lines).map(id => parseInt(id)).filter(id => !isNaN(id)).forEach(id => affectedLineIds.add(id));
        parseArray(oldUser.sections).map(id => parseInt(id)).filter(id => !isNaN(id)).forEach(id => affectedSectionIds.add(id));

        for (const subSecId of affectedSubSectionIds) {
          await SubSection.syncUserList(subSecId);
        }
        for (const lineId of affectedLineIds) {
          await Line.syncUserList(lineId);
        }
        for (const sectionId of affectedSectionIds) {
          await Section.syncUserList(sectionId);
        }
      }
    } catch (error) {
      console.error(`Failed to trigger hierarchy sync in updateUser: ${error.message}`);
    }
  }

  // Sync stations to machine_assignments
  if (data.stations !== undefined) {
    try {
      const stations = parseArray(data.stations);
      const targetStationIds = stations.map(id => parseInt(id)).filter(id => !isNaN(id));
      
      const [existingAssignments] = await executeQuery(
        "SELECT machine_id FROM machine_assignments WHERE user_id = ?",
        [userId]
      );
      const existingStationIds = existingAssignments.map(a => a.machine_id);
      
      const toInsert = targetStationIds.filter(id => !existingStationIds.includes(id));
      const toDelete = existingStationIds.filter(id => !targetStationIds.includes(id));
      
      const affectedSubSectionIds = new Set();
      const allStationIdsToCheck = [...new Set([...targetStationIds, ...existingStationIds])];
      if (allStationIdsToCheck.length > 0) {
        const [machines] = await executeQuery(
          `SELECT id, subSectionId FROM machines WHERE id IN (${allStationIdsToCheck.join(',')})`
        );
        machines.forEach(m => {
          if (m.subSectionId) affectedSubSectionIds.add(m.subSectionId);
        });
      }
      
      const assignedBy = req.user?.id || null;
      for (const stationId of toInsert) {
        await executeQuery(
          "INSERT INTO machine_assignments (user_id, machine_id, assigned_by) VALUES (?, ?, ?)",
          [userId, stationId, assignedBy]
        );
      }
      
      if (toDelete.length > 0) {
        await executeQuery(
          `DELETE FROM machine_assignments WHERE user_id = ? AND machine_id IN (${toDelete.join(',')})`,
          [userId]
        );
      }
      
      const SubSection = (await import("../models/subSection.model.js")).default;
      for (const subSecId of affectedSubSectionIds) {
        await SubSection.syncUserList(subSecId);
      }
    } catch (e) {
      console.error("Error syncing stations in updateUser:", e.message);
    }
  } else if (data.stationId) {
    // Legacy single assignment fallback
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
      
      const [machineInfo] = await executeQuery("SELECT subSectionId FROM machines WHERE id = ?", [data.stationId]);
      if (machineInfo.length > 0 && machineInfo[0].subSectionId) {
        const SubSection = (await import("../models/subSection.model.js")).default;
        await SubSection.syncUserList(machineInfo[0].subSectionId);
      }
    } catch (e) {
      console.error("Error syncing station assignment in updateUser:", e.message);
    }
  }

  if (data.departments) {
    const departments = parseArray(data.departments);
    await handleInstructorAssignments(userId, departments);
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

  try {
    await UserHierarchySnapshot.syncFromUsers();
  } catch (syncErr) {
    console.error("Snapshot sync failed after updateUser:", syncErr.message);
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

  try {
    await UserHierarchySnapshot.syncFromUsers();
  } catch (syncErr) {
    console.error("Snapshot sync failed after deleteUser:", syncErr.message);
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
    "(u.isDeleted = 0 OR u.isDeleted IS NULL)",
    "(u.designation IS NULL OR u.designation = '' OR u.designation NOT IN (SELECT designation FROM designation_shutters))"
  ];
  if (req.query.dojoHandoverPassedOnly === "true") {
    whereClauses.push(`(
      EXISTS (
        SELECT 1 FROM attempted_quizzes aq
        JOIN quizzes q ON aq.quiz = q.id
        WHERE (aq.student = CAST(u.id AS NVARCHAR(255)) OR aq.student = u.userName)
          AND q.isDojo = 1
          AND q.isHandover = 1
          AND aq.status = 'PASSED'
      )
      OR EXISTS (
        SELECT 1 FROM evaluation_test_attempts eta
        WHERE eta.userId = u.id AND eta.isHandoverEligible = 1
      )
    )`);
  }

  const isDojoVal = req.query.isDojo === "true" || req.query.isDojo === true;
  if (isDojoVal) {
    whereClauses.push("(u.isTemporary = 1)");
  } else {
    if (req.query.includeTemporary === "true") {
      whereClauses.push("((u.isTemporary = 0 OR u.isTemporary IS NULL) OR u.isTemporary = 1)");
    } else if (req.query.includeTemporary === "only") {
      whereClauses.push("(u.isTemporary = 1)");
    } else {
      if (req.query.ojtApprovedOnly === "true" || req.query.ojtApprovedToday === "true" || req.query.dojoHandoverPassedOnly === "true") {
        whereClauses.push("((u.isTemporary = 0 OR u.isTemporary IS NULL) OR u.isTemporary = 1)");
      } else {
        whereClauses.push("(u.isTemporary = 0 OR u.isTemporary IS NULL)");
      }
    }
  }
  let params = [];
  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t);
  }
  const deptId = normalizeParam(req.query.departmentId);
  const sectId = normalizeParam(req.query.sectionId);
  const lnId = normalizeParam(req.query.lineId);
  const subSectId = normalizeParam(req.query.subSectionId);
  const stnId = normalizeParam(req.query.stationId);

  if (deptId) { whereClauses.push("d.id = ?"); params.push(deptId); }
  if (sectId) {
    whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.id = ?)");
    params.push(sectId);
  }
  if (lnId) {
    whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [lines] l2 CROSS APPLY OPENJSON(ISNULL(l2.users, '[]')) u_inner WHERE l2.id = ?)");
    params.push(lnId);
  }
  if (subSectId) {
    whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sub_sections] ss2 CROSS APPLY OPENJSON(ISNULL(ss2.users, '[]')) u_inner WHERE ss2.id = ?)");
    params.push(subSectId);
  }
  if (stnId) { whereClauses.push("u.stationId = ?"); params.push(stnId); }
  if (req.query.sixteenDayApprovedOnly === "true") {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM (
        SELECT studentId, approvedBy, verifiedBy,
               ROW_NUMBER() OVER (PARTITION BY studentId ORDER BY attemptNumber DESC, createdAt DESC) as rn
        FROM sixteen_day_monitorings
      ) latest_sdm
      WHERE latest_sdm.studentId = u.id
        AND latest_sdm.rn = 1
        AND latest_sdm.verifiedBy LIKE '%Approved%'
        AND latest_sdm.verifiedBy NOT LIKE '%Rejected%'
    )`);
  }
  if (req.query.ojtApprovedOnly === "true") {
    whereClauses.push(`(
      (u.ojt LIKE '%Pass%' OR u.ojt LIKE '%Approved%')
      OR EXISTS (
        SELECT 1 FROM on_job_trainings ojt
        WHERE (
          ojt.student = CAST(u.id AS NVARCHAR(50))
          OR (ojt.attendanceRecords LIKE '%' + u.empId + '%' AND u.empId IS NOT NULL AND u.empId != '')
          OR (ojt.attendanceRecords LIKE '%' + u.userName + '%' AND u.userName IS NOT NULL AND u.userName != '')
        )
        AND (ojt.result = 'Pass' OR ojt.result = 'Approved')
      )
    )`);
  }

  if (req.query.ojtApprovedToday === "true") {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM on_job_trainings ojt
      WHERE (
        ojt.student = CAST(u.id AS NVARCHAR(50))
        OR (ojt.attendanceRecords LIKE '%' + u.empId + '%' AND u.empId IS NOT NULL AND u.empId != '')
        OR (ojt.attendanceRecords LIKE '%' + u.userName + '%' AND u.userName IS NOT NULL AND u.userName != '')
      )
      AND (ojt.result = 'Pass' OR ojt.result = 'Approved')
      AND CAST(ojt.createdAt AS DATE) = CAST(GETDATE() AS DATE)
    )`);
  }

  if (req.query.designation) {
    const designations = req.query.designation.split(",").map(d => d.trim()).filter(Boolean);
    if (designations.length > 0) {
      whereClauses.push(`u.designation IN (${designations.map(() => "?").join(",")})`);
      params.push(...designations);
    }
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

  let statusParamAdded = false;

  if (upperStatus === "PRESENT") {
    if (dateFrom && dateTo) whereClauses.push("al.presentDaysCount > 0");
    else whereClauses.push("al.logStatus = 'Present'");
  } else if (upperStatus === "ABSENT") {
    if (dateFrom && dateTo) whereClauses.push("(al.userId IS NULL OR al.presentDaysCount = 0)");
    else whereClauses.push("(al.userId IS NULL OR al.logStatus = 'Absent' OR al.logStatus != 'Present')");
  } else if (status) {
    whereClauses.push("u.status = ?");
    params.push(status);
    statusParamAdded = true;
  } else if (req.query.includeLeft !== "true") {
    whereClauses.push("(u.status IS NULL OR u.status != 'LEFT')");
  }

  if (shift) {
    const filterDate = normalizeParam(date) || normalizeParam(dateFrom);
    if (filterDate) {
      whereClauses.push(`COALESCE(JSON_VALUE(u.shiftSchedule, CONCAT('$."', CAST(? AS VARCHAR(10)), '"')), u.shift) = ?`);
      params.push(filterDate, shift);
    } else {
      whereClauses.push("u.shift = ?");
      params.push(shift);
    }
  }

  if (req.user.role === "INSTRUCTOR") {
    const [iDepts] = await executeQuery("SELECT id FROM departments WHERE instructor = ?", [req.user.id]);
    if (iDepts.length) {
      const ids = iDepts.map(d => d.id).join(',');
      whereClauses.push(`(u.departmentId IN (${ids}) OR u.department IN (${ids}))`);
    } else whereClauses.push("1=0");
  } else if (req.user.role === "CUSTOM") {
    const customTargetLayout = String(req.user.customRole?.targetLayout || '').toLowerCase();
    const isAdminLayout = ['admin', 'superadmin'].includes(customTargetLayout);

    // Resolve the set of departments this custom user is allowed to see
    let allowedDepts = [];
    if (req.user.departmentId) allowedDepts.push(String(req.user.departmentId));
    try {
      const parsedDepts = typeof req.user.departments === 'string' ? JSON.parse(req.user.departments) : (req.user.departments || []);
      if (Array.isArray(parsedDepts)) parsedDepts.forEach(d => allowedDepts.push(String(d)));
    } catch (e) { }
    allowedDepts = [...new Set(allowedDepts)].filter(Boolean);

    if (isAdminLayout && allowedDepts.length === 0) {
      // Admin-layout with no assigned departments: full access, no restriction
    } else if (allowedDepts.length > 0) {
      // Restricted to assigned departments (applies to both layouts when depts are assigned)
      const placeholders = allowedDepts.map(() => '?').join(',');
      whereClauses.push(`(
        u.departmentId IN (${placeholders})
        OR u.department IN (${placeholders})
        OR EXISTS (
          SELECT 1 FROM OPENJSON(ISNULL(u.departments, '[]'))
          WITH (deptId INT '$')
          WHERE deptId IN (${placeholders})
        )
      )`);
      params.push(...allowedDepts, ...allowedDepts, ...allowedDepts);
    } else {
      // Non-admin layout with no assigned departments: block all access
      whereClauses.push("1=0");
    }
  }

  const assignmentClause = buildAssignmentClause(req.query.assignmentStatus, req.query.assignmentType);
  if (assignmentClause) whereClauses.push(assignmentClause);

  // Build counts query: same scope (search, hierarchy, role) but without status/shift/attendance filters
  const countsWhereClauses = whereClauses.filter(c =>
    c !== "u.status = ?" &&
    c !== "(u.status IS NULL OR u.status != 'LEFT')" &&
    !c.includes("al.")
  );
  const countsParams = statusParamAdded
    ? params.slice(0, -1)
    : [...params];
  const countsWhereSQL = `WHERE ${countsWhereClauses.join(' AND ')}`;

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

  const [statusCountsData] = await executeQuery(`
    SELECT
      SUM(CASE WHEN u.status = 'LEFT' THEN 1 ELSE 0 END) as leftCount,
      SUM(CASE WHEN u.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as onLeaveCount,
      SUM(CASE WHEN (u.status IS NULL OR (u.status != 'LEFT' AND u.status != 'ON_LEAVE')) THEN 1 ELSE 0 END) as presentCount
    FROM users u ${getHierarchyJoinSQL}
    ${countsWhereSQL}
  `, countsParams);

  res.json(new ApiResponse(200, {
    users: students.map(formatUser),
    totalUsers: cnt[0].total,
    totalPages: Math.ceil(cnt[0].total / limit),
    counts: {
      presentCount: statusCountsData[0]?.presentCount || 0,
      onLeaveCount: statusCountsData[0]?.onLeaveCount || 0,
      leftCount: statusCountsData[0]?.leftCount || 0,
    }
  }, "Students fetched successfully"));
});

export const getUniqueDesignations = asyncHandler(async (req, res) => {
  const [rows] = await executeQuery(`
    SELECT DISTINCT designation
    FROM users
    WHERE designation IS NOT NULL AND designation != '' AND (isDeleted = 0 OR isDeleted IS NULL)
      AND designation NOT IN (SELECT designation FROM designation_shutters)
    ORDER BY designation ASC
  `);
  const designations = rows.map(r => r.designation);
  res.json(new ApiResponse(200, designations, "Unique designations fetched successfully"));
});

export const getDesignationsWithCounts = asyncHandler(async (req, res) => {
  const [rows] = await executeQuery(`
    SELECT
      u.designation,
      COUNT(*) AS totalCount,
      SUM(CASE WHEN (u.status IS NULL OR u.status != 'LEFT') THEN 1 ELSE 0 END) AS activeCount,
      CASE WHEN ds.designation IS NOT NULL THEN 1 ELSE 0 END AS isShuttered
    FROM users u
    LEFT JOIN designation_shutters ds ON ds.designation = u.designation
    WHERE u.designation IS NOT NULL AND u.designation != '' AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
      AND (u.isTemporary = 0 OR u.isTemporary IS NULL)
    GROUP BY u.designation, ds.designation
    ORDER BY u.designation ASC
  `);
  res.json(new ApiResponse(200, rows, "Designations with counts fetched successfully"));
});

export const shutterDesignation = asyncHandler(async (req, res) => {
  const { designation } = req.body;
  if (!designation) throw new ApiError(400, "designation is required");
  await DesignationShutter.shutter(designation);
  res.json(new ApiResponse(200, null, `Designation "${designation}" shuttered successfully`));
});

export const unshutterDesignation = asyncHandler(async (req, res) => {
  const { designation } = req.body;
  if (!designation) throw new ApiError(400, "designation is required");
  await DesignationShutter.unshutter(designation);
  res.json(new ApiResponse(200, null, `Designation "${designation}" unshuttered successfully`));
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
    const assignmentStatus = filters?.assignmentStatus;
    const needsHierarchy = assignmentStatus && ['assigned', 'unassigned'].includes(assignmentStatus);

    if (needsHierarchy) {
      // Use the hierarchy join to resolve IDs matching the assignment-level filter
      let hierWhere = ["u.isEmployee = 1", "(u.isTrainer = 0 OR u.isTrainer IS NULL)", "(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
      let hierParams = [];

      if (filters?.search) {
        const t = `%${filters.search}%`;
        hierWhere.push("(u.fullName LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
        hierParams.push(t, t, t);
      }
      if (filters?.status && filters.status !== "ALL") {
        hierWhere.push("u.status = ?");
        hierParams.push(filters.status);
      }
      if (filters?.unit && filters.unit !== "ALL") {
        hierWhere.push("u.unit = ?");
        hierParams.push(filters.unit);
      }
      if (filters?.departmentId && filters.departmentId !== "ALL") {
        hierWhere.push("(u.departmentId = ? OR u.department = ?)");
        hierParams.push(filters.departmentId, filters.departmentId);
      }

      const ac = buildAssignmentClause(assignmentStatus, filters.assignmentType);
      if (ac) hierWhere.push(ac);

      const [matchedRows] = await executeQuery(
        `SELECT u.id FROM users u ${getHierarchyJoinSQL} WHERE ${hierWhere.join(' AND ')}`,
        hierParams
      );
      const matchedIds = matchedRows.map(r => r.id);

      if (!matchedIds.length) {
        await logAudit(req.user.id, "BULK_DELETE_USERS_FILTERED", { filters });
        return res.json(new ApiResponse(200, null, "No matching users found to delete"));
      }

      const phs = matchedIds.map(() => "?").join(",");
      await executeQuery(`UPDATE users SET isDeleted = 1 WHERE id IN (${phs})`, matchedIds);
      await logAudit(req.user.id, "BULK_DELETE_USERS_FILTERED", { filters });
      return res.json(new ApiResponse(200, null, "All matching users deleted"));
    }

    // Handle filtered bulk delete (all matching records) — flat path when no assignment filter
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

/**
 * Get Temporary Hires (DOJO Hiring)
 */
export const getTemporaryUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  let whereClauses = ["u.isTemporary = 1", "(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
  let params = [];

  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.empId LIKE ? OR u.phoneNumber LIKE ?)");
    params.push(t, t, t);
  }

  if (req.query.gender && req.query.gender !== 'ALL') {
    whereClauses.push("u.gender = ?");
    params.push(req.query.gender);
  }

  if (req.query.today === 'true') {
    const today = new Date().toISOString().split('T')[0];
    whereClauses.push("CAST(u.createdAt AS DATE) = ?");
    params.push(today);
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

  // Fetch Stats
  const [statsData] = await executeQuery(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN CAST(createdAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as todayJoined,
      SUM(CASE WHEN gender = 'MALE' THEN 1 ELSE 0 END) as maleCount,
      SUM(CASE WHEN gender = 'FEMALE' THEN 1 ELSE 0 END) as femaleCount
    FROM users 
    WHERE isTemporary = 1 AND (isDeleted = 0 OR isDeleted IS NULL)
  `);

  const [cnt] = await executeQuery(`SELECT COUNT(*) as total FROM users u ${whereSQL}`, params);
  const [users] = await executeQuery(`
    SELECT u.*, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName, ma.assignments
    FROM users u
    ${getHierarchyJoinSQL}
    ${whereSQL}
    ORDER BY u.createdAt DESC
    OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
  `, [...params, offset, limit]);

  res.json(new ApiResponse(200, {
    users: users.map(formatUser),
    totalUsers: cnt[0].total,
    totalPages: Math.ceil(cnt[0].total / limit),
    currentPage: page,
    ...statsData[0]
  }, "Temporary users fetched successfully"));
});

/**
 * Get Next Temporary ID Sequence
 */
/**
 * Get Next Temporary ID Sequence
 */
export const getNextTemporaryId = asyncHandler(async (req, res) => {
  const { prefix } = req.query; // e.g. TEMPJEED
  if (!prefix) throw new ApiError("Prefix is required", 400);

  // Clean prefix of any hyphens if they were passed by old frontend
  const cleanPrefix = prefix.replace(/-/g, '');

  const [rows] = await executeQuery(`
    SELECT empId FROM users
    WHERE empId LIKE ? AND isTemporary = 1
    ORDER BY empId DESC
  `, [`${cleanPrefix}%`]);

  let nextSeq = 1;
  let randomPart = Math.floor(100 + Math.random() * 900); // 3-digit random

  if (rows.length > 0) {
    const lastId = rows[0].empId;

    // Attempt to parse sequence from the end (last 3 digits)
    const seqMatch = lastId.match(/(\d{3})$/);
    if (seqMatch) {
      nextSeq = parseInt(seqMatch[1]) + 1;

      // Attempt to extract the random part (3 digits before the sequence)
      // We look for 3 digits that precede the last 3 digits
      const randMatch = lastId.match(/(\d{3})\d{3}$/);
      if (randMatch) {
        randomPart = randMatch[1];
      }
    }
  }

  const formattedSeq = String(nextSeq).padStart(3, '0');
  const nextId = `${cleanPrefix}${randomPart}${formattedSeq}`;

  res.json(new ApiResponse(200, { nextId }, "Next sequence generated"));
});

/**
 * Bulk Update Shift Schedule
 * Merges the provided shiftSchedulePatch into each targeted user's existing shiftSchedule.
 * Patch values of null/"" delete a date key; any valid shift value ("A","B","C","G") sets it.
 * Uses a single SELECT + single CASE-WHEN UPDATE to avoid N+1 queries.
 */
export const bulkUpdateShiftSchedule = asyncHandler(async (req, res) => {
  const { ids, isAllSelected, filters, shiftSchedulePatch } = req.body;

  if (!shiftSchedulePatch || typeof shiftSchedulePatch !== 'object' || Array.isArray(shiftSchedulePatch)) {
    throw new ApiError("shiftSchedulePatch is required and must be a date→shift object", 400);
  }

  // Resolve which user IDs to target
  let userIds = [];

  if (isAllSelected) {
    const assignmentStatus = filters?.assignmentStatus;
    const needsHierarchy = assignmentStatus && ['assigned', 'unassigned'].includes(assignmentStatus);

    if (needsHierarchy) {
      let hierWhere = ["u.isEmployee = 1", "(u.isTrainer = 0 OR u.isTrainer IS NULL)", "(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
      let hierParams = [];

      if (filters?.search) {
        const t = `%${filters.search}%`;
        hierWhere.push("(u.fullName LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
        hierParams.push(t, t, t);
      }
      if (filters?.status && filters.status !== "ALL") {
        hierWhere.push("u.status = ?");
        hierParams.push(filters.status);
      }
      if (filters?.unit && filters.unit !== "ALL") {
        hierWhere.push("u.unit = ?");
        hierParams.push(filters.unit);
      }
      if (filters?.departmentId && filters.departmentId !== "ALL") {
        hierWhere.push("(u.departmentId = ? OR u.department = ?)");
        hierParams.push(filters.departmentId, filters.departmentId);
      }

      const ac = buildAssignmentClause(assignmentStatus, filters.assignmentType);
      if (ac) hierWhere.push(ac);

      const [matchedRows] = await executeQuery(
        `SELECT u.id FROM users u ${getHierarchyJoinSQL} WHERE ${hierWhere.join(' AND ')}`,
        hierParams
      );
      userIds = matchedRows.map(r => r.id);
    } else {
      let whereClauses = [
        "isEmployee = 1",
        "(isTrainer = 0 OR isTrainer IS NULL)",
        "(isDeleted = 0 OR isDeleted IS NULL)",
      ];
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

      const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;
      const [rows] = await executeQuery(`SELECT id FROM users ${whereSQL}`, params);
      userIds = rows.map(r => r.id);
    }
  } else {
    if (!ids?.length) throw new ApiError("No IDs provided", 400);
    userIds = ids;
  }

  if (userIds.length === 0) {
    return res.json(new ApiResponse(200, { updated: 0 }, "No users matched the criteria"));
  }

  // Fetch all existing shiftSchedules in one query
  const inPlaceholders = userIds.map(() => "?").join(",");
  const [users] = await executeQuery(
    `SELECT id, shiftSchedule FROM users WHERE id IN (${inPlaceholders})`,
    userIds
  );

  if (users.length === 0) {
    return res.json(new ApiResponse(200, { updated: 0 }, "No matching users found in database"));
  }

  // Merge patch into each user's schedule in memory
  const updates = users.map(u => {
    const existing = parseJSON(u.shiftSchedule, {});
    const merged = { ...existing };
    for (const [date, shift] of Object.entries(shiftSchedulePatch)) {
      if (shift === null || shift === "") {
        delete merged[date];
      } else {
        merged[date] = shift;
      }
    }
    return { id: u.id, shiftSchedule: JSON.stringify(merged) };
  });

  // Single UPDATE using CASE WHEN — 2 total DB round-trips regardless of user count
  const cases = updates.map(() => "WHEN ? THEN ?").join(" ");
  const caseParams = updates.flatMap(u => [u.id, u.shiftSchedule]);
  const updatedIds = updates.map(u => u.id);
  const updatedPlaceholders = updatedIds.map(() => "?").join(",");

  await executeQuery(
    `UPDATE users SET shiftSchedule = CASE id ${cases} END WHERE id IN (${updatedPlaceholders})`,
    [...caseParams, ...updatedIds]
  );

  await logAudit(req.user.id, "BULK_UPDATE_SHIFT_SCHEDULE", {
    count: updates.length,
    isAllSelected: !!isAllSelected,
    datesModified: Object.keys(shiftSchedulePatch).length,
  });

  try {
    await UserHierarchySnapshot.syncFromUsers();
  } catch (syncErr) {
    console.error("Snapshot sync failed after bulkUpdateShiftSchedule:", syncErr.message);
  }

  res.json(new ApiResponse(200, { updated: updates.length }, `Shift schedule updated for ${updates.length} user${updates.length !== 1 ? "s" : ""}`));
});
