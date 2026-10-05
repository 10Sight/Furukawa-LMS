import { executeQuery } from "../db/mssqlHelper.js";
import Certificate from "../models/certificate.model.js";
import CertificateTemplate from "../models/certificateTemplate.model.js";
import Course from "../models/course.model.js";
import Progress from "../models/progress.model.js";
import User from '../models/auth.model.js';
import Department from '../models/department.model.js';
import Quiz from '../models/quiz.model.js';
import AttemptedQuiz from '../models/attemptedQuiz.model.js';

/**
 * Ensure a certificate exists for the student/course if they are eligible.
 * Eligibility: all modules completed AND all course quizzes have at least one PASSED attempt
 * - If no quizzes exist for the course, quizzes criterion is considered satisfied.
 * Returns: { created: boolean, certificate?: doc, reason?: string }
 */
export async function ensureCertificateIfEligible(studentId, courseId, opts = {}) {
  if (!studentId || !courseId) {
    return { created: false, reason: "Invalid student or course id" };
  }

  // Already has a certificate?
  // Check for COURSE_COMPLETION or legacy (missing type) certificates
  // We assume anything NOT 'SKILL_UPGRADATION' is a completion certificate
  const [existingRows] = await executeQuery(
    "SELECT TOP 1 * FROM certificates WHERE student = ? AND course = ? AND type != 'SKILL_UPGRADATION'",
    [studentId, courseId]
  );

  if (existingRows.length > 0) {
    return { created: false, certificate: new Certificate(existingRows[0]), reason: "Exists" };
  }

  const course = await Course.findById(courseId);
  if (!course) return { created: false, reason: "Course not found" };

  const progress = await Progress.findOne({ student: studentId, course: courseId });
  if (!progress) return { created: false, reason: "No progress" };

  // Manual module count check
  const [modRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [courseId]);
  const totalModules = modRows[0].count;
  const completedModules = (progress.completedModules || []).length || 0;
  const modulesCompleted = (totalModules === 0) || (completedModules >= totalModules);

  // Ensure progress is up-to-date and require 100%
  try { await progress.calculateProgress(); } catch (_) { }
  const progressComplete = (progress.progressPercent >= 100);

  // Quizzes requirement: all quizzes in course have a PASSED attempt
  const quizzes = await Quiz.find({ course: courseId });
  const totalQuizzes = quizzes.length;
  let quizzesOk = true;
  if (totalQuizzes > 0) {
    const quizIds = quizzes.map(q => q.id);
    const [passedAttempts] = await executeQuery(
      "SELECT DISTINCT quiz FROM attempted_quizzes WHERE student = ? AND status = 'PASSED' AND quiz IN (?)",
      [studentId, quizIds]
    );
    const passedQuizSet = new Set(passedAttempts.map(a => String(a.quiz)));
    quizzesOk = quizIds.every(id => passedQuizSet.has(String(id)));
  }

  if (!(modulesCompleted && quizzesOk && progressComplete)) {
    return { created: false, reason: "Eligibility not met" };
  }

  // Determine issuer (instructor of student's department if available)
  const student = await User.findById(studentId);

  let studentDept = null;
  if (student && student.department) {
    studentDept = await Department.findById(student.department);
  }

  let issuedBy = opts.issuedByUserId;
  if (!issuedBy && studentDept && studentDept.instructor) {
    issuedBy = studentDept.instructor;
  }

  if (!issuedBy) issuedBy = studentId; // last resort

  // Attach minimal metadata or use default template to enrich
  let metadata = null;
  try {
    const template = await CertificateTemplate.findOne({ isDefault: true, isActive: true })
      || await CertificateTemplate.findOne({ isActive: true });

    if (template) {
      let deptName = 'N/A';
      if (student && student.department) {
        // student.department is ID
        const d = await Department.findById(student.department);
        if (d) deptName = d.name;
      }

      // Fetch Level Config for ordering and total levels
      let levelConfig = null;
      const [lConfigs] = await executeQuery("SELECT TOP 1 * FROM course_level_configs WHERE isActive = 1");
      if (lConfigs.length > 0) {
        const raw = lConfigs[0];
        raw.levels = typeof raw.levels === 'string' ? JSON.parse(raw.levels) : raw.levels;
        levelConfig = raw;
      }

      // Default to L1..L3 if no config
      const levels = levelConfig?.levels || [{ name: 'L1' }, { name: 'L2' }, { name: 'L3' }];
      const currentLevelName = progress.currentLevel || 'L1';
      const currentLevelIndex = levels.findIndex(l => l.name === currentLevelName);

      // Fetch all modules for course to map them to levels
      // Note: modules table does NOT have 'level' column, so we use heuristic based on completion count

      const completedModules = progress.completedModules || [];
      completedModules.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
      const totalCompleted = completedModules.length;

      const getHeuristicDate = (percent) => {
        if (totalCompleted === 0) return null;
        const idx = Math.ceil(totalCompleted * percent) - 1;
        const safeIdx = Math.max(0, Math.min(idx, totalCompleted - 1));
        const mod = completedModules[safeIdx];
        return mod ? new Date(mod.completedAt) : null;
      };

      const formatDate = (date) => {
        if (!date) return '-';
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
      };

      let level1DateObj = null;
      let level2DateObj = null;
      let level3DateObj = null;

      if (currentLevelName === 'L3') {
        level1DateObj = getHeuristicDate(0.33);
        level2DateObj = getHeuristicDate(0.66);
        level3DateObj = getHeuristicDate(1.0);
      } else if (currentLevelName === 'L2') {
        level1DateObj = getHeuristicDate(0.5);
        level2DateObj = getHeuristicDate(1.0);
      } else {
        level1DateObj = getHeuristicDate(1.0);
      }

      // Logic for Start Date & Completion Date
      let startDateObj;
      let completionDateObj;

      // Start Date
      startDateObj = new Date(student.createdAt);

      // Completion Date
      completionDateObj = level3DateObj || level2DateObj || level1DateObj || new Date();

      // Pie Chart Logic
      const totalLevels = levels.length || 3;
      const currentProgressStep = currentLevelIndex + 1;
      const fillPercentage = Math.round((currentProgressStep / totalLevels) * 100);
      const pieChartCss = `background: conic-gradient(#F97316 0% ${fillPercentage}%, #E5E7EB ${fillPercentage}% 100%); border-radius: 50%;`;

      const certificateData = {
        studentName: student?.fullName || '',
        courseName: course?.title || '',
        departmentName: deptName,
        instructorName: 'N/A',
        level: currentLevelName,
        issueDate: formatDate(new Date()),
        grade: 'PASS',
        employeeId: student.userName,
        unit: student.unit || 'N/A',
        startDate: formatDate(startDateObj),
        completionDate: formatDate(completionDateObj),
        level1Date: formatDate(level1DateObj),
        level2Date: formatDate(level2DateObj),
        level3Date: formatDate(level3DateObj),
        userImage: student.avatar?.url || 'https://via.placeholder.com/150',
        pieChart: pieChartCss
      };

      let html = template.template || '';
      Object.keys(certificateData).forEach(k => {
        const val = certificateData[k] !== null && certificateData[k] !== undefined ? certificateData[k] : '';
        html = html.split(`{{${k}}}`).join(val);
      });

      metadata = {
        ...certificateData,
        templateId: String(template.id),
        templateName: template.name,
        generatedHTML: html,
        styles: template.styles
      };
    }
  } catch (_) { }

  const cert = await Certificate.create({
    student: studentId,
    course: courseId,
    issuedBy,
    grade: 'PASS',
    type: 'COURSE_COMPLETION',
    metadata,
  });

  return { created: true, certificate: cert };
}

export default ensureCertificateIfEligible;
