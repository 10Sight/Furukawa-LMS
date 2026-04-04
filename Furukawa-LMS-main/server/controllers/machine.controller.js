import { executeQuery } from "../db/mssqlHelper.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Create a new machine (Station)
// @route   POST /api/machines
// @access  Private
export const createMachine = asyncHandler(async (req, res) => {
    const { name, lineId, subSectionId, description } = req.body;

    if (!name || !lineId || !subSectionId) {
        throw new ApiError(400, "Name, Line ID, and Sub-Section ID are required");
    }

    if (isNaN(lineId) || isNaN(subSectionId)) {
        throw new ApiError(400, "Invalid Line or Sub-Section ID parameter. Must be numeric.");
    }

    // Check if line exists
    const [lines] = await executeQuery("SELECT id FROM [lines] WHERE id = ?", [lineId]);
    if (lines.length === 0) {
        throw new ApiError(404, "Line not found");
    }

    // Check if sub-section exists
    const [subSections] = await executeQuery("SELECT id FROM [sub_sections] WHERE id = ?", [subSectionId]);
    if (subSections.length === 0) {
        throw new ApiError(404, "Sub-Section not found");
    }

    // Insert
    const [result] = await executeQuery(
        "INSERT INTO machines (name, line, subSectionId, description, isActive, createdAt, updatedAt) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE())",
        [name, lineId, subSectionId, description, true]
    );

    const [newMachine] = await executeQuery(`
        SELECT m.*, 
        (SELECT COUNT(DISTINCT ma.user_id) FROM machine_assignments ma WHERE ma.machine_id = m.id) as machineCount
        FROM machines m WHERE m.id = ?`, [result[0].id]);

    res.status(201).json(
        new ApiResponse(201, newMachine[0], "Station created successfully")
    );
});

// @desc    Get all machines for a sub-section
// @route   GET /api/machines/sub-section/:subSectionId
// @access  Private
export const getMachinesBySubSection = asyncHandler(async (req, res) => {
    const { subSectionId } = req.params;

    if (isNaN(subSectionId)) {
        throw new ApiError(400, "Invalid Sub-Section ID parameter. Must be numeric.");
    }

    const [machines] = await executeQuery(`
        SELECT m.*, 
        (SELECT COUNT(DISTINCT ma.user_id) FROM machine_assignments ma WHERE ma.machine_id = m.id) as machineCount
        FROM machines m WHERE m.subSectionId = ? ORDER BY m.createdAt DESC`, [subSectionId]);

    res.status(200).json(
        new ApiResponse(200, machines, "Stations fetched successfully")
    );
});

// @desc    Get all machines for a line (Backward Compatibility)
// @route   GET /api/machines/line/:lineId
// @access  Private
export const getMachinesByLine = asyncHandler(async (req, res) => {
    const { lineId } = req.params;

    if (isNaN(lineId)) {
        throw new ApiError(400, "Invalid Line ID parameter. Must be numeric.");
    }

    const [machines] = await executeQuery(`
        SELECT m.*, ss.name as subSectionName,
        (SELECT COUNT(DISTINCT ma.user_id) FROM machine_assignments ma WHERE ma.machine_id = m.id) as machineCount
        FROM machines m
        LEFT JOIN sub_sections ss ON m.subSectionId = ss.id
        WHERE m.line = ? 
        ORDER BY m.createdAt DESC
    `, [lineId]);

    res.status(200).json(
        new ApiResponse(200, machines, "Machines fetched successfully")
    );
});

// @desc    Get all machines for a section
// @route   GET /api/machines/section/:sectionId
// @access  Private
export const getMachinesBySection = asyncHandler(async (req, res) => {
    const { sectionId } = req.params;

    if (isNaN(sectionId)) {
        throw new ApiError(400, "Invalid Section ID parameter. Must be numeric.");
    }

    const [machines] = await executeQuery(`
        SELECT m.*, l.name as lineName, ss.name as subSectionName,
        (SELECT COUNT(DISTINCT ma.user_id) FROM machine_assignments ma WHERE ma.machine_id = m.id) as machineCount
        FROM machines m
        JOIN [lines] l ON m.line = l.id
        LEFT JOIN sub_sections ss ON m.subSectionId = ss.id
        WHERE l.sectionId = ? 
        ORDER BY l.name ASC, ss.name ASC, m.name ASC
    `, [sectionId]);

    res.status(200).json(
        new ApiResponse(200, machines, "Section machines fetched successfully")
    );
});

// @desc    Get all machines for a department
// @route   GET /api/machines/department/:departmentId
// @access  Private
export const getMachinesByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;

    if (isNaN(departmentId)) {
        throw new ApiError(400, "Invalid Department ID parameter. Must be numeric.");
    }

    const [machines] = await executeQuery(`
        SELECT m.*, l.name as lineName, ss.name as subSectionName,
        (SELECT COUNT(DISTINCT ma.user_id) FROM machine_assignments ma WHERE ma.machine_id = m.id) as machineCount
        FROM machines m
        JOIN [lines] l ON m.line = l.id
        LEFT JOIN sub_sections ss ON m.subSectionId = ss.id
        WHERE l.department = ? 
        ORDER BY l.name ASC, ss.name ASC, m.name ASC
    `, [departmentId]);

    res.status(200).json(
        new ApiResponse(200, machines, "Department machines fetched successfully")
    );
});

// @desc    Update a machine
// @route   PUT /api/machines/:id
// @access  Private
export const updateMachine = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid Machine ID parameter. Must be numeric.");
    }

    const [existing] = await executeQuery("SELECT * FROM machines WHERE id = ?", [id]);
    if (existing.length === 0) {
        throw new ApiError(404, "Machine not found");
    }
    const machine = existing[0];

    let updateFields = [];
    let updateValues = [];

    if (typeof name !== 'undefined') { updateFields.push("name = ?"); updateValues.push(name); }

    if (typeof description !== 'undefined') { updateFields.push("description = ?"); updateValues.push(description); }
    if (typeof isActive !== 'undefined') { updateFields.push("isActive = ?"); updateValues.push(isActive); }

    if (updateFields.length > 0) {
        updateFields.push("updatedAt = GETDATE()");
        await executeQuery(`UPDATE machines SET ${updateFields.join(', ')} WHERE id = ?`, [...updateValues, id]);
    }

    const [updatedMachine] = await executeQuery(`
        SELECT m.*, 
        (SELECT COUNT(DISTINCT ma.user_id) FROM machine_assignments ma WHERE ma.machine_id = m.id) as machineCount
        FROM machines m WHERE m.id = ?`, [id]);

    res.status(200).json(
        new ApiResponse(200, updatedMachine[0], "Machine updated successfully")
    );
});

// @desc    Delete a machine
// @route   DELETE /api/machines/:id
// @access  Private
export const deleteMachine = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid Machine ID parameter. Must be numeric.");
    }

    const [result, metadata] = await executeQuery("DELETE FROM machines WHERE id = ?", [id]);

    if (metadata.affectedRows === 0) {
        throw new ApiError(404, "Machine not found");
    }

    res.status(200).json(
        new ApiResponse(200, {}, "Machine deleted successfully")
    );
});

// @desc    Get machine by ID
// @route   GET /api/machines/:id
// @access  Private
export const getMachineById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid Machine ID parameter. Must be numeric.");
    }

    const [machines] = await executeQuery(`
        SELECT m.*, 
        (SELECT COUNT(DISTINCT ma.user_id) FROM machine_assignments ma WHERE ma.machine_id = m.id) as machineCount
        FROM machines m WHERE m.id = ?`, [id]);

    if (machines.length === 0) {
        throw new ApiError(404, "Machine not found");
    }

    res.status(200).json(
        new ApiResponse(200, machines[0], "Machine fetched successfully")
    );
});

// @desc    Assign an employee to a machine
// @route   POST /api/machines/:id/employees
// @access  Private (Admin, Trainer)
export const assignEmployee = asyncHandler(async (req, res) => {
    const { id: machineId } = req.params;
    const { userId } = req.body;
    const assignedBy = req.user.id; // User ID from verifyJWT

    if (!userId) {
        throw new ApiError("User ID is required", 400);
    }

    if (isNaN(machineId) || isNaN(userId)) {
        throw new ApiError(400, "Invalid Machine or User ID parameter. Must be numeric.");
    }

    // 1. Get Machine and its Line
    const [machines] = await executeQuery("SELECT * FROM machines WHERE id = ?", [machineId]);
    if (machines.length === 0) {
        throw new ApiError("Machine not found", 404);
    }
    const machine = machines[0];

    // 2. Get Line details (to find Department)
    const [lines] = await executeQuery("SELECT * FROM [lines] WHERE id = ?", [machine.line]);
    if (lines.length === 0) {
        throw new ApiError("Line associated with this machine not found", 404);
    }
    const line = lines[0];

    // 3. Get User details
    const [users] = await executeQuery("SELECT * FROM users WHERE id = ?", [userId]);
    if (users.length === 0) {
        throw new ApiError("User not found", 404);
    }
    const user = users[0];

    // 4. Verify Department match
    let isDepartmentMatch = false;

    // Debugging logs
    console.log(`[MachineAssignment] Match Check: UserDept=${user.department} vs LineDept=${line.department}`);

    if (String(user.department) === String(line.department)) {
        isDepartmentMatch = true;
    } else {
        // Fallback: check 'departments' array if it exists
        try {
            const userDepts = JSON.parse(user.departments || '[]');
            if (Array.isArray(userDepts)) {
                if (userDepts.some(d => String(d) === String(line.department))) {
                    isDepartmentMatch = true;
                }
            }
        } catch (e) {
            // ignore parse error
        }
    }

    if (!isDepartmentMatch) {
        // Fallback 2: Check Department's student list directly (Source of Truth)
        try {
            const [deptRows] = await executeQuery("SELECT students FROM departments WHERE id = ?", [line.department]);
            if (deptRows.length > 0 && deptRows[0].students) {
                const deptStudents = JSON.parse(deptRows[0].students || '[]');
                if (Array.isArray(deptStudents) && (deptStudents.includes(userId) || deptStudents.includes(String(userId)))) {
                    console.log(`[MachineAssignment] Match Found via Department.students list`);
                    isDepartmentMatch = true;
                }
            }
        } catch (e) {
            console.error("Error checking department students list:", e);
        }
    }

    if (!isDepartmentMatch) {
        // Fallback 3: Special departments (Maintenance, Utility, etc.)
        const globalDepts = ['maintenance', 'utility', 'quality', 'admin', 'hr', 'src'];
        if (user.department && globalDepts.includes(user.department.toLowerCase())) {
            console.log(`[MachineAssignment] Match Found via Global Department: ${user.department}`);
            isDepartmentMatch = true;
        }
    }

    if (!isDepartmentMatch) {
        throw new ApiError(`Employee dept (${user.department}) does not match Machine Line dept (${line.department}). User Depts: ${user.departments}`, 400);
    }

    // 5. Assign and Sync Hierarchy
    try {
        // First, check if assignment already exists to avoid PK violation (though we have a catch below, check is cleaner)
        const [existingAssign] = await executeQuery(
            "SELECT id FROM machine_assignments WHERE machine_id = ? AND user_id = ?",
            [machineId, userId]
        );

        if (existingAssign.length === 0) {
            await executeQuery(
                "INSERT INTO machine_assignments (machine_id, user_id, assigned_by) VALUES (?, ?, ?)",
                [machineId, userId, assignedBy]
            );
        }

        // Now Sync Hierarchy back to User record so "Operator Flow" works
        // We need department name
        const [depts] = await executeQuery("SELECT name FROM departments WHERE id = ?", [line.department]);
        const departmentName = depts[0]?.name;

        // We also need sub-section name for legacy 'sub_section' field
        const [subSections] = await executeQuery("SELECT name FROM sub_sections WHERE id = ?", [machine.subSectionId]);
        const subSectionName = subSections[0]?.name;

        console.log(`[MachineAssignment] SYNCING User=${userId} -> Dept=${line.department}(${departmentName}), Sect=${line.sectionId}, Line=${line.id}, SubSect=${machine.subSectionId}(${subSectionName}), Station=${machine.id}`);

        const updateResult = await executeQuery(`
            UPDATE users 
            SET departmentId = ?, 
                department = ?, 
                sectionId = ?, 
                lineId = ?, 
                subSectionId = ?, 
                stationId = ?,
                sub_section = ?
            WHERE id = ?
        `, [
            line.department, 
            departmentName || null, 
            line.sectionId, 
            line.id, 
            machine.subSectionId, 
            machine.id, 
            subSectionName || null,
            userId
        ]);
        console.log(`[MachineAssignment] Update result:`, updateResult);

    } catch (error) {
        if (error.number === 2627 || error.number === 2601) {
            throw new ApiError("Employee is already assigned to this machine", 400);
        }
        throw error;
    }

    res.status(200).json(
        new ApiResponse(200, {}, "Employee assigned to machine successfully and hierarchy updated")
    );
});

// @desc    Remove an employee from a machine
// @route   DELETE /api/machines/:id/employees/:userId
// @access  Private (Admin, Trainer)
export const removeEmployee = asyncHandler(async (req, res) => {
    const { id: machineId, userId } = req.params;

    if (isNaN(machineId) || isNaN(userId)) {
        throw new ApiError(400, "Invalid Machine or User ID parameter. Must be numeric.");
    }

    const [result, metadata] = await executeQuery(
        "DELETE FROM machine_assignments WHERE machine_id = ? AND user_id = ?",
        [machineId, userId]
    );

    if (metadata.affectedRows === 0) {
        throw new ApiError("Assignment not found", 404);
    }

    // Sync back to User record - clear stationId
    try {
        await executeQuery(
            "UPDATE users SET stationId = NULL WHERE id = ? AND stationId = ?",
            [userId, machineId]
        );
    } catch (error) {
        console.error("Error clearing user stationId:", error);
    }

    res.status(200).json(
        new ApiResponse(200, {}, "Employee removed from machine successfully")
    );
});

// @desc    Get employees assigned to a machine
// @route   GET /api/machines/:id/employees
// @access  Private
export const getMachineEmployees = asyncHandler(async (req, res) => {
    const { id: machineId } = req.params;

    if (isNaN(machineId)) {
        throw new ApiError(400, "Invalid Machine ID parameter. Must be numeric.");
    }

    // Join with users table to get details
    const query = `
        SELECT u.id, u.fullName, u.email, u.empId, u.avatar, ma.assigned_at
        FROM machine_assignments ma
        JOIN users u ON ma.user_id = u.id
        WHERE ma.machine_id = ?
    `;

    const [employees] = await executeQuery(query, [machineId]);

    // Parse avatar if needed
    const formattedEmployees = employees.map(emp => ({
        ...emp,
        avatar: typeof emp.avatar === 'string' ? JSON.parse(emp.avatar) : emp.avatar
    }));

    res.status(200).json(
        new ApiResponse(200, formattedEmployees, "Machine employees fetched successfully")
    );
});
