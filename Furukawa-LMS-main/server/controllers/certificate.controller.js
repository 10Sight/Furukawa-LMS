import { executeQuery } from "../db/mssqlHelper.js";
import Certificate from "../models/certificate.model.js";
import CertificateTemplate from "../models/certificateTemplate.model.js";
import Course from "../models/course.model.js";
import User from "../models/auth.model.js";
import Enrollment from "../models/enrollment.model.js";
import Submission from "../models/submission.model.js";
import Assignment from "../models/assignment.model.js";
import AttemptedQuiz from "../models/attemptedQuiz.model.js";
import Progress from "../models/progress.model.js";
import Department from "../models/department.model.js";
import Quiz from "../models/quiz.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import NotificationService from "../services/notification.service.js";

// Helper for population
const populateCertificate = async (cert) => {
    if (!cert) return null;
    if (typeof cert.student !== 'object') {
        const u = await User.findById(cert.student);
        if (u) cert.student = { id: u.id, fullName: u.fullName, email: u.email };
    }
    if (typeof cert.course !== 'object') {
        const c = await Course.findById(cert.course);
        if (c) cert.course = { id: c.id, title: c.title, description: c.description };
    }
    if (typeof cert.issuedBy !== 'object' && cert.issuedBy) {
        const u = await User.findById(cert.issuedBy);
        if (u) cert.issuedBy = { id: u.id, fullName: u.fullName, email: u.email };
    }
    return cert;
};

// Inline helper for auto-eligibility check
const checkEligibilityAndCreate = async (studentId, courseId, opts = {}) => {
    // 1. Check existing
    const existing = await Certificate.findOne({
        student: studentId,
        course: courseId,
        type: { $ne: 'SKILL_UPGRADATION' }
    });
    if (existing) return { created: false, certificate: existing, reason: "Exists" };

    // 2. Fetch data
    const course = await Course.findById(courseId);
    if (!course) return { created: false, reason: "Course not found" };

    const progress = await Progress.findOne({ student: studentId, course: courseId });
    if (!progress) return { created: false, reason: "No progress found" };

    // 3. Check Modules Completion
    // Course modules are not directly on course object in SQL usually unless fetched? 
    // Course model usually has simple properties. Need to COUNT modules.
    const [modRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [courseId]);
    const totalModules = modRows[0].count;

    const completedModules = progress.completedModules?.length || 0;
    const modulesCompleted = (totalModules === 0) || (completedModules >= totalModules);

    // 4. Check Quizzes
    const [quizzes] = await executeQuery("SELECT id FROM quizzes WHERE course = ?", [courseId]);
    let quizzesOk = true;
    if (quizzes.length > 0) {
        const quizIds = quizzes.map(q => q.id);
        // Find passed attempts
        const [attempts] = await executeQuery(
            "SELECT DISTINCT quiz FROM attempted_quizzes WHERE student = ? AND status = 'PASSED' AND quiz IN (?)",
            [studentId, quizIds]
        );
        const passedSet = new Set(attempts.map(a => String(a.quiz)));
        quizzesOk = quizIds.every(qid => passedSet.has(String(qid)));
    }

    if (!modulesCompleted || !quizzesOk) {
        return { created: false, reason: "Eligibility not met" };
    }

    // 5. Determine Issuer
    let issuedBy = opts.issuedByUserId;
    if (!issuedBy) {
        try {
            // Find student department instructor
            const student = await User.findById(studentId);
            if (student && student.department) {
                // student.department is just ID or populated? In SQL model usually just ID string/int?
                // Wait, User model in SQL has `department` field?
                // Let's assume it has department ID.
                if (typeof student.department === 'string' || typeof student.department === 'number') {
                    const dept = await Department.findById(student.department);
                    if (dept && dept.instructor) issuedBy = dept.instructor;
                }
            }
        } catch (e) { }
    }
    if (!issuedBy) issuedBy = studentId;

    // 6. Generate Metadata with Template
    let metadata = undefined;

    let template = await CertificateTemplate.findOne({ isDefault: 1, isActive: 1 });
    if (!template) {
        const [temps] = await executeQuery("SELECT TOP 1 * FROM certificate_templates WHERE isActive = 1 ORDER BY createdAt ASC");
        if (temps.length > 0) template = new CertificateTemplate(temps[0]);
    }

    if (template) {
        const student = await User.findById(studentId);
        let deptName = 'N/A';
        if (student.department) {
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
        // "5 pizza slices... if level 2... 2 slices fill"
        // We simulate this with a conic gradient.
        // Total levels = levels.length. Current = currentLevelIndex + 1.
        const totalLevels = levels.length || 3;
        const currentProgressStep = currentLevelIndex + 1;
        const fillPercentage = Math.round((currentProgressStep / totalLevels) * 100);

        // CSS for a simple pie chart / donut
        // Using a variable for color if possible, else hardcode standard orange/blue
        const pieChartCss = `background: conic-gradient(#F97316 0% ${fillPercentage}%, #E5E7EB ${fillPercentage}% 100%); border-radius: 50%;`;
        // Or if the template expects an <img> tag, we might need a placeholder image service, but usually CSS is better for {{pieChart}} style attribute?
        // Let's assume {{pieChart}} is inside a style="..." attribute or we inject a full div string.
        // User request: "in pie chart circle have to repersent his level"
        // If the placeholder is {{pieChart}}, let's provide a data-uri or just the style string if the template uses it like <div style="{{pieChart}}"></div>
        // Safest is to provide the style string.

        const certData = {
            studentName: student.fullName,
            courseName: course.title,
            departmentName: deptName,
            instructorName: 'N/A',
            level: currentLevelName,
            issueDate: formatDate(new Date()),
            grade: 'PASS',
            employeeId: student.userName, // Changed from id to userName
            unit: student.unit || 'N/A',
            startDate: formatDate(startDateObj),
            completionDate: formatDate(completionDateObj),
            level1Date: formatDate(level1DateObj),
            level2Date: formatDate(level2DateObj),
            level3Date: formatDate(level3DateObj),
            userImage: student.avatar?.url || 'https://via.placeholder.com/150', // User image
            pieChart: pieChartCss // Intended for style attribute
        };

        let html = template.template;
        Object.keys(certData).forEach(k => {
            const val = certData[k] !== null && certData[k] !== undefined ? certData[k] : '';
            html = html.split(`{{${k}}}`).join(val);
        });


        metadata = {
            ...certData,
            templateId: template.id,
            templateName: template.name,
            generatedHTML: html,
            styles: template.styles
        };
    }

    const cert = await Certificate.create({
        student: studentId,
        course: courseId,
        issuedBy,
        grade: 'PASS',
        type: 'COURSE_COMPLETION',
        metadata
    });

    return { created: true, certificate: cert };
};

export const issueCertificate = asyncHandler(async (req, res) => {
    const { courseId, studentId } = req.body;

    if (!courseId || !studentId) {
        throw new ApiError("Invalid course or student ID", 400);
    }

    const course = await Course.findById(courseId);
    if (!course) throw new ApiError("Course not found", 404);

    const student = await User.findById(studentId);
    if (!student) throw new ApiError("Student not found", 404);

    const existing = await Certificate.findOne({
        student: studentId,
        course: courseId,
        type: { $ne: 'SKILL_UPGRADATION' }
    });
    if (existing) {
        throw new ApiError("Certificate already issued for this student & course", 400);
    }

    const certificate = await Certificate.create({
        student: studentId,
        course: courseId,
        issuedBy: req.user.id,
        type: 'COURSE_COMPLETION'
    });

    res.status(201)
        .json(new ApiResponse(201, certificate, "Certificate issued successfully"));
});

export const issueCertificateWithTemplate = asyncHandler(async (req, res) => {
    const { studentId, courseId, templateId, grade = 'PASS' } = req.body;

    if (!studentId || !courseId) {
        throw new ApiError("Invalid student or course ID", 400);
    }

    // Student Self-Service
    if (req.user.role === 'STUDENT') {
        if (String(req.user.id) !== String(studentId)) {
            throw new ApiError("You can only issue certificates for yourself", 403);
        }

        const result = await checkEligibilityAndCreate(studentId, courseId, { issuedByUserId: req.user.id });
        if (!result.created && !result.certificate) {
            throw new ApiError(result.reason || "Not eligible yet", 400);
        }

        const cert = result.certificate;
        const populated = await populateCertificate(cert);

        return res.status(200).json(new ApiResponse(200, {
            certificate: populated,
            template: {
                _id: cert.metadata?.templateId,
                name: cert.metadata?.templateName,
                html: cert.metadata?.generatedHTML,
                styles: cert.metadata?.styles
            }
        }, "Certificate issued/fetched successfully"));
    }

    // Admin/Instructor Logic
    const existing = await Certificate.findOne({ student: studentId, course: courseId, type: { $ne: 'SKILL_UPGRADATION' } });
    if (existing) throw new ApiError("Certificate already exists", 400);

    const student = await User.findById(studentId);
    if (!student) throw new ApiError("Student not found", 404);

    const course = await Course.findById(courseId);
    if (!course) throw new ApiError("Course not found", 404);

    let template;
    if (templateId) {
        template = await CertificateTemplate.findById(templateId);
        if (!template) throw new ApiError("Template not found", 404);
    } else {
        // Find default or first active
        template = await CertificateTemplate.findOne({ isDefault: 1, isActive: 1 });
        if (!template) {
            const [temps] = await executeQuery("SELECT TOP 1 * FROM certificate_templates WHERE isActive = 1 ORDER BY createdAt ASC");
            if (temps.length > 0) template = new CertificateTemplate(temps[0]);
        }
        if (!template) throw new ApiError("No template available", 404);
    }

    // Fetch details for placeholders
    let deptName = 'N/A';
    let instrName = 'N/A';
    if (student.department) {
        const d = await Department.findById(student.department);
        if (d) {
            deptName = d.name;
            if (d.instructor) {
                const i = await User.findById(d.instructor);
                if (i) instrName = i.fullName;
            }
        }
    }

    const progress = await Progress.findOne({ student: studentId, course: courseId });

    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
    const startDate = enrollment ? new Date(enrollment.enrolledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const completionDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const certData = {
        studentName: student.fullName,
        courseName: course.title,
        departmentName: deptName,
        instructorName: instrName,
        level: progress?.currentLevel || 'Beginner',
        issueDate: completionDate,
        grade: grade,
        employeeId: student.userName || student.id,
        unit: student.unit || 'N/A',
        startDate,
        completionDate,
        level1Date: '-',
        level2Date: '-',
        level3Date: '-'
    };

    let html = template.template;
    Object.keys(certData).forEach(k => {
        const val = certData[k] !== null && certData[k] !== undefined ? certData[k] : '';
        html = html.split(`{{${k}}}`).join(val);
    });

    const cert = await Certificate.create({
        student: studentId,
        course: courseId,
        issuedBy: req.user.id,
        grade,
        type: 'COURSE_COMPLETION',
        metadata: {
            ...certData,
            templateId: template.id,
            templateName: template.name,
            generatedHTML: html,
            styles: template.styles
        }
    });

    // Trigger Email Notification
    NotificationService.sendFormReport("Skill Matrix Certificate Sheet", null, certData, studentId)
        .catch(err => console.error("[Cert] Notification failed:", err));

    const populated = await populateCertificate(cert);

    res.status(201).json(new ApiResponse(201, {
        certificate: populated,
        template: {
            _id: template.id,
            name: template.name,
            html: html,
            styles: template.styles
        }
    }, "Certificate issued successfully"));
});

export const generateCertificatePreview = asyncHandler(async (req, res) => {
    const { studentId, courseId, templateId } = req.body;

    if (!studentId || !courseId) throw new ApiError("Student and Course IDs required", 400);

    let student, course, deptName = 'Sample Dept', instrName = 'Jane Smith', level = 'Intermediate';

    try {
        student = await User.findById(studentId);
        course = await Course.findById(courseId);
        if (student?.department) {
            const d = await Department.findById(student.department);
            if (d) {
                deptName = d.name;
                if (d.instructor) {
                    const i = await User.findById(d.instructor);
                    if (i) instrName = i.fullName;
                }
            }
        }
        const prog = await Progress.findOne({ student: studentId, course: courseId });
        if (prog) level = prog.currentLevel;
    } catch (e) { }

    let template;
    if (templateId) {
        template = await CertificateTemplate.findById(templateId);
    } else {
        template = await CertificateTemplate.findOne({ isDefault: 1, isActive: 1 });
        if (!template) {
            const [temps] = await executeQuery("SELECT TOP 1 * FROM certificate_templates WHERE isActive = 1 ORDER BY createdAt ASC");
            if (temps.length > 0) template = new CertificateTemplate(temps[0]);
        }
    }
    if (!template) throw new ApiError("No template found", 404);

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
    const currentLevelName = level || 'L1';
    const currentLevelIndex = levels.findIndex(l => l.name === currentLevelName);

    // Fetch all modules for course to map them to levels
    // Note: modules table does NOT have 'level' column, so we use heuristic based on completion count

    const completedModules = prog ? (prog.completedModules || []) : [];
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

    let startDateObj;
    let completionDateObj;

    startDateObj = student ? new Date(student.createdAt) : new Date();

    completionDateObj = level3DateObj || level2DateObj || level1DateObj || new Date();

    const totalLevels = levels.length || 3;
    const currentProgressStep = currentLevelIndex + 1;
    const fillPercentage = Math.round((currentProgressStep / totalLevels) * 100);
    const pieChartCss = `background: conic-gradient(#F97316 0% ${fillPercentage}%, #E5E7EB ${fillPercentage}% 100%); border-radius: 50%;`;

    const data = {
        studentName: student?.fullName || 'John Doe',
        courseName: course?.title || 'Sample Course',
        departmentName: deptName,
        instructorName: instrName,
        level: level,
        issueDate: formatDate(new Date()),
        grade: 'A+',
        employeeId: student?.userName || 'EMP001',
        unit: student?.unit || 'Main Unit',
        startDate: formatDate(startDateObj),
        completionDate: formatDate(completionDateObj),
        level1Date: formatDate(level1DateObj),
        level2Date: formatDate(level2DateObj),
        level3Date: formatDate(level3DateObj),
        userImage: student?.avatar?.url || 'https://via.placeholder.com/150',
        pieChart: pieChartCss
    };

    let html = template.template;
    Object.keys(data).forEach(k => {
        const val = data[k] !== null && data[k] !== undefined ? data[k] : '';
        html = html.split(`{{${k}}}`).join(val);
    });

    res.json(new ApiResponse(200, {
        html: html,
        styles: template.styles,
        data: data,
        template: {
            _id: template.id,
            name: template.name,
            description: template.description
        }
    }, "Preview generated"));
});

export const getCertificateById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let cert = await Certificate.findById(id);
    if (!cert) throw new ApiError("Certificate not found", 404);

    cert = await populateCertificate(cert);
    res.json(new ApiResponse(200, cert, "Fetched successfully"));
});

export const getStudentCertificates = asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    // Assuming studentId is correct ID for finding certs
    let certs = await Certificate.find({ student: studentId });
    console.log(`[DEBUG] Fetched ${certs.length} certs for student ${studentId}`);
    certs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

    // Optimize: Use req.user for student info
    const studentInfo = { id: req.user.id, fullName: req.user.fullName, email: req.user.email };

    // Bulk fetch courses and issuers
    const courseIds = [...new Set(certs.map(c => c.course))].filter(id => id);
    const issuerIds = [...new Set(certs.map(c => c.issuedBy))].filter(id => id);

    let courseMap = new Map();
    if (courseIds.length > 0) {
        const [courses] = await executeQuery("SELECT id, title, description FROM courses WHERE id IN (?)", [courseIds]);
        courses.forEach(c => courseMap.set(String(c.id), c));
    }

    let issuerMap = new Map();
    if (issuerIds.length > 0) {
        const [issuers] = await executeQuery("SELECT id, fullName, email FROM users WHERE id IN (?)", [issuerIds]);
        issuers.forEach(u => issuerMap.set(String(u.id), u));
    }

    const populatedCerts = certs.map(cert => {
        // Use spread to avoid mutating original if needed, but here fine
        const populated = { ...cert };

        // Student
        populated.student = studentInfo;

        // Course
        if (populated.course) {
            const c = courseMap.get(String(populated.course));
            if (c) populated.course = { id: c.id, title: c.title, description: c.description };
        }

        // Issued By
        if (populated.issuedBy) {
            const u = issuerMap.get(String(populated.issuedBy));
            if (u) populated.issuedBy = { id: u.id, fullName: u.fullName, email: u.email };
        }

        return populated;
    });

    res.json(new ApiResponse(200, populatedCerts, "Fetched successfully"));
});

export const getCourseCertificates = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    let certs = await Certificate.find({ course: courseId });
    certs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

    certs = await Promise.all(certs.map(populateCertificate));
    res.json(new ApiResponse(200, certs, "Fetched successfully"));
});

export const revokeCertificate = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [resDb] = await executeQuery("DELETE FROM certificates WHERE id = ?", [id]);

    if (resDb.affectedRows === 0) throw new ApiError("Certificate not found", 404);

    res.json(new ApiResponse(200, null, "Revoked successfully"));
});

export const checkCertificateEligibility = asyncHandler(async (req, res) => {
    const { studentId, courseId } = req.params;

    const student = await User.findById(studentId);
    if (!student) throw new ApiError("Student not found", 404);

    const course = await Course.findById(courseId);
    if (!course) throw new ApiError("Course not found", 404);

    // Auth check
    // Assuming student.department contains dept ID
    let deptInstructorId = null;
    if (student.department) {
        const d = await Department.findById(student.department);
        if (d) deptInstructorId = d.instructor;
    }

    const isStudentSelf = String(req.user.id) === String(studentId);
    const isInstructor = deptInstructorId && String(deptInstructorId) === String(req.user.id);
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(req.user.role);

    if (!isStudentSelf && !isInstructor && !isAdmin) {
        throw new ApiError("Unauthorized", 403);
    }

    // Check existing
    const existing = await Certificate.findOne({ student: studentId, course: courseId });
    if (existing) {
        return res.json(new ApiResponse(200, {
            eligible: false,
            reason: "Certificate already issued",
            certificate: existing
        }, "Checked"));
    }

    const progress = await Progress.findOne({ student: studentId, course: courseId });
    if (!progress) {
        return res.json(new ApiResponse(200, {
            eligible: false,
            reason: "No progress found",
            requirements: { courseCompletion: false, quizPassed: false, assignmentsGraded: false }
        }, "Checked"));
    }

    // Check completion
    const [modRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [courseId]);
    const totalModules = modRows[0].count;
    const completedModules = progress.completedModules?.length || 0;
    const courseCompleted = (totalModules > 0 && completedModules >= totalModules);

    // Quizzes
    const [allQuizzes] = await executeQuery("SELECT id, title, passingScore FROM quizzes WHERE course = ?", [courseId]);
    let passedAttempts = [];
    if (allQuizzes.length > 0) {
        [passedAttempts] = await executeQuery(
            "SELECT DISTINCT quiz FROM attempted_quizzes WHERE student = ? AND status = 'PASSED' AND quiz IN (?)",
            [studentId, allQuizzes.map(q => q.id)]
        );
    }
    const passedSet = new Set(passedAttempts.map(a => String(a.quiz)));
    // If no quizzes, passed=true
    const quizPassed = allQuizzes.length === 0 || allQuizzes.every(q => passedSet.has(String(q.id)));

    // Assignments
    const [assignments] = await executeQuery("SELECT id, title, maxScore FROM assignments WHERE course = ?", [courseId]);
    let assignmentsGraded = true;
    let assignmentDetails = [];

    if (assignments.length > 0) {
        const [subs] = await executeQuery(
            "SELECT * FROM submissions WHERE student = ? AND assignment IN (?)",
            [studentId, assignments.map(a => a.id)]
        );

        // Map subs
        const subMap = new Map();
        subs.forEach(s => subMap.set(String(s.assignment), s));

        assignments.forEach(a => {
            const s = subMap.get(String(a.id));
            const isGraded = s && s.grade !== null && s.grade !== undefined;
            if (!isGraded) assignmentsGraded = false;
            assignmentDetails.push({
                assignment: a.title,
                grade: s ? s.grade : null,
                maxScore: a.maxScore,
                isGraded
            });
        });
    }

    const eligible = courseCompleted && quizPassed && assignmentsGraded;

    res.json(new ApiResponse(200, {
        eligible,
        reason: eligible ? "Eligible" : "Requirements not met",
        requirements: { courseCompletion, quizPassed, assignmentsGraded },
        details: {
            progress: {
                completedModules,
                totalModules,
                progressPercent: progress.progressPercent || 0,
                currentLevel: progress.currentLevel
            },
            quizzes: {
                totalAttempts: passedAttempts.length, // approximation of passed count
                passedQuizzes: passedAttempts.length
            },
            assignments: {
                totalSubmissions: assignmentDetails.length,
                gradedSubmissions: assignmentDetails.filter(a => a.isGraded).length,
                submissions: assignmentDetails
            }
        }
    }, "Available"));
});
