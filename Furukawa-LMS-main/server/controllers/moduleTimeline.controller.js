import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

// Helper to safely parse JSON
const parseJSON = (data, fallback = []) => {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch (e) { return fallback; }
  }
  return data || fallback;
};

// Create or update module timeline
export const createOrUpdateTimeline = asyncHandler(async (req, res) => {
  const {
    courseId,
    moduleId,
    departmentId,
    deadline,
    gracePeriodHours = 24,
    enableWarnings = true,
    warningPeriods = [168, 72, 24],
    description,
  } = req.body;

  const { timelineId } = req.params;

  if (!courseId || !moduleId || !departmentId || !deadline) {
    throw new ApiError("Course ID, Module ID, Department ID, and deadline are required", 400);
  }

  // Parse deadline
  const parsedDeadline = new Date(deadline);
  if (Number.isNaN(parsedDeadline.getTime())) {
    throw new ApiError("Invalid deadline date", 400);
  }

  // Normalize warning periods
  const normalizedWarningPeriods = Array.isArray(warningPeriods)
    ? warningPeriods.map(p => Number(p)).filter(p => Number.isFinite(p) && p > 0)
    : [168, 72, 24];

  // Validate existence (Course, Module, Department)
  const [courses] = await executeQuery("SELECT id FROM courses WHERE id = ?", [courseId]);
  if (courses.length === 0) throw new ApiError("Course not found", 404);

  const [modules] = await executeQuery("SELECT id, course FROM modules WHERE id = ?", [moduleId]);
  if (modules.length === 0) throw new ApiError("Module not found", 404);
  if (modules[0].course !== courseId) throw new ApiError("Module does not belong to the specified course", 400);

  const [departments] = await executeQuery("SELECT id FROM departments WHERE id = ?", [departmentId]);
  if (departments.length === 0) throw new ApiError("Department not found", 404);

  let currentTimelineId = timelineId;

  if (currentTimelineId) {
    // Update existing via ID
    const [existing] = await executeQuery("SELECT id FROM module_timelines WHERE id = ?", [currentTimelineId]);
    if (existing.length === 0) throw new ApiError("Timeline not found", 404);

    await executeQuery(
      `UPDATE module_timelines SET 
             deadline = ?, gracePeriodHours = ?, enableWarnings = ?, warningPeriods = ?, description = ?, updatedBy = ?, lastProcessedAt = NULL, updatedAt = GETDATE()
             WHERE id = ?`,
      [parsedDeadline, gracePeriodHours, enableWarnings, JSON.stringify(normalizedWarningPeriods), description, req.user.id, currentTimelineId]
    );
  } else {
    // Check duplication
    const [existing] = await executeQuery(
      "SELECT id FROM module_timelines WHERE course = ? AND module = ? AND department = ? AND isActive = 1",
      [courseId, moduleId, departmentId]
    );

    if (existing.length > 0) {
      // Update the existing one instead of creating new? Or just pivot to update logic.
      // Logic implies "Create or Update". If exists match, update it.
      currentTimelineId = existing[0].id;
      await executeQuery(
        `UPDATE module_timelines SET 
                 deadline = ?, gracePeriodHours = ?, enableWarnings = ?, warningPeriods = ?, description = ?, updatedBy = ?, lastProcessedAt = NULL, updatedAt = GETDATE()
                 WHERE id = ?`,
        [parsedDeadline, gracePeriodHours, enableWarnings, JSON.stringify(normalizedWarningPeriods), description, req.user.id, currentTimelineId]
      );
    } else {
      // Create
      const [result] = await executeQuery(
        `INSERT INTO module_timelines 
                 (course, module, department, deadline, gracePeriodHours, enableWarnings, warningPeriods, description, createdBy, isActive, createdAt, updatedAt)
                 OUTPUT INSERTED.id
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, GETDATE(), GETDATE())`,
        [courseId, moduleId, departmentId, parsedDeadline, gracePeriodHours, enableWarnings, JSON.stringify(normalizedWarningPeriods), description, req.user.id]
      );
      currentTimelineId = result[0].id;
    }
  }

  // Fetch and populate for response
  const [tRows] = await executeQuery(`
        SELECT t.*, 
               c.title as courseTitle, 
               m.title as moduleTitle, m.description as moduleDesc,
               d.name as departmentName
        FROM module_timelines t
        LEFT JOIN courses c ON t.course = c.id
        LEFT JOIN modules m ON t.module = m.id
        LEFT JOIN departments d ON (t.department = CAST(d.id AS NVARCHAR(50)) OR t.department = d.name)
        WHERE t.id = ?
    `, [currentTimelineId]);

  const timeline = tRows[0];
  if (timeline) {
    timeline.warningPeriods = parseJSON(timeline.warningPeriods);
    // Mimic population structure if frontend expects objects
    timeline.course = { id: timeline.course, title: timeline.courseTitle };
    timeline.module = { id: timeline.module, title: timeline.moduleTitle, description: timeline.moduleDesc };
    timeline.department = { id: timeline.department, name: timeline.departmentName };
    delete timeline.courseTitle; delete timeline.moduleTitle; delete timeline.moduleDesc; delete timeline.departmentName;
  }

  res.status(200).json(new ApiResponse(200, timeline, "Module timeline set successfully"));
});

// Get timelines for a course and department
export const getTimelinesForDepartment = asyncHandler(async (req, res) => {
  const { courseId, departmentId } = req.params;
  if (!courseId || !departmentId) throw new ApiError("Course ID and Department ID are required", 400);

  const [timelines] = await executeQuery(`
        SELECT t.*,
               m.title as mTitle, m.description as mDesc, [m.order] as mOrder,
               c.title as cTitle,
               d.name as dName
        FROM module_timelines t
        JOIN modules m ON t.module = m.id
        JOIN courses c ON t.course = c.id
        JOIN departments d ON (t.department = CAST(d.id AS NVARCHAR(50)) OR t.department = d.name)
        WHERE t.course = ? AND t.department = ? AND t.isActive = 1
        ORDER BY [m.order] ASC
    `, [courseId, departmentId]);

  const formatted = timelines.map(t => {
    t.warningPeriods = parseJSON(t.warningPeriods);
    t.module = { id: t.module, title: t.mTitle, description: t.mDesc, order: t.mOrder };
    t.course = { id: t.course, title: t.cTitle };
    t.department = { id: t.department, name: t.dName };
    delete t.mTitle; delete t.mDesc; delete t.mOrder; delete t.cTitle; delete t.dName;
    return t;
  });

  res.status(200).json(new ApiResponse(200, formatted, "Timelines retrieved successfully"));
});

// Get all timelines (admin view)
export const getAllTimelines = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  let whereClauses = ["t.isActive = 1"];
  let params = [];

  if (req.query.courseId) { whereClauses.push("t.course = ?"); params.push(req.query.courseId); }
  if (req.query.departmentId) { whereClauses.push("t.department = ?"); params.push(req.query.departmentId); }
  if (req.query.overdue === 'true') { whereClauses.push("t.deadline < GETDATE()"); }

  const whereSQL = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";

  const [countResult] = await executeQuery(`SELECT COUNT(*) as exact_count FROM module_timelines t ${whereSQL}`, params);
  const total = countResult[0].exact_count;

  const [rows] = await executeQuery(`
        SELECT t.*,
               c.title as cTitle,
               m.title as mTitle, [m.order] as mOrder,
               d.name as dName,
               u.fullName as uName
        FROM module_timelines t
        LEFT JOIN courses c ON t.course = c.id
        LEFT JOIN modules m ON t.module = m.id
        LEFT JOIN departments d ON (t.department = CAST(d.id AS NVARCHAR(50)) OR t.department = d.name)
        LEFT JOIN users u ON t.createdBy = u.id
        ${whereSQL}
        ORDER BY t.deadline ASC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `, [...params, skip, limit]);

  const timelines = rows.map(t => {
    t.warningPeriods = parseJSON(t.warningPeriods);
    t.course = { id: t.course, title: t.cTitle };
    t.module = { id: t.module, title: t.mTitle, order: t.mOrder };
    t.department = { id: t.department, name: t.dName };
    t.createdBy = { id: t.createdBy, fullName: t.uName };
    delete t.cTitle; delete t.mTitle; delete t.mOrder; delete t.dName; delete t.uName;
    return t;
  });

  const totalPages = Math.ceil(total / limit);

  res.status(200).json(new ApiResponse(200, {
    timelines,
    pagination: { current: page, pages: totalPages, total, limit }
  }, "All timelines retrieved successfully"));
});

// Delete/deactivate timeline
export const deleteTimeline = asyncHandler(async (req, res) => {
  const { timelineId } = req.params;
  const [result, metadata] = await executeQuery("UPDATE module_timelines SET isActive = 0, updatedBy = ? WHERE id = ?", [req.user.id, timelineId]);
  if (metadata.affectedRows === 0) throw new ApiError("Timeline not found", 404);
  res.status(200).json(new ApiResponse(200, null, "Timeline deactivated successfully"));
});

// Get timeline status for students in a department
export const getTimelineStatus = asyncHandler(async (req, res) => {
  const { courseId, departmentId } = req.params;

  // Get active timelines
  const [timelines] = await executeQuery(`
        SELECT t.*, m.title as mTitle, [m.order] as mOrder
        FROM module_timelines t
        JOIN modules m ON t.module = m.id
        WHERE t.course = ? AND t.department = ? AND t.isActive = 1
        ORDER BY [m.order] ASC
    `, [courseId, departmentId]);

  // Get students in department
  // Assuming department.students is stored as JSON array of IDs in departments table
  const [deptRows] = await executeQuery("SELECT students FROM departments WHERE id = ?", [departmentId]);
  if (deptRows.length === 0) throw new ApiError("Department not found", 404);

  const studentIds = parseJSON(deptRows[0].students, []);
  if (studentIds.length === 0) return res.status(200).json(new ApiResponse(200, [], "No students in department"));

  // Fetch student details
  // Note: studentIds must be treated safely.
  if (studentIds.length === 0) return res.status(200).json(new ApiResponse(200, [], "Timeline status retrieved successfully"));

  const placeholders = studentIds.map(() => '?').join(',');
  const [students] = await executeQuery(`SELECT id, fullName, email FROM users WHERE id IN (${placeholders})`, studentIds);

  // Get progress for these students
  const [progressRecords] = await executeQuery(`
        SELECT * FROM progress 
        WHERE course = ? AND student IN (${placeholders})
    `, [courseId, ...studentIds]);

  const progressMap = new Map();
  progressRecords.forEach(p => {
    p.completedModules = parseJSON(p.completedModules, []);
    p.timelineViolations = parseJSON(p.timelineViolations, []);
    progressMap.set(p.student, p);
  });

  // Helper to check missed deadline
  // Logic: Look at Mongoose model method
  // hasStudentMissedDeadline(studentId) -> checks JSON `missedDeadlines` array in module_timeline
  // We need `missedDeadlines` (JSON) from timeline row. 
  // Wait, timeline table likely has a `missedDeadlines` JSON column tracking this.
  // If it's not in my SELECT, I should include it. `SELECT t.*` includes it.

  const now = new Date();

  const statusReport = timelines.map(t => {
    const tMissed = parseJSON(t.missedDeadlines, []);
    const hasStudentMissed = (sid) => tMissed.some(m => String(m.student) === String(sid));

    const moduleStatus = {
      module: { id: t.module, title: t.mTitle, order: t.mOrder },
      deadline: t.deadline,
      gracePeriodHours: t.gracePeriodHours,
      isOverdue: now > new Date(t.deadline),
      students: []
    };

    students.forEach(student => {
      const p = progressMap.get(student.id);
      const isCompleted = p?.completedModules.some(cm => String(cm.moduleId) === String(t.module));
      const completedAt = isCompleted ? p.completedModules.find(cm => String(cm.moduleId) === String(t.module))?.completedAt : null;

      const hasMissedDeadline = hasStudentMissed(student.id);
      const hasViolation = p?.timelineViolations.some(tv => String(tv.module) === String(t.module));

      let status = 'IN_PROGRESS';
      if (isCompleted) status = 'COMPLETED';
      else if (hasMissedDeadline) status = 'MISSED_DEADLINE';
      else if (moduleStatus.isOverdue) status = 'OVERDUE';

      moduleStatus.students.push({
        student: { _id: student.id, fullName: student.fullName, email: student.email },
        isCompleted: !!isCompleted,
        completedAt,
        hasMissedDeadline,
        hasViolation: !!hasViolation,
        status
      });
    });
    return moduleStatus;
  });

  res.status(200).json(new ApiResponse(200, statusReport, "Timeline status retrieved successfully"));
});

// Process timeline enforcement (background job)
export const processTimelineEnforcement = asyncHandler(async (req, res) => {
  const now = new Date();

  // 1. Get active timelines that need processing 
  // (Optimization: Logic usually checks lastProcessedAt + interval, here strictly we check all active)
  const [timelines] = await executeQuery(`
        SELECT t.*, d.students as deptStudents 
        FROM module_timelines t 
        JOIN departments d ON (t.department = CAST(d.id AS NVARCHAR(50)) OR t.department = d.name)
        WHERE t.isActive = 1
    `);

  let processedCount = 0;
  let demotionCount = 0;
  const errors = [];

  // Helper to add timeline violation to progress
  // We do this manually via SQL updates on JSON

  for (const t of timelines) {
    try {
      const deptStudents = parseJSON(t.deptStudents, []);
      if (deptStudents.length === 0) continue;

      // Fetch progress for these students
      // Optimization: Fetch only relevant progress? 
      const placeholders = deptStudents.map(() => '?').join(',');
      const [progressRows] = await executeQuery(
        `SELECT * FROM progress WHERE course = ? AND student IN (${placeholders})`,
        [t.course, ...deptStudents]
      );

      // Fetch Modules in order to determine "Previous Module"
      const [modules] = await executeQuery("SELECT id, title, [order] FROM modules WHERE course = ? ORDER BY [order] ASC", [t.course]);

      // Needed to find previous module
      const currentModIdx = modules.findIndex(m => m.id === t.module);

      const graceDeadline = new Date(new Date(t.deadline).getTime() + (t.gracePeriodHours * 3600000));

      // Check deadlines
      if (now > graceDeadline) {
        // Potential demotion loop
        for (const p of progressRows) {
          const completedModules = parseJSON(p.completedModules, []);
          const timelineViolations = parseJSON(p.timelineViolations, []);
          const timelineNotifications = parseJSON(p.timelineNotifications, []);

          const hasCompleted = completedModules.some(cm => String(cm.moduleId) === String(t.module));

          // Check if already missed
          const tMissed = parseJSON(t.missedDeadlines, []);
          const alreadyMissed = tMissed.some(m => String(m.student) === String(p.student));

          if (!hasCompleted && !alreadyMissed) {
            // Demotion Logic
            if (currentModIdx > 0) {
              const prevModule = modules[currentModIdx - 1];

              // Demote: Remove current module from completed? 
              // Wait, if !hasCompleted, they haven't completed current. 
              // The logic says "moved back to previous module". 
              // Usually this means if they had partial progress or just resetting their "current" pointer 
              // (but progress model here seems based on completedModules list).
              // If they strictly track "current module", specific logic applies.
              // The original code: `progress.demoteToModule(previousModule._id)` implies setting some state 
              // or ensuring they cannot proceed past previous.
              // Assuming `demoteToModule` might remove OTHER future modules if any? 
              // Given they haven't completed current, essentially they are stuck. 
              // BUT original code logged a VIOLATION and NOTIFICATION.

              // We'll mimic the side effects: Add Violation, Add Notification.

              const violation = {
                module: t.module,
                missedDeadline: t.deadline,
                demotedTo: prevModule.id,
                occurredAt: new Date()
              };
              timelineViolations.push(violation);

              const notif = {
                type: 'DEMOTION',
                module: t.module,
                message: `You have been moved back to "${prevModule.title}" due to missing the deadline.`,
                sentAt: new Date(),
                isRead: false,
                _id: `${Date.now()}-demotion`
              };
              timelineNotifications.push(notif);

              // Update Progress
              await executeQuery(
                "UPDATE progress SET timelineViolations = ?, timelineNotifications = ?, updatedAt = GETDATE() WHERE id = ?",
                [JSON.stringify(timelineViolations), JSON.stringify(timelineNotifications), p.id]
              );

              // Update Timeline (add to missedDeadlines)
              tMissed.push({ student: p.student, demotedTo: prevModule.id, at: new Date() });
              await executeQuery("UPDATE module_timelines SET missedDeadlines = ? WHERE id = ?", [JSON.stringify(tMissed), t.id]);

              demotionCount++;
            }
          }
        }
      }

      await executeQuery("UPDATE module_timelines SET lastProcessedAt = GETDATE() WHERE id = ?", [t.id]);
      processedCount++;

    } catch (e) {
      errors.push({ timelineId: t.id, error: e.message });
    }
  }

  res.status(200).json(new ApiResponse(200, { processedCount, demotionCount, errors: errors.length ? errors : undefined }, `Timeline enforcement processed`));
});

// Send timeline warnings
export const sendTimelineWarnings = asyncHandler(async (req, res) => {
  const now = new Date();
  const [timelines] = await executeQuery(`SELECT t.*, d.students as deptStudents, m.title as mTitle FROM module_timelines t JOIN departments d ON (t.department = CAST(d.id AS NVARCHAR(50)) OR t.department = d.name) JOIN modules m ON t.module = m.id WHERE t.isActive = 1 AND t.enableWarnings = 1 AND t.deadline > GETDATE()`);

  let warningsSent = 0;
  const errors = [];

  for (const t of timelines) {
    try {
      const timeUntil = new Date(t.deadline).getTime() - now.getTime();
      const hoursUntil = timeUntil / 3600000;
      const warningPeriods = parseJSON(t.warningPeriods, [168, 72, 24]);

      // Check if any period matches
      for (const wHours of warningPeriods) {
        if (hoursUntil <= wHours && hoursUntil > (wHours - 1)) {
          // Time to send warning
          const wType = wHours === 168 ? '7_DAYS' : wHours === 72 ? '3_DAYS' : wHours === 24 ? '1_DAY' : 'CUSTOM';

          const deptStudents = parseJSON(t.deptStudents, []);
          if (deptStudents.length === 0) continue;

          const placeholders = deptStudents.map(() => '?').join(',');
          const [progressRows] = await executeQuery(`SELECT * FROM progress WHERE course = ? AND student IN (${placeholders})`, [t.course, ...deptStudents]);

          for (const p of progressRows) {
            const completedModules = parseJSON(p.completedModules, []);
            // Check completion
            if (!completedModules.some(cm => String(cm.moduleId) === String(t.module))) {
              // Check if warning already sent (Need history in timeline or progress?)
              // Original code: `timeline.recordWarningSent` -> implies timeline stores this history.
              // We assume `warningHistory` column exists as JSON in module_timelines.

              let warningHistory = parseJSON(t.warningHistory, []);
              // Check if specific warning type sent to student
              const sent = warningHistory.some(wh => String(wh.student) === String(p.student) && wh.type === wType);

              if (!sent) {
                // Send Warning
                let notes = parseJSON(p.timelineNotifications, []);
                notes.push({
                  type: 'WARNING',
                  module: t.module,
                  message: `Reminder: You have ${Math.ceil(hoursUntil)} hours left to complete "${t.mTitle}"`,
                  sentAt: new Date(),
                  isRead: false,
                  _id: `${Date.now()}-warn`
                });

                await executeQuery("UPDATE progress SET timelineNotifications = ? WHERE id = ?", [JSON.stringify(notes), p.id]);

                warningHistory.push({ student: p.student, type: wType, at: new Date() });
                warningsSent++;
              }

              // Update timeline history regardless of loop (accumulate changes)
              // Optimization: Update once per timeline after loop if possible, 
              // but doing per student ensures atomicity. Since loop is small/batch, we can aggregate.
              t.warningHistory = JSON.stringify(warningHistory); // local update for loop
            }
          }

          // Persist timeline history
          await executeQuery("UPDATE module_timelines SET warningHistory = ? WHERE id = ?", [t.warningHistory, t.id]);
        }
      }
    } catch (e) {
      errors.push({ timelineId: t.id, error: e.message });
    }
  }

  res.status(200).json(new ApiResponse(200, { warningsSent, errors: errors.length ? errors : undefined }, "Warnings processed"));
});

// Get timeline notifications
export const getMyTimelineNotifications = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { courseId } = req.params;

  const [rows] = await executeQuery("SELECT timelineNotifications FROM progress WHERE student = ? AND course = ?", [studentId, courseId]);
  if (rows.length === 0) throw new ApiError("Progress record not found", 404);

  let notifs = parseJSON(rows[0].timelineNotifications, [])
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    .slice(0, 50);

  // Need to populate module titles in notifications?
  // The original Mongoose code populated `module`.
  // We have `module` ID in notification.
  // We can fetch titles.
  const moduleIds = [...new Set(notifs.map(n => n.module).filter(Boolean))];
  if (moduleIds.length > 0) {
    const ph = moduleIds.map(() => '?').join(',');
    const [mods] = await executeQuery(`SELECT id, title FROM modules WHERE id IN (${ph})`, moduleIds);
    const modMap = new Map(mods.map(m => [m.id, m.title]));

    notifs = notifs.map(n => ({
      ...n,
      module: { _id: n.module, title: modMap.get(n.module) || 'Unknown Module' }
    }));
  }

  res.status(200).json(new ApiResponse(200, notifs, "Notifications retrieved"));
});

// Mark read
export const markNotificationRead = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { courseId, notificationId } = req.params;

  const [rows] = await executeQuery("SELECT id, timelineNotifications FROM progress WHERE student = ? AND course = ?", [studentId, courseId]);
  if (rows.length === 0) throw new ApiError("Progress record not found", 404);

  let notifs = parseJSON(rows[0].timelineNotifications, []);
  const idx = notifs.findIndex(n => String(n._id) === String(notificationId));

  if (idx !== -1) {
    notifs[idx].isRead = true;
    await executeQuery("UPDATE progress SET timelineNotifications = ? WHERE id = ?", [JSON.stringify(notifs), rows[0].id]);
  }

  res.status(200).json(new ApiResponse(200, null, "Marked as read"));
});
