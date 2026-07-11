import { pool } from "../db/connectDB.js";
import User from "../models/auth.model.js";
import Course from "../models/course.model.js";
import Department from "../models/department.model.js";
import Enrollment from "../models/enrollment.model.js";
import Certificate from "../models/certificate.model.js";
import CertificateTemplate from "../models/certificateTemplate.model.js";
import Audit from "../models/audit.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sendEmail from "../utils/mail.util.js";
import auditLogger from "../utils/auditLogger.js"; // Standard import if default export exists

// === BULK USER ENROLLMENT ===

// Bulk enroll users in courses/departments
export const bulkEnrollUsers = asyncHandler(async (req, res) => {
    const { userIds, courseIds = [], departmentId, enrollmentType = 'course', notify = true } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new ApiError("User IDs are required", 400);
    }

    if (!courseIds.length && !departmentId) {
        throw new ApiError("Either course IDs or department ID is required", 400);
    }

    // Validate users exist (SQL IN)
    const [existingUsers] = await pool.query(`SELECT id, email, fullName FROM users WHERE id IN (?)`, [userIds]);
    if (existingUsers.length !== userIds.length) {
        // Find which are missing for better error? Or just throw generic.
        // Original threw if length mismatch.
        throw new ApiError("Some users not found", 404);
    }

    let department = null;
    let targetCourses = [];

    // Validate department
    if (departmentId) {
        department = await Department.findById(departmentId);
        if (!department) throw new ApiError("Department not found", 404);

        // If department is linked to a course
        // In SQL model we have 'course' column (ID string usually).
        if (department.course) {
            const c = await Course.findById(department.course);
            if (c) targetCourses.push(c);
        }
    }

    // Validate provided courses
    if (courseIds.length > 0 && !departmentId) {
        // Need to check all
        const [foundCourses] = await pool.query(`SELECT * FROM courses WHERE id IN (?)`, [courseIds]);
        if (foundCourses.length !== courseIds.length) throw new ApiError("Some courses not found", 404);

        // SQL rows need to be mapped if we rely on Model instances later, but plain objects ok here
        // We only need ids and titles for email.
        targetCourses = foundCourses;
    }

    const connection = await pool.getConnection(); // Get dedicated connection for transaction
    const results = {
        successful: [],
        failed: [],
        skipped: []
    };

    try {
        await connection.beginTransaction();

        for (const userId of userIds) {
            for (const course of targetCourses) {
                try {
                    // Check existing enrollment
                    // Use connection (transaction) to read? Or just pool? 
                    // Better to use connection to see own writes if any (though loop doesn't overlap on same user-course).
                    const [rows] = await connection.query(
                        `SELECT * FROM enrollments WHERE userId = ? AND courseId = ?`,
                        [userId, course.id]
                    );

                    if (rows.length > 0) {
                        results.skipped.push({
                            userId,
                            courseId: course.id,
                            reason: 'Already enrolled'
                        });
                        continue;
                    }

                    // Create enrollment
                    const enrollmentData = {
                        userId,
                        courseId: course.id,
                        departmentId: departmentId || null,
                        enrolledBy: req.user.id,
                        enrollmentDate: new Date(),
                        status: 'active'
                    };

                    const [insertResult] = await connection.query(
                        `INSERT INTO enrollments (userId, courseId, departmentId, enrolledBy, enrollmentDate, status) VALUES (?, ?, ?, ?, ?, ?)`,
                        [userId, course.id, enrollmentData.departmentId, enrollmentData.enrolledBy, enrollmentData.enrollmentDate, enrollmentData.status]
                    );

                    // Add user to department if specified
                    if (departmentId) {
                        // Lock department row to update students JSON safely
                        const [deptRows] = await connection.query(`SELECT students FROM departments WHERE id = ? FOR UPDATE`, [departmentId]);
                        if (deptRows.length > 0) {
                            let students = deptRows[0].students; // It comes as JSON object (array) due to mysql2 type casting if configured, or string.
                            // Assuming mysql2 returns parsed JSON if column type is JSON. 
                            if (!Array.isArray(students)) students = [];

                            if (!students.includes(userId) && !students.includes(String(userId))) {
                                students.push(userId);
                                await connection.query(`UPDATE departments SET students = ? WHERE id = ?`, [JSON.stringify(students), departmentId]);
                            }
                        }
                    }

                    results.successful.push({
                        userId,
                        courseId: course.id,
                        enrollmentId: insertResult.insertId
                    });

                } catch (innerError) {
                    results.failed.push({
                        userId,
                        courseId: course.id,
                        error: innerError.message
                    });
                    // Don't abort whole transaction for one user failure? 
                    // Mongoose logic had try/catch inside loop but session was around all.
                    // If one fails, session might strictly abort? 
                    // Original code: catch inside loop pushes to failed. 
                    // BUT session.withTransaction typically aborts on error thrown? 
                    // Actually, if we catch inside, transaction continues.
                }
            }
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw new ApiError(`Bulk enrollment transaction failed: ${error.message}`, 500);
    } finally {
        connection.release();
    }

    // Notifications
    if (notify && results.successful.length > 0) {
        try {
            // Distinct users
            const distinctUserIds = [...new Set(results.successful.map(r => r.userId))];

            // We have existingUsers map earlier or re-fetch
            const userMap = new Map();
            existingUsers.forEach(u => userMap.set(u.id, u));

            for (const uid of distinctUserIds) {
                const user = userMap.get(uid);
                if (!user) continue;

                const userSuccesses = results.successful.filter(r => r.userId === uid);
                const userCourseIds = userSuccesses.map(r => r.courseId);
                const userCourses = targetCourses.filter(c => userCourseIds.includes(c.id));

                if (userCourses.length > 0) {
                    await sendEmail({
                        to: user.email,
                        subject: `Enrollment Confirmation - ${userCourses.length > 1 ? 'Multiple Courses' : userCourses[0].title}`,
                        template: 'bulk-enrollment',
                        data: {
                            userName: user.fullName,
                            courses: userCourses,
                            departmentName: department?.name || null,
                            loginUrl: process.env.FRONTEND_URL || ''
                        }
                    });
                }
            }
        } catch (emailError) {
            console.error("Bulk email error", emailError);
        }
    }

    // Reuse audit logger (it uses its own pool usually)
    await auditLogger(req.user.id, 'BULK_ENROLL_USERS', {
        userCount: userIds.length,
        courseCount: targetCourses.length,
        departmentId,
        results: {
            successful: results.successful.length,
            failed: results.failed.length,
            skipped: results.skipped.length
        }
    }, { req });

    res.json(new ApiResponse(200, {
        results,
        summary: {
            total: userIds.length * targetCourses.length,
            successful: results.successful.length,
            failed: results.failed.length,
            skipped: results.skipped.length
        }
    }, 'Bulk enrollment completed'));
});

// === BULK EMAIL OPERATIONS ===

// Send bulk emails
export const bulkSendEmails = asyncHandler(async (req, res) => {
    const {
        recipients = [],
        recipientType = 'users',
        userIds = [],
        roles = [],
        departmentIds = [],
        subject,
        content,
        template = null,
        templateData = {}
    } = req.body;

    if (!subject || !content) {
        throw new ApiError("Subject and content are required", 400);
    }

    let emailRecipients = [];

    if (recipientType === 'users' && userIds.length > 0) {
        const [users] = await pool.query(
            "SELECT id, email, fullName FROM users WHERE id IN (?) AND isEmailVerified = 1",
            [userIds]
        );
        emailRecipients = users.map(user => ({
            email: user.email,
            name: user.fullName,
            userId: user.id
        }));
    } else if (recipientType === 'roles' && roles.length > 0) {
        const [users] = await pool.query(
            "SELECT id, email, fullName, role FROM users WHERE role IN (?) AND isEmailVerified = 1",
            [roles]
        );
        emailRecipients = users.map(user => ({
            email: user.email,
            name: user.fullName,
            userId: user.id,
            role: user.role
        }));
    } else if (recipientType === 'departments' && departmentIds.length > 0) {
        // This is harder because 'students' is JSON array in 'departments'.
        // Can't JOIN easily on JSON in older MySQL.
        // Strategy: Fetch departments, get student IDs, then fetch users.
        const [departments] = await pool.query("SELECT id, name, students FROM departments WHERE id IN (?)", [departmentIds]);

        const allStudentIds = new Set();
        departments.forEach(d => {
            const studs = Array.isArray(d.students) ? d.students : (typeof d.students === 'string' ? JSON.parse(d.students || '[]') : []);
            studs.forEach(sid => allStudentIds.add(sid));
        });

        if (allStudentIds.size > 0) {
            const [students] = await pool.query(
                "SELECT id, email, fullName FROM users WHERE id IN (?)",
                [Array.from(allStudentIds)]
            );
            // Need to map back to which dept? Not critical for simple list, but original code added dept info.
            // Original: pushed duplicate emails if user in multiple depts? 
            // Original: "emailRecipients.push(...) inside nested loop". Yes multiple.
            // Then filtered duplicates later.

            const studentMap = new Map();
            students.forEach(s => studentMap.set(String(s.id), s));

            departments.forEach(dept => {
                const studs = Array.isArray(dept.students) ? dept.students : (typeof dept.students === 'string' ? JSON.parse(dept.students || '[]') : []);
                studs.forEach(sid => {
                    const s = studentMap.get(String(sid));
                    if (s) {
                        emailRecipients.push({
                            email: s.email,
                            name: s.fullName,
                            userId: s.id,
                            departmentId: dept.id,
                            departmentName: dept.name
                        });
                    }
                });
            });
        }
    } else if (recipients.length > 0) {
        emailRecipients = recipients.map(email => ({ email, name: email }));
    }

    if (emailRecipients.length === 0) {
        throw new ApiError("No valid recipients found", 400);
    }

    // Remove duplicates
    emailRecipients = emailRecipients.filter((recipient, index, self) =>
        index === self.findIndex(r => r.email === recipient.email)
    );

    const results = {
        successful: [],
        failed: [],
        total: emailRecipients.length
    };

    // Send emails
    for (const recipient of emailRecipients) {
        try {
            const emailData = {
                ...templateData,
                recipientName: recipient.name,
                recipientEmail: recipient.email
            };

            await sendEmail({
                to: recipient.email,
                subject,
                ...(template ? { template, data: emailData } : { html: content, text: content.replace(/<[^>]*>/g, '') })
            });

            results.successful.push({
                email: recipient.email,
                name: recipient.name,
                sentAt: new Date()
            });

        } catch (error) {
            results.failed.push({
                email: recipient.email,
                name: recipient.name,
                error: error.message
            });
        }

        // Delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    await auditLogger(req.user.id, 'BULK_SEND_EMAILS', {
        recipientType,
        totalRecipients: results.total,
        subject,
        template,
        results: {
            successful: results.successful.length,
            failed: results.failed.length
        }
    }, { req });

    res.json(new ApiResponse(200, {
        results,
        summary: {
            total: results.total,
            successful: results.successful.length,
            failed: results.failed.length,
            successRate: Math.round((results.successful.length / results.total) * 100)
        }
    }, 'Bulk email operation completed'));
});

// === BULK CERTIFICATE GENERATION ===

export const bulkGenerateCertificates = asyncHandler(async (req, res) => {
    const {
        userIds = [],
        courseId,
        templateId,
        departmentId = null,
        criteria = 'completion'
    } = req.body;

    if (!courseId || !templateId) {
        throw new ApiError("Course ID and template ID are required", 400);
    }

    const course = await Course.findById(courseId);
    const template = await CertificateTemplate.findById(templateId);

    if (!course) throw new ApiError("Course not found", 404);
    if (!template) throw new ApiError("Certificate template not found", 404);

    let eligibleUserIds = [];

    if (userIds.length > 0) {
        eligibleUserIds = userIds;
    } else {
        if (criteria === 'completion') {
            // Completed enrollments
            let sql = "SELECT userId FROM enrollments WHERE courseId = ? AND status = 'completed'";
            const params = [courseId];
            if (departmentId) {
                sql += " AND departmentId = ?";
                params.push(departmentId);
            }
            const [rows] = await pool.query(sql, params);
            eligibleUserIds = rows.map(r => r.userId);
        } else if (criteria === 'enrollment') {
            let sql = "SELECT userId FROM enrollments WHERE courseId = ?";
            const params = [courseId];
            if (departmentId) {
                sql += " AND departmentId = ?";
                params.push(departmentId);
            }
            const [rows] = await pool.query(sql, params);
            eligibleUserIds = rows.map(r => r.userId);
        }
    }

    // Fetch user details
    if (eligibleUserIds.length === 0) {
        throw new ApiError("No eligible users found for certificate generation", 400);
    }

    const [eligibleUsers] = await pool.query("SELECT id, fullName, email FROM users WHERE id IN (?)", [eligibleUserIds]);

    const results = {
        successful: [],
        failed: [],
        skipped: []
    };

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        for (const user of eligibleUsers) {
            try {
                // Check existing
                const [rows] = await connection.query(
                    `SELECT id FROM certificates WHERE student = ? AND course = ? AND metadata->>'$.templateId' = ?`,
                    [user.id, course.id, String(template.id)]
                );
                // Note: JSON query syntax ->> might vary by MySQL version. 
                // Alternatively, check simple fields: student and course. 
                // Original used templateId check. 
                // Let's assume student+course+type is enough or check robustly? 
                // Standard unique constraint on certificates? Usually unique per student-course.
                // Let's rely on standard logic.

                if (rows.length > 0) {
                    results.skipped.push({
                        userId: user.id,
                        userName: user.fullName,
                        reason: 'Certificate already exists'
                    });
                    continue;
                }

                const certNum = `CERT-${Date.now()}-${user.id}`;
                const issueDate = new Date();

                const certData = {
                    student: user.id,
                    course: course.id,
                    department: departmentId,
                    issuedBy: req.user.id,
                    issuedDate: issueDate,
                    certificateNumber: certNum,
                    status: 'issued',
                    type: 'COMPLETION', // default
                    metadata: JSON.stringify({
                        userName: user.fullName,
                        courseName: course.title,
                        templateName: template.name,
                        templateId: template.id,
                        generationType: 'bulk'
                    })
                };

                // Insert
                const [ins] = await connection.query(
                    `INSERT INTO certificates (student, course, department, issuedBy, issuedDate, certificateNumber, status, type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [certData.student, certData.course, certData.department, certData.issuedBy, certData.issuedDate, certData.certificateNumber, certData.status, certData.type, certData.metadata]
                );

                results.successful.push({
                    userId: user.id,
                    userName: user.fullName,
                    certificateId: ins.insertId,
                    certificateNumber: certNum
                });

            } catch (err) {
                results.failed.push({
                    userId: user.id,
                    userName: user.fullName,
                    error: err.message
                });
            }
        }

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw new ApiError("Bulk certificate generation failed transaction", 500);
    } finally {
        connection.release();
    }

    // Notifications
    try {
        for (const success of results.successful) {
            const user = eligibleUsers.find(u => u.id === success.userId);
            if (user && user.email) {
                await sendEmail({
                    to: user.email,
                    subject: `Certificate Available - ${course.title}`,
                    template: 'certificate-generated',
                    data: {
                        userName: user.fullName,
                        courseName: course.title,
                        certificateNumber: success.certificateNumber,
                        downloadUrl: `${process.env.FRONTEND_URL}/certificates/${success.certificateId}`
                    }
                });
            }
        }
    } catch (e) { }

    await auditLogger(req.user.id, 'BULK_GENERATE_CERTIFICATES', {
        courseId,
        templateId,
        departmentId,
        criteria,
        totalUsers: eligibleUsers.length,
        results: {
            successful: results.successful.length,
            failed: results.failed.length,
            skipped: results.skipped.length
        }
    }, { req });

    res.json(new ApiResponse(200, {
        results,
        summary: {
            total: eligibleUsers.length,
            successful: results.successful.length,
            failed: results.failed.length,
            skipped: results.skipped.length
        }
    }, 'Bulk certificate generation completed'));
});

// === BULK OPERATION HISTORY ===

export const getBulkOperationHistory = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        operation = '',
        dateFrom,
        dateTo,
        sortBy = 'createdAt',
        order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build SQL query
    let sql = "SELECT * FROM audits WHERE action IN ('BULK_ENROLL_USERS', 'BULK_SEND_EMAILS', 'BULK_GENERATE_CERTIFICATES')";
    const params = [];

    if (operation) {
        const operationMap = {
            'enrollment': 'BULK_ENROLL_USERS',
            'email': 'BULK_SEND_EMAILS',
            'certificates': 'BULK_GENERATE_CERTIFICATES'
        };
        if (operationMap[operation]) {
            sql += " AND action = ?";
            params.push(operationMap[operation]);
        }
    }

    if (dateFrom) {
        sql += " AND createdAt >= ?";
        params.push(new Date(dateFrom));
    }
    if (dateTo) {
        sql += " AND createdAt <= ?";
        params.push(new Date(dateTo));
    }

    // Count
    const [countRows] = await pool.query(`SELECT COUNT(*) as count FROM (${sql}) as sub`, params);
    const totalOperations = countRows[0].count;

    // Fetch
    sql += ` ORDER BY ${sortBy === 'createdAt' ? 'createdAt' : 'createdAt'} ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(sql, params);

    // Populate user manual
    const userIds = [...new Set(rows.map(r => r.user))].filter(Boolean);
    let userMap = new Map();
    if (userIds.length > 0) {
        const [users] = await pool.query("SELECT id, fullName, email FROM users WHERE id IN (?)", [userIds]);
        users.forEach(u => userMap.set(u.id, u));
    }

    const enhancedOperations = rows.map(op => {
        let details = op.details;
        if (typeof details === 'string') {
            try { details = JSON.parse(details); } catch (e) { }
        }

        const u = userMap.get(op.user);
        return {
            ...op,
            user: u ? { _id: u.id, fullName: u.fullName, email: u.email } : null, // Mongoose compat structure
            operationType: op.action.replace('BULK_', '').toLowerCase().replace('_', ' '),
            status: details?.results ? 'completed' : 'in_progress',
            summary: details?.results || null,
            details // Ensure parsed
        };
    });

    res.json(new ApiResponse(200, {
        operations: enhancedOperations,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOperations / parseInt(limit)),
            totalOperations,
            limit: parseInt(limit)
        }
    }, 'Bulk operation history fetched successfully'));
});
