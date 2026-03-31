import { executeQuery } from "../db/mssqlHelper.js";
import Enrollment from "../models/enrollment.model.js";
import Course from "../models/course.model.js";
import User from "../models/auth.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper to manually populate objects
const populateEnrollment = async (enrollment, fields = []) => {
    if (!enrollment) return null;

    if (fields.includes('student') && enrollment.student) {
        if (typeof enrollment.student !== 'object') {
            const [rows] = await executeQuery("SELECT id, fullName, email FROM users WHERE id = ?", [enrollment.student]);
            if (rows.length > 0) enrollment.student = rows[0];
        }
    }

    if (fields.includes('course') && enrollment.course) {
        if (typeof enrollment.course !== 'object') {
            const [rows] = await executeQuery("SELECT id, title, description FROM courses WHERE id = ?", [enrollment.course]);
            if (rows.length > 0) enrollment.course = rows[0];
        }
    }

    if (fields.includes('enrolledBy') && enrollment.enrolledBy) {
        if (typeof enrollment.enrolledBy !== 'object') {
            const [rows] = await executeQuery("SELECT id, fullName, email, role FROM users WHERE id = ?", [enrollment.enrolledBy]);
            if (rows.length > 0) enrollment.enrolledBy = rows[0];
        }
    }

    return enrollment;
};

export const enrollStudent = asyncHandler(async (req, res) => {
    const { courseId, studentId } = req.body;

    if (!courseId) throw new ApiError("Course ID required", 400);
    if (!studentId) throw new ApiError("Student ID required", 400);

    // 1. Validate Entities
    const [courses] = await executeQuery("SELECT * FROM courses WHERE id = ?", [courseId]);
    if (courses.length === 0) throw new ApiError("Course not found", 404);
    const course = courses[0];

    const [students] = await executeQuery("SELECT * FROM users WHERE id = ?", [studentId]);
    if (students.length === 0 || students[0].role !== "STUDENT") throw new ApiError("Invalid student", 400);

    // 2. Check Existence
    const [existing] = await executeQuery("SELECT * FROM enrollments WHERE course = ? AND student = ?", [courseId, studentId]);
    if (existing.length > 0) throw new ApiError("Student already enrolled", 400);

    // 3. Create Enrollment
    const [result] = await executeQuery(
        `INSERT INTO enrollments (course, student, enrolledBy, status, enrolledAt) 
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, GETDATE())`,
        [courseId, studentId, req.user.id, 'ACTIVE']
    );
    const enrollmentId = result[0].id;

    // 4. Update Course (students array count)
    let courseStudents = course.students || [];
    if (typeof courseStudents === 'string') try { courseStudents = JSON.parse(courseStudents); } catch (e) { courseStudents = []; }

    if (!courseStudents.map(String).includes(String(studentId))) {
        courseStudents.push(studentId);
        await executeQuery("UPDATE courses SET students = ?, totalEnrollments = totalEnrollments + 1 WHERE id = ?", [JSON.stringify(courseStudents), courseId]);
    }

    // 5. Update User (enrolledCourses array)
    let userCourses = students[0].enrolledCourses || [];
    if (typeof userCourses === 'string') try { userCourses = JSON.parse(userCourses); } catch (e) { userCourses = []; }

    if (!userCourses.map(String).includes(String(courseId))) {
        userCourses.push(courseId);
        await executeQuery("UPDATE users SET enrolledCourses = ? WHERE id = ?", [JSON.stringify(userCourses), studentId]);
    }

    // Fetch created enrollment for response
    const [createdEnrollment] = await executeQuery("SELECT * FROM enrollments WHERE id = ?", [enrollmentId]);

    res.status(201).json(new ApiResponse(201, createdEnrollment[0], "Student enrolled successfully"));
});

export const unenrollStudent = asyncHandler(async (req, res) => {
    const { courseId, studentId } = req.body;

    // Check enrollment
    const [rows] = await executeQuery("SELECT * FROM enrollments WHERE course = ? AND student = ?", [courseId, studentId]);
    if (rows.length === 0) throw new ApiError("Enrollment not found", 404);

    // 1. Delete Enrollment
    await executeQuery("DELETE FROM enrollments WHERE course = ? AND student = ?", [courseId, studentId]);

    // 2. Update Course
    const [courses] = await executeQuery("SELECT students FROM courses WHERE id = ?", [courseId]);
    if (courses.length > 0) {
        let cStudents = courses[0].students || [];
        if (typeof cStudents === 'string') try { cStudents = JSON.parse(cStudents); } catch (e) { cStudents = []; }

        // Filter out
        const newStudents = cStudents.filter(s => String(s) !== String(studentId));
        if (newStudents.length !== cStudents.length) {
            // Decrement count if removed and ensure not below 0
            await executeQuery("UPDATE courses SET students = ?, totalEnrollments = (CASE WHEN totalEnrollments > 0 THEN totalEnrollments - 1 ELSE 0 END) WHERE id = ?", [JSON.stringify(newStudents), courseId]);
        }
    }

    // 3. Update User
    const [users] = await executeQuery("SELECT enrolledCourses FROM users WHERE id = ?", [studentId]);
    if (users.length > 0) {
        let uCourses = users[0].enrolledCourses || [];
        if (typeof uCourses === 'string') try { uCourses = JSON.parse(uCourses); } catch (e) { uCourses = []; }

        const newCourses = uCourses.filter(c => String(c) !== String(courseId));
        if (newCourses.length !== uCourses.length) {
            await executeQuery("UPDATE users SET enrolledCourses = ? WHERE id = ?", [JSON.stringify(newCourses), studentId]);
        }
    }

    res.json(new ApiResponse(200, null, "Unenrolled successfully"));
});

export const getAllEnrollments = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const search = req.query.search || "";
    let whereSql = "WHERE 1=1";
    let params = [];

    if (search) {
        whereSql += " AND status LIKE ?";
        params.push(`%${search}%`);
    }

    const [countRows] = await executeQuery(`SELECT COUNT(*) as total FROM enrollments ${whereSql}`, params);
    const total = countRows[0].total;

    const [rows] = await executeQuery(`SELECT * FROM enrollments ${whereSql} ORDER BY createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`, [...params, offset, limit]);

    const enrollments = await Promise.all(rows.map(e => populateEnrollment(e, ['student', 'course', 'enrolledBy'])));

    res.json(new ApiResponse(200, {
        enrollments,
        pagination: { total, page, pages: Math.ceil(total / limit), limit }
    }, "fetched"));
});

export const getStudentEnrollments = asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    const [rows] = await executeQuery("SELECT * FROM enrollments WHERE student = ? ORDER BY createdAt DESC", [studentId]);
    const enrollments = await Promise.all(rows.map(e => populateEnrollment(e, ['course'])));

    res.json(new ApiResponse(200, enrollments, "fetched"));
});

export const getCourseEnrollments = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const [rows] = await executeQuery("SELECT * FROM enrollments WHERE course = ? ORDER BY createdAt DESC", [courseId]);
    const enrollments = await Promise.all(rows.map(e => populateEnrollment(e, ['student'])));

    res.json(new ApiResponse(200, enrollments, "fetched"));
});

export const updateEnrollment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const [rows] = await executeQuery("SELECT * FROM enrollments WHERE id = ?", [id]);
    if (rows.length === 0) throw new ApiError("Not found", 404);

    if (status) {
        await executeQuery("UPDATE enrollments SET status = ? WHERE id = ?", [status, id]);
        rows[0].status = status;
    }

    res.json(new ApiResponse(200, rows[0], "Updated"));
});

export const deleteEnrollment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [rows] = await executeQuery("SELECT * FROM enrollments WHERE id = ?", [id]);
    if (rows.length === 0) throw new ApiError("Not found", 404);

    await executeQuery("DELETE FROM enrollments WHERE id = ?", [id]);

    res.json(new ApiResponse(200, null, "Deleted"));
});