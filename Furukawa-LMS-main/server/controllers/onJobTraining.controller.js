import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";

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
        const { studentId, departmentId, lineId, machineId, name } = req.body;

        if (!studentId || !departmentId || !lineId || !machineId) {
            return next(new ApiError("All fields (Student, Department, Line, Machine) are required", 400));
        }

        // Validate Student (ID or Username)
        // Check if studentId matches ID format or treat as username
        const [users] = await executeQuery("SELECT id FROM users WHERE CAST(id AS NVARCHAR(50)) = ? OR userName = ?", [studentId, studentId]);
        if (users.length === 0) return next(new ApiError("Student not found", 404));
        const userId = users[0].id;

        // Verify Dept, Line, Machine existence
        // (Optional strict check, or allow FK constraint to fail if not exists. Explicit is better for user feedback)
        const [depts] = await executeQuery("SELECT id FROM departments WHERE id = ?", [departmentId]);
        if (depts.length === 0) return next(new ApiError("Department not found", 404));

        const [lines] = await executeQuery("SELECT id FROM [lines] WHERE id = ?", [lineId]);
        if (lines.length === 0) return next(new ApiError("Line not found", 404));

        const [machines] = await executeQuery("SELECT id FROM machines WHERE id = ?", [machineId]);
        if (machines.length === 0) return next(new ApiError("Machine not found", 404));

        const ojtName = name || "Level-1 Practical Evaluation of On the Job Training";

        const [insertRows] = await executeQuery(
            `INSERT INTO on_job_trainings 
            (student, name, department, line, machine, createdBy, updatedBy, entries, result, createdAt, updatedAt)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
            [userId, ojtName, departmentId, lineId, machineId, req.user.id, req.user.id, JSON.stringify([]), "Pending"]
        );

        const insertedId = insertRows[0]?.id;

        // Fetch created OJT with populated names
        const [rows] = await executeQuery(`
            SELECT ojt.*, 
                   d.name as deptName, 
                   l.name as lineName, 
                   m.name as machineName, m.name as machineDisplayName
            FROM on_job_trainings ojt
            LEFT JOIN departments d ON ojt.department = CAST(d.id AS NVARCHAR(50)) OR ojt.department = d.name
            LEFT JOIN [lines] l ON ojt.line = CAST(l.id AS NVARCHAR(50)) OR ojt.line = l.name
            LEFT JOIN machines m ON ojt.machine = CAST(m.id AS NVARCHAR(50)) OR ojt.machine = m.name
            WHERE ojt.id = ?
        `, [insertedId]);

        const ojt = rows[0];
        if (ojt) {
            ojt.entries = parseJSON(ojt.entries, []);
            ojt.scoring = parseJSON(ojt.scoring, null);
            ojt.department = { id: ojt.department, name: ojt.deptName };
            ojt.line = { id: ojt.line, name: ojt.lineName };
            // Original used `name` AND `machineName` (or similar). machineDisplayName maps to `m.machineName` if that column existed.
            // Using standard approach based on previous controllers:
            ojt.machine = { id: ojt.machine, name: ojt.machineName, machineName: ojt.machineDisplayName };

            delete ojt.deptName; delete ojt.lineName; delete ojt.machineName; delete ojt.machineDisplayName;
        }

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
        const [users] = await executeQuery("SELECT id FROM users WHERE CAST(id AS NVARCHAR(50)) = ? OR userName = ?", [studentId, studentId]);
        if (users.length === 0) return next(new ApiError("Student not found", 404));
        const userId = users[0].id;

        const [ojts] = await executeQuery(`
            SELECT ojt.*, 
                   d.name as deptName, 
                   l.name as lineName, 
                   m.name as machineName, m.name as machineDisplayName
            FROM on_job_trainings ojt
            LEFT JOIN departments d ON ojt.department = CAST(d.id AS NVARCHAR(50)) OR ojt.department = d.name
            LEFT JOIN [lines] l ON ojt.line = CAST(l.id AS NVARCHAR(50)) OR ojt.line = l.name
            LEFT JOIN machines m ON ojt.machine = CAST(m.id AS NVARCHAR(50)) OR ojt.machine = m.name
            WHERE ojt.student = ?
            ORDER BY ojt.createdAt DESC
        `, [userId]);

        const formatted = ojts.map(ojt => {
            ojt.entries = parseJSON(ojt.entries, []);
            ojt.scoring = parseJSON(ojt.scoring, null);
            ojt.department = { id: ojt.department, name: ojt.deptName };
            ojt.line = { id: ojt.line, name: ojt.lineName };
            ojt.machine = { id: ojt.machine, name: ojt.machineName, machineName: ojt.machineDisplayName };
            delete ojt.deptName; delete ojt.lineName; delete ojt.machineName; delete ojt.machineDisplayName;
            return ojt;
        });

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
                   l.name as lineName, 
                   m.name as machineName, m.name as machineDisplayName,
                   u.fullName as studentName, u.email as studentEmail, u.avatar as studentAvatar
            FROM on_job_trainings ojt
            LEFT JOIN departments d ON ojt.department = CAST(d.id AS NVARCHAR(50)) OR ojt.department = d.name
            LEFT JOIN [lines] l ON ojt.line = CAST(l.id AS NVARCHAR(50)) OR ojt.line = l.name
            LEFT JOIN machines m ON ojt.machine = CAST(m.id AS NVARCHAR(50)) OR ojt.machine = m.name
            LEFT JOIN users u ON ojt.student = CAST(u.id AS NVARCHAR(50)) OR ojt.student = u.userName
            WHERE ojt.id = ?
        `, [id]);

        if (rows.length === 0) {
            return next(new ApiError("OJT record not found", 404));
        }

        const ojt = rows[0];
        ojt.entries = parseJSON(ojt.entries, []);
        ojt.entries = parseJSON(ojt.entries, []);
        ojt.scoring = parseJSON(ojt.scoring, null);
        ojt.attendanceRecords = parseJSON(ojt.attendanceRecords, []);
        ojt.department = { id: ojt.department, name: ojt.deptName };
        ojt.line = { id: ojt.line, name: ojt.lineName };
        ojt.machine = { id: ojt.machine, name: ojt.machineName, machineName: ojt.machineDisplayName };
        ojt.student = { id: ojt.student, fullName: ojt.studentName, email: ojt.studentEmail, avatar: ojt.studentAvatar };

        delete ojt.deptName; delete ojt.lineName; delete ojt.machineName; delete ojt.machineDisplayName;
        delete ojt.studentName; delete ojt.studentEmail; delete ojt.studentAvatar;

        res.status(200).json({
            success: true,
            data: ojt
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
            areaLine, trainingDate, trainingGivenBy, trainingTopic, trainingStartTime, trainingEndTime, trainingDetail, attendanceRecords, trainingDetailImage
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
            updatedOJT.entries = parseJSON(updatedOJT.entries, []);
            updatedOJT.entries = parseJSON(updatedOJT.entries, []);
            updatedOJT.scoring = parseJSON(updatedOJT.scoring, null);
            updatedOJT.attendanceRecords = parseJSON(updatedOJT.attendanceRecords, []);
        }

        // --- EMAIL NOTIFICATION TRIGGER ---
        const isEvaluation = entries !== undefined || scoring !== undefined;
        const isRecord = attendanceRecords !== undefined;

        if (isEvaluation) {
            NotificationService.sendFormReport("On Job Training Evaluation Sheet", rows[0].department, req.body)
                .catch(err => console.error("[OJT Eval] Notification failed:", err));
        }

        if (isRecord) {
            NotificationService.sendFormReport("On Job Training Record Sheet", rows[0].department, req.body)
                .catch(err => console.error("[OJT Record] Notification failed:", err));
        }
        // ----------------------------------

        res.status(200).json({
            success: true,
            message: "OJT updated successfully",
            data: updatedOJT
        });

    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};
