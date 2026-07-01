import XLSX from "xlsx";
import { executeQuery } from "../db/mssqlHelper.js";
import UserHierarchySnapshot from "../models/userHierarchySnapshot.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import bcrypt from "bcryptjs";
import User from "../models/auth.model.js";
import fs from "fs";

/**
 * Parse date string in DD-MMM-YY or DD-MMM-YYYY format robustly and timezone-independently
 */
const parseDDMMMYY = (str) => {
    if (!str) return null;
    const cleanStr = str.toString().trim();
    // Match DD-MMM-YY or DD-MMM-YYYY (e.g. 01-Jun-26 or 01-Jun-2026)
    const match = cleanStr.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/);
    if (!match) return null;

    const day = parseInt(match[1]);
    const monthStr = match[2].toLowerCase();
    let year = parseInt(match[3]);

    if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
    }

    const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };

    const month = months[monthStr.substring(0, 3)];
    if (!month) return null;

    const formattedDay = String(day).padStart(2, '0');
    return `${year}-${month}-${formattedDay}`;
};

/**
 * Get row value by checking multiple possible column names case-insensitively and space-normalized
 */
const getRowVal = (row, keys) => {
    if (!row) return null;
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];

        const normKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
        for (const rowKey of Object.keys(row)) {
            const normRowKey = rowKey.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
            if (normKey === normRowKey) {
                return row[rowKey];
            }
        }
    }
    return null;
};

/**
 * Robust date normalization to YYYY-MM-DD
 */
const normalizeDate = (val) => {
    if (!val) return null;

    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const str = val.toString().trim();
    if (!str) return null;

    // 1. Try DD-MMM-YY or DD-MMM-YYYY (e.g. 01-Jun-26 or 01-Jun-2026)
    const dmmmyy = parseDDMMMYY(str);
    if (dmmmyy) return dmmmyy;

    // 2. Try DD/MM/YYYY or DD-MM-YYYY (e.g. 24/06/2026 or 24-06-2026)
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        let year = parseInt(dmyMatch[3]);
        if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year;
        }
        
        const mVal = parseInt(month);
        const dVal = parseInt(day);
        if (mVal >= 1 && mVal <= 12 && dVal >= 1 && dVal <= 31) {
            return `${year}-${month}-${day}`;
        }
    }

    // 3. Try YYYY-MM-DD or YYYY/MM/DD (e.g. 2013-03-01) - parsed timezone-safely
    const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, '0');
        const day = ymdMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Fallback
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        if (str.includes('T') || str.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }

    return null;
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
        const [allContractors] = await executeQuery("SELECT id, name FROM contractors WHERE status = 'active'");

        const deptMap = new Map(allDepts.map(d => [d.name.toLowerCase().trim(), d.id]));

        const sectionMap = new Map();
        allSections.forEach(s => {
            const name = s.name.toLowerCase().trim();
            const deptId = s.departmentId;
            const category = (s.category || "").toLowerCase().trim();
            sectionMap.set(`${deptId}|${name}`, s.id);
            if (category && category !== "not applicable") {
                sectionMap.set(`${deptId}|${name} - ${category}`, s.id);
            }
        });

        const contractorMap = new Map(allContractors.map(c => [c.name.toLowerCase().trim(), c.id]));

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
                    empId: getRowVal(row, ["EmployeeCode", "EmployeeID", "Employee Code", "Employee ID"])?.toString().trim(),
                    idCard: getRowVal(row, ["CardNo", "Card No.", "Card No"])?.toString().trim(),
                    fullName: getRowVal(row, ["Name", "Full Name"])?.toString().trim(),
                    fatherHusbandName: getRowVal(row, ["Father/HusbandName", "Father / Husband Name"])?.toString().trim(),
                    gender: getRowVal(row, ["Gender", "Gender "])?.toString().trim(),
                    department: getRowVal(row, ["Department"])?.toString().trim(),
                    section: getRowVal(row, ["Section"])?.toString().trim(),
                    line: getRowVal(row, ["Line"])?.toString().trim(),
                    sub_section: getRowVal(row, ["Sub Section"])?.toString().trim(),
                    stationNo: getRowVal(row, ["Station No.", "Station No"])?.toString().trim(),
                    mentor: getRowVal(row, ["Mentor"])?.toString().trim(),
                    designation: getRowVal(row, ["Designation"])?.toString().trim(),
                    dob: normalizeDate(getRowVal(row, ["D.O.B.", "DOB", "D.O.B"])),
                    joiningDate: normalizeDate(getRowVal(row, ["D.O.J.", "DOJ", "D.O.J"])),
                    education: getRowVal(row, ["Education"])?.toString().trim(),
                    district: getRowVal(row, ["District", "Distt", "Dist"])?.toString().trim(),
                    state: getRowVal(row, ["State"])?.toString().trim(),
                    pin: getRowVal(row, ["PIN", "Pin", "Pin Code", "Pincode"])?.toString().trim(),
                    busRoute: getRowVal(row, ["Bus Route"])?.toString().trim(),
                    email: getRowVal(row, ["E-Mail ID", "Email", "Email ID"])?.toString().trim(),
                    phoneNumber: getRowVal(row, ["Mobile No.", "Mobile No", "Mobile Number", "Phone", "Phone Number"])?.toString().trim(),
                    currentLevel: getRowVal(row, ["L", "Lavel", "Level"])?.toString().trim(),
                    leavingDate: normalizeDate(getRowVal(row, ["Date of Leaving", "DateofLeaving"])),
                    reasonOfLeaving: getRowVal(row, ["Reason of Leaving", "ReasonofLeaving"])?.toString().trim(),
                    contractor: getRowVal(row, ["Contractor"])?.toString().trim() || null,
                    rawStatus: getRowVal(row, ["Status"])?.toString().trim() || null,
                    status: normalizeStatus(getRowVal(row, ["Status"])),
                };

                // Resolve hierarchy IDs
                const departmentId = normalizedRow.department ? deptMap.get(normalizedRow.department.toLowerCase().trim()) : null;
                const sectionId = (departmentId && normalizedRow.section)
                    ? sectionMap.get(`${departmentId}|${normalizedRow.section.toLowerCase().trim()}`)
                    : null;

                const stationId = null;
                const subSectionId = null;
                const lineId = null;
                const contractorId = normalizedRow.contractor
                    ? (contractorMap.get(normalizedRow.contractor.toLowerCase().trim()) || null)
                    : null;

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

                // Check if user already exists (needed for phone conflict resolution below)
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
                    [normalizedRow.empId.toLowerCase()]
                );

                if (existing && existing.length > 0) {
                    existingUser = existing[0];
                }

                // Handle duplicate phone number gracefully instead of failing the row
                if (normalizedRow.phoneNumber) {
                    const [dupPhone] = await executeQuery(
                        "SELECT id, userName FROM users WHERE phoneNumber = ? AND userName != ?",
                        [normalizedRow.phoneNumber, normalizedRow.empId.toLowerCase()]
                    );
                    if (dupPhone && dupPhone.length > 0) {
                        if (existingUser) {
                            // Keep their existing phone number so the update doesn't hit the unique constraint
                            normalizedRow.phoneNumber = existingUser.phoneNumber || null;
                        } else {
                            // New user: set null so insert succeeds (NULL is not subject to unique constraint)
                            normalizedRow.phoneNumber = null;
                        }
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
                    contractorId,
                    userName: normalizedRow.empId.toLowerCase(),
                    password: normalizedRow.empId,
                    role: "STUDENT",
                    unit: "UNIT_1",
                    isEmployee: true,
                    isAdmin: false,
                    isTrainer: false,
                    email: normalizedRow.email || null,
                    status: normalizedRow.status || "PRESENT",
                    departments: departmentId ? [departmentId] : [],
                    sections: sectionId ? [sectionId] : []
                };

                if (existingUser) {
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
                        { key: 'contractorId', label: 'Contractor' },
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

                        const isNewValEmpty = newVal === null || newVal === undefined || newVal.toString().trim() === "";

                        // Leaving details: only clear when status is explicitly PRESENT in Excel;
                        // otherwise fall through to normal diff logic so new values can be set.
                        if (['leavingDate', 'reasonOfLeaving'].includes(field.key)) {
                            const explicitStatus = normalizedRow.rawStatus ? normalizeStatus(normalizedRow.rawStatus) : null;
                            if (explicitStatus === "PRESENT") {
                                if (oldVal !== null && oldVal !== undefined && oldVal !== "") {
                                    updatedData[field.key] = null;
                                    changes[field.label] = { from: oldVal, to: "Cleared (Status Present)" };
                                }
                                continue; // Skip normal diff — clearing is done
                            }
                            // Status is not PRESENT: fall through to isNewValEmpty + diff logic below
                        }

                        // Status: only update if the Excel cell was explicitly filled in.
                        if (field.key === 'status' && !normalizedRow.rawStatus) {
                            continue;
                        }

                        // All other fields: skip if Excel cell is empty to prevent wiping existing data.
                        if (isNewValEmpty) {
                            continue;
                        }

                        let isDifferent = false;
                        if (['dob', 'joiningDate', 'leavingDate'].includes(field.key)) {
                            const d1 = safeDate(newVal);
                            const d2 = safeDate(oldVal);
                            if (d1 !== d2) isDifferent = true;
                        } else {
                            const s1 = newVal.toString().trim();
                            const s2 = (oldVal !== null && oldVal !== undefined) ? oldVal.toString().trim() : "";
                            if (s1 !== s2) isDifferent = true;
                        }

                        if (isDifferent) {
                            updatedData[field.key] = userData[field.key];

                            // Handle syncing string columns for hierarchy and contractor
                            if (field.key === 'departmentId') {
                                updatedData.department = normalizedRow.department;
                                changes[field.label] = { from: existingUser.departmentName || "N/A", to: normalizedRow.department || "N/A" };
                            } else if (field.key === 'sectionId') {
                                updatedData.section = normalizedRow.section;
                                changes[field.label] = { from: existingUser.sectionName || "N/A", to: normalizedRow.section || "N/A" };
                            } else if (field.key === 'contractorId') {
                                updatedData.contractorId = userData.contractorId;
                                updatedData.contractor = normalizedRow.contractor || null;
                                changes[field.label] = { from: existingUser.contractor || "N/A", to: normalizedRow.contractor || "N/A" };
                            } else {
                                changes[field.label] = { from: oldVal || "N/A", to: newVal || "N/A" };
                            }
                        }
                    }

                    // ALWAYS ensure departments and sections arrays are in sync with their IDs
                    if (userData.departmentId) {
                        updatedData.departments = JSON.stringify([userData.departmentId]);
                    }
                    if (userData.sectionId) {
                        updatedData.sections = JSON.stringify([userData.sectionId]);
                    }

                    if (Object.keys(updatedData).length > 0) {
                        const updateFields = Object.keys(updatedData).map(k => `${k} = ?`).join(', ');
                        const values = [...Object.values(updatedData), existingUser.id];

                        await executeQuery(`UPDATE users SET ${updateFields}, updatedAt = GETDATE(), isDeleted = 0 WHERE id = ?`, values);

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

        try {
            await UserHierarchySnapshot.syncFromUsers();
        } catch (syncErr) {
            console.error("Snapshot sync failed after importEmployees:", syncErr.message);
        }

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

        try {
            await UserHierarchySnapshot.syncFromUsers();
        } catch (syncErr) {
            console.error("Snapshot sync failed after importInstructors:", syncErr.message);
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

        // DEBUG: save the uploaded file and log info
        try {
            fs.writeFileSync("d:/10Sight Agency/Sarvagaya Institute/FME/Furukawa-LMS/Furukawa-LMS-main/server/uploaded_debug.xlsx", req.file.buffer);
            const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
            const logContent = [
                `Time: ${new Date().toISOString()}`,
                `Sheets: ${JSON.stringify(workbook.SheetNames)}`
            ];
            workbook.SheetNames.forEach(name => {
                const ws = workbook.Sheets[name];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
                logContent.push(`Sheet: ${name}, total rows: ${rows.length}`);
                if (rows.length > 0) {
                    logContent.push(`  Row 0: ${JSON.stringify(rows[0])}`);
                }
                if (rows.length > 1) {
                    logContent.push(`  Row 1: ${JSON.stringify(rows[1])}`);
                }
            });
            fs.appendFileSync("d:/10Sight Agency/Sarvagaya Institute/FME/Furukawa-LMS/Furukawa-LMS-main/server/import_debug.log", logContent.join("\n") + "\n\n");
        } catch (err) {
            console.error("DEBUG error saving or logging:", err);
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

        const deptMap = new Map();
        allDepts.forEach(d => {
            const name = d.name.toLowerCase().trim();
            deptMap.set(name, d.id);
            if (name.includes(" - ")) {
                const parts = name.split(" - ");
                deptMap.set(parts[0].trim(), d.id);
            }
        });

        const sectionMap = new Map();
        allSections.forEach(s => {
            const name = s.name.toLowerCase().trim();
            sectionMap.set(`${s.departmentId}|${name}`, s.id);
            if (name.includes(" - ")) {
                const parts = name.split(" - ");
                sectionMap.set(`${s.departmentId}|${parts[0].trim()}`, s.id);
            }
        });

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
                    contractor: getRowVal(row, ["Contractor", "Contractor Name"])?.toString().trim(),
                    empId: getRowVal(row, ["Employee Code", "EmployeeID", "Employee ID"])?.toString().trim(),
                    idCard: getRowVal(row, ["Card No.", "Card No", "CardNo"])?.toString().trim(),
                    fullName: getRowVal(row, ["Name", "Full Name"])?.toString().trim(),
                    gender: getRowVal(row, ["Gender"])?.toString().trim() || "MALE",
                    department: getRowVal(row, ["Department"])?.toString().trim(),
                    section: getRowVal(row, ["Section"])?.toString().trim(),
                    line: getRowVal(row, ["Line"])?.toString().trim(),
                    sub_section: getRowVal(row, ["Sub Section"])?.toString().trim(),
                    stationNo: getRowVal(row, ["Station No.", "Station No", "Station"])?.toString().trim(),
                    phoneNumber: getRowVal(row, ["Mobile No", "Mobile No.", "Mobile Number", "Phone", "Phone Number"])?.toString().trim(),
                    email: getRowVal(row, ["E-Mail ID", "Email", "Email ID"])?.toString().trim(),
                    designation: getRowVal(row, ["Designation"])?.toString().trim(),
                    dob: normalizeDate(getRowVal(row, ["DOB", "D.O.B.", "Date of Birth"])),
                    joiningDate: normalizeDate(getRowVal(row, ["D.O.J.", "DOJ", "Date of Joining", "Date of Join"])),
                    expectedHandover: normalizeDate(getRowVal(row, ["Expected Handover Date", "Expected handover date", "Expected Handover"])),
                    fatherHusbandName: getRowVal(row, ["Father / Husband Name", "Father/HusbandName", "Father Name", "Husband Name"]),
                    education: getRowVal(row, ["Education"]),
                    district: getRowVal(row, ["Distt", "District"]),
                    state: getRowVal(row, ["State"]),
                    pin: getRowVal(row, ["PIN", "Pincode", "Pin Code"]),
                    busRoute: getRowVal(row, ["Bus Route"]),
                };


                if (!normalizedRow.empId || !normalizedRow.fullName) {
                    if (!normalizedRow.empId && !normalizedRow.fullName) continue;
                    throw new Error("Missing required fields: Employee Code and Name are mandatory.");
                }

                // Check for duplicate username (Employee Code)
                const [existing] = await executeQuery("SELECT id FROM users WHERE LOWER(userName) = LOWER(?)", [normalizedRow.empId]);
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

                const userData = {
                    fullName: normalizedRow.fullName,
                    userName: normalizedRow.empId,
                    empId: normalizedRow.empId,
                    idCard: normalizedRow.idCard || null,
                    password: normalizedRow.empId,
                    role: "STUDENT",
                    isEmployee: true,
                    isTemporary: true,
                    status: "PRESENT",
                    gender: (normalizedRow.gender || "").toUpperCase().startsWith('F') ? "FEMALE" : "MALE",
                    email: normalizedRow.email || null,
                    phoneNumber: normalizedRow.phoneNumber || null,
                    departmentId: null,
                    sectionId: null,
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
                    unit: "UNIT_1",
                    expectedHandover: normalizedRow.expectedHandover || null,
                    contractor: normalizedRow.contractor || null,
                };

                const newUser = await User.create(userData);

                results.success.push({ row: rowNumber, userName: userData.userName, empId: userData.empId });
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

        try {
            await UserHierarchySnapshot.syncFromUsers();
        } catch (syncErr) {
            console.error("Snapshot sync failed after importDojoUsers:", syncErr.message);
        }

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
                "Contractor": "ABC Contractors",
                "Department": "C&C - Indirect",
                "Section": "Assembly - Direct",
                "Line": "AIRBAG",
                "Sub Section": "YHB FL 1",
                "Station No.": "LEADER",
                "Designation": "Operator",
                "DOB": "1990-11-23",
                "D.O.J.": "2013-03-01",
                "Expected Handover Date": "2024-06-30",
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
        const widths = Object.keys(templateData[0]).map(key => ({ wch: Math.max(key.length, 15) }));
        worksheet["!cols"] = widths;
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
