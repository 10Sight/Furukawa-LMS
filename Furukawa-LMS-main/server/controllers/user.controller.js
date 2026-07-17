import { executeQuery } from "../db/mssqlHelper.js";
import UserHierarchySnapshot from "../models/userHierarchySnapshot.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import Department from "../models/department.model.js";
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

// Cascades NULLs down the section -> line -> subSection -> station hierarchy (and the
// mirrored target* chain used for temporary users) on a plain object carrying those keys.
// Must run against the *effective* post-update state (i.e. after merging in any existing
// values for fields the caller isn't touching), not against a raw partial request body,
// otherwise a patch that only sends the parent field won't cascade to its children.
const applyHierarchyCascade = (obj) => {
  if (!obj.sectionId) {
    obj.lineId = null;
    if (Array.isArray(obj.lines)) obj.lines.length = 0;
  }
  if (!obj.lineId) {
    obj.subSectionId = null;
    if (Array.isArray(obj.subSections)) obj.subSections.length = 0;
  }
  if (!obj.subSectionId) {
    obj.stationId = null;
    if (Array.isArray(obj.stations)) obj.stations.length = 0;
  }

  if (!obj.targetSectionId) obj.targetLineId = null;
  if (!obj.targetLineId) obj.targetSubSectionId = null;
  if (!obj.targetSubSectionId) obj.targetStationId = null;
};

// Given a users-table row (singular *Id columns + JSON array columns), resolves every
// sub-section/line/section whose cached `users` list needs re-syncing after that user's
// assignment changes (e.g. on delete), including sub-sections reached only via a station.
const collectHierarchySyncTargets = async (userRow) => {
  const affectedSubSectionIds = new Set();
  const affectedLineIds = new Set();
  const affectedSectionIds = new Set();

  if (!userRow) return { affectedSubSectionIds, affectedLineIds, affectedSectionIds };

  const toIntArray = (val) => parseArray(val).map(id => parseInt(id)).filter(id => !isNaN(id));

  if (userRow.subSectionId) affectedSubSectionIds.add(parseInt(userRow.subSectionId));
  toIntArray(userRow.subSections).forEach(id => affectedSubSectionIds.add(id));
  if (userRow.lineId) affectedLineIds.add(parseInt(userRow.lineId));
  toIntArray(userRow.lines).forEach(id => affectedLineIds.add(id));
  if (userRow.sectionId) affectedSectionIds.add(parseInt(userRow.sectionId));
  toIntArray(userRow.sections).forEach(id => affectedSectionIds.add(id));

  const stationIds = toIntArray(userRow.stations);
  if (stationIds.length > 0) {
    const [machines] = await executeQuery(
      `SELECT DISTINCT subSectionId FROM machines WHERE id IN (${stationIds.join(',')})`
    );
    machines.forEach(m => { if (m.subSectionId) affectedSubSectionIds.add(m.subSectionId); });
  }

  return { affectedSubSectionIds, affectedLineIds, affectedSectionIds };
};

const syncHierarchyUserLists = async (subSectionIds, lineIds, sectionIds) => {
  try {
    const SubSection = (await import("../models/subSection.model.js")).default;
    const Line = (await import("../models/line.model.js")).default;
    const Section = (await import("../models/section.model.js")).default;

    for (const subSecId of subSectionIds) await SubSection.syncUserList(subSecId);
    for (const lineId of lineIds) await Line.syncUserList(lineId);
    for (const sectionId of sectionIds) await Section.syncUserList(sectionId);
  } catch (error) {
    console.error(`Failed to sync hierarchy user lists: ${error.message}`);
  }
};

// Merges hierarchy sync targets across a batch of removed/deactivated users, then syncs once.
const syncHierarchyForRows = async (userRows) => {
  const allSubSectionIds = new Set();
  const allLineIds = new Set();
  const allSectionIds = new Set();

  for (const row of userRows || []) {
    const { affectedSubSectionIds, affectedLineIds, affectedSectionIds } = await collectHierarchySyncTargets(row);
    affectedSubSectionIds.forEach(id => allSubSectionIds.add(id));
    affectedLineIds.forEach(id => allLineIds.add(id));
    affectedSectionIds.forEach(id => allSectionIds.add(id));
  }

  await syncHierarchyUserLists(allSubSectionIds, allLineIds, allSectionIds);
};

// Strips the given user ids out of every department's `students`/`instructor` JSON arrays.
// Called on both soft- and hard-delete so a "deleted" user disappears from department
// membership immediately, the same way it already drops out of sections/lines/sub_sections.
const removeUsersFromDepartmentAssignments = async (userIds) => {
  if (!userIds || userIds.length === 0) return;
  const idSet = new Set(userIds.map(String));

  try {
    const [departments] = await executeQuery("SELECT id, students, instructor FROM departments");
    for (const dept of departments) {
      let students = [];
      try { students = JSON.parse(dept.students || "[]"); } catch (e) { students = []; }
      if (!Array.isArray(students)) students = [];

      let instructors = [];
      try {
        const parsed = typeof dept.instructor === 'string' ? JSON.parse(dept.instructor) : dept.instructor;
        instructors = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
      } catch (e) {
        instructors = dept.instructor ? [dept.instructor] : [];
      }

      const cleanedStudents = students.filter(id => !idSet.has(String(id)));
      const cleanedInstructors = instructors.filter(id => !idSet.has(String(id)));

      if (cleanedStudents.length !== students.length || cleanedInstructors.length !== instructors.length) {
        await executeQuery(
          "UPDATE departments SET students = ?, instructor = ? WHERE id = ?",
          [JSON.stringify(cleanedStudents), JSON.stringify(cleanedInstructors), dept.id]
        );
      }
    }
  } catch (error) {
    console.error(`Failed to remove users from department assignments: ${error.message}`);
  }
};

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
    SELECT TOP 1 name as contractorName FROM contractors 
    WHERE id = u.contractorId
  ) c_res
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

  let marksPercent;
  if (u.quizScore !== null && u.quizScore !== undefined && u.quizQuestions) {
    try {
      const questions = parseJSON(u.quizQuestions, []);
      const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0) || 1;
      marksPercent = `${Math.round((u.quizScore / totalMarks) * 100)}%`;
    } catch (e) {
      console.error("Error calculating marks in formatUser:", e);
    }
  }

  const formatted = {
    ...u,
    _id: u.id,
    ...(marksPercent !== undefined ? { marks: marksPercent } : {}),
    contractor: u.contractorName || u.contractor || "",
    avatar: parseJSON(u.avatar),
    assignments,
    departments: parseJSON(u.departments, []),
    stations: parseJSON(u.stations, []),
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

// Parses a single value or comma-separated list of values into an array of trimmed, non-empty ids.
const toIdList = (val) => {
  const normalized = normalizeParam(val);
  if (!normalized) return [];
  return String(normalized).split(',').map(id => id.trim()).filter(Boolean);
};

// Accepts a JSON-array string (as sent from the frontend), a plain array, or a
// comma-separated string, and returns a flat list of non-empty id strings.
const parseIdArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v !== null && v !== undefined && v !== '').map(String);
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.filter(v => v !== null && v !== undefined && v !== '').map(String);
  } catch (e) { /* not JSON, fall through */ }
  return toIdList(val);
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

// Builds the SQL fragment + params for the `dojoHandoverPassedOnly` filter.
// Departments with a configured Dojo Eligibility Evaluation Test use the strict
// evaluation-only check; departments not yet migrated to Dojo Hiring Config fall
// back to the legacy quiz-OR-any-eval-attempt check so their searches keep working.
const buildDojoHandoverPassedClause = async (departmentId) => {
  const dept = departmentId ? await Department.findById(departmentId) : null;
  const eligibilityEvalIds = dept?.dojoEligibilityEvaluationId || [];
  const interviewEvalIds = dept?.dojoInterviewEvaluationId || [];
  const requiresInterview = !!dept?.isDojoSpecificDept && interviewEvalIds.length > 0;

  if (eligibilityEvalIds.length === 0) {
    return {
      sql: `(
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
      )`,
      params: []
    };
  }

  let sql = `EXISTS (
    SELECT 1 FROM evaluation_test_attempts eta
    WHERE eta.userId = u.id AND eta.isHandoverEligible = 1
      AND eta.testId IN (SELECT CAST(value AS INT) FROM OPENJSON(?))
  )`;
  const params = [JSON.stringify(eligibilityEvalIds)];

  if (requiresInterview) {
    sql += ` AND EXISTS (
      SELECT 1 FROM evaluation_test_attempts eta2
      WHERE eta2.userId = u.id AND eta2.isHandoverEligible = 1
        AND eta2.testId IN (SELECT CAST(value AS INT) FROM OPENJSON(?))
    )`;
    params.push(JSON.stringify(interviewEvalIds));
  }

  return { sql, params };
};

/**
 * Get All Users (Paginated & Filtered)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 10000);
  const offset = (page - 1) * limit;

  let whereClauses = [
    "(u.isDeleted = 0 OR u.isDeleted IS NULL)"
  ];
  let params = [];
  if (req.query.ignoreShutter !== "true") {
    whereClauses.push(
      "(u.designation IS NULL OR u.designation = '' OR u.isTemporary = 1 OR u.designation NOT IN (SELECT designation FROM designation_shutters))"
    );
  }
  if (req.query.dojoHandoverPassedOnly === "true") {
    const dojoClause = await buildDojoHandoverPassedClause(req.query.departmentId);
    whereClauses.push(dojoClause.sql);
    params.push(...dojoClause.params);
  }

  if (req.query.includeTemporary === "true") {
    whereClauses.push("((u.isTemporary = 0 OR u.isTemporary IS NULL) OR u.isTemporary = 1)");
  } else if (req.query.includeTemporary === "only") {
    whereClauses.push("(u.isTemporary = 1)");
  } else {
    whereClauses.push("(u.isTemporary = 0 OR u.isTemporary IS NULL)");
  }

  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.email LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t, t);
  }

  if (req.query.unit) { whereClauses.push("u.unit = ?"); params.push(req.query.unit); }
  
  const deptIds = toIdList(req.query.departmentId);
  const sectIds = toIdList(req.query.sectionId);
  const lnIds = toIdList(req.query.lineId);
  const subSectIds = toIdList(req.query.subSectionId);
  const stnIds = toIdList(req.query.stationId);

  if (deptIds.length) {
    const ph = deptIds.map(() => "?").join(",");
    whereClauses.push(`(u.departmentId IN (${ph}) OR (u.isTemporary = 1 AND u.targetDeptId IN (${ph})) OR u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.departmentId IN (${ph})))`);
    params.push(...deptIds, ...deptIds, ...deptIds);
  }
  if (sectIds.length) {
    const ph = sectIds.map(() => "?").join(",");
    whereClauses.push(`u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.id IN (${ph}))`);
    params.push(...sectIds);
  }
  if (lnIds.length) {
    const ph = lnIds.map(() => "?").join(",");
    whereClauses.push(`u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [lines] l2 CROSS APPLY OPENJSON(ISNULL(l2.users, '[]')) u_inner WHERE l2.id IN (${ph}))`);
    params.push(...lnIds);
  }
  if (subSectIds.length) {
    const ph = subSectIds.map(() => "?").join(",");
    whereClauses.push(`u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sub_sections] ss2 CROSS APPLY OPENJSON(ISNULL(ss2.users, '[]')) u_inner WHERE ss2.id IN (${ph}))`);
    params.push(...subSectIds);
  }
  if (stnIds.length) {
    const ph = stnIds.map(() => "?").join(",");
    whereClauses.push(`(u.stationId IN (${ph}) OR (u.isTemporary = 1 AND u.targetStationId IN (${ph})) OR u.id IN (SELECT user_id FROM machine_assignments WHERE machine_id IN (${ph})))`);
    params.push(...stnIds, ...stnIds, ...stnIds);
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
      SELECT 1 FROM OPENJSON(ISNULL(u.ojt, '[]'))
      WITH (
        result NVARCHAR(50) '$.result',
        approvedAt DATETIME '$.approvedAt'
      ) AS ojt_item
      WHERE (ojt_item.result = 'Pass' OR ojt_item.result = 'Approved')
        AND CAST(ojt_item.approvedAt AS DATE) = CAST(GETDATE() AS DATE)
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

  const includeHandoverMarks = req.query.includeHandoverMarks === "true";
  const marksJoinSQL = includeHandoverMarks ? `
    OUTER APPLY (
      SELECT TOP 1 aq.score, q.questions as quizQuestions
      FROM attempted_quizzes aq
      JOIN quizzes q ON CAST(q.id AS NVARCHAR(255)) = aq.quiz
      WHERE (CAST(u.id AS NVARCHAR(255)) = aq.student OR u.userName = aq.student)
        AND q.isDojo = 1
        AND q.isHandover = 1
        AND (aq.status = 'PASSED' OR aq.status = 'PASS')
      ORDER BY aq.completedAt DESC
    ) mq` : "";
  const marksSelectSQL = includeHandoverMarks ? ", mq.score as quizScore, mq.quizQuestions as quizQuestions" : "";

  const includeEvaluationInfo = req.query.includeEvaluationInfo === "true";
  const evalJoinSQL = includeEvaluationInfo ? `
    OUTER APPLY (
      SELECT TOP 1 sme.updatedAt as lastEvalDate, sme.sheetIndex as lastEvalSheetIndex, sme.period as lastEvalPeriod
      FROM skill_matrix_evaluations sme
      WHERE sme.studentId = u.id
      ORDER BY sme.sheetIndex DESC, sme.createdAt DESC
    ) eval_res` : "";
  const evalSelectSQL = includeEvaluationInfo ? ", eval_res.lastEvalDate, eval_res.lastEvalSheetIndex, eval_res.lastEvalPeriod" : "";

  // --- NEW: Calculate Present/Absent counts for the cards ---
  const excludeCounts = req.query.excludeCounts === "true";
  let presentCount = 0;
  let absentCount = 0;
  let leftCount = 0;
  let presentEfficiency = 0;
  let overallEfficiency = 0;
  let systemEfficiency = 0;

  if (!excludeCounts) {
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

    presentCount = countsData[0]?.presentCount || 0;
    absentCount = countsData[0]?.absentCount || 0;
    leftCount = countsData[0]?.leftCount || 0;
    presentEfficiency = countsData[0]?.presentEfficiency || 0;
    overallEfficiency = countsData[0]?.overallEfficiency || 0;
    systemEfficiency = countsData[0]?.systemEfficiency || 0;
  }
  // ----------------------------------------------------------

  const [cnt] = await executeQuery(`
    SELECT COUNT(*) as total 
    FROM users u ${getHierarchyJoinSQL} 
    ${attendanceJoinSQL}
    ${whereSQL}
  `, [...attendanceParams, ...params]);
  const totalUsers = cnt[0].total;

  // Sorting
  const sortBy = req.query.sortBy || "createdAt";
  const order = req.query.order || "desc";
  const allowedSortFields = {
    createdAt: "u.createdAt",
    fullName: "u.fullName",
    userName: "u.userName",
    empId: "u.empId",
    id: "u.id"
  };
  const sortColumn = allowedSortFields[sortBy] || "u.createdAt";
  const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";

  const [users] = await executeQuery(`
    SELECT u.*,
           d.id as actualDeptId, d.deptName, d.deptInstructor,
           s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName, ma.assignments,
           cr.name as customRoleName,
           al.logShift,
           al.logStatus,
           al.logDate${marksSelectSQL}${evalSelectSQL}
    FROM users u
    ${getHierarchyJoinSQL}
    LEFT JOIN custom_roles cr ON u.customRoleId = cr.id
    ${attendanceJoinSQL}
    ${marksJoinSQL}
    ${evalJoinSQL}
    ${whereSQL}
    ORDER BY ${sortColumn} ${sortOrder}, u.id ${sortOrder}
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
           cr.name as customRoleName, cr.color as customRoleColor, cr.allowedPages as customRoleAllowedPages,
           c_res.contractorName
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
  if (data.idCard) {
    dupQuery += " OR idCard = ?";
    dupParams.push(data.idCard);
  }
  const [dupes] = await executeQuery(dupQuery, dupParams);
  if (dupes.length > 0) throw new ApiError("Username or ID Card already in use", 400);

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

  // Enforce hierarchy: a NULL parent forces its children to NULL too. Aliasing the array
  // consts onto `data` lets the cascade clear them in place, which also keeps the later
  // machine_assignments/hierarchy-sync loops (which read `stations`/`lines`/`subSections`
  // directly) consistent with the cleared IDs.
  applyHierarchyCascade(Object.assign(data, { lines, subSections, stations }));

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

  const isStudentLike = (data.isEmployee ? 1 : 0) || (data.role === 'CUSTOM' && !data.isTrainer);
  if (isStudentLike) {
    logAudit(req.user?.id, "CREATE_STUDENT", { studentId: newUserId, userName: data.userName, fullName: data.fullName, departmentId: data.departmentId }, { resourceType: "User", resourceId: newUserId, req })
      .catch(err => console.error("logAudit(CREATE_STUDENT) failed:", err.message));
  }

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
    "customRoleId", "currentLevel", "currentSkill", "isTemporary",
    "targetDeptId", "targetSectionId", "targetLineId", "targetSubSectionId", "targetStationId",
    "departments", "stations", "sections", "lines", "subSections", "shiftSchedule", "dojoShift"
  ];

  const oldUser = rows[0];

  // Shift scheduling is not allowed for temporary users. Only block when the
  // schedule is actually being changed -- every save from the edit form carries
  // the user's current (possibly unchanged) shiftSchedule along with it, so a
  // presence check alone would block every unrelated edit to a temp user.
  if (data.shiftSchedule !== undefined) {
    const willBeTemporary = data.isTemporary !== undefined ? !!data.isTemporary : !!oldUser.isTemporary;
    if (willBeTemporary) {
      const newScheduleStr = JSON.stringify(data.shiftSchedule || {});
      const oldScheduleStr = JSON.stringify(parseJSON(oldUser.shiftSchedule, {}));
      if (newScheduleStr !== oldScheduleStr) {
        throw new ApiError("Shift scheduling is not allowed for temporary users", 400);
      }
    }
  }

  // Enforce permission to change status
  if (data.status !== undefined && data.status !== oldUser.status) {
    if (!hasPermission(req.user, SYSTEM_PERMISSIONS.USER_CHANGE_STATUS)) {
      throw new ApiError("You do not have permission to change user status", 403);
    }
  }

  // If station is being updated, sync currentLevel with the skill level for that station's sub-section.
  // Never drop an existing currentLevel to null just because the new sub-section has no recorded
  // skill yet (e.g. a Mentor with currentLevel L3 being assigned their first station) — preserve it
  // and seed currentSkill for the new sub-section so the two stay consistent going forward.
  if (data.stationId && data.stationId !== oldUser.stationId) {
    const currentSkillMap = parseJSON(oldUser.currentSkill, {});
    const [machRows] = await executeQuery("SELECT subSectionId FROM machines WHERE id = ?", [data.stationId]);
    const subSecId = machRows.length > 0 ? machRows[0].subSectionId : null;
    
    // If a level was explicitly passed in the request, preserve it and seed it into the new sub-section mapping
    if (data.currentLevel !== undefined && data.currentLevel) {
      if (subSecId) currentSkillMap[subSecId] = data.currentLevel;
    } else {
      // Fall back to resolving the level from the sub-section history or old level
      if (subSecId && currentSkillMap[subSecId]) {
        data.currentLevel = currentSkillMap[subSecId];
      } else if (oldUser.currentLevel) {
        data.currentLevel = oldUser.currentLevel;
        if (subSecId) currentSkillMap[subSecId] = oldUser.currentLevel;
      } else {
        data.currentLevel = null;
      }
    }
    data.currentSkill = currentSkillMap;
  }

  // Auto-set leavingDate if status is changed to LEFT and no date is provided
  if (data.status === "LEFT" && !data.leavingDate && oldUser.status !== "LEFT") {
    data.leavingDate = new Date().toISOString().split('T')[0];
  }

  // Reset leaving details if status is changed from LEFT to an active status (like PRESENT or ON_LEAVE)
  if (data.status !== undefined && data.status !== "LEFT" && oldUser.status === "LEFT") {
    data.leavingDate = null;
    data.reasonOfLeaving = null;
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

  // Enforce hierarchy cascade: if a parent level ends up NULL, its children must be NULL too.
  // This is a partial-update (PATCH) endpoint, so `data` may omit fields entirely — cascade
  // against the *effective* post-update state (falling back to oldUser for anything `data`
  // doesn't touch), then write back only what the cascade actually changed so it's picked up
  // by the fieldsToUpdate loop below.
  const effective = {
    sectionId: data.sectionId !== undefined ? data.sectionId : oldUser.sectionId,
    lineId: data.lineId !== undefined ? data.lineId : oldUser.lineId,
    subSectionId: data.subSectionId !== undefined ? data.subSectionId : oldUser.subSectionId,
    stationId: data.stationId !== undefined ? data.stationId : oldUser.stationId,
    lines: data.lines !== undefined ? parseArray(data.lines) : parseArray(oldUser.lines),
    subSections: data.subSections !== undefined ? parseArray(data.subSections) : parseArray(oldUser.subSections),
    stations: data.stations !== undefined ? parseArray(data.stations) : parseArray(oldUser.stations),
    targetSectionId: data.targetSectionId !== undefined ? data.targetSectionId : oldUser.targetSectionId,
    targetLineId: data.targetLineId !== undefined ? data.targetLineId : oldUser.targetLineId,
    targetSubSectionId: data.targetSubSectionId !== undefined ? data.targetSubSectionId : oldUser.targetSubSectionId,
    targetStationId: data.targetStationId !== undefined ? data.targetStationId : oldUser.targetStationId,
  };
  const before = { ...effective, lines: [...effective.lines], subSections: [...effective.subSections], stations: [...effective.stations] };
  applyHierarchyCascade(effective);

  if (effective.lineId !== before.lineId) { data.lineId = effective.lineId; data.lines = effective.lines; }
  if (effective.subSectionId !== before.subSectionId) { data.subSectionId = effective.subSectionId; data.subSections = effective.subSections; }
  if (effective.stationId !== before.stationId) { data.stationId = effective.stationId; data.stations = effective.stations; }
  if (effective.targetLineId !== before.targetLineId) data.targetLineId = effective.targetLineId;
  if (effective.targetSubSectionId !== before.targetSubSectionId) data.targetSubSectionId = effective.targetSubSectionId;
  if (effective.targetStationId !== before.targetStationId) data.targetStationId = effective.targetStationId;

  // If the admin is directly editing currentLevel (not via the station-change sync above, which
  // already keeps currentSkill in step), mirror the new level into currentSkill for whichever
  // sub-section is currently active — same resolution formatUser uses (subSectionId, else
  // targetSubSectionId for temporary users) — so a manual level bump doesn't drift out of sync
  // with the per-station skill map. Users with no active sub-section (e.g. Mentors) have nothing
  // to write into, so currentLevel alone remains the source of truth for them.
  const stationChanged = data.stationId && data.stationId !== oldUser.stationId;
  if (!stationChanged && data.currentLevel !== undefined && data.currentLevel && data.currentLevel !== oldUser.currentLevel) {
    const activeSubSecId = effective.subSectionId || effective.targetSubSectionId;
    if (activeSubSecId) {
      const currentSkillMap = data.currentSkill !== undefined ? parseJSON(data.currentSkill, {}) : parseJSON(oldUser.currentSkill, {});
      currentSkillMap[activeSubSecId] = data.currentLevel;
      data.currentSkill = currentSkillMap;
    }
  }

  for (const f of fieldsToUpdate) {
    if (data[f] !== undefined) {
      if (f === "userName") {
        const [ex] = await executeQuery("SELECT id FROM users WHERE userName = ? AND id != ?", [data[f].toLowerCase(), userId]);
        if (ex.length) throw new ApiError("Username already in use", 400);
        updates.push("userName = ?"); values.push(data[f].toLowerCase());
      } else if (f === "phoneNumber" && data[f]) {
        updates.push("phoneNumber = ?"); values.push(data[f]);
      } else if (f === "phoneNumber" && !data[f]) {
        updates.push("phoneNumber = NULL");
      } else if (f === "idCard" && data[f]) {
        const [ex] = await executeQuery("SELECT id FROM users WHERE idCard = ? AND id != ?", [data[f], userId]);
        if (ex.length) throw new ApiError("ID Card already in use", 400);
        updates.push("idCard = ?"); values.push(data[f]);
      } else if (f === "idCard" && !data[f]) {
        updates.push("idCard = NULL");
      } else if (f === "email") {
        const emailVal = (data[f] && data[f].trim()) ? data[f].trim().toLowerCase() : null;
        if (emailVal) {
          updates.push("email = ?");
          values.push(emailVal);
        } else {
          updates.push("email = NULL");
        }
      } else if (f === "departmentId") {
        updates.push("departmentId = ?"); values.push(data[f] || null);
        if (data[f]) {
          const [dept] = await executeQuery("SELECT name FROM departments WHERE id = ?", [data[f]]);
          if (dept.length) { updates.push("department = ?"); values.push(dept[0].name); }
        } else {
          updates.push("department = NULL");
        }
      } else if (f === "sectionId") {
        updates.push("sectionId = ?"); values.push(data[f] || null);
        if (data[f]) {
          const [sec] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [data[f]]);
          if (sec.length) { updates.push("section = ?"); values.push(sec[0].name); }
        } else {
          updates.push("section = NULL");
        }
      } else if (f === "lineId") {
        updates.push("lineId = ?"); values.push(data[f] || null);
        if (data[f]) {
          const [ln] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [data[f]]);
          if (ln.length) { updates.push("line = ?"); values.push(ln[0].name); }
        } else {
          updates.push("line = NULL");
        }
      } else if (f === "subSectionId") {
        updates.push("subSectionId = ?"); values.push(data[f] || null);
        if (data[f]) {
          const [ss] = await executeQuery("SELECT name FROM sub_sections WHERE id = ?", [data[f]]);
          if (ss.length) { updates.push("sub_section = ?"); values.push(ss[0].name); }
        } else {
          updates.push("sub_section = NULL");
        }
      } else if (f === "stationId") {
        updates.push("stationId = ?"); values.push(data[f] || null);
        if (data[f]) {
          const [st] = await executeQuery("SELECT name FROM machines WHERE id = ?", [data[f]]);
          if (st.length) { updates.push("stationNo = ?"); values.push(st[0].name); }
        } else {
          updates.push("stationNo = NULL");
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
      } else if (f === "currentSkill") {
        updates.push("currentSkill = ?");
        values.push(JSON.stringify(parseJSON(data[f], {})));
      } else {
        updates.push(`${f} = ?`);
        values.push(['isEmployee', 'isAdmin', 'isTrainer', 'isMentor', 'isSupervisor', 'isIncharge', 'isTemporary'].includes(f) ? (data[f] ? 1 : 0) : (data[f] === undefined ? null : data[f]));
      }
    }
  }

  if (updates.length > 1) {
    await executeQuery(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [...values, userId]);

    const resultIsEmployee = data.isEmployee !== undefined ? (data.isEmployee ? 1 : 0) : oldUser.isEmployee;
    const resultRole = data.role !== undefined ? data.role : oldUser.role;
    const resultIsTrainer = data.isTrainer !== undefined ? (data.isTrainer ? 1 : 0) : oldUser.isTrainer;
    const isStudentLike = resultIsEmployee || (resultRole === 'CUSTOM' && !resultIsTrainer);
    if (isStudentLike) {
      const changedFields = fieldsToUpdate.filter(f => data[f] !== undefined);
      logAudit(req.user?.id, "UPDATE_STUDENT", { studentId: userId, changedFields }, { resourceType: "User", resourceId: userId, req })
        .catch(err => console.error("logAudit(UPDATE_STUDENT) failed:", err.message));
    }
  }

  // Trigger Hierarchy Sync
  // Note: status is intentionally excluded — sync queries below only filter on isDeleted/role,
  // never on status, so a status-only change (e.g. Mark as Left) has nothing to resync and
  // running this cascade for it was pure wasted latency.
  if (data.lineId || data.subSectionId || data.stationId || data.lines !== undefined || data.subSections !== undefined || data.sections !== undefined || data.isDeleted !== undefined) {
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

  // Fire-and-forget: this rebuilds the whole snapshot table (TRUNCATE + full INSERT...SELECT
  // over all users) and was blocking every update response, including simple status changes
  // like Mark as Left. The table is already eventually-consistent via a 30-minute background
  // sync, so it doesn't need to be on the response's critical path.
  UserHierarchySnapshot.syncFromUsers().catch((syncErr) => {
    console.error("Snapshot sync failed after updateUser:", syncErr.message);
  });

  res.json(new ApiResponse(200, finalUser, "User updated successfully"));
});

/**
 * Delete User
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const [rows] = await executeQuery("SELECT id, avatar, role, isEmployee, isTrainer, fullName FROM users WHERE id = ?", [userId]);
  if (rows.length === 0) throw new ApiError("User not found", 404);

  const avatar = parseJSON(rows[0].avatar);
  if (avatar?.url && avatar.url.startsWith('/uploads/')) {
    await deleteFromLocal(avatar.url);
  }

  const isStudentLike = rows[0].isEmployee || (rows[0].role === 'CUSTOM' && !rows[0].isTrainer);
  const targetFullName = rows[0].fullName;

  if (req.user.role === "SUPERADMIN" || req.user.role === "ADMIN") {
    // Before permanent delete, get hierarchy assignments to cleanup
    const [user] = await executeQuery(
      "SELECT departmentId, sectionId, lineId, subSectionId, sections, lines, subSections, stations FROM users WHERE id = ?",
      [userId]
    );

    const { affectedSubSectionIds, affectedLineIds, affectedSectionIds } = await collectHierarchySyncTargets(user[0]);

    // machine_assignments has no FK to users, so it doesn't cascade on delete - clean it up explicitly
    await executeQuery("DELETE FROM machine_assignments WHERE user_id = ?", [userId]);
    await executeQuery("DELETE FROM users WHERE id = ?", [userId]);
    await logAudit(req.user.id, "DELETE_USER_PERMANENT", { userId }, { req });
    if (isStudentLike) {
      logAudit(req.user.id, "DELETE_STUDENT_PERMANENT", { studentId: userId, fullName: targetFullName }, { resourceType: "User", resourceId: userId, req })
        .catch(err => console.error("logAudit(DELETE_STUDENT_PERMANENT) failed:", err.message));
    }

    await removeUsersFromDepartmentAssignments([userId]);
    await syncHierarchyUserLists(affectedSubSectionIds, affectedLineIds, affectedSectionIds);
  } else {
    const [user] = await executeQuery(
      "SELECT sectionId, lineId, subSectionId, sections, lines, subSections, stations FROM users WHERE id = ?",
      [userId]
    );
    const { affectedSubSectionIds, affectedLineIds, affectedSectionIds } = await collectHierarchySyncTargets(user[0]);

    await executeQuery("UPDATE users SET isDeleted = 1 WHERE id = ?", [userId]);
    await logAudit(req.user.id, "DELETE_USER_SOFT", { userId }, { req });
    if (isStudentLike) {
      logAudit(req.user.id, "DELETE_STUDENT_SOFT", { studentId: userId, fullName: targetFullName }, { resourceType: "User", resourceId: userId, req })
        .catch(err => console.error("logAudit(DELETE_STUDENT_SOFT) failed:", err.message));
    }

    // A soft-deleted user must drop out of department/section/line/sub-section membership too
    await removeUsersFromDepartmentAssignments([userId]);
    await syncHierarchyUserLists(affectedSubSectionIds, affectedLineIds, affectedSectionIds);
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
  if (req.query.ignoreShutter !== "true") {
    whereClauses.push(
      "(u.designation IS NULL OR u.designation = '' OR u.isTemporary = 1 OR u.designation NOT IN (SELECT designation FROM designation_shutters))"
    );
  }
  if (req.query.dojoHandoverPassedOnly === "true") {
    const dojoClause = await buildDojoHandoverPassedClause(req.query.departmentId);
    whereClauses.push(dojoClause.sql);
    params.push(...dojoClause.params);
  }

  const isDojoVal = req.query.isDojo === "true" || req.query.isDojo === true;
  if (isDojoVal) {
    whereClauses.push("(u.isTemporary = 1)");
    const quizTargetSections = parseIdArray(req.query.quizTargetSections);
    const quizTargetDepts = parseIdArray(req.query.quizTargetDepts);
    if (quizTargetSections.length) {
      const ph = quizTargetSections.map(() => "?").join(",");
      whereClauses.push(`u.targetSectionId IN (${ph})`);
      params.push(...quizTargetSections);
    } else if (quizTargetDepts.length) {
      const ph = quizTargetDepts.map(() => "?").join(",");
      whereClauses.push(`u.targetDeptId IN (${ph})`);
      params.push(...quizTargetDepts);
    }
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
  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)");
    params.push(t, t, t);
  }
  const deptIds = toIdList(req.query.departmentId);
  const sectIds = toIdList(req.query.sectionId);
  const lnIds = toIdList(req.query.lineId);
  const subSectIds = toIdList(req.query.subSectionId);
  const stnIds = toIdList(req.query.stationId);

  if (deptIds.length) {
    const ph = deptIds.map(() => "?").join(",");
    whereClauses.push(`d.id IN (${ph})`);
    params.push(...deptIds);
  }
  if (sectIds.length) {
    const ph = sectIds.map(() => "?").join(",");
    whereClauses.push(`u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.id IN (${ph}))`);
    params.push(...sectIds);
  }
  if (lnIds.length) {
    const ph = lnIds.map(() => "?").join(",");
    whereClauses.push(`u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [lines] l2 CROSS APPLY OPENJSON(ISNULL(l2.users, '[]')) u_inner WHERE l2.id IN (${ph}))`);
    params.push(...lnIds);
  }
  if (subSectIds.length) {
    const ph = subSectIds.map(() => "?").join(",");
    whereClauses.push(`u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sub_sections] ss2 CROSS APPLY OPENJSON(ISNULL(ss2.users, '[]')) u_inner WHERE ss2.id IN (${ph}))`);
    params.push(...subSectIds);
  }
  if (stnIds.length) {
    const ph = stnIds.map(() => "?").join(",");
    whereClauses.push(`u.stationId IN (${ph})`);
    params.push(...stnIds);
  }
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
      SELECT 1 FROM OPENJSON(ISNULL(u.ojt, '[]'))
      WITH (
        result NVARCHAR(50) '$.result',
        approvedAt DATETIME '$.approvedAt'
      ) AS ojt_item
      WHERE (ojt_item.result = 'Pass' OR ojt_item.result = 'Approved')
        AND CAST(ojt_item.approvedAt AS DATE) = CAST(GETDATE() AS DATE)
    )`);
  }

  if (req.query.designation) {
    const designations = req.query.designation.split(",").map(d => d.trim()).filter(Boolean);
    if (designations.length > 0) {
      whereClauses.push(`u.designation IN (${designations.map(() => "?").join(",")})`);
      params.push(...designations);
    }
  }

  if (req.query.filterMultiSkillingLevels === "true") {
    const activeConfig = await CourseLevelConfig.getActiveConfig();
    if (activeConfig && activeConfig.levels) {
      const allowedLevels = activeConfig.levels
        .filter(l => l.includeInMultiSkilling === true || l.includeInMultiSkilling === 'true')
        .map(l => l.name);

      if (allowedLevels.length > 0) {
        const placeholders = allowedLevels.map(() => "?").join(",");
        // Mirror formatUser's level resolution: currentSkill[subSectionId] takes
        // precedence over the currentLevel column, which is only synced on station change.
        whereClauses.push(`
          COALESCE(
            JSON_VALUE(u.currentSkill, CONCAT('$."', COALESCE(u.subSectionId, u.targetSubSectionId), '"')),
            u.currentLevel
          ) IN (${placeholders})
        `);
        params.push(...allowedLevels);
      }
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
  let statusParamIndex = -1;

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
    statusParamIndex = params.length - 1;
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
      whereClauses.push(`(u.departmentId IN (${ids}) OR u.department IN (${ids}) OR (u.isTemporary = 1 AND (u.targetDeptId IN (${ids}) OR u.targetDeptId IS NULL)))`);
    } else whereClauses.push("1=0");
  } else if (req.user.role === "CUSTOM") {
    const customTargetLayout = String(req.user.customRole?.targetLayout || '').toLowerCase();
    const isFullAccessLayout = ['admin', 'superadmin', 'trainer', 'instructor'].includes(customTargetLayout);

    // Resolve the set of departments this custom user is allowed to see
    let allowedDepts = [];
    if (req.user.departmentId) allowedDepts.push(String(req.user.departmentId));
    try {
      const parsedDepts = typeof req.user.departments === 'string' ? JSON.parse(req.user.departments) : (req.user.departments || []);
      if (Array.isArray(parsedDepts)) parsedDepts.forEach(d => allowedDepts.push(String(d)));
    } catch (e) { }
    allowedDepts = [...new Set(allowedDepts)].filter(Boolean);

    if (isFullAccessLayout && allowedDepts.length === 0) {
      // Admin/Trainer-layout with no assigned departments: full access, no restriction
    } else if (allowedDepts.length > 0) {
      // Restricted to assigned departments (applies to both layouts when depts are assigned)
      const placeholders = allowedDepts.map(() => '?').join(',');
      whereClauses.push(`(
        u.departmentId IN (${placeholders})
        OR u.department IN (${placeholders})
        OR u.isTemporary = 1
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
    ? [...params.slice(0, statusParamIndex), ...params.slice(statusParamIndex + 1)]
    : [...params];
  const countsWhereSQL = `WHERE ${countsWhereClauses.join(' AND ')}`;

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

  const includeHandoverMarks = req.query.includeHandoverMarks === "true";
  const marksJoinSQL = includeHandoverMarks ? `
    OUTER APPLY (
      SELECT TOP 1 aq.score, q.questions as quizQuestions
      FROM attempted_quizzes aq
      JOIN quizzes q ON CAST(q.id AS NVARCHAR(255)) = aq.quiz
      WHERE (CAST(u.id AS NVARCHAR(255)) = aq.student OR u.userName = aq.student)
        AND q.isDojo = 1
        AND q.isHandover = 1
        AND (aq.status = 'PASSED' OR aq.status = 'PASS')
      ORDER BY aq.completedAt DESC
    ) mq` : "";
  const marksSelectSQL = includeHandoverMarks ? ", mq.score as quizScore, mq.quizQuestions as quizQuestions" : "";

  const [cnt] = await executeQuery(`
    SELECT COUNT(*) as total
    FROM users u ${getHierarchyJoinSQL}
    ${attendanceJoinSQL}
    ${whereSQL}
  `, [...attendanceParams, ...params]);
  const [students] = await executeQuery(`
    SELECT u.*, d.id as actualDeptId, d.deptName, s_res.sectionName, l_res.lineName, ss_res.subSectionName, st.stationName,
           al.logShift, al.logStatus, al.logDate, c_res.contractorName${marksSelectSQL}
    FROM users u ${getHierarchyJoinSQL}
    ${attendanceJoinSQL}
    ${marksJoinSQL}
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
      const hierDeptIds = toIdList(filters?.departmentId);
      if (hierDeptIds.length) {
        const ph = hierDeptIds.map(() => "?").join(",");
        hierWhere.push(`(u.departmentId IN (${ph}) OR u.department IN (${ph}))`);
        hierParams.push(...hierDeptIds, ...hierDeptIds);
      }

      const ac = buildAssignmentClause(assignmentStatus, filters.assignmentType);
      if (ac) hierWhere.push(ac);

      const [matchedRows] = await executeQuery(
        `SELECT u.id FROM users u ${getHierarchyJoinSQL} WHERE ${hierWhere.join(' AND ')}`,
        hierParams
      );
      const matchedIds = matchedRows.map(r => r.id);

      if (!matchedIds.length) {
        await logAudit(req.user.id, "BULK_DELETE_USERS_FILTERED", { filters }, { req });
        return res.json(new ApiResponse(200, null, "No matching users found to delete"));
      }

      const phs = matchedIds.map(() => "?").join(",");
      const [rowsToDelete] = await executeQuery(
        `SELECT sectionId, lineId, subSectionId, sections, lines, subSections, stations FROM users WHERE id IN (${phs})`,
        matchedIds
      );
      await executeQuery(`UPDATE users SET isDeleted = 1 WHERE id IN (${phs})`, matchedIds);
      await logAudit(req.user.id, "BULK_DELETE_USERS_FILTERED", { filters }, { req });
      await removeUsersFromDepartmentAssignments(matchedIds);
      await syncHierarchyForRows(rowsToDelete);
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
    const flatDeptIds = toIdList(filters?.departmentId);
    if (flatDeptIds.length) {
      const ph = flatDeptIds.map(() => "?").join(",");
      whereClauses.push(`(departmentId IN (${ph}) OR department IN (${ph}))`);
      params.push(...flatDeptIds, ...flatDeptIds);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : "";
    const [rowsToDelete] = await executeQuery(
      `SELECT id, sectionId, lineId, subSectionId, sections, lines, subSections, stations FROM users ${whereSQL}`,
      params
    );
    await executeQuery(`UPDATE users SET isDeleted = 1 ${whereSQL}`, params);

    await logAudit(req.user.id, "BULK_DELETE_USERS_FILTERED", { filters }, { req });
    await removeUsersFromDepartmentAssignments(rowsToDelete.map(r => r.id));
    await syncHierarchyForRows(rowsToDelete);
    return res.json(new ApiResponse(200, null, "All matching users deleted"));
  }

  if (!ids?.length) throw new ApiError("No IDs provided", 400);

  const [rowsToDelete] = await executeQuery(
    `SELECT sectionId, lineId, subSectionId, sections, lines, subSections, stations FROM users WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids
  );

  // Generate the placeholders for the IN clause
  const placeholders = ids.map(() => "?").join(",");
  await executeQuery(`UPDATE users SET isDeleted = 1 WHERE id IN (${placeholders})`, ids);

  await logAudit(req.user.id, "BULK_DELETE_USERS_LIST", { count: ids.length }, { req });
  await removeUsersFromDepartmentAssignments(ids);
  await syncHierarchyForRows(rowsToDelete);
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

  let whereClauses = ["(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
  let params = [];

  const activeTab = req.query.activeTab || 'all';

  // Current date in Asia/Kolkata, formatted as YYYY-MM-DD, so "today" matches
  // India local time regardless of the DB server's own timezone (e.g. UTC).
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  switch (activeTab) {
    case 'today':
      // Today's Entry: isTemporary=1, NOT LEFT, joiningDate = today
      whereClauses.push("u.isTemporary = 1");
      whereClauses.push("(u.status != 'LEFT' OR u.status IS NULL)");
      whereClauses.push("CAST(u.joiningDate AS DATE) = ?");
      params.push(todayStr);
      break;

    case 'all':
      // Practical: isTemporary=1, NOT LEFT, joiningDate != today
      whereClauses.push("u.isTemporary = 1");
      whereClauses.push("(u.status != 'LEFT' OR u.status IS NULL)");
      whereClauses.push("(u.joiningDate IS NULL OR CAST(u.joiningDate AS DATE) != ?)");
      params.push(todayStr);
      break;

    case 'handover-candidate':
      // Handover: isTemporary=0 (flipped by handover approval), NOT LEFT
      // Must exist in handover_sheets with APPROVE status
      whereClauses.push("(u.isTemporary = 0 OR u.isTemporary IS NULL)");
      whereClauses.push("(u.status != 'LEFT' OR u.status IS NULL)");
      whereClauses.push(`EXISTS (
        SELECT 1
        FROM handover_sheets hs
        CROSS APPLY OPENJSON(hs.entries) as entry
        WHERE TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT) = u.id
          AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
      )`);
      break;

    case 'left':
      // Left: isTemporary=1, status=LEFT
      whereClauses.push("u.isTemporary = 1");
      whereClauses.push("u.status = 'LEFT'");
      break;

    default:
      // Fallback: same as practical
      whereClauses.push("u.isTemporary = 1");
      whereClauses.push("(u.status != 'LEFT' OR u.status IS NULL)");
      whereClauses.push("(u.joiningDate IS NULL OR CAST(u.joiningDate AS DATE) != ?)");
      params.push(todayStr);
      break;
  }

  if (req.query.search) {
    const t = `%${req.query.search}%`;
    whereClauses.push("(u.fullName LIKE ? OR u.empId LIKE ? OR u.phoneNumber LIKE ?)");
    params.push(t, t, t);
  }

  if (req.query.gender && req.query.gender !== 'ALL') {
    whereClauses.push("u.gender = ?");
    params.push(req.query.gender);
  }

  const departmentId = normalizeParam(req.query.departmentId);
  // Hierarchy join is only needed to resolve d.id, so skip it (and its per-row cost) unless
  // a department filter is actually active.
  const hierarchyJoinSQL = departmentId ? getHierarchyJoinSQL : "";

  if (departmentId) {
    whereClauses.push("d.id = ?");
    params.push(departmentId);
  }

  if (req.query.startDate) {
    whereClauses.push("u.joiningDate >= ?");
    params.push(req.query.startDate);
  }

  if (req.query.endDate) {
    whereClauses.push("u.joiningDate <= ?");
    params.push(req.query.endDate);
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

  // Fetch Stats — scoped by department/date range when provided, but never by
  // search/gender/today/status, so the cards keep showing totals across every tab.
  let statsWhereClauses = ["u.isTemporary = 1", "(u.isDeleted = 0 OR u.isDeleted IS NULL)"];
  let statsParams = [];
  if (departmentId) {
    statsWhereClauses.push("d.id = ?");
    statsParams.push(departmentId);
  }
  if (req.query.startDate) {
    statsWhereClauses.push("u.joiningDate >= ?");
    statsParams.push(req.query.startDate);
  }
  if (req.query.endDate) {
    statsWhereClauses.push("u.joiningDate <= ?");
    statsParams.push(req.query.endDate);
  }
  const statsWhereSQL = `WHERE ${statsWhereClauses.join(' AND ')}`;

  const [statsData] = await executeQuery(`
    SELECT
      SUM(CASE WHEN (u.status != 'LEFT' OR u.status IS NULL) AND (u.joiningDate IS NULL OR CAST(u.joiningDate AS DATE) != ?) THEN 1 ELSE 0 END) as total,
      SUM(CASE WHEN u.status = 'LEFT' THEN 1 ELSE 0 END) as leftTotal,
      SUM(CASE WHEN (u.status != 'LEFT' OR u.status IS NULL) AND CAST(u.joiningDate AS DATE) = ? THEN 1 ELSE 0 END) as todayJoined,
      SUM(CASE WHEN (u.status != 'LEFT' OR u.status IS NULL) AND u.gender = 'MALE' THEN 1 ELSE 0 END) as maleCount,
      SUM(CASE WHEN (u.status != 'LEFT' OR u.status IS NULL) AND u.gender = 'FEMALE' THEN 1 ELSE 0 END) as femaleCount
    FROM users u
    ${hierarchyJoinSQL}
    ${statsWhereSQL}
  `, [todayStr, todayStr, ...statsParams]);

  let handoverWhereClauses = ["(u.isDeleted = 0 OR u.isDeleted IS NULL)", "(u.status != 'LEFT' OR u.status IS NULL)"];
  let handoverParams = [];
  if (departmentId) {
    handoverWhereClauses.push("d.id = ?");
    handoverParams.push(departmentId);
  }
  let handoverDateFilterClause = "";
  if (req.query.startDate) {
    handoverDateFilterClause += " AND hs.date >= ?";
    handoverParams.push(req.query.startDate);
  }
  if (req.query.endDate) {
    handoverDateFilterClause += " AND hs.date <= ?";
    handoverParams.push(req.query.endDate);
  }

  // Default to the current month when no date filter is applied, so the
  // "Total Handover" card reflects this month's approvals instead of all-time.
  if (!req.query.startDate && !req.query.endDate) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    handoverDateFilterClause += " AND hs.date >= ? AND hs.date <= ?";
    handoverParams.push(formatISO(startOfMonth), formatISO(endOfMonth));
  }

  const [handoverData] = await executeQuery(`
    SELECT COUNT(DISTINCT u.id) as handoverCount
    FROM users u
    ${hierarchyJoinSQL}
    WHERE ${handoverWhereClauses.join(' AND ')}
      AND EXISTS (
          SELECT 1
          FROM handover_sheets hs
          CROSS APPLY OPENJSON(hs.entries) as entry
          WHERE TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT) = u.id
            AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
            ${handoverDateFilterClause}
      )
  `, handoverParams);
  const handoverCount = handoverData[0]?.handoverCount || 0;

  const [cnt] = await executeQuery(`SELECT COUNT(*) as total FROM users u ${hierarchyJoinSQL} ${whereSQL}`, params);
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
    total: statsData[0].total,
    leftTotal: statsData[0].leftTotal,
    todayJoined: statsData[0].todayJoined,
    maleCount: statsData[0].maleCount,
    femaleCount: statsData[0].femaleCount,
    handoverCount,
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
      const hierDeptIds = toIdList(filters?.departmentId);
      if (hierDeptIds.length) {
        const ph = hierDeptIds.map(() => "?").join(",");
        hierWhere.push(`(u.departmentId IN (${ph}) OR u.department IN (${ph}))`);
        hierParams.push(...hierDeptIds, ...hierDeptIds);
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
      const flatDeptIds = toIdList(filters?.departmentId);
      if (flatDeptIds.length) {
        const ph = flatDeptIds.map(() => "?").join(",");
        whereClauses.push(`(departmentId IN (${ph}) OR department IN (${ph}))`);
        params.push(...flatDeptIds, ...flatDeptIds);
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
      if (shift === null || shift === "" || shift === "REMOVE") {
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
  }, { req });

  try {
    await UserHierarchySnapshot.syncFromUsers();
  } catch (syncErr) {
    console.error("Snapshot sync failed after bulkUpdateShiftSchedule:", syncErr.message);
  }

  res.json(new ApiResponse(200, { updated: updates.length }, `Shift schedule updated for ${updates.length} user${updates.length !== 1 ? "s" : ""}`));
});
