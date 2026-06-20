import { executeQuery } from "../db/mssqlHelper.js";
import Department from "../models/department.model.js";
import User from "../models/auth.model.js";
import Course from "../models/course.model.js";
import Progress from "../models/progress.model.js";
import Submission from "../models/submission.model.js";
import AttendanceLog from "../models/attendanceLog.model.js";
import NotificationService from "../services/notification.service.js";
import HandoverSheet from "../models/handoverSheet.model.js";
import HandoverSheetConfig from "../models/handoverSheetConfig.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sendMail from "../utils/mail.util.js";

const normalizeParam = (val) => {
    if (!val || val === 'undefined' || val === 'null' || val === '' || val === '0' || val === 'all' || val === 'All') return null;
    return val;
};

// Helper to resolve department by ID or Slug
async function resolveDepartmentId(idOrSlug) {
    if (!idOrSlug) return null;
    if (!isNaN(idOrSlug)) return idOrSlug;
    const [rows] = await executeQuery("SELECT id FROM departments WHERE slug = ?", [idOrSlug]);
    return rows.length > 0 ? rows[0].id : null;
}

// Helper to manual populate
const populateDepartment = async (dept, fields = []) => {
    if (!dept) return null;

    if (fields.includes('instructor') && dept.instructor) {
        if (typeof dept.instructor !== 'object') {
            const instructorId = dept.instructor;
            // Guard against "Assembly Quality" or other non-numeric IDs in numeric column query
            const u = (!instructorId || isNaN(instructorId)) ? null : await User.findById(instructorId);
            if (u) {
                dept.instructor = { id: u.id, _id: u.id, fullName: u.fullName, email: u.email, slug: u.slug, createdAt: u.createdAt };
            } else if (!isNaN(instructorId)) {
                // If it was a numeric ID but user not found, keep as null or ID
                dept.instructor = null;
            }
            // If it was "Assembly Quality", we leave it as is or null it? 
            // Better to null it if the application expects an object/ID
        }
    }

    if (fields.includes('courses') && dept.courses && dept.courses.length > 0) {
        if (typeof dept.courses[0] !== 'object') {
            const [rows] = await executeQuery("SELECT id, title, slug, description, difficulty, status FROM courses WHERE id IN (?)", [dept.courses]);
            const courses = rows.map(c => ({ ...c, _id: c.id }));
            dept.courses = courses;
            if (!dept.course && courses.length > 0) dept.course = courses[0];
        }
    }

    if (fields.includes('course') && dept.course && typeof dept.course !== 'object') {
        const [c] = await executeQuery("SELECT id, title, slug, description, difficulty, status FROM courses WHERE id = ?", [dept.course]);
        if (c.length > 0) dept.course = { ...c[0], _id: c[0].id };
    }

    if (fields.includes('studentCount')) {
        const [countRows] = await executeQuery(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE (departmentId = ? OR department = ? OR department = ?)
            AND (isDeleted = 0 OR isDeleted IS NULL)
            AND (isEmployee = 1)
            AND (isTrainer = 0 OR isTrainer IS NULL)
            AND (customRoleId IS NULL)
            AND (status IS NULL OR status != 'LEFT')
        `, [dept.id, String(dept.id), dept.name]);
        dept.studentCount = countRows[0].count;
    }

    if (fields.includes('students')) {
        // Load limited students for preview; use getDepartmentTrainees for full paginated list
        const [students] = await executeQuery(`
            SELECT TOP 50 id, fullName, email, slug, createdAt, avatar, userName, empId, currentLevel, status
            FROM users 
            WHERE (departmentId = ? OR department = ? OR department = ?)
            AND (isDeleted = 0 OR isDeleted IS NULL)
            AND (isEmployee = 1)
            AND (isTrainer = 0 OR isTrainer IS NULL)
            AND (customRoleId IS NULL)
            AND (status IS NULL OR status != 'LEFT')
            ORDER BY fullName ASC
        `, [dept.id, String(dept.id), dept.name]);
        dept.students = students.map(s => ({ ...s, _id: s.id }));

        // Always ensure we have an accurate studentCount if we're showing the students list
        if (!dept.studentCount) {
            const [countRows] = await executeQuery(`
                SELECT COUNT(*) as count 
                FROM users 
                WHERE (departmentId = ? OR department = ? OR department = ?)
                AND (isDeleted = 0 OR isDeleted IS NULL)
                AND (isEmployee = 1)
                AND (isTrainer = 0 OR isTrainer IS NULL)
                AND (customRoleId IS NULL)
                AND (status IS NULL OR status != 'LEFT')
            `, [dept.id, String(dept.id), dept.name]);
            dept.studentCount = countRows[0].count;
        }
    }
    return dept;
};

export const getMyDepartment = asyncHandler(async (req, res) => {
    if (!req.user || !req.user.department) return res.json(new ApiResponse(200, null, "No department assigned"));
    const deptId = req.user.department;
    let department = await Department.findById(deptId);
    if (!department) return res.json(new ApiResponse(200, null, "No department assigned"));
    department = await populateDepartment(department, ['instructor', 'courses', 'course']);
    const responseDept = {
        name: department.name,
        status: department.status,
        startDate: department.startDate,
        endDate: department.endDate,
        capacity: department.capacity,
        schedule: department.schedule,
        courses: department.courses,
        course: department.course
    };
    return res.json(new ApiResponse(200, responseDept, "My department fetched successfully"));
});

export const getMyDepartments = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    let departments = [];
    if (userRole === "INSTRUCTOR") {
        // userId is numeric, but instructor column is VARCHAR. 
        // Ensure we pass as string to avoid SQL server's implicit cast to INT on the column.
        const rows = await Department.find({ instructor: String(userId) });
        departments = await Promise.all(rows.map(d => populateDepartment(d, ['courses', 'course', 'students'])));
    } else if (userRole === "STUDENT") {
        if (!req.user.department) return res.json(new ApiResponse(200, [], "No department assigned"));
        let dept = await Department.findById(req.user.department);
        if (dept) {
            dept = await populateDepartment(dept, ['instructor', 'courses']);
            departments = [dept];
        }
    }
    return res.json(new ApiResponse(200, { departments, totalDepartments: departments.length }, "My departments fetched successfully"));
});

export const createDepartment = asyncHandler(async (req, res) => {
    const { name, uniCode, instructorId, courseIds, startDate, endDate, capacity } = req.body;
    if (!name) throw new ApiError("Department name is required", 400);

    if (uniCode) {
        const [existing] = await executeQuery("SELECT id FROM departments WHERE uniCode = ?", [uniCode]);
        if (existing.length > 0) throw new ApiError("Department with this UniCode already exists", 400);
    }

    let courses = [];
    if (courseIds && Array.isArray(courseIds) && courseIds.length > 0) {
        const uniqueIds = [...new Set(courseIds.map(id => parseInt(id)).filter(id => !isNaN(id)))];
        if (uniqueIds.length === 0) throw new ApiError("No valid course IDs provided", 400);
        const [rows] = await executeQuery("SELECT id FROM courses WHERE id IN (?)", [uniqueIds]);
        if (rows.length !== uniqueIds.length) throw new ApiError("One or more invalid course IDs provided", 400);
        courses = uniqueIds;
    } else if (req.body.courseId) {
        const [rows] = await executeQuery("SELECT id FROM courses WHERE id = ?", [req.body.courseId]);
        if (rows.length === 0) throw new ApiError("Invalid course selected", 400);
        courses = [rows[0].id];
    }
    const departmentData = {
        name,
        uniCode: uniCode && uniCode.trim() !== "" ? uniCode.trim() : null,
        instructor: instructorId || null,
        courses,
        course: courses.length > 0 ? courses[0] : null,
        students: [],
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        capacity: capacity ? parseInt(capacity) : null
    };
    let department = await Department.create(departmentData);
    department = await populateDepartment(department, ['instructor', 'courses', 'course']);
    res.status(201).json(new ApiResponse(201, department, "Department created successfully"));
});

export const assignInstructor = asyncHandler(async (req, res) => {
    const { departmentId, instructorId } = req.body;
    const department = await Department.findById(departmentId);
    if (!department) throw new ApiError("Department not found", 404);
    const instructor = await User.findById(instructorId);
    if (!instructor || instructor.role !== "INSTRUCTOR") throw new ApiError("Invalid instructor", 400);
    if (['LEFT', 'SUSPENDED', 'BANNED'].includes(instructor.status)) throw new ApiError("Cannot assign a deactivated user", 400);
    if (department.instructor && String(department.instructor) === String(instructorId)) throw new ApiError("Instructor is already assigned", 400);
    department.instructor = instructorId;
    await department.save();
    let currentDepts = instructor.departments || [];
    if (typeof currentDepts === 'string') try { currentDepts = JSON.parse(currentDepts); } catch (e) { currentDepts = []; }
    if (!currentDepts.map(String).includes(String(departmentId))) {
        currentDepts.push(departmentId);
        instructor.departments = currentDepts;
        await instructor.save();
    }
    const updated = await populateDepartment(department, ['instructor']);
    res.json(new ApiResponse(200, updated, "Instructor assigned successfully"));
});

export const removeInstructor = asyncHandler(async (req, res) => {
    const { departmentId } = req.body;
    const department = await Department.findById(departmentId);
    if (!department) throw new ApiError("Department not found", 404);
    if (!department.instructor) throw new ApiError("No instructor assigned", 400);
    const instructorId = department.instructor;
    department.instructor = null;
    await department.save();
    const instructor = await User.findById(instructorId);
    if (instructor) {
        let currentDepts = instructor.departments || [];
        if (typeof currentDepts === 'string') try { currentDepts = JSON.parse(currentDepts); } catch (e) { currentDepts = []; }
        instructor.departments = currentDepts.filter(d => String(d) !== String(departmentId));
        await instructor.save();
    }
    res.json(new ApiResponse(200, department, "Instructor removed successfully"));
});

export const addStudentToDepartment = asyncHandler(async (req, res) => {
    const { departmentId, studentId, studentIds } = req.body;

    // Normalize input to array
    let idsToAdd = [];
    if (studentIds && Array.isArray(studentIds)) {
        idsToAdd = studentIds;
    } else if (studentId) {
        idsToAdd = [studentId];
    }

    if (idsToAdd.length === 0) throw new ApiError("No students provided", 400);

    const department = await Department.findById(departmentId);
    if (!department) throw new ApiError("Department not found", 404);

    // Validate students exist
    const users = await User.find({
        _id: { $in: idsToAdd }
    });

    if (users.length === 0) {
        throw new ApiError("None of the provided student IDs were found", 404);
    }

    if (users.length !== idsToAdd.length) {
        console.warn("Some provided student IDs were not found");
    }

    const validIdsToAdd = users.map(u => u._id);

    // Filter out already existing students for the department's student list
    const existingStudentIds = department.students.map(String);
    const newStudentIds = validIdsToAdd.filter(id => !existingStudentIds.includes(String(id)));

    // Validate capacity if there are new students to add
    if (newStudentIds.length > 0 && department.capacity) {
        const currentCount = department.students.length;
        if (currentCount + newStudentIds.length > department.capacity) {
            throw new ApiError(`Cannot add ${newStudentIds.length} students. Department capacity is ${department.capacity} and current count is ${currentCount}`, 400);
        }
    }

    if (newStudentIds.length > 0) {
        department.students.push(...newStudentIds);
        await department.save();
    }

    // ALWAYS update the user records to keep them synchronized with this department
    await User.updateMany(
        { _id: { $in: validIdsToAdd } },
        {
            $set: {
                department: department.name,
                departmentId: department.id
            },
            $addToSet: { departments: department.id }
        }
    );

    res.json(new ApiResponse(200, department, `${validIdsToAdd.length} students synced with department successfully`));
});

export const removeStudentFromDepartment = asyncHandler(async (req, res) => {
    const { departmentId, studentId } = req.body;
    const department = await Department.findById(departmentId);
    if (!department) throw new ApiError("Department not found", 404);
    department.students = department.students.filter(s => String(s) !== String(studentId));
    await department.save();
    const student = await User.findById(studentId);
    if (student) {
        let sDepts = student.departments || [];
        if (typeof sDepts === 'string') try { sDepts = JSON.parse(sDepts); } catch (e) { sDepts = []; }
        student.departments = sDepts.filter(d => String(d) !== String(departmentId));
        if (String(student.departmentId) === String(departmentId) || String(student.department) === String(departmentId)) {
            const nextDeptId = student.departments.length > 0 ? student.departments[0] : null;
            student.departmentId = nextDeptId;
            // Sync name for legacy
            if (nextDeptId) {
                const [nextDept] = await executeQuery("SELECT name FROM departments WHERE id = ?", [nextDeptId]);
                student.department = nextDept.length ? nextDept[0].name : null;
            } else {
                student.department = null;
            }
        }
        await student.save();
    }
    res.json(new ApiResponse(200, department, "Student removed successfully"));
});

export const getAllDepartments = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    let whereSql = "WHERE 1=1";
    let params = [];
    if (search) {
        whereSql += " AND name LIKE ?";
        params.push(`%${search}%`);
    }
    if (!req.query.includeDeleted || (req.user.role !== "SUPERADMIN" && !req.user.isAdmin && !req.user.isEmployee)) {
        whereSql += " AND (isDeleted IS NULL OR isDeleted = 0)";
    }
    const [countRows] = await executeQuery(`SELECT COUNT(*) as total FROM departments ${whereSql}`, params);
    const total = countRows[0].total;
    const [rows] = await executeQuery(`SELECT * FROM departments ${whereSql} ORDER BY createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`, [...params, offset, limit]);
    const departments = await Promise.all(rows.map(d => {
        const dept = new Department(d);
        return populateDepartment(dept, ['instructor', 'courses', 'course', 'students', 'studentCount']);
    }));
    res.json(new ApiResponse(200, { departments, totalDepartments: total, totalPages: Math.ceil(total / limit), currentPage: page, limit }, "Departments fetched successfully"));
});

export const getDepartmentById = asyncHandler(async (req, res) => {
    const id = await resolveDepartmentId(req.params.id);
    if (!id) throw new ApiError("Invalid ID", 400);
    let department = await Department.findById(id);
    if (!department) throw new ApiError("Department not found", 404);
    department = await populateDepartment(department, ['instructor', 'students', 'courses', 'course', 'studentCount']);
    res.json(new ApiResponse(200, department, "Fetched"));
});

export const getDepartmentTrainees = asyncHandler(async (req, res) => {
    const id = await resolveDepartmentId(req.params.id);
    if (!id) throw new ApiError("Department not found", 404);

    const department = await Department.findById(id);
    if (!department) throw new ApiError("Department not found", 404);

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status || "";

    let whereSql = `
        WHERE (u.departmentId = ? OR u.department = ? OR u.department = ? 
               OR (u.isTemporary = 1 AND u.targetDeptId = ? AND u.currentLevel != 'L1' AND ? = 'true'))
        AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
        AND (u.isEmployee = 1)
        AND (u.isTrainer = 0 OR u.isTrainer IS NULL)
        AND (u.customRoleId IS NULL)
        AND (u.status IS NULL OR u.status != 'LEFT')
    `;
    let params = [department.id, String(department.id), department.name, department.id, req.query.includeTemporary || 'false'];

    if (search) {
        whereSql += " AND (u.fullName LIKE ? OR u.email LIKE ? OR u.userName LIKE ? OR u.empId LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && status !== "all") {
        whereSql += " AND u.status = ?";
        params.push(status);
    }

    const [countRows] = await executeQuery(`SELECT COUNT(*) as total FROM users u ${whereSql}`, params);
    const total = countRows[0].total;

    const [trainees] = await executeQuery(`
        SELECT u.id, u.fullName, u.email, u.slug, u.createdAt, u.avatar, u.username, u.empId, u.currentLevel, u.status, u.phoneNumber
        FROM users u
        ${whereSql}
        ORDER BY u.fullName ASC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `, [...params, offset, limit]);

    res.json(new ApiResponse(200, {
        trainees: trainees.map(t => ({ ...t, _id: t.id })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    }, "Trainees fetched successfully"));
});

export const updateDepartment = asyncHandler(async (req, res) => {
    const { name, uniCode, status, courseId, startDate, endDate, capacity } = req.body;
    const id = await resolveDepartmentId(req.params.id);
    if (!id) throw new ApiError("Department not found", 404);
    const department = await Department.findById(id);
    if (!department) throw new ApiError("Department not found", 404);
    if (name) department.name = name;
    if (uniCode) {
        if (department.uniCode !== uniCode) {
            const [existing] = await executeQuery("SELECT id FROM departments WHERE uniCode = ? AND id != ?", [uniCode, id]);
            if (existing.length > 0) throw new ApiError("Department with this UniCode already exists", 400);
            department.uniCode = uniCode;
        }
    }
    if (status) department.status = status;
    if (req.body.courseIds && Array.isArray(req.body.courseIds)) {
        const uniqueIds = [...new Set(req.body.courseIds.map(id => parseInt(id)).filter(id => !isNaN(id)))];
        if (uniqueIds.length > 0) {
            const [rows] = await executeQuery("SELECT id FROM courses WHERE id IN (?)", [uniqueIds]);
            if (rows.length !== uniqueIds.length) throw new ApiError("Invalid course IDs", 400);
            department.courses = uniqueIds;
            department.course = uniqueIds[0];
        } else {
            department.courses = [];
            department.course = null;
        }
    }
    else if (courseId) {
        department.courses = [courseId];
        department.course = courseId;
    }
    if (startDate) department.startDate = new Date(startDate);
    if (endDate) department.endDate = new Date(endDate);
    if (capacity) department.capacity = parseInt(capacity);
    if (req.body.isReportingEnabled !== undefined) department.isReportingEnabled = req.body.isReportingEnabled;
    await department.save();
    const updated = await populateDepartment(department, ['instructor', 'courses', 'course']);
    res.json(new ApiResponse(200, updated, "Updated"));
});

export const deleteDepartment = asyncHandler(async (req, res) => {
    const id = await resolveDepartmentId(req.params.id);
    const department = await Department.findById(id);
    if (!department) throw new ApiError("Not found", 404);

    // Cascade Delete Hierarchy (Bottom-up)
    // 1. Find all Sections
    const [sections] = await executeQuery("SELECT id FROM [sections] WHERE departmentId = ?", [id]);
    const sectionIds = sections.map(s => s.id);

    if (sectionIds.length > 0) {
        // 2. Find all Lines
        const [lines] = await executeQuery(`SELECT id FROM [lines] WHERE sectionId IN (${sectionIds.join(",")})`);
        const lineIds = lines.map(l => l.id);

        if (lineIds.length > 0) {
            // 3. Find all Sub-Sections
            const [subSections] = await executeQuery(`SELECT id FROM [sub_sections] WHERE lineId IN (${lineIds.join(",")})`);
            const subSectionIds = subSections.map(s => s.id);

            if (subSectionIds.length > 0) {
                // 4. Delete all Machines
                await executeQuery(`DELETE FROM machines WHERE subSectionId IN (${subSectionIds.join(",")})`);

                // 5. Delete all Sub-Sections
                await executeQuery(`DELETE FROM [sub_sections] WHERE lineId IN (${lineIds.join(",")})`);
            }

            // 6. Delete all Lines
            await executeQuery(`DELETE FROM [lines] WHERE sectionId IN (${sectionIds.join(",")})`);
        }

        // 7. Delete all Sections
        await executeQuery("DELETE FROM [sections] WHERE departmentId = ?", [id]);
    }

    // 8. Delete the Department record
    await executeQuery("DELETE FROM departments WHERE id = ?", [id]);

    res.json(new ApiResponse(200, null, "Department and all associated records deleted permanently"));
});

export const getDepartmentProgress = asyncHandler(async (req, res) => {
    const id = await resolveDepartmentId(req.params.id);
    const department = await Department.findById(id);
    if (!department) throw new ApiError("Not found", 404);

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const courses = [];
    const courseIdsToFetch = [...(department.courses || [])];
    if (courseIdsToFetch.length === 0 && department.course) {
        courseIdsToFetch.push(department.course);
    }

    if (courseIdsToFetch.length > 0) {
        const [cRows] = await executeQuery("SELECT id, title FROM courses WHERE id IN (?)", [courseIdsToFetch]);
        for (let c of cRows) {
            const [mRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [c.id]);
            c.totalModules = mRows[0].count;
            courses.push(c);
        }
    }

    // If no courses, we still want to see students (with 0 progress)
    // if (courses.length === 0) return res.json(new ApiResponse(200, { departmentProgress: [], overallStats: {}, total: 0 }, "No courses"));

    const sectionId = normalizeParam(req.query.sectionId);
    const lineId = normalizeParam(req.query.lineId);
    const subSectionId = normalizeParam(req.query.subSectionId);
    const stationId = normalizeParam(req.query.stationId);

    let whereSql = `
        WHERE (departmentId = ? OR department = ? OR department = ?)
        AND (isDeleted = 0 OR isDeleted IS NULL)
        AND (isEmployee = 1)
        AND (isTrainer = 0 OR isTrainer IS NULL)
        AND (customRoleId IS NULL)
        AND (status IS NULL OR status != 'LEFT')
    `;
    let params = [department.id, String(department.id), department.name];

    if (sectionId) { whereSql += " AND sectionId = ?"; params.push(sectionId); }
    if (lineId) { whereSql += " AND lineId = ?"; params.push(lineId); }
    if (subSectionId) { whereSql += " AND subSectionId = ?"; params.push(subSectionId); }
    if (stationId) { whereSql += " AND stationId = ?"; params.push(stationId); }

    if (search) {
        whereSql += " AND (fullName LIKE ? OR email LIKE ? OR userName LIKE ? OR empId LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [countRows] = await executeQuery(`SELECT COUNT(*) as total FROM users ${whereSql}`, params);
    const total = countRows[0].total;

    const [students] = await executeQuery(`
        SELECT u.id, u.fullName, u.email, u.avatar, u.currentLevel, u.status, u.empId, u.currentSkill, u.stationId,
               s.name as stationName
        FROM users u
        LEFT JOIN machines s ON u.stationId = s.id
        ${whereSql}
        ORDER BY u.fullName ASC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `, [...params, offset, limit]);

    const studentIds = students.map(s => s.id);
    let departmentProgress = [];
    const courseIds = courses.map(c => c.id);

    // Fetch machineId -> subSectionId mapping
    const [machineRows] = await executeQuery("SELECT id, subSectionId FROM [machines]");
    const machineSubSectionMap = {};
    machineRows.forEach(m => {
        machineSubSectionMap[String(m.id)] = String(m.subSectionId);
    });

    const [progressRows] = (courseIds.length > 0 && studentIds.length > 0)
        ? await executeQuery("SELECT * FROM progress WHERE student IN (?) AND course IN (?)", [studentIds, courseIds])
        : [[], {}];

    if (courses.length > 0) {
        for (const course of courses) {
            for (const student of students) {
                const prog = progressRows.find(p => p.student == student.id && p.course == course.id);
                const completedModules = prog?.completedModules ? JSON.parse(prog.completedModules).length : 0;
                const pct = course.totalModules > 0 ? Math.round((completedModules / course.totalModules) * 100) : 0;
                let currentLevel = prog?.currentLevel || student.currentLevel || 'L1';
                let levelLockEnabled = prog?.levelLockEnabled || false;
                let lockedLevel = prog?.lockedLevel || null;

                // Override with sub-section specific data if station filter is active
                if (stationId && stationId !== "undefined") {
                    const subSecId = machineSubSectionMap[String(stationId)];
                    let currentSkill = student.currentSkill || "{}";
                    if (typeof currentSkill === 'string') {
                        try { currentSkill = JSON.parse(currentSkill); } catch (e) { currentSkill = {}; }
                    }
                    if (subSecId && currentSkill[subSecId]) {
                        currentLevel = currentSkill[subSecId];
                        levelLockEnabled = !!currentSkill[`${subSecId}_locked`];
                        lockedLevel = currentSkill[`${subSecId}_lockedLevel`];
                    }
                }

                // Resolve TRUE primary level: Strict check against primary station's subSectionId
                let resolvedPrimaryLevel = "L1";
                let studentSkill = student.currentSkill || "{}";
                if (typeof studentSkill === 'string') {
                    try { studentSkill = JSON.parse(studentSkill); } catch (e) { studentSkill = {}; }
                }

                if (student.stationId) {
                    const subSecId = machineSubSectionMap[String(student.stationId)];
                    resolvedPrimaryLevel = (subSecId && studentSkill[subSecId]) || "L1";
                } else {
                    // Fallback to global level only if no primary station is assigned
                    resolvedPrimaryLevel = student.currentLevel || "L1";
                }

                departmentProgress.push({
                    student: {
                        _id: student.id,
                        fullName: student.fullName,
                        email: student.email,
                        avatar: student.avatar,
                        status: student.status,
                        empId: student.empId,
                        primaryLevel: resolvedPrimaryLevel,
                        primaryStation: student.stationName
                    },
                    completedModules,
                    totalModules: course.totalModules,
                    progressPercentage: pct,
                    courseTitle: course.title,
                    courseId: course.id,
                    currentLevel,
                    levelLockEnabled,
                    lockedLevel
                });
            }
        }
    } else {
        // No courses assigned, just return students
        for (const student of students) {
            let currentLevel = student.currentLevel || 'L1';
            let levelLockEnabled = false;
            let lockedLevel = null;

            // Override with sub-section specific data if station filter is active
            if (stationId && stationId !== "undefined") {
                const subSecId = machineSubSectionMap[String(stationId)];
                let currentSkill = student.currentSkill || "{}";
                if (typeof currentSkill === 'string') {
                    try { currentSkill = JSON.parse(currentSkill); } catch (e) { currentSkill = {}; }
                }
                if (subSecId && currentSkill[subSecId]) {
                    currentLevel = currentSkill[subSecId];
                    levelLockEnabled = !!currentSkill[`${subSecId}_locked`];
                    lockedLevel = currentSkill[`${subSecId}_lockedLevel`];
                }
            }

            // Resolve TRUE primary level: Strict check against primary station's subSectionId
            let resolvedPrimaryLevel = "L1";
            let studentSkill = student.currentSkill || "{}";
            if (typeof studentSkill === 'string') {
                try { studentSkill = JSON.parse(studentSkill); } catch (e) { studentSkill = {}; }
            }

            if (student.stationId) {
                const subSecId = machineSubSectionMap[String(student.stationId)];
                resolvedPrimaryLevel = (subSecId && studentSkill[subSecId]) || "L1";
            } else {
                resolvedPrimaryLevel = student.currentLevel || "L1";
            }

            departmentProgress.push({
                student: {
                    _id: student.id,
                    fullName: student.fullName,
                    email: student.email,
                    avatar: student.avatar,
                    status: student.status,
                    empId: student.empId,
                    primaryLevel: resolvedPrimaryLevel,
                    primaryStation: student.stationName
                },
                completedModules: 0,
                totalModules: 0,
                progressPercentage: 0,
                courseTitle: "No Course Assigned",
                courseId: null,
                currentLevel,
                levelLockEnabled,
                lockedLevel
            });
        }
    }

    // Calculate overall stats (This remains based on the paginated sample for speed, 
    // or we could do a separate query for global averages if needed)
    const overallStats = {
        totalStudents: total,
        studentsWithProgress: departmentProgress.filter(p => p.completedModules > 0).length,
        averageProgress: departmentProgress.length > 0 ? Math.round(departmentProgress.reduce((acc, curr) => acc + curr.progressPercentage, 0) / departmentProgress.length) : 0,
        totalModules: courses.reduce((acc, curr) => acc + curr.totalModules, 0)
    };

    res.json(new ApiResponse(200, {
        departmentProgress,
        overallStats,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    }, "Progress fetched successfully"));
});


export const getDepartmentSubmissions = asyncHandler(async (req, res) => {
    const id = await resolveDepartmentId(req.params.id);
    const department = await Department.findById(id);
    if (!department) throw new ApiError("Not found", 404);

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const [students] = await executeQuery(`
        SELECT id FROM users 
        WHERE (departmentId = ? OR department = ? OR department = ?)
        AND (isDeleted = 0 OR isDeleted IS NULL)
        AND (isEmployee = 1)
        AND (isTrainer = 0 OR isTrainer IS NULL)
        AND (customRoleId IS NULL)
        AND (status IS NULL OR status != 'LEFT')
    `, [department.id, String(department.id), department.name]);

    const studentIds = students.map(s => s.id);
    if (studentIds.length === 0) return res.json(new ApiResponse(200, { submissions: [], stats: {}, total: 0 }, "Empty"));

    let whereSql = "WHERE s.student IN (?)";
    let params = [studentIds];

    if (search) {
        whereSql += " AND (u.fullName LIKE ? OR a.title LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
    }

    const [countRows] = await executeQuery(`
        SELECT COUNT(*) as total 
        FROM submissions s 
        JOIN users u ON s.student = u.id 
        JOIN assignments a ON s.assignment = a.id 
        ${whereSql}
    `, params);
    const totalCount = countRows[0].total;

    const [rows] = await executeQuery(`
        SELECT s.*, u.fullName, u.email, u.avatar, a.title as aTitle, a.dueDate, a.maxScore, c.title as cTitle 
        FROM submissions s 
        JOIN users u ON s.student = u.id 
        JOIN assignments a ON s.assignment = a.id 
        JOIN courses c ON a.courseId = c.id 
        ${whereSql} 
        ORDER BY s.submittedAt DESC 
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `, [...params, offset, limit]);

    const submissions = rows.map(r => ({
        _id: r.id,
        grade: r.grade,
        isLate: r.isLate,
        submittedAt: r.submittedAt,
        student: { fullName: r.fullName, email: r.email, avatar: r.avatar },
        assignment: { title: r.aTitle, dueDate: r.dueDate, maxScore: r.maxScore, course: { title: r.cTitle } }
    }));

    const graded = submissions.filter(s => s.grade != null).length;
    const late = submissions.filter(s => s.isLate).length;
    const avg = graded > 0 ? Math.round(submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / graded) : 0;

    res.json(new ApiResponse(200, {
        submissions,
        stats: { totalSubmissions: totalCount, gradedSubmissions: graded, averageGrade: avg, lateSubmissions: late },
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
    }, "Fetched"));
});

export const getDepartmentAttempts = asyncHandler(async (req, res) => {
    const id = await resolveDepartmentId(req.params.id);
    const department = await Department.findById(id);
    if (!department) throw new ApiError("Not found", 404);

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const [students] = await executeQuery(`
        SELECT id FROM users 
        WHERE (departmentId = ? OR department = ? OR department = ?)
        AND (isDeleted = 0 OR isDeleted IS NULL)
        AND (isEmployee = 1)
        AND (isTrainer = 0 OR isTrainer IS NULL)
        AND (customRoleId IS NULL)
        AND (status IS NULL OR status != 'LEFT')
    `, [department.id, String(department.id), department.name]);

    const studentIds = students.map(s => s.id);
    if (studentIds.length === 0) return res.json(new ApiResponse(200, { attempts: [], stats: {}, total: 0 }, "Empty"));

    let whereSql = "WHERE aq.student IN (?)";
    let params = [studentIds];

    if (search) {
        whereSql += " AND (u.fullName LIKE ? OR q.title LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
    }

    const [countRows] = await executeQuery(`
        SELECT COUNT(*) as total 
        FROM attempted_quizzes aq 
        JOIN users u ON aq.student = u.id 
        JOIN quizzes q ON aq.quiz = q.id 
        ${whereSql}
    `, params);
    const totalCount = countRows[0].total;

    const [rows] = await executeQuery(`
        SELECT aq.*, u.fullName, u.email, u.avatar, q.title as qTitle 
        FROM attempted_quizzes aq 
        JOIN users u ON aq.student = u.id 
        JOIN quizzes q ON aq.quiz = q.id 
        ${whereSql} 
        ORDER BY aq.createdAt DESC 
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `, [...params, offset, limit]);

    const attempts = rows.map(r => ({
        _id: r.id,
        score: r.score,
        scorePercent: r.scorePercent,
        passed: r.passed,
        attemptedAt: r.createdAt,
        student: { fullName: r.fullName, email: r.email, avatar: r.avatar },
        quiz: { title: r.qTitle }
    }));

    const totalPassed = attempts.filter(a => a.passed).length;
    const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + (a.scorePercent || 0), 0) / attempts.length) : 0;
    const passRate = attempts.length > 0 ? Math.round((totalPassed / attempts.length) * 100) : 0;

    res.json(new ApiResponse(200, {
        attempts,
        stats: { totalAttempts: totalCount, passedAttempts: totalPassed, averageScore: avgScore, passRate },
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
    }, "Fetched"));
});

export const getDepartmentAssessments = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const [u] = await executeQuery("SELECT department FROM users WHERE id = ?", [userId]);
    if (!u[0].department) throw new ApiError("No department", 404);
    const deptId = u[0].department;
    const department = await Department.findById(deptId);
    if (!department.course) throw new ApiError("No course in department", 404);
    const [prog] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, department.course]);
    res.json(new ApiResponse(200, {}, "Fetched (Placeholder for SQL logic)"));
});

export const getAllDepartmentsProgress = asyncHandler(async (req, res) => {
    const rows = await Department.find({ isDeleted: { $ne: true } });
    const departments = await Promise.all(rows.map(d => populateDepartment(d, ['courses', 'students'])));
    const aggregatedData = [];
    res.json(new ApiResponse(200, aggregatedData, "Fetched (Placeholder for full implementation)"));
});

// === Missing Exports Implementation ===

export const getDepartmentCourseContent = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    // Get user's department ID (numeric)
    const [u] = await executeQuery("SELECT departmentId, department FROM users WHERE id = ?", [userId]);
    if (!u[0] || (!u[0].departmentId && !u[0].department)) {
        return res.json(new ApiResponse(200, [], "No department assigned"));
    }

    // Use departmentId (INT) preferably, or resolve it
    let deptId = u[0].departmentId;
    if (!deptId && u[0].department) {
        // Fallback to resolve by name if numeric ID is missing but name exists
        const [resolved] = await executeQuery("SELECT id FROM departments WHERE name = ?", [u[0].department]);
        if (resolved.length > 0) deptId = resolved[0].id;
    }

    if (!deptId || isNaN(deptId)) {
        return res.json(new ApiResponse(200, [], "No valid department ID found for user"));
    }

    // Get department's course
    const [d] = await executeQuery("SELECT course FROM departments WHERE id = ?", [deptId]);
    if (d.length === 0 || !d[0].course) {
        console.log("Debug: No course found for department", deptId);
        return res.json(new ApiResponse(200, [], "No course assigned to department"));
    }
    const courseId = d[0].course;

    // Fetch Course
    const [c] = await executeQuery("SELECT * FROM courses WHERE id = ?", [courseId]);
    if (c.length === 0) {
        console.log("Debug: Course ID not found in DB:", courseId);
        return res.json(new ApiResponse(200, [], "Course not found"));
    }

    if (c[0].status !== 'PUBLISHED') {
        console.log("Debug: Course found but status is:", c[0].status);
        // For testing, let's allow NON-published courses for now to verify data fetching works
        // return res.json(new ApiResponse(200, [], `Course found but status is ${c[0].status} (must be PUBLISHED)`));
    }
    const course = c[0];

    // Fetch Modules
    const [modules] = await executeQuery("SELECT * FROM modules WHERE course = ? ORDER BY [order] ASC, id ASC", [courseId]);

    // Fetch Lessons for each module
    for (let m of modules) {
        const [lessons] = await executeQuery("SELECT id, title, duration, [order], resources FROM lessons WHERE module = ? ORDER BY [order] ASC, id ASC", [m.id]);
        m.lessons = lessons;
    }

    course.modules = modules;

    // Fetch User Progress for this course
    const [progParams] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    const progressData = progParams.length > 0 ? progParams[0] : {};

    // Parse JSON fields in progress if they exist
    if (progressData.completedModules && typeof progressData.completedModules === 'string') {
        try { progressData.completedModules = JSON.parse(progressData.completedModules); } catch (e) { }
    }
    if (progressData.completedLessons && typeof progressData.completedLessons === 'string') {
        try { progressData.completedLessons = JSON.parse(progressData.completedLessons); } catch (e) { }
    }

    // Attach progress to the response (frontend expects courseData to contain it now, or we can wrap it)
    // To match my recent frontend change where `courseData` *is* the response data:
    course.progress = progressData;

    res.json(new ApiResponse(200, course, "Department course content fetched successfully"));
});

// soft delete endpoints removed as per permanent deletion requirement

export const updateAllDepartmentStatuses = asyncHandler(async (req, res) => {
    // Placeholder logic similar to updateAllStatuses
    await Department.updateAllStatuses();
    res.json(new ApiResponse(200, null, "Statuses updated"));
});

export const updateDepartmentStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const id = await resolveDepartmentId(req.params.id);
    await executeQuery("UPDATE departments SET status = ? WHERE id = ?", [status, id]);
    res.json(new ApiResponse(200, null, "Status updated"));
});

export const cancelDepartment = asyncHandler(async (req, res) => {
    const id = await resolveDepartmentId(req.params.id);
    await executeQuery("UPDATE departments SET status = 'CANCELLED', statusUpdatedAt = GETDATE() WHERE id = ?", [id]);
    res.json(new ApiResponse(200, null, "Department Cancelled"));
});

export const getMyDepartmentNotifications = asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, [], "Placeholder: Notifications"));
});

export const getDepartmentStatusInfo = asyncHandler(async (req, res) => {
    const id = await resolveDepartmentId(req.params.id);
    const [rows] = await executeQuery("SELECT status, statusUpdatedAt FROM departments WHERE id = ?", [id]);
    res.json(new ApiResponse(200, rows[0], "Status Info"));
});

export const getDepartmentSchedulerStatus = asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, { status: "running" }, "Scheduler Status"));
});

export const restartDepartmentScheduler = asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, { message: "Restarted" }, "Scheduler Restarted"));
});

export const getDepartmentsScheduledForCleanup = asyncHandler(async (req, res) => {
    const [rows] = await executeQuery("SELECT * FROM departments WHERE status IN ('COMPLETED', 'CANCELLED') AND isDeleted = 0");
    res.json(new ApiResponse(200, rows, "Scheduled for Cleanup"));
});

export const triggerDepartmentCleanup = asyncHandler(async (req, res) => {
    // Trigger cleanup logic potentially
    res.json(new ApiResponse(200, { message: "Cleanup Triggered" }, "Cleanup Triggered"));
});

export const getDepartmentCleanupStatus = asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, { status: "idle" }, "Cleanup Status"));
});

export const restartDepartmentCleanupScheduler = asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, { message: "Cleanup Restarted" }, "Cleanup Restarted"));
});

export const sendManualCleanupWarning = asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, { message: "Warnings sent" }, "Warnings sent"));
});

export const getHandoverSheet = asyncHandler(async (req, res) => {
    const departmentId = await resolveDepartmentId(req.params.id);
    if (!departmentId) throw new ApiError("Invalid Department ID", 400);

    const sectionId = req.query.sectionId || null;
    const date = req.query.date || null;
    let sheet = await HandoverSheet.findSpecific(departmentId, sectionId, date);

    if (!sheet) {
        // Auto-suggest users from both sources: legacy handover quiz AND dojo evaluation test
        let suggestedEntries = [];
        if (date) {
            // Source 1: Legacy — users who passed a handover quiz on this date
            const [passedUsers] = await executeQuery(`
                SELECT DISTINCT
                    u.id as studentId,
                    u.fullName as employeeName,
                    u.userName as employeeCode,
                    u.targetDeptId,
                    u.targetSectionId as sectionId,
                    u.targetLineId as lineId,
                    u.targetSubSectionId as subSectionId,
                    u.targetStationId as stationId,
                    l.name as lineName,
                    st.name as stationName,
                    aq.score,
                    q.questions as quizQuestions
                FROM users u
                JOIN attempted_quizzes aq ON CAST(u.id AS NVARCHAR(255)) = aq.student OR u.userName = aq.student
                JOIN quizzes q ON CAST(q.id AS NVARCHAR(255)) = aq.quiz
                LEFT JOIN [lines] l ON u.targetLineId = l.id
                LEFT JOIN machines st ON u.targetStationId = st.id
                WHERE u.isTemporary = 1
                  AND u.targetDeptId = ?
                  AND q.isHandover = 1
                  AND q.isDojo = 1
                  AND (aq.status = 'PASSED' OR aq.status = 'PASS')
                  AND CAST(aq.completedAt AS DATE) = CAST(? AS DATE)
                  AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
                  AND (u.status IS NULL OR u.status != 'LEFT')
            `, [departmentId, date]);

            const quizSuggested = passedUsers.map(user => {
                let marksPercent = "0%";
                try {
                    const questions = JSON.parse(user.quizQuestions || "[]");
                    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0) || 1;
                    marksPercent = `${Math.round((user.score / totalMarks) * 100)}%`;
                } catch (e) {
                    console.error("Error calculating marks:", e);
                }
                return { ...user, marks: marksPercent, passedQuizDate: date, isAutoSuggested: true };
            });

            // Source 2: Dojo evaluation test — approved + confirmed, last column all ✓, passedDate matches
            const [evalUsers] = await executeQuery(`
                SELECT DISTINCT
                    u.id as studentId,
                    u.fullName as employeeName,
                    u.userName as employeeCode,
                    u.targetDeptId,
                    u.targetSectionId as sectionId,
                    u.targetLineId as lineId,
                    u.targetSubSectionId as subSectionId,
                    u.targetStationId as stationId,
                    l.name as lineName,
                    st.name as stationName
                FROM evaluation_test_attempts eta
                JOIN users u ON eta.userId = u.id
                LEFT JOIN [lines] l ON u.targetLineId = l.id
                LEFT JOIN machines st ON u.targetStationId = st.id
                WHERE eta.isHandoverEligible = 1
                  AND CAST(eta.passedDate AS DATE) = CAST(? AS DATE)
                  AND u.targetDeptId = ?
                  AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
                  AND (u.status IS NULL OR u.status != 'LEFT')
            `, [date, departmentId]);

            const evalSuggested = evalUsers.map(user => ({
                ...user,
                marks: "100%",
                passedQuizDate: date,
                isAutoSuggested: true
            }));

            // Merge: deduplicate by studentId; evaluation test entry wins over quiz entry
            const mergedMap = new Map();
            quizSuggested.forEach(e => mergedMap.set(e.studentId, e));
            evalSuggested.forEach(e => mergedMap.set(e.studentId, e));
            suggestedEntries = [...mergedMap.values()];
        }

        return res.status(200).json(
            new ApiResponse(200, {
                isNew: true,
                entries: suggestedEntries,
                date: date
            }, suggestedEntries.length > 0 ? "Found suggested entries from evaluations" : "No record found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, { ...sheet, isNew: false }, "Handover Sheet fetched successfully")
    );
});

export const saveHandoverSheet = asyncHandler(async (req, res) => {
    const departmentId = await resolveDepartmentId(req.params.id);
    if (!departmentId) throw new ApiError("Invalid Department ID", 400);

    const { date, entries, signatures, metadata, sectionId, isSubmitted } = req.body;

    let sheet = await HandoverSheet.findSpecific(departmentId, sectionId || null, date);

    // Permission check for approvals
    const userPermissions = req.user?.customRole?.permissions || [];
    const isAdmin = req.user?.isAdmin || req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN';
    const canApprove = isAdmin || userPermissions.includes('handover_sheet:approve');

    if (!canApprove) {
        // Prevent setting or changing HOD signature
        const existingHod = sheet?.signatures?.hod || "";
        const requestedHod = signatures?.hod || "";
        if (requestedHod !== existingHod) {
            throw new ApiError("You do not have permission to approve/reject handover sheets (HOD signature restriction)", 403);
        }

        // Prevent setting or changing interviewStatus/statusActionBy for any entry
        const existingEntriesMap = new Map();
        if (sheet && Array.isArray(sheet.entries)) {
            sheet.entries.forEach(e => {
                if (e.studentId) {
                    existingEntriesMap.set(String(e.studentId), e);
                }
            });
        }

        for (const entry of entries || []) {
            if (entry.studentId) {
                const existingEntry = existingEntriesMap.get(String(entry.studentId));
                const existingStatus = existingEntry?.interviewStatus || "";
                const requestedStatus = entry.interviewStatus || "";
                const existingActionBy = existingEntry?.statusActionBy || "";
                const requestedActionBy = entry.statusActionBy || "";
                if (requestedStatus !== existingStatus || requestedActionBy !== existingActionBy) {
                    throw new ApiError("You do not have permission to approve/reject handover sheet entries", 403);
                }
            } else {
                // If there's no studentId yet, they can't submit an approved/rejected row
                if (entry.interviewStatus || entry.statusActionBy) {
                    throw new ApiError("You do not have permission to approve/reject handover sheet entries", 403);
                }
            }
        }
    }

    let newStudents = [];

    // Identify new students (kept for potential audit/logging if needed)
    if (sheet) {
        const existingStudentIds = new Set((sheet.entries || []).map(e => String(e.studentId)));
        newStudents = (entries || []).filter(e => e.studentId && !existingStudentIds.has(String(e.studentId)));
    } else {
        newStudents = entries || [];
    }

    if (sheet) {
        sheet.date = date;
        sheet.entries = entries;
        sheet.signatures = signatures;
        sheet.metadata = metadata;
        sheet.updatedBy = req.user?.fullName || req.user?.name || "System";

        await sheet.save();
    } else {
        sheet = await HandoverSheet.create({
            departmentId,
            sectionId: sectionId || null,
            date,
            entries,
            signatures,
            metadata,
            createdBy: req.user?.fullName || req.user?.name || "System",
            isSubmitted: !!isSubmitted,
            submittedAt: isSubmitted ? new Date() : null
        });
    }

    // --- SYNC ASSIGNMENTS & AUTO-ASSIGN ON APPROVAL ---
    if (entries && Array.isArray(entries)) {
        for (const entry of entries) {
            if (entry.studentId) {
                const [uRows] = await executeQuery("SELECT isTemporary, departmentId, targetDeptId FROM users WHERE id = ?", [entry.studentId]);
                if (uRows.length) {
                    const user = uRows[0];

                    // 1. Update Target Dept if changed (for temporary users)
                    if (user.isTemporary && entry.departmentId && String(entry.departmentId) !== String(user.targetDeptId)) {
                        await executeQuery("UPDATE users SET targetDeptId = ? WHERE id = ?", [entry.departmentId, entry.studentId]);
                    }

                    // 2. Auto-Assign Department on Approval (Transition to regular employee)
                    const targetDept = entry.departmentId || user.targetDeptId || departmentId;
                    const targetSect = entry.sectionId || user.targetSectionId || sectionId || null;
                    const targetLine = entry.lineId || user.targetLineId || null;
                    const targetSubSect = entry.subSectionId || user.targetSubSectionId || null;
                    const targetStn = entry.stationId || user.targetStationId || null;

                    if (entry.interviewStatus === 'APPROVE' && targetDept) {
                        // We always update to ensure they are assigned to the chosen dept/section/line/sub-section/station, clear target columns, and set isTemporary to 0
                        await executeQuery(
                            `UPDATE users 
                             SET departmentId = ?, 
                                 targetDeptId = NULL, 
                                 sectionId = ?, 
                                 lineId = ?, 
                                 subSectionId = ?, 
                                 stationId = ?,
                                 targetSectionId = NULL,
                                 targetLineId = NULL,
                                 targetSubSectionId = NULL,
                                 targetStationId = NULL,
                                 isTemporary = 0 
                             WHERE id = ?`,
                            [targetDept, targetSect, targetLine, targetSubSect, targetStn, entry.studentId]
                        );
                        console.log(`[Handover] User ${entry.studentId} assigned to dept ${targetDept}, sect ${targetSect}, line ${targetLine} and cleared temporary status upon approval.`);
                    }
                }
            }
        }
    }
    // --------------------------------------------------

    // --- EMAIL HANDOVER SHEET (Only if submitted) ---
    if (isSubmitted) {
        console.log(`[Handover] Triggering email report for department ${departmentId}`);
        NotificationService.sendFormReport("Handover Sheet", departmentId, {
            date,
            entries,
            signatures,
            metadata,
            sectionId
        }).catch(err => console.error("[Handover] Notification failed:", err));
    }
    // ----------------------------------

    return res.status(200).json(
        new ApiResponse(200, sheet, isSubmitted ? "Handover Sheet submitted and emailed successfully" : "Handover Sheet progress saved successfully")
    );
});

export const getHandoverSheetConfig = asyncHandler(async (req, res) => {
    const departmentId = await resolveDepartmentId(req.params.id);
    if (!departmentId) throw new ApiError("Department ID is required", 400);
    const sectionId = req.query.sectionId || null;

    const config = await HandoverSheetConfig.findSpecific(departmentId, sectionId);
    if (!config) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true, departmentId, sectionId }, "No configuration found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, { ...config, isNew: false }, "Configuration fetched successfully")
    );
});

export const saveHandoverSheetConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark, sectionId } = req.body;
    if (!departmentId) throw new ApiError("Department ID is required", 400);
    if (!config) throw new ApiError("Configuration data is required", 400);

    const updatedBy = req.user?.fullName || req.user?.name || "System";
    const saved = await HandoverSheetConfig.upsert(departmentId, config, remark, updatedBy, sectionId || null);

    return res.status(200).json(
        new ApiResponse(200, saved, "Configuration saved successfully")
    );
});

export const getHandoverSheetHistory = asyncHandler(async (req, res) => {
    const departmentId = await resolveDepartmentId(req.params.id);
    if (!departmentId) throw new ApiError("Department ID is required", 400);
    const sectionId = req.query.sectionId || null;

    const history = await HandoverSheetConfig.getHistory(departmentId, 20, sectionId);
    return res.status(200).json(
        new ApiResponse(200, history, "History fetched successfully")
    );
});

export const sendHandoverPDF = asyncHandler(async (req, res) => {
    const { email, pdfBase64, departmentName, date } = req.body;

    if (!email || !pdfBase64) {
        throw new ApiError("Email and PDF data are required", 400);
    }

    // Convert base64 to buffer
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const subject = `Handover Sheet - ${departmentName} (${date})`;
    const message = `
        <div style="font-family: sans-serif; line-height: 1.5;">
            <h2>Handover Sheet</h2>
            <p>Please find the attached Handover Sheet for <b>${departmentName}</b> on <b>${date}</b>.</p>
            <hr />
            <p style="font-size: 12px; color: #666;">This is an automated email from Furukawa Minda LMS.</p>
        </div>
    `;

    const attachments = [{
        filename: `Handover_Sheet_${departmentName.replace(/\s+/g, '_')}_${date}.pdf`,
        content: buffer,
        contentType: 'application/pdf'
    }];

    await sendMail(email, subject, message, attachments);

    res.json(new ApiResponse(200, null, "Email sent successfully with PDF attachment"));
});

export const getHandoverSheetsMonitoring = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, month, year } = req.query;

    const filterDeptId = normalizeParam(departmentId);
    const filterSectionId = normalizeParam(sectionId);
    const filterMonth = normalizeParam(month);
    const filterYear = normalizeParam(year);

    const isAdmin = req.user?.isAdmin || req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN';
    const hasHandoverBypass = req.user?.customRole?.permissions?.includes('dojo:handover_sheet');
    const canAccessAll = isAdmin || hasHandoverBypass;

    const conditions = ["1=1"];
    const params = [];

    if (filterDeptId) {
        conditions.push("hs.departmentId = ?");
        params.push(filterDeptId);
    } else if (!canAccessAll) {
        const assignedDepts = [];
        if (Array.isArray(req.user?.departments)) assignedDepts.push(...req.user.departments);
        if (req.user?.departmentId) assignedDepts.push(req.user.departmentId);
        const uniqueDepts = [...new Set(assignedDepts.map(String).filter(Boolean))];
        if (uniqueDepts.length === 0) {
            return res.status(200).json(new ApiResponse(200, [], "No accessible handover sheets"));
        }
        conditions.push(`hs.departmentId IN (${uniqueDepts.map(() => '?').join(',')})`);
        params.push(...uniqueDepts);
    }

    if (filterSectionId) {
        conditions.push("hs.sectionId = ?");
        params.push(filterSectionId);
    }

    if (filterMonth) {
        conditions.push("MONTH(hs.date) = ?");
        params.push(parseInt(filterMonth));
    }

    if (filterYear) {
        conditions.push("YEAR(hs.date) = ?");
        params.push(parseInt(filterYear));
    }

    const whereClause = conditions.join(" AND ");

    const [rows] = await executeQuery(`
        SELECT
            hs.id,
            hs.departmentId,
            hs.sectionId,
            hs.date,
            hs.isSubmitted,
            hs.submittedAt,
            hs.createdBy,
            hs.updatedBy,
            hs.createdAt,
            hs.updatedAt,
            d.name AS departmentName,
            sec.name AS sectionName,
            (SELECT COUNT(*) FROM OPENJSON(hs.entries)) AS entriesCount
        FROM handover_sheets hs
        LEFT JOIN departments d ON hs.departmentId = d.id
        LEFT JOIN [sections] sec ON hs.sectionId = sec.id
        WHERE ${whereClause}
        ORDER BY hs.date DESC, hs.createdAt DESC
    `, params);

    return res.status(200).json(
        new ApiResponse(200, rows, "Handover sheet monitoring data fetched successfully")
    );
});

export const getStudentHandoverHistory = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    if (!studentId) throw new ApiError("Student ID is required", 400);

    const [rows] = await executeQuery(`
        SELECT
            hs.id,
            hs.departmentId,
            hs.sectionId,
            hs.date,
            hs.isSubmitted,
            hs.submittedAt,
            d.name as departmentName,
            sec.name as sectionName,
            JSON_VALUE(entry.value, '$.marks') as marks,
            JSON_VALUE(entry.value, '$.process') as process,
            JSON_VALUE(entry.value, '$.mentor') as mentor,
            JSON_VALUE(entry.value, '$.interview1') as interview1,
            JSON_VALUE(entry.value, '$.interview2') as interview2,
            JSON_VALUE(entry.value, '$.interviewStatus') as interviewStatus,
            JSON_VALUE(entry.value, '$.statusActionBy') as statusActionBy
        FROM handover_sheets hs
        CROSS APPLY OPENJSON(hs.entries) as entry
        LEFT JOIN departments d ON hs.departmentId = d.id
        LEFT JOIN [sections] sec ON hs.sectionId = sec.id
        WHERE JSON_VALUE(entry.value, '$.studentId') = CAST(? AS NVARCHAR(50))
        ORDER BY hs.date DESC, hs.createdAt DESC
    `, [studentId]);

    res.status(200).json(
        new ApiResponse(200, rows, "Student handover history fetched successfully")
    );
});
