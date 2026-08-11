import crypto from "crypto";
import os from "os";
import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";
import logAudit from "../utils/auditLogger.js";
import { formatLocalDate } from "../utils/istDate.util.js";

// Helper to safely parse JSON
const parseJSON = (data, fallback = []) => {
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

/**
 * @desc    Create a new On Job Training record
 * @route   POST /api/v1/on-job-training/create
 * @access  Private (Admin, Instructor)
 */
export const createOnJobTraining = async (req, res, next) => {
    try {
        const { studentId, departmentId, sectionId, lineId, subSectionId, machineId, name } = req.body;

        if (!departmentId || !sectionId) {
            return next(new ApiError("Department and Section are required", 400));
        }

        let userId = null;
        if (studentId) {
            // Validate Student (ID or Username)
            const [users] = await executeQuery("SELECT id FROM users WHERE CAST(id AS NVARCHAR(50)) = ? OR userName = ?", [studentId, studentId]);
            if (users.length === 0) return next(new ApiError("Student not found", 404));
            userId = users[0].id;
        }

        // Verify Department, Section existence
        const [depts] = await executeQuery("SELECT id FROM departments WHERE id = ?", [departmentId]);
        if (depts.length === 0) return next(new ApiError("Department not found", 404));

        const [sects] = await executeQuery("SELECT id FROM sections WHERE id = ?", [sectionId]);
        if (sects.length === 0) return next(new ApiError("Section not found", 404));

        // Optional checks for Line, SubSection, Machine if provided
        if (lineId) {
            const [lines] = await executeQuery("SELECT id FROM [lines] WHERE id = ?", [lineId]);
            if (lines.length === 0) return next(new ApiError("Line not found", 404));
        }
        if (subSectionId) {
            const [subSections] = await executeQuery("SELECT id FROM [sub_sections] WHERE id = ?", [subSectionId]);
            if (subSections.length === 0) return next(new ApiError("Sub-Section not found", 404));
        }
        if (machineId) {
            const [machines] = await executeQuery("SELECT id FROM machines WHERE id = ?", [machineId]);
            if (machines.length === 0) return next(new ApiError("Machine not found", 404));
        }

        const ojtName = name || "Level-1 Practical Evaluation of On the Job Training";
        const shareToken = crypto.randomUUID();

        const [insertRows] = await executeQuery(
            `INSERT INTO on_job_trainings
            (shareToken, student, name, department, section, line, subSection, machine, createdBy, updatedBy, entries, result, createdAt, updatedAt)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
            [shareToken, userId, ojtName, departmentId, sectionId, lineId || null, subSectionId || null, machineId || null, req.user.id, req.user.id, JSON.stringify([]), "Pending"]
        );

        const insertedId = insertRows[0]?.id;

        // Fetch created OJT with populated names
        const [rows] = await executeQuery(`
            SELECT ojt.*, 
                   d.name as deptName, 
                   s.name as sectionName,
                   l.name as lineName, 
                   ss.name as subSectionName,
                   m.name as machineName, m.name as machineDisplayName
            FROM on_job_trainings ojt
            LEFT JOIN departments d ON ojt.department = CAST(d.id AS NVARCHAR(50)) OR ojt.department = d.name
            LEFT JOIN sections s ON ojt.section = CAST(s.id AS NVARCHAR(50)) OR ojt.section = s.name
            LEFT JOIN [lines] l ON ojt.line = CAST(l.id AS NVARCHAR(50)) OR ojt.line = l.name
            LEFT JOIN [sub_sections] ss ON ojt.subSection = CAST(ss.id AS NVARCHAR(50)) OR ojt.subSection = ss.name
            LEFT JOIN machines m ON ojt.machine = CAST(m.id AS NVARCHAR(50)) OR ojt.machine = m.name
            WHERE ojt.id = ?
        `, [insertedId]);

        const ojt = rows[0];
        if (ojt) {
            ojt.trainingDate = ojt.trainingDate instanceof Date ? formatLocalDate(ojt.trainingDate) : ojt.trainingDate;
            ojt.entries = parseJSON(ojt.entries, []);
            ojt.scoring = parseJSON(ojt.scoring, null);
            ojt.attendanceRecords = parseJSON(ojt.attendanceRecords, []);
            ojt.trainingLog = parseJSON(ojt.trainingLog, []);
            ojt.department = { id: ojt.department, name: ojt.deptName };
            ojt.section = ojt.section ? { id: ojt.section, name: ojt.sectionName } : null;
            ojt.line = ojt.line ? { id: ojt.line, name: ojt.lineName } : null;
            ojt.subSection = ojt.subSection ? { id: ojt.subSection, name: ojt.subSectionName } : null;
            ojt.machine = ojt.machine ? { id: ojt.machine, name: ojt.machineName, machineName: ojt.machineDisplayName } : null;

            delete ojt.deptName; delete ojt.sectionName; delete ojt.lineName; delete ojt.subSectionName;
            delete ojt.machineName; delete ojt.machineDisplayName;
        }

        logAudit(req.user?.id, "CREATE_ON_JOB_TRAINING", { studentId: userId, departmentId, sectionId, lineId },
            { resourceType: "OnJobTraining", resourceId: insertedId, req }
        ).catch(err => console.error("logAudit(CREATE_ON_JOB_TRAINING) failed:", err.message));

        res.status(201).json({
            success: true,
            message: "On Job Training created successfully",
            data: ojt
        });

    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Get All On Job Trainings for a Student
 * @route   GET /api/v1/on-job-training/student/:studentId
 * @access  Private
 */
export const getStudentOnJobTrainings = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        // Resolve student ID
        const [users] = await executeQuery("SELECT id, userName, empId FROM users WHERE CAST(id AS NVARCHAR(50)) = ? OR userName = ?", [studentId, studentId]);
        if (users.length === 0) return next(new ApiError("Student not found", 404));
        const user = users[0];
        const userId = user.id;
        const userName = user.userName;
        const empId = user.empId;

        const [ojts] = await executeQuery(`
            SELECT ojt.*, 
                   d.name as deptName, 
                   s.name as sectionName,
                   l.name as lineName, 
                   ss.name as subSectionName,
                   m.name as machineName, m.name as machineDisplayName
            FROM on_job_trainings ojt
            LEFT JOIN departments d ON ojt.department = CAST(d.id AS NVARCHAR(50)) OR ojt.department = d.name
            LEFT JOIN sections s ON ojt.section = CAST(s.id AS NVARCHAR(50)) OR ojt.section = s.name
            LEFT JOIN [lines] l ON ojt.line = CAST(l.id AS NVARCHAR(50)) OR ojt.line = l.name
            LEFT JOIN [sub_sections] ss ON ojt.subSection = CAST(ss.id AS NVARCHAR(50)) OR ojt.subSection = ss.name
            LEFT JOIN machines m ON ojt.machine = CAST(m.id AS NVARCHAR(50)) OR ojt.machine = m.name
            WHERE ojt.student = ?
               OR (ojt.attendanceRecords LIKE ? AND ? IS NOT NULL AND ? != '')
               OR (ojt.attendanceRecords LIKE ? AND ? IS NOT NULL AND ? != '')
            ORDER BY ojt.createdAt DESC
        `, [
            userId, 
            `%${empId}%`, empId, empId,
            `%${userName}%`, userName, userName
        ]);

        const formatted = ojts.map(ojt => {
            ojt.trainingDate = ojt.trainingDate instanceof Date ? formatLocalDate(ojt.trainingDate) : ojt.trainingDate;
            ojt.entries = parseJSON(ojt.entries, []);
            ojt.scoring = parseJSON(ojt.scoring, null);
            ojt.attendanceRecords = parseJSON(ojt.attendanceRecords, []);
            ojt.trainingLog = parseJSON(ojt.trainingLog, []);
            ojt.department = { id: ojt.department, name: ojt.deptName };
            ojt.section = ojt.section ? { id: ojt.section, name: ojt.sectionName } : null;
            ojt.line = ojt.line ? { id: ojt.line, name: ojt.lineName } : null;
            ojt.subSection = ojt.subSection ? { id: ojt.subSection, name: ojt.subSectionName } : null;
            ojt.machine = ojt.machine ? { id: ojt.machine, name: ojt.machineName, machineName: ojt.machineDisplayName } : null;

            delete ojt.deptName; delete ojt.sectionName; delete ojt.lineName; delete ojt.subSectionName;
            delete ojt.machineName; delete ojt.machineDisplayName;
            return ojt;
        });

        logAudit(req.user?.id, "VIEW_ON_JOB_TRAINING_LIST", { studentId: userId, count: formatted.length },
            { resourceType: "OnJobTraining", req }
        ).catch(err => console.error("logAudit(VIEW_ON_JOB_TRAINING_LIST) failed:", err.message));

        res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted
        });

    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Get Single OJT by ID
 * @route   GET /api/v1/on-job-training/:id
 * @access  Private
 */
export const getOnJobTrainingById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const [rows] = await executeQuery(`
            SELECT ojt.*, 
                   d.name as deptName, 
                   s.name as sectionName,
                   l.name as lineName, 
                   ss.name as subSectionName,
                   m.name as machineName, m.name as machineDisplayName,
                   u.fullName as studentName, u.email as studentEmail, u.avatar as studentAvatar,
                   uc.fullName as creatorName,
                   uu.fullName as approverName
            FROM on_job_trainings ojt
            LEFT JOIN departments d ON ojt.department = CAST(d.id AS NVARCHAR(50)) OR ojt.department = d.name
            LEFT JOIN sections s ON ojt.section = CAST(s.id AS NVARCHAR(50)) OR ojt.section = s.name
            LEFT JOIN [lines] l ON ojt.line = CAST(l.id AS NVARCHAR(50)) OR ojt.line = l.name
            LEFT JOIN [sub_sections] ss ON ojt.subSection = CAST(ss.id AS NVARCHAR(50)) OR ojt.subSection = ss.name
            LEFT JOIN machines m ON ojt.machine = CAST(m.id AS NVARCHAR(50)) OR ojt.machine = m.name
            LEFT JOIN users u ON ojt.student = CAST(u.id AS NVARCHAR(50)) OR ojt.student = u.userName
            LEFT JOIN users uc ON CAST(ojt.createdBy AS NVARCHAR(50)) = CAST(uc.id AS NVARCHAR(50)) OR ojt.createdBy = uc.userName
            LEFT JOIN users uu ON CAST(ojt.updatedBy AS NVARCHAR(50)) = CAST(uu.id AS NVARCHAR(50)) OR ojt.updatedBy = uu.userName
            WHERE ojt.id = ?
        `, [id]);

        if (rows.length === 0) {
            return next(new ApiError("OJT record not found", 404));
        }

        const ojt = rows[0];
        ojt.trainingDate = ojt.trainingDate instanceof Date ? formatLocalDate(ojt.trainingDate) : ojt.trainingDate;
        ojt.entries = parseJSON(ojt.entries, []);
        ojt.scoring = parseJSON(ojt.scoring, null);
        ojt.attendanceRecords = parseJSON(ojt.attendanceRecords, []);
        ojt.trainingLog = parseJSON(ojt.trainingLog, []);
        ojt.department = { id: ojt.department, name: ojt.deptName };
        ojt.section = ojt.section ? { id: ojt.section, name: ojt.sectionName } : null;
        ojt.line = ojt.line ? { id: ojt.line, name: ojt.lineName } : null;
        ojt.subSection = ojt.subSection ? { id: ojt.subSection, name: ojt.subSectionName } : null;
        ojt.machine = ojt.machine ? { id: ojt.machine, name: ojt.machineName, machineName: ojt.machineDisplayName } : null;
        ojt.student = ojt.student ? { id: ojt.student, fullName: ojt.studentName, email: ojt.studentEmail, avatar: ojt.studentAvatar } : null;
        ojt.creatorName = ojt.creatorName || null;
        ojt.approverName = ojt.approverName || null;

        delete ojt.deptName; delete ojt.sectionName; delete ojt.lineName; delete ojt.subSectionName;
        delete ojt.machineName; delete ojt.machineDisplayName;
        delete ojt.studentName; delete ojt.studentEmail; delete ojt.studentAvatar;

        logAudit(req.user?.id, "VIEW_ON_JOB_TRAINING", { ojtId: id, studentId: ojt.student?.id || null, trainingTopic: ojt.trainingTopic || ojt.name },
            { resourceType: "OnJobTraining", resourceId: id, req }
        ).catch(err => console.error("logAudit(VIEW_ON_JOB_TRAINING) failed:", err.message));

        res.status(200).json({
            success: true,
            data: ojt
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Detect this server's LAN IPv4 address, so share links work from other
 *          devices on the network instead of a "localhost" address only the host machine can reach.
 * @route   GET /api/on-job-training/lan-ip
 * @access  Private
 */
export const getServerLanIp = (req, res) => {
    const interfaces = os.networkInterfaces();
    let lanIp = null;

    for (const ifaceList of Object.values(interfaces)) {
        const match = ifaceList.find((iface) => iface.family === "IPv4" && !iface.internal);
        if (match) {
            lanIp = match.address;
            break;
        }
    }

    res.status(200).json({ success: true, data: { lanIp } });
};

/**
 * @desc    Get a single On Job Training record by its public share token (read-only sharing)
 * @route   GET /api/on-job-training/public/:token
 * @access  Public
 */
export const getOnJobTrainingByShareToken = async (req, res, next) => {
    try {
        const { token } = req.params;

        const [rows] = await executeQuery(`
            SELECT ojt.*,
                   d.name as deptName,
                   s.name as sectionName,
                   l.name as lineName,
                   ss.name as subSectionName,
                   m.name as machineName, m.name as machineDisplayName,
                   u.fullName as studentName, u.email as studentEmail, u.avatar as studentAvatar,
                   uc.fullName as creatorName,
                   uu.fullName as approverName
            FROM on_job_trainings ojt
            LEFT JOIN departments d ON ojt.department = CAST(d.id AS NVARCHAR(50)) OR ojt.department = d.name
            LEFT JOIN sections s ON ojt.section = CAST(s.id AS NVARCHAR(50)) OR ojt.section = s.name
            LEFT JOIN [lines] l ON ojt.line = CAST(l.id AS NVARCHAR(50)) OR ojt.line = l.name
            LEFT JOIN [sub_sections] ss ON ojt.subSection = CAST(ss.id AS NVARCHAR(50)) OR ojt.subSection = ss.name
            LEFT JOIN machines m ON ojt.machine = CAST(m.id AS NVARCHAR(50)) OR ojt.machine = m.name
            LEFT JOIN users u ON ojt.student = CAST(u.id AS NVARCHAR(50)) OR ojt.student = u.userName
            LEFT JOIN users uc ON CAST(ojt.createdBy AS NVARCHAR(50)) = CAST(uc.id AS NVARCHAR(50)) OR ojt.createdBy = uc.userName
            LEFT JOIN users uu ON CAST(ojt.updatedBy AS NVARCHAR(50)) = CAST(uu.id AS NVARCHAR(50)) OR ojt.updatedBy = uu.userName
            WHERE ojt.shareToken = ?
        `, [token]);

        if (rows.length === 0) {
            return next(new ApiError("Shared OJT link not found or expired", 404));
        }

        const ojt = rows[0];
        ojt.trainingDate = ojt.trainingDate instanceof Date ? formatLocalDate(ojt.trainingDate) : ojt.trainingDate;
        ojt.entries = parseJSON(ojt.entries, []);
        ojt.scoring = parseJSON(ojt.scoring, null);
        ojt.attendanceRecords = parseJSON(ojt.attendanceRecords, []);
        ojt.trainingLog = parseJSON(ojt.trainingLog, []);
        ojt.department = { id: ojt.department, name: ojt.deptName };
        ojt.section = ojt.section ? { id: ojt.section, name: ojt.sectionName } : null;
        ojt.line = ojt.line ? { id: ojt.line, name: ojt.lineName } : null;
        ojt.subSection = ojt.subSection ? { id: ojt.subSection, name: ojt.subSectionName } : null;
        ojt.machine = ojt.machine ? { id: ojt.machine, name: ojt.machineName, machineName: ojt.machineDisplayName } : null;
        ojt.student = ojt.student ? { id: ojt.student, fullName: ojt.studentName, email: ojt.studentEmail, avatar: ojt.studentAvatar } : null;
        ojt.creatorName = ojt.creatorName || null;
        ojt.approverName = ojt.approverName || null;

        const ojtId = ojt.id;
        delete ojt.id; delete ojt._id; delete ojt.shareToken;
        delete ojt.deptName; delete ojt.sectionName; delete ojt.lineName; delete ojt.subSectionName;
        delete ojt.machineName; delete ojt.machineDisplayName;
        delete ojt.studentName; delete ojt.studentEmail; delete ojt.studentAvatar;

        logAudit(null, "VIEW_ON_JOB_TRAINING_PUBLIC", { publicToken: token },
            { resourceType: "OnJobTraining", resourceId: ojtId, req }
        ).catch(err => console.error("logAudit(VIEW_ON_JOB_TRAINING_PUBLIC) failed:", err.message));

        res.status(200).json({
            success: true,
            data: ojt
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Get All On Job Trainings (with hierarchy filters)
 * @route   GET /api/v1/on-job-training
 * @access  Private (Admin, Trainer)
 */
export const getAllOnJobTrainings = async (req, res, next) => {
    try {
        const { departmentId, sectionId, lineId, subSectionId } = req.query;

        let queryStr = `
            SELECT ojt.*, 
                   d.name as deptName, 
                   s.name as sectionName,
                   l.name as lineName, 
                   ss.name as subSectionName,
                   m.name as machineName, m.name as machineDisplayName,
                   u.fullName as studentName, u.empId as studentEmpId,
                   uc.fullName as creatorName,
                   uu.fullName as approverName
            FROM on_job_trainings ojt
            LEFT JOIN departments d ON ojt.department = CAST(d.id AS NVARCHAR(50)) OR ojt.department = d.name
            LEFT JOIN sections s ON ojt.section = CAST(s.id AS NVARCHAR(50)) OR ojt.section = s.name
            LEFT JOIN [lines] l ON ojt.line = CAST(l.id AS NVARCHAR(50)) OR ojt.line = l.name
            LEFT JOIN [sub_sections] ss ON ojt.subSection = CAST(ss.id AS NVARCHAR(50)) OR ojt.subSection = ss.name
            LEFT JOIN machines m ON ojt.machine = CAST(m.id AS NVARCHAR(50)) OR ojt.machine = m.name
            LEFT JOIN users u ON ojt.student = CAST(u.id AS NVARCHAR(50)) OR ojt.student = u.userName
            LEFT JOIN users uc ON CAST(ojt.createdBy AS NVARCHAR(50)) = CAST(uc.id AS NVARCHAR(50)) OR ojt.createdBy = uc.userName
            LEFT JOIN users uu ON CAST(ojt.updatedBy AS NVARCHAR(50)) = CAST(uu.id AS NVARCHAR(50)) OR ojt.updatedBy = uu.userName
            WHERE 1=1
        `;
        const params = [];

        if (departmentId) {
            queryStr += " AND (ojt.department = ? OR d.id = ?)";
            params.push(departmentId, departmentId);
        }
        if (sectionId) {
            queryStr += " AND (ojt.section = ? OR s.id = ?)";
            params.push(sectionId, sectionId);
        }
        if (lineId) {
            queryStr += " AND (ojt.line = ? OR l.id = ?)";
            params.push(lineId, lineId);
        }
        if (subSectionId) {
            queryStr += " AND (ojt.subSection = ? OR ss.id = ?)";
            params.push(subSectionId, subSectionId);
        }

        queryStr += " ORDER BY ojt.createdAt DESC";

        const [ojts] = await executeQuery(queryStr, params);

        const formatted = ojts.map(ojt => {
            ojt.trainingDate = ojt.trainingDate instanceof Date ? formatLocalDate(ojt.trainingDate) : ojt.trainingDate;
            ojt.entries = parseJSON(ojt.entries, []);
            ojt.scoring = parseJSON(ojt.scoring, null);
            ojt.attendanceRecords = parseJSON(ojt.attendanceRecords, []);
            ojt.trainingLog = parseJSON(ojt.trainingLog, []);
            ojt.department = { id: ojt.department, name: ojt.deptName };
            ojt.section = ojt.section ? { id: ojt.section, name: ojt.sectionName } : null;
            ojt.line = ojt.line ? { id: ojt.line, name: ojt.lineName } : null;
            ojt.subSection = ojt.subSection ? { id: ojt.subSection, name: ojt.subSectionName } : null;
            ojt.machine = ojt.machine ? { id: ojt.machine, name: ojt.machineName, machineName: ojt.machineDisplayName } : null;
            ojt.student = ojt.student ? { id: ojt.student, fullName: ojt.studentName, empId: ojt.studentEmpId } : null;
            ojt.creatorName = ojt.creatorName || null;
            ojt.approverName = ojt.approverName || null;
            
            delete ojt.deptName; delete ojt.sectionName; delete ojt.lineName; delete ojt.subSectionName;
            delete ojt.machineName; delete ojt.machineDisplayName; delete ojt.studentName; delete ojt.studentEmpId;
            return ojt;
        });

        logAudit(req.user?.id, "VIEW_ON_JOB_TRAINING_LIST", { departmentId, sectionId, lineId, subSectionId, count: formatted.length },
            { resourceType: "OnJobTraining", req }
        ).catch(err => console.error("logAudit(VIEW_ON_JOB_TRAINING_LIST) failed:", err.message));

        res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Update OJT Record
 * @route   PATCH /api/v1/on-job-training/:id
 * @access  Private
 */
export const updateOnJobTraining = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { entries, scoring, totalMarks, totalMarksObtained, totalPercentage, result, remarks, remarkImage,
            areaLine, trainingDate, trainingGivenBy, trainingTopic, trainingStartTime, trainingEndTime, trainingDetail, attendanceRecords, trainingDetailImage, trainingLog
        } = req.body;

        console.log(`[DEBUG] Update OJT ${id} Payload:`, JSON.stringify(req.body, null, 2));

        const [rows] = await executeQuery("SELECT * FROM on_job_trainings WHERE id = ?", [id]);
        if (rows.length === 0) return next(new ApiError("OJT record not found", 404));

        let updateFields = [];
        let updateValues = [];

        if (entries !== undefined) { updateFields.push("entries = ?"); updateValues.push(JSON.stringify(entries)); }
        if (scoring !== undefined) { updateFields.push("scoring = ?"); updateValues.push(JSON.stringify(scoring)); }

        const parseNum = (val) => (val === "" || val === null || isNaN(val)) ? null : Number(val);

        if (totalMarks !== undefined) { updateFields.push("totalMarks = ?"); updateValues.push(parseNum(totalMarks)); }
        if (totalMarksObtained !== undefined) { updateFields.push("totalMarksObtained = ?"); updateValues.push(parseNum(totalMarksObtained)); }
        if (totalPercentage !== undefined) { updateFields.push("totalPercentage = ?"); updateValues.push(parseNum(totalPercentage)); }

        if (result !== undefined) { updateFields.push("result = ?"); updateValues.push(result); }
        if (remarks !== undefined) { updateFields.push("remarks = ?"); updateValues.push(remarks); }
        if (remarkImage !== undefined) { updateFields.push("remarkImage = ?"); updateValues.push(remarkImage); }

        // Training Record Fields
        if (areaLine !== undefined) { updateFields.push("areaLine = ?"); updateValues.push(areaLine); }
        if (trainingDate !== undefined) { updateFields.push("trainingDate = ?"); updateValues.push(trainingDate); }
        if (trainingGivenBy !== undefined) { updateFields.push("trainingGivenBy = ?"); updateValues.push(trainingGivenBy); }
        if (trainingTopic !== undefined) { updateFields.push("trainingTopic = ?"); updateValues.push(trainingTopic); }
        if (trainingStartTime !== undefined) { updateFields.push("trainingStartTime = ?"); updateValues.push(trainingStartTime); }
        if (trainingEndTime !== undefined) { updateFields.push("trainingEndTime = ?"); updateValues.push(trainingEndTime); }
        if (trainingDetail !== undefined) { updateFields.push("trainingDetail = ?"); updateValues.push(trainingDetail); }
        if (attendanceRecords !== undefined) { updateFields.push("attendanceRecords = ?"); updateValues.push(JSON.stringify(attendanceRecords)); }
        if (trainingDetailImage !== undefined) { updateFields.push("trainingDetailImage = ?"); updateValues.push(trainingDetailImage); }
        if (trainingLog !== undefined) { updateFields.push("trainingLog = ?"); updateValues.push(JSON.stringify(trainingLog)); }

        updateFields.push("updatedBy = ?"); updateValues.push(req.user.id);
        updateFields.push("updatedAt = GETDATE()");

        await executeQuery(
            `UPDATE on_job_trainings SET ${updateFields.join(', ')} WHERE id = ?`,
            [...updateValues, id]
        );

        // Fetch updated
        const [updatedRows] = await executeQuery("SELECT * FROM on_job_trainings WHERE id = ?", [id]);
        const updatedOJT = updatedRows[0];

        if (updatedOJT) {
            updatedOJT.trainingDate = updatedOJT.trainingDate instanceof Date ? formatLocalDate(updatedOJT.trainingDate) : updatedOJT.trainingDate;
            updatedOJT.entries = parseJSON(updatedOJT.entries, []);
            updatedOJT.scoring = parseJSON(updatedOJT.scoring, null);
            updatedOJT.attendanceRecords = parseJSON(updatedOJT.attendanceRecords, []);
            updatedOJT.trainingLog = parseJSON(updatedOJT.trainingLog, []);
        }

        // Sync Student's ojt badges array in user table to reflect the current state of this sheet.
        // Runs on every save (not just when `result` is in the payload) so that adding/removing
        // attendees on a reused sheet keeps everyone's badge in sync.
        if (updatedOJT) {
            const attendanceRecords = updatedOJT.attendanceRecords || [];
            const sheetApproved = updatedOJT.result === "Pass" || updatedOJT.result === "Approved";

            // Per-student approval map. The sheet's primary `student` (used by single-trainee
            // Evaluation sheets, which have no attendanceRecords) always follows the sheet-level
            // result — it's a 1-to-1 evaluation. Attendance-row trainees (group Record sheets)
            // are decoupled from the sheet-level result: each trainee's badge eligibility depends
            // solely on their own row's `result`, so approving the sheet under "Checked By" does
            // NOT grant badges to everyone listed — each trainee must be approved individually.
            const studentApprovalMap = new Map();
            if (updatedOJT.student) {
                studentApprovalMap.set(String(updatedOJT.student), sheetApproved);
            }

            const ecodes = attendanceRecords.map(r => r.ecode).filter(Boolean);
            if (ecodes.length > 0) {
                const placeholders = ecodes.map(() => "?").join(",");
                const [matchedUsers] = await executeQuery(
                    `SELECT id, empId, userName FROM users WHERE empId IN (${placeholders}) OR userName IN (${placeholders})`,
                    [...ecodes, ...ecodes]
                );
                matchedUsers.forEach(u => {
                    const row = attendanceRecords.find(r => r.ecode && (r.ecode === u.empId || r.ecode === u.userName));
                    if (!row) return;
                    const rowApproved = row.result === "Approved" || row.result === "Pass";
                    studentApprovalMap.set(String(u.id), rowApproved);
                });
            }

            const currentStudentIds = new Set(studentApprovalMap.keys());

            // Students who already carry this sheet's badge (covers students removed since the last save)
            const [previouslyLinkedUsers] = await executeQuery(
                `SELECT u.id FROM users u
                 CROSS APPLY OPENJSON(ISNULL(u.ojt, '[]')) WITH (ojtId INT '$.ojtId') AS item
                 WHERE item.ojtId = ?`,
                [Number(id)]
            );
            const previouslyLinkedIds = new Set(previouslyLinkedUsers.map(u => String(u.id)));

            const studentIdsToProcess = new Set([...currentStudentIds, ...previouslyLinkedIds]);

            for (const studentId of studentIdsToProcess) {
                try {
                    const shouldHaveBadge = studentApprovalMap.get(studentId) === true;

                    const [userRows] = await executeQuery("SELECT ojt, empId, userName FROM users WHERE id = ?", [studentId]);
                    if (userRows.length === 0) continue;

                    let ojtArray = [];
                    try {
                        ojtArray = JSON.parse(userRows[0].ojt || "[]");
                    } catch (e) {
                        ojtArray = [];
                    }
                    if (!Array.isArray(ojtArray)) ojtArray = [];

                    const existingIdx = ojtArray.findIndex(item => String(item.ojtId) === String(id));

                    if (shouldHaveBadge) {
                        // Use this student's own attendance row date as their approval date, so
                        // eligibility tracks whatever day the trainer recorded/edited for them —
                        // editing the row's date (or a fresh sheet) is how a trainer reopens
                        // same-day quiz eligibility on a later day.
                        const { empId: userEmpId, userName: userUserName } = userRows[0];
                        const studentRow = attendanceRecords.find(r =>
                            r.ecode && (r.ecode === userEmpId || r.ecode === userUserName)
                        );

                        let customApprovalDate = new Date();
                        if (studentRow?.date && !isNaN(new Date(studentRow.date).getTime())) {
                            customApprovalDate = new Date(studentRow.date);
                        } else if (updatedOJT.trainingDate && !isNaN(new Date(updatedOJT.trainingDate).getTime())) {
                            customApprovalDate = new Date(updatedOJT.trainingDate);
                        }

                        const newEntry = {
                            ojtId: Number(id),
                            subSectionId: updatedOJT.subSection,
                            departmentId: updatedOJT.department,
                            sectionId: updatedOJT.section,
                            lineId: updatedOJT.line,
                            result: studentRow?.result || updatedOJT.result,
                            approvedAt: customApprovalDate
                        };

                        if (existingIdx >= 0) {
                            ojtArray[existingIdx] = newEntry;
                        } else {
                            ojtArray.push(newEntry);
                        }
                    } else if (existingIdx >= 0) {
                        ojtArray.splice(existingIdx, 1);
                    } else {
                        continue;
                    }

                    await executeQuery("UPDATE users SET ojt = ? WHERE id = ?", [JSON.stringify(ojtArray), studentId]);
                    console.log(`[DEBUG] Synced OJT ${id} badge (present=${shouldHaveBadge}) to user ${studentId}'s ojt column.`);
                } catch (syncErr) {
                    console.error(`[ERROR] Failed to sync OJT ${id} badge to user ${studentId}:`, syncErr.message);
                }
            }
        }

        // --- EMAIL NOTIFICATION TRIGGER ---
        const isEvaluation = entries !== undefined || scoring !== undefined;
        const isRecord = attendanceRecords !== undefined;
        
        const sendEmailVal = req.body.sendEmail;
        const submitVal = req.body.submit;
        const shouldSendEmail = (sendEmailVal === true || sendEmailVal === 'true') || 
                                (submitVal === true || submitVal === 'true');

        console.log(`[DEBUG] OJT Email Trigger Evaluation:`, {
            isEvaluation,
            isRecord,
            sendEmailVal,
            sendEmailType: typeof sendEmailVal,
            submitVal,
            submitType: typeof submitVal,
            shouldSendEmail
        });

        if (shouldSendEmail) {
            if (isEvaluation) {
                NotificationService.sendFormReport("On Job Training Evaluation Sheet", rows[0].department, { ...req.body, ojtId: id })
                    .catch(err => console.error("[OJT Eval] Notification failed:", err));
            }

            if (isRecord) {
                NotificationService.sendFormReport("On Job Training Record Sheet", rows[0].department, { ...req.body, ojtId: id })
                    .catch(err => console.error("[OJT Record] Notification failed:", err));
            }
        }
        // ----------------------------------

        logAudit(req.user?.id, "UPDATE_ON_JOB_TRAINING", { ojtId: id, totalMarksObtained, result, remarks },
            { resourceType: "OnJobTraining", resourceId: id, req }
        ).catch(err => console.error("logAudit(UPDATE_ON_JOB_TRAINING) failed:", err.message));

        res.status(200).json({
            success: true,
            message: "OJT updated successfully",
            data: updatedOJT
        });

    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Delete OJT Record
 * @route   DELETE /api/v1/on-job-training/:id
 * @access  Private (Admin, Instructor)
 */
export const deleteOnJobTraining = async (req, res, next) => {
    try {
        const { id } = req.params;

        const [rows] = await executeQuery("SELECT * FROM on_job_trainings WHERE id = ?", [id]);
        if (rows.length === 0) return next(new ApiError("OJT record not found", 404));

        await executeQuery("DELETE FROM on_job_trainings WHERE id = ?", [id]);

        logAudit(req.user?.id, "DELETE_ON_JOB_TRAINING", { id },
            { resourceType: "OnJobTraining", resourceId: id, req }
        ).catch(err => console.error("logAudit(DELETE_ON_JOB_TRAINING) failed:", err.message));

        res.status(200).json({
            success: true,
            message: "OJT record deleted successfully"
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

