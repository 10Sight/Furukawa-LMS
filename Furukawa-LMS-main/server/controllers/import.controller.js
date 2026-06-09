import XLSX from "xlsx";
import { executeQuery } from "../db/mssqlHelper.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import bcrypt from "bcryptjs";
import User from "../models/auth.model.js";

/**
 * Robust date normalization to YYYY-MM-DD
 */
const normalizeDate = (val) => {
    if (!val) return null;
    
    let d;
    if (val instanceof Date) {
        d = val;
    } else {
        d = new Date(val);
    }

    if (isNaN(d.getTime())) return null;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Helper to sync user ID to department's students array
 * Ensures the operator is removed from old departments if they are reassigned
 */
const syncDepartmentStudents = async (userId, departmentId) => {
    if (!userId) return;
    
    try {
        // 1. Remove user from all other departments first to ensure consistency
        // (Current requirement is one department per operator)
        const [allDeptsWithUser] = await executeQuery(
            "SELECT id, students FROM departments WHERE students IS NOT NULL AND students != '[]'"
        );

        for (const dept of allDeptsWithUser) {
            let students = [];
            try {
                students = JSON.parse(dept.students || "[]");
            } catch (e) { students = []; }

            if (Array.isArray(students) && (students.includes(userId) || students.includes(String(userId)))) {
                // If it's not the current target department, remove the user
                if (String(dept.id) !== String(departmentId)) {
                    const updatedStudents = students.filter(id => String(id) !== String(userId));
                    await executeQuery(
                        "UPDATE departments SET students = ? WHERE id = ?",
                        [JSON.stringify(updatedStudents), dept.id]
                    );
                }
            }
        }

        // 2. Add user to the new department if provided
        if (departmentId) {
            const [deptRows] = await executeQuery("SELECT id, students FROM departments WHERE id = ?", [departmentId]);
            if (deptRows.length > 0) {
                let students = [];
                try {
                    students = JSON.parse(deptRows[0].students || "[]");
                } catch (e) { students = []; }

                if (!Array.isArray(students)) students = [];

                if (!students.includes(userId) && !students.includes(String(userId))) {
                    students.push(userId);
                    await executeQuery(
                        "UPDATE departments SET students = ? WHERE id = ?",
                        [JSON.stringify(students), departmentId]
                    );
                }
            }
        }
    } catch (error) {
        console.error(`Error syncing user ${userId} to department ${departmentId}:`, error);
    }
};

/**
 * Internal helper to generate next temporary ID for DOJO candidates
 */
const generateNextTempId = async (prefix) => {
    const cleanPrefix = prefix.replace(/-/g, '').replace(/\s/g, '');
    const [rows] = await executeQuery(`
        SELECT TOP 1 empId FROM users 
        WHERE empId LIKE ? AND isTemporary = 1
        ORDER BY createdAt DESC
    `, [`${cleanPrefix}%`]);

    let nextSeq = 1;
    let randomPart = Math.floor(100 + Math.random() * 900); // 3-digit random

    if (rows && rows.length > 0) {
        const lastId = rows[0].empId;
        // Try to extract existing sequence (last 3 digits)
        const seqMatch = lastId.match(/(\d{3})$/);
        if (seqMatch) {
            nextSeq = parseInt(seqMatch[1]) + 1;
        }
        
        // Try to keep the same random part for same prefix to maintain structure
        const randMatch = lastId.match(/(\d{3})\d{3}$/);
        if (randMatch) {
            randomPart = randMatch[1];
        }
    }

    const formattedSeq = String(nextSeq).padStart(3, '0');
    return `${cleanPrefix}${randomPart}${formattedSeq}`;
};

/**
 * Normalize status values from Excel to canonical DB values (PRESENT / LEFT / ON-LEAVE)
 */
const normalizeStatus = (val) => {
    if (!val) return "PRESENT";
    const v = val.toString().trim().toUpperCase().replace(/[\s\-_]+/g, '');
    if (v === "LEFT" || v === "LEAVING" || v === "RESIGNED" || v === "TERMINATED") return "LEFT";
    if (v === "ONLEAVE" || v === "LEAVE") return "ON-LEAVE";
    return "PRESENT";
};

/**
 * Import employees from Excel file
 * Expected columns: EmployeeID, CardNo, Name, Father/HusbandName, Gender, Department, Section, Line, Sub Section, Station No., Mentor, Designation, D.O.B., D.O.J., Education, District, State, PIN, Bus Route, E-Mail ID, Mobile No., L, Date of Leaving, Reason of Leaving, Status
 */
export const importEmployees = async (req, res) => {
    try {
        if (!req.file) {
            throw new ApiError(400, "No file uploaded");
        }

        // Read the worksheet as a 2D array to find the header row
        // Use cellDates: true to handle Excel date objects properly
        const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });
        let hRowIndex = -1;
        
        // Find the header row (look for "EmployeeID" or "Employee Code")
        for (let i = 0; i < Math.min(allRows.length, 15); i++) {
            const row = allRows[i];
            if (row && Array.isArray(row) && row.some(cell => {
                if (!cell) return false;
                const c = cell.toString().trim().toLowerCase();
                return c === "employeeid" || c === "employee code" || c === "employee id";
            })) {
                hRowIndex = i;
                break;
            }
        }

        if (hRowIndex === -1) {
            hRowIndex = 0; // Fallback to first row
        }

        const headers = allRows[hRowIndex].map(h => h?.toString().trim() || "");
        const rawData = allRows.slice(hRowIndex + 1);

        // Convert 2D array to array of objects
        const data = rawData.map(r => {
            const obj = {};
            headers.forEach((h, idx) => {
                const key = h || `__EMPTY_${idx}`;
                obj[key] = r[idx];
            });
            return obj;
        });

        if (!data || data.length === 0) {
            throw new ApiError(400, "No data found in Excel file");
        }

        const headerRowIndex = hRowIndex; // For rowNumber calculation compatibility

        // Fetch all hierarchy mappings for lookup (Pre-fetch for matching as explained to user)
        const [allDepts] = await executeQuery("SELECT id, name FROM departments WHERE isDeleted = 0");
        const [allSections] = await executeQuery("SELECT id, name, departmentId, category FROM sections WHERE isActive = 1");
        const [allLines] = await executeQuery("SELECT id, name, sectionId FROM [lines] WHERE isActive = 1");
        const [allSubSections] = await executeQuery("SELECT id, name, lineId FROM sub_sections WHERE isActive = 1");
        const [allStations] = await executeQuery("SELECT id, name, subSectionId FROM machines WHERE isActive = 1");

        const deptMap = new Map(allDepts.map(d => [d.name.toLowerCase().trim(), d.id]));
        
        const sectionMap = new Map();
        allSections.forEach(s => {
            const name = s.name.toLowerCase().trim();
            const deptId = s.departmentId;
            const category = (s.category || "").toLowerCase().trim();
            // Store standard name
            sectionMap.set(`${deptId}|${name}`, s.id);
            // Store name with category suffix if applicable (e.g. "Assembly - Direct")
            if (category && category !== "not applicable") {
                sectionMap.set(`${deptId}|${name} - ${category}`, s.id);
            }
        });

        // New Hierarchical Station Map: sectionId|stationName -> { stationId, subSectionId, lineId }
        const sectionStationMap = new Map();
        allStations.forEach(st => {
            const subSection = allSubSections.find(ss => ss.id === st.subSectionId);
            if (subSection) {
                const line = allLines.find(l => l.id === subSection.lineId);
                if (line) {
                    const sectionId = line.sectionId;
                    const key = `${sectionId}|${st.name.toLowerCase().trim()}`;
                    sectionStationMap.set(key, {
                        stationId: st.id,
                        subSectionId: st.subSectionId,
                        lineId: line.id
                    });
                }
            }
        });

        const results = {
            success: [],
            failed: [],
            total: data.length,
            updatedCount: 0
        };

        // Create Import Log entry
        const [logResult] = await executeQuery(
            "INSERT INTO import_logs (fileName, importType, totalRows, importedBy) OUTPUT INSERTED.id VALUES (?, ?, ?, ?)",
            [req.file.originalname, "OPERATOR", data.length, req.user?.id || null]
        );
        const logId = logResult[0].id;

        // Process each row
        const hIndex = headerRowIndex === -1 ? 0 : headerRowIndex;
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = hIndex + i + 2; // Excel row number (1-indexed + header)

            try {
                // Map Excel headers to internal names for validation and processing
                const normalizedRow = {
                    empId: (row["EmployeeID"] || row["Employee Code"] || row["Employee ID"])?.toString().trim(),
                    idCard: (row["CardNo"] || row["Card No."] || row["Card No"])?.toString().trim(),
                    fullName: (row["Name"] || row["Full Name"])?.toString().trim(),
                    fatherHusbandName: (row["Father/HusbandName"] || row["Father / Husband Name"])?.toString().trim(),
                    gender: (row["Gender"] || row["Gender "])?.toString().trim(),
                    department: (row["Department"])?.toString().trim(),
                    section: (row["Section"])?.toString().trim(),
                    line: (row["Line"])?.toString().trim(),
                    sub_section: (row["Sub Section"])?.toString().trim(),
                    stationNo: (row["Station No."] || row["Station No"])?.toString().trim(),
                    mentor: (row["Mentor"])?.toString().trim(),
                    designation: (row["Designation"])?.toString().trim(),
                    dob: normalizeDate(row["D.O.B."] || row["DOB"] || row["D.O.B"]),
                    joiningDate: normalizeDate(row["D.O.J."] || row["DOJ"] || row["D.O.J"]),
                    education: (row["Education"])?.toString().trim(),
                    district: (row["District"] || row["Distt"] || row["Dist"])?.toString().trim(),
                    state: (row["State"])?.toString().trim(),
                    pin: (row["PIN"] || row["Pin"])?.toString().trim(),
                    busRoute: (row["Bus Route"])?.toString().trim(),
                    email: (row["E-Mail ID"] || row["Email"])?.toString().trim(),
                    phoneNumber: (row["Mobile No."] || row["Mobile No"] || row["Mobile Number"])?.toString().trim(),
                    currentLevel: (row["L"] || row["Lavel"] || row["Level"])?.toString().trim(),
                    leavingDate: normalizeDate(row["Date of Leaving"]),
                    reasonOfLeaving: (row["Reason of Leaving"])?.toString().trim(),
                    contractor: (row["Contractor"])?.toString().trim() || null,
                    status: normalizeStatus(row["Status"]),
                };

                // Resolve hierarchy IDs
                const departmentId = normalizedRow.department ? deptMap.get(normalizedRow.department.toLowerCase().trim()) : null;
                const sectionId = (departmentId && normalizedRow.section) 
                    ? sectionMap.get(`${departmentId}|${normalizedRow.section.toLowerCase().trim()}`) 
                    : null;
                
                // Derive Line, Sub-Section, and Station from Station No. + Section
                const hierarchyMatch = (sectionId && normalizedRow.stationNo)
                    ? sectionStationMap.get(`${sectionId}|${normalizedRow.stationNo.toLowerCase().trim()}`)
                    : null;

                const stationId = hierarchyMatch?.stationId || null;
                const subSectionId = hierarchyMatch?.subSectionId || null;
                const lineId = hierarchyMatch?.lineId || null;

                // Validate required fields (phoneNumber is now optional)
                if (!normalizedRow.empId || !normalizedRow.idCard || !normalizedRow.fullName) {
                    const isEssentiallyEmpty = !normalizedRow.empId && !normalizedRow.idCard && !normalizedRow.fullName;
                    if (isEssentiallyEmpty) continue;

                    const isHeaderRow = ["employeeid", "employee code", "employee id", "employee code", "emp code", "emp id"].includes(normalizedRow.empId?.toLowerCase());
                    if (isHeaderRow) continue;

                    if (normalizedRow.empId && (normalizedRow.empId.includes(' ') || normalizedRow.empId.length > 15)) {
                        continue;
                    }

                    if (normalizedRow.phoneNumber && !/^\d{8,15}$/.test(normalizedRow.phoneNumber.replace(/\D/g, ''))) {
                         continue;
                    }

                    const error = "Missing required fields: EmployeeID, CardNo, and Name are mandatory.";
                    results.failed.push({ row: rowNumber, data: row, error });
                    
                    // Log to DB
                    await executeQuery(
                        "INSERT INTO import_log_details (logId, rowNumber, rowData, status, errorMessage) VALUES (?, ?, ?, ?, ?)",
                        [logId, rowNumber, JSON.stringify(row), "FAILED", error]
                    );
                    continue;
                }

                // Helper for date comparison
                const safeDate = (val) => normalizeDate(val);

                // Check for duplicate phone number if provided
                if (normalizedRow.phoneNumber) {
                    const [dupPhone] = await executeQuery(
                        "SELECT id, userName FROM users WHERE phoneNumber = ? AND userName != ?",
                        [normalizedRow.phoneNumber, normalizedRow.empId.toLowerCase()]
                    );
                    if (dupPhone && dupPhone.length > 0) {
                        const error = `Phone number ${normalizedRow.phoneNumber} is already used by another user (${dupPhone[0].userName})`;
                        results.failed.push({ row: rowNumber, data: row, error });
                        await executeQuery(
                            "INSERT INTO import_log_details (logId, rowNumber, rowData, status, errorMessage) VALUES (?, ?, ?, ?, ?)",
                            [logId, rowNumber, JSON.stringify(row), "FAILED", error]
                        );
                        continue;
                    }
                }

                // Prepare user data (Prioritize isEmployee for tracking)
                const userData = {
                    ...normalizedRow,
                    departmentId,
                    sectionId,
                    lineId,
                    subSectionId,
                    stationId,
                    userName: normalizedRow.empId.toLowerCase(),
                    password: normalizedRow.empId,
                    role: "STUDENT",
                    unit: "UNIT_1",
                    isEmployee: true,
                    isAdmin: false,
                    isTrainer: false,
                    email: normalizedRow.email || null,
                    status: normalizedRow.status || "PRESENT",
                    departments: departmentId ? [departmentId] : []
                };

                // Check if user already exists
                let existingUser = null;
                const [existing] = await executeQuery(
                    "SELECT u.*, d.name as departmentName, s.name as sectionName, l.name as lineName, ss.name as subSectionName, st.name as stationName " +
                    "FROM users u " +
                    "LEFT JOIN departments d ON u.departmentId = d.id " +
                    "LEFT JOIN sections s ON u.sectionId = s.id " +
                    "LEFT JOIN [lines] l ON u.lineId = l.id " +
                    "LEFT JOIN sub_sections ss ON u.subSectionId = ss.id " +
                    "LEFT JOIN machines st ON u.stationId = st.id " +
                    "WHERE u.userName = ?", 
                    [userData.userName]
                );

                if (existing && existing.length > 0) {
                    existingUser = existing[0];
                    const changes = {};
                    const fieldsToCompare = [
                        { key: 'fullName', label: 'Name' },
                        { key: 'idCard', label: 'Card No.' },
                        { key: 'fatherHusbandName', label: 'Father/Husband Name' },
                        { key: 'gender', label: 'Gender' },
                        { key: 'departmentId', label: 'Department' },
                        { key: 'sectionId', label: 'Section' },
                        // Line, Sub-Section, and Station are EXCLUDED from updates as per requirement
                        { key: 'mentor', label: 'Mentor' },
                        { key: 'designation', label: 'Designation' },
                        { key: 'dob', label: 'DOB' },
                        { key: 'joiningDate', label: 'Joining Date' },
                        { key: 'leavingDate', label: 'Date of Leaving' },
                        { key: 'reasonOfLeaving', label: 'Reason of Leaving' },
                        { key: 'contractor', label: 'Contractor' },
                        { key: 'education', label: 'Education' },
                        { key: 'district', label: 'District' },
                        { key: 'state', label: 'State' },
                        { key: 'pin', label: 'PIN' },
                        { key: 'busRoute', label: 'Bus Route' },
                        { key: 'email', label: 'Email' },
                        { key: 'phoneNumber', label: 'Mobile No.' },
                        { key: 'currentLevel', label: 'Level' },
                        { key: 'status', label: 'Status' },
                    ];

                    const updatedData = {};
                    
                    for (const field of fieldsToCompare) {
                        const newVal = userData[field.key];
                        const oldVal = existingUser[field.key];
                        
                        let isDifferent = false;
                        if (['dob', 'joiningDate', 'leavingDate'].includes(field.key)) {
                            const d1 = safeDate(newVal);
                            const d2 = safeDate(oldVal);
                            if (d1 !== d2) isDifferent = true;
                        } else {
                            const s1 = (newVal !== null && newVal !== undefined) ? newVal.toString().trim() : "";
                            const s2 = (oldVal !== null && oldVal !== undefined) ? oldVal.toString().trim() : "";
                            if (s1 !== s2) isDifferent = true;
                        }

                        if (isDifferent) {
                            updatedData[field.key] = userData[field.key];
                            
                            // Handle syncing string columns for hierarchy
                            if (field.key === 'departmentId') { 
                                updatedData.department = normalizedRow.department;
                                changes[field.label] = { from: existingUser.departmentName || "N/A", to: normalizedRow.department || "N/A" };
                            } else if (field.key === 'sectionId') { 
                                updatedData.section = normalizedRow.section;
                                changes[field.label] = { from: existingUser.sectionName || "N/A", to: normalizedRow.section || "N/A" };
                            } else if (field.key === 'lineId') { 
                                updatedData.line = normalizedRow.line;
                                changes[field.label] = { from: existingUser.lineName || "N/A", to: normalizedRow.line || "N/A" };
                            } else if (field.key === 'subSectionId') { 
                                updatedData.sub_section = normalizedRow.sub_section; // Check if col name is sub_section or subSection
                                changes[field.label] = { from: existingUser.subSectionName || "N/A", to: normalizedRow.sub_section || "N/A" };
                            } else if (field.key === 'stationId') { 
                                updatedData.stationNo = normalizedRow.stationNo;
                                changes[field.label] = { from: existingUser.stationName || "N/A", to: normalizedRow.stationNo || "N/A" };
                            } else {
                                changes[field.label] = { from: oldVal || "N/A", to: newVal || "N/A" };
                            }
                        }
                    }

                    // ALWAYS ensure departments array is in sync with departmentId
                    if (userData.departmentId) {
                        updatedData.departments = JSON.stringify([userData.departmentId]);
                    }

                    if (Object.keys(updatedData).length > 0) {
                        const updateFields = Object.keys(updatedData).map(k => `${k} = ?`).join(', ');
                        const values = [...Object.values(updatedData), existingUser.id];
                        
                        await executeQuery(`UPDATE users SET ${updateFields}, updatedAt = GETDATE(), isDeleted = 0 WHERE id = ?`, values);

                        // Sync stationId to machine_assignments if it was updated or already exists
                        const targetStationId = userData.stationId || existingUser.stationId;
                        if (targetStationId) {
                            const [hasAssign] = await executeQuery(
                                "SELECT id FROM machine_assignments WHERE user_id = ? AND machine_id = ?",
                                [existingUser.id, targetStationId]
                            );
                            if (hasAssign.length === 0) {
                                await executeQuery(
                                    "INSERT INTO machine_assignments (user_id, machine_id, assigned_by) VALUES (?, ?, ?)",
                                    [existingUser.id, targetStationId, req.user?.id || null]
                                );
                            }
                        }

                        const status = Object.keys(changes).length > 0 ? "UPDATED" : "SUCCESS";
                        results.success.push({
                            row: rowNumber,
                            userName: userData.userName,
                            empId: userData.empId,
                            status
                        });
                        if (status === "UPDATED") results.updatedCount++;

                        await executeQuery(
                            "INSERT INTO import_log_details (logId, rowNumber, rowData, status, entityId, changes) VALUES (?, ?, ?, ?, ?, ?)",
                            [logId, rowNumber, JSON.stringify(row), status, existingUser.id, JSON.stringify(changes)]
                        );

                        // Always ensure department students list is synced for any processed operator
                        // This helper now handles moving from one department to another correctly
                        await syncDepartmentStudents(existingUser.id, userData.departmentId);
                    } else {
                        // This case should theoretically not happen now as departments is always synced if departmentId exists
                        results.success.push({
                            row: rowNumber,
                            userName: userData.userName,
                            empId: userData.empId,
                            status: "SUCCESS"
                        });
                        await executeQuery("UPDATE users SET isDeleted = 0 WHERE id = ?", [existingUser.id]);
                        await executeQuery(
                            "INSERT INTO import_log_details (logId, rowNumber, rowData, status, entityId) VALUES (?, ?, ?, ?, ?)",
                            [logId, rowNumber, JSON.stringify(row), "SUCCESS", existingUser.id]
                        );
                    }
                    continue;
                }

                // Insert user
                const newUser = await User.create(userData);

                // Sync station assignment to machine_assignments
                if (userData.stationId) {
                    await executeQuery(
                        "INSERT INTO machine_assignments (user_id, machine_id, assigned_by) VALUES (?, ?, ?)",
                        [newUser.id, userData.stationId, req.user?.id || null]
                    );
                }

                // Sync department students list for new user
                if (departmentId) {
                    await syncDepartmentStudents(newUser.id, departmentId);
                }

                results.success.push({
                    row: rowNumber,
                    userName: userData.userName,
                    empId: userData.empId,
                    status: "CREATED"
                });

                // Log to DB
                await executeQuery(
                    "INSERT INTO import_log_details (logId, rowNumber, rowData, status, entityId) VALUES (?, ?, ?, ?, ?)",
                    [logId, rowNumber, JSON.stringify(row), "CREATED", newUser.id]
                );

            } catch (error) {
                const errorMsg = error.message || "Failed to import user";
                results.failed.push({ row: rowNumber, data: row, error: errorMsg });
                
                // Log to DB
                await executeQuery(
                    "INSERT INTO import_log_details (logId, rowNumber, rowData, status, errorMessage) VALUES (?, ?, ?, ?, ?)",
                    [logId, rowNumber, JSON.stringify(row), "FAILED", errorMsg]
                );
            }
        }

        // Finalize Import Log summary
        await executeQuery(
            "UPDATE import_logs SET successCount = ?, failCount = ?, updatedCount = ? WHERE id = ?",
            [results.success.length, results.failed.length, results.updatedCount, logId]
        );

        res.json(
            new ApiResponse(
                200,
                results,
                `Import completed: ${results.success.length} succeeded, ${results.failed.length} failed`
            )
        );
    } catch (error) {
        console.error("Import employees error:", error);
        throw new ApiError(500, error.message || "Failed to import employees");
    }
};

/**
 * Import instructors from Excel file
 */
export const importInstructors = async (req, res) => {
    try {
        if (!req.file) {
            throw new ApiError(400, "No file uploaded");
        }

        const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        if (!data || data.length === 0) {
            throw new ApiError(400, "Excel file is empty");
        }

        const results = { success: [], failed: [], total: data.length, updatedCount: 0 };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2;

            try {
                if (!row.fullName || !row.userName || !row.phoneNumber) {
                    results.failed.push({
                        row: rowNumber,
                        data: row,
                        error: "Missing required fields (fullName, userName, phoneNumber)",
                    });
                    continue;
                }

                // Prepare user data for User.create
                const userData = {
                    fullName: row.fullName.trim(),
                    userName: row.userName.trim().toLowerCase(),
                    email: row.email ? row.email.trim().toLowerCase() : null,
                    phoneNumber: row.phoneNumber.toString().trim(),
                    password: row.password || "trainer123", // User.create will hash this
                    role: "INSTRUCTOR",
                    unit: row.unit || "UNIT_1",
                    empId: row.empId?.toString().trim() || null,
                    isEmployee: false,
                    isAdmin: false,
                    isTrainer: true,
                    joiningDate: normalizeDate(row.joiningDate),
                    status: "PRESENT",
                };

                const existing = await executeQuery(
                    "SELECT id FROM users WHERE phoneNumber = ? OR userName = ?",
                    [userData.phoneNumber, userData.userName]
                );

                if (existing.length > 0) {
                    results.failed.push({
                        row: rowNumber,
                        data: row,
                        error: `User already exists with phone number ${userData.phoneNumber} or username ${userData.userName}`,
                    });
                    continue;
                }

                // Insert user using User model (handles slug, hashing, defaults)
                await User.create(userData);

                results.success.push({ row: rowNumber, userName: userData.userName });
            } catch (error) {
                results.failed.push({ row: rowNumber, error: error.message });
            }
        }

        res.json(new ApiResponse(200, results, `Import: ${results.success.length} ok, ${results.failed.length} failed`));
    } catch (error) {
        throw new ApiError(500, error.message || "Failed to import instructors");
    }
};

/**
 * Download employee import template
 */
export const downloadImportTemplate = async (req, res) => {
    try {
        // Create sample data with headers matching the image
        const templateData = [
            {
                "Employee Code": "AS000233",
                "Card No.": "00C0233",
                "Name": "SUBHASH SINGH",
                "Father / Husband Name": "RAM SHARAN",
                "Gender": "M",
                "Department": "C&C - Indirect",
                "Section": "Assembly - Direct",
                "Line": "AIRBAG",
                "Sub Section": "YHB FL 1",
                "Station No.": "LEADER",
                "Mentor": "",
                "Designation": "Operator",
                "DOB": "1990-11-23",
                "D.O.J.": "2013-03-01",
                "Education": "10th",
                "Distt": "REVARI",
                "State": "Haryana",
                "PIN": "123101",
                "Bus Route": "Route 1",
                "E-Mail ID": "subhash@example.com",
                "Mobile No": "9876543210",
                "Lavel": "L1",
                "Date of Leaving": "",
                "Reason of Leaving": "",
                "Contractor": "",
                "Status": "PRESENT",
            },
        ];

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        
        // Define column widths for better readability (optional but helpful)
        const widths = Object.keys(templateData[0]).map(key => ({ wch: Math.max(key.length, 15) }));
        worksheet["!cols"] = widths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        // Set headers
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=operator_import_template.xlsx"
        );
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.send(buffer);
    } catch (error) {
        console.error("Download template error:", error);
        throw new ApiError(500, "Failed to generate template");
    }
};

/**
 * Import DOJO candidates from Excel file
 */
export const importDojoUsers = async (req, res) => {
    try {
        if (!req.file) {
            throw new ApiError(400, "No file uploaded");
        }

        // Read the Excel file
        const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });
        
        let hRowIndex = -1;
        for (let i = 0; i < Math.min(allRows.length, 15); i++) {
            const row = allRows[i];
            if (row && Array.isArray(row) && row.some(cell => {
                if (!cell) return false;
                const c = cell.toString().trim().toLowerCase();
                return c === "employeeid" || c === "employee code" || c === "employee id";
            })) {
                hRowIndex = i;
                break;
            }
        }

        if (hRowIndex === -1) hRowIndex = 0;

        const headers = allRows[hRowIndex].map(h => h?.toString().trim() || "");
        const rawData = allRows.slice(hRowIndex + 1);

        const data = rawData.map(r => {
            const obj = {};
            headers.forEach((h, idx) => {
                const key = h || `__EMPTY_${idx}`;
                obj[key] = r[idx];
            });
            return obj;
        });

        if (!data || data.length === 0) {
            throw new ApiError(400, "No data found in Excel file");
        }

        const [allDepts] = await executeQuery("SELECT id, name FROM departments WHERE isDeleted = 0");
        const [allSections] = await executeQuery("SELECT id, name, departmentId FROM sections WHERE isActive = 1");
        const [allLines] = await executeQuery("SELECT id, name, sectionId FROM [lines] WHERE isActive = 1");
        const [allSubSections] = await executeQuery("SELECT id, name, lineId FROM sub_sections WHERE isActive = 1");
        const [allStations] = await executeQuery("SELECT id, name, subSectionId FROM machines WHERE isActive = 1");

        const deptMap = new Map(allDepts.map(d => [d.name.toLowerCase().trim(), d.id]));
        const sectionMap = new Map(allSections.map(s => [`${s.departmentId}|${s.name.toLowerCase().trim()}`, s.id]));

        const results = { success: [], failed: [], total: data.length, updatedCount: 0 };

        const [logResult] = await executeQuery(
            "INSERT INTO import_logs (fileName, importType, totalRows, importedBy) OUTPUT INSERTED.id VALUES (?, ?, ?, ?)",
            [req.file.originalname, "DOJO_CANDIDATE", data.length, req.user?.id || null]
        );
        const logId = logResult[0].id;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = hRowIndex + i + 2;

            try {
                const normalizedRow = {
                    empId: (row["Employee Code"] || row["EmployeeID"] || row["Employee ID"])?.toString().trim(),
                    fullName: (row["Name"] || row["Full Name"])?.toString().trim(),
                    gender: (row["Gender"])?.toString().trim() || "MALE",
                    department: (row["Department"])?.toString().trim(),
                    section: (row["Section"])?.toString().trim(),
                    line: (row["Line"])?.toString().trim(),
                    sub_section: (row["Sub Section"])?.toString().trim(),
                    stationNo: (row["Station No."])?.toString().trim(),
                    phoneNumber: (row["Mobile No"] || row["Mobile No."] || row["Mobile Number"])?.toString().trim(),
                    email: (row["E-Mail ID"] || row["Email"])?.toString().trim(),
                    designation: (row["Designation"])?.toString().trim(),
                    dob: normalizeDate(row["DOB"] || row["D.O.B."]),
                    joiningDate: normalizeDate(row["D.O.J."] || row["DOJ"]),
                    fatherHusbandName: row["Father / Husband Name"] || row["Father/HusbandName"] || null,
                    education: row["Education"] || null,
                    district: row["Distt"] || row["District"] || null,
                    state: row["State"] || null,
                    pin: row["PIN"] || null,
                    busRoute: row["Bus Route"] || null,
                };

                if (!normalizedRow.empId || !normalizedRow.fullName) {
                    if (!normalizedRow.empId && !normalizedRow.fullName) continue;
                    throw new Error("Missing required fields: Employee Code and Name are mandatory.");
                }

                // Check for duplicate username (Employee Code)
                const [existing] = await executeQuery("SELECT id FROM users WHERE userName = ?", [normalizedRow.empId.toLowerCase()]);
                if (existing.length > 0) {
                    throw new Error(`Candidate with Employee Code ${normalizedRow.empId} already exists.`);
                }

                // If phone number is already in use, clear it so creation still proceeds
                if (normalizedRow.phoneNumber) {
                    const [dupPhone] = await executeQuery(
                        "SELECT id FROM users WHERE phoneNumber = ?",
                        [normalizedRow.phoneNumber]
                    );
                    if (dupPhone && dupPhone.length > 0) {
                        normalizedRow.phoneNumber = null;
                    }
                }

                // Resolve hierarchy
                const departmentId = normalizedRow.department ? deptMap.get(normalizedRow.department.toLowerCase().trim()) : null;
                const sectionId = (departmentId && normalizedRow.section) ? sectionMap.get(`${departmentId}|${normalizedRow.section.toLowerCase().trim()}`) : null;

                // Generate Temporary ID
                const namePart = normalizedRow.fullName.substring(0, 3).toUpperCase();
                const empPart = normalizedRow.empId.toUpperCase();
                const prefix = `TEMP${namePart}${empPart}`;
                const tempId = await generateNextTempId(prefix);

                const userData = {
                    fullName: normalizedRow.fullName,
                    userName: normalizedRow.empId.toLowerCase(), // Manual code as login
                    empId: tempId, // Generated TEMP ID
                    password: tempId, // TEMP ID as password
                    role: "STUDENT",
                    isEmployee: true,
                    isTemporary: true,
                    status: "PRESENT",
                    gender: (normalizedRow.gender || "").toUpperCase().startsWith('F') ? "FEMALE" : "MALE",
                    email: normalizedRow.email || null,
                    phoneNumber: normalizedRow.phoneNumber || null,
                    departmentId: departmentId,
                    sectionId: sectionId,
                    targetDeptId: departmentId,
                    targetSectionId: sectionId,
                    designation: normalizedRow.designation,
                    dob: normalizedRow.dob,
                    joiningDate: normalizedRow.joiningDate || new Date().toISOString().split('T')[0],
                    fatherHusbandName: normalizedRow.fatherHusbandName,
                    education: normalizedRow.education,
                    district: normalizedRow.district,
                    state: normalizedRow.state,
                    pin: normalizedRow.pin,
                    busRoute: normalizedRow.busRoute,
                    unit: "UNIT_1"
                };

                const newUser = await User.create(userData);

                results.success.push({ row: rowNumber, userName: userData.userName, tempId });
                await executeQuery(
                    "INSERT INTO import_log_details (logId, rowNumber, rowData, status, entityId) VALUES (?, ?, ?, ?, ?)",
                    [logId, rowNumber, JSON.stringify(row), "CREATED", newUser.id]
                );

            } catch (error) {
                results.failed.push({ row: rowNumber, error: error.message });
                await executeQuery(
                    "INSERT INTO import_log_details (logId, rowNumber, rowData, status, errorMessage) VALUES (?, ?, ?, ?, ?)",
                    [logId, rowNumber, JSON.stringify(row), "FAILED", error.message]
                );
            }
        }

        await executeQuery(
            "UPDATE import_logs SET successCount = ?, failCount = ? WHERE id = ?",
            [results.success.length, results.failed.length, logId]
        );

        res.json(new ApiResponse(200, results, `Import: ${results.success.length} ok, ${results.failed.length} failed`));
    } catch (error) {
        console.error("Import DOJO candidates error:", error);
        throw new ApiError(500, error.message || "Failed to import DOJO candidates");
    }
};

/**
 * Download DOJO import template
 */
export const downloadDojoImportTemplate = async (req, res) => {
    try {
        const templateData = [
            {
                "Employee Code": "AS000233",
                "Card No.": "00C0233",
                "Name": "SUBHASH SINGH",
                "Father / Husband Name": "RAM SHARAN",
                "Gender": "M",
                "Department": "C&C - Indirect",
                "Section": "Assembly - Direct",
                "Line": "AIRBAG",
                "Sub Section": "YHB FL 1",
                "Station No.": "LEADER",
                "Mentor": "",
                "Designation": "Operator",
                "DOB": "1990-11-23",
                "D.O.J.": "2013-03-01",
                "Education": "10th",
                "Distt": "REVARI",
                "State": "Haryana",
                "PIN": "123101",
                "Bus Route": "Route 1",
                "E-Mail ID": "subhash@example.com",
                "Mobile No": "9876543210",
                "Status": "PRESENT",
            },
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Disposition", "attachment; filename=dojo_import_template.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buffer);
    } catch (error) {
        throw new ApiError(500, "Failed to generate template");
    }
};

/**
 * Download instructor import template
 */
export const downloadInstructorTemplate = async (req, res) => {
    try {
        const templateData = [{
            fullName: "Jane Trainer",
            userName: "janetrainer",
            email: "jane@example.com",
            phoneNumber: "0987654321",
            unit: "UNIT_1",
            joiningDate: "2024-01-01",
            password: "optional_password"
        }];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Instructors");
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Disposition", "attachment; filename=instructor_import_template.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buffer);
    } catch (error) {
        throw new ApiError(500, "Failed to generate template");
    }
};
/**
 * Get Import Logs history
 */
export const getImportLogs = async (req, res) => {
    const [logs] = await executeQuery(
        "SELECT il.*, u.fullName as importedBy_name FROM import_logs il LEFT JOIN users u ON il.importedBy = u.id ORDER BY il.createdAt DESC"
    );
    res.json(new ApiResponse(200, logs, "Import logs fetched successfully"));
};

/**
 * Get Detailed info for a specific import log
 */
export const getImportLogDetails = async (req, res) => {
    const { id } = req.params;
    
    const [log] = await executeQuery("SELECT * FROM import_logs WHERE id = ?", [id]);
    if (log.length === 0) throw new ApiError(404, "Log not found");

    const [details] = await executeQuery(
        "SELECT * FROM import_log_details WHERE logId = ? ORDER BY rowNumber ASC",
        [id]
    );

    res.json(new ApiResponse(200, {
        summary: log[0],
        details: details.map(d => ({
            ...d,
            rowData: typeof d.rowData === 'string' ? JSON.parse(d.rowData) : d.rowData,
            changes: typeof d.changes === 'string' ? JSON.parse(d.changes) : d.changes
        }))
    }, "Import log details fetched successfully"));
};
