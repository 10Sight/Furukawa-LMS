
// New 
import AttendanceLog from "../models/attendanceLog.model.js";
import User from "../models/auth.model.js";
import xlsx from "xlsx";
import logger from "../logger/winston.logger.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";
import { getEligibleUserSql } from "../utils/userEligibility.js";
import { formatLocalDate } from "../utils/istDate.util.js";

// export const uploadAttendance = async (req, res, next) => {
//     try {
//         // Validate file upload
//         if (!req.file) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No file uploaded"
//             });
//         }

//         // Read the Excel file
//         const workbook = xlsx.read(req.file.buffer, {
//             type: "buffer",
//             cellDates: true,
//             raw: false,
//         });

//         const sheetName = workbook.SheetNames[0];
//         const sheet = workbook.Sheets[sheetName];
//         const rows2D = xlsx.utils.sheet_to_json(sheet, {
//             header: 1,
//             defval: "",
//             blankrows: false
//         });

//         if (!rows2D.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Sheet is empty"
//             });
//         }

//         // --- Helper Functions ---
//         const clean = (v) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
//         const normalizeEmpId = (v) => String(v || "").trim().replace(/\.0$/, "");

//         const parseTime = (timeStr) => {
//             if (!timeStr || timeStr === 'NaN' || timeStr === '') return null;

//             // 1. Handle JS Date objects (likely from xlsx cellDates: true)
//             if (timeStr instanceof Date) {
//                 // If it's a valid date
//                 if (!isNaN(timeStr.getTime())) {
//                     // Extract HH:MM:SS in local time (assuming Excel parser adjusted timezone or treated as local)
//                     const hours = timeStr.getHours();
//                     const minutes = timeStr.getMinutes();
//                     const seconds = timeStr.getSeconds();
//                     return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
//                 }
//                 return null;
//             }

//             const str = String(timeStr).trim();

//             // 2. Handle AM/PM formats (e.g., "2:30 PM", "02:30:15 am") and standard HH:MM:SS
//             // Matches: 2:30, 2:30 PM, 14:30:00, 2:30:00 AM
//             const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
//             if (timeMatch) {
//                 let [_, hours, minutes, seconds, meridiem] = timeMatch;
//                 hours = parseInt(hours, 10);
//                 minutes = parseInt(minutes, 10);
//                 seconds = seconds ? parseInt(seconds, 10) : 0;

//                 if (meridiem) {
//                     const isPM = meridiem.toUpperCase() === 'PM';
//                     const isAM = meridiem.toUpperCase() === 'AM';

//                     if (isPM && hours < 12) hours += 12;
//                     if (isAM && hours === 12) hours = 0;
//                 }

//                 return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
//             }

//             // 3. Handle Excel time decimals (0.59375 = 14:15:00)
//             // Valid range: 0.0 to 0.9999 (representing 00:00 to 23:59)
//             if (!isNaN(str) && parseFloat(str) < 1 && parseFloat(str) >= 0) {
//                 const decimal = parseFloat(str);
//                 const totalSeconds = Math.round(decimal * 24 * 60 * 60);
//                 const hours = Math.floor(totalSeconds / 3600);
//                 const minutes = Math.floor((totalSeconds % 3600) / 60);
//                 const seconds = totalSeconds % 60;
//                 return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
//             }

//             // 4. Handle edge case: decimal > 1 but might be Excel timestamp (days + time)
//             // If strictly needed, we could take fractional part, but usually Time column is just Time.
//             // Ignoring for now to avoid false positives on ID numbers.

//             return null;
//         };

//         const parseHours = (hrsStr) => {
//             if (!hrsStr || hrsStr === 'NaN' || hrsStr === '') return 0;
//             const parsed = parseFloat(hrsStr);
//             return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
//         };

//         // --- 1. Detect Header Row ---
//         let headerRowIndex = -1;
//         for (let i = 0; i < Math.min(rows2D.length, 20); i++) {
//             const row = rows2D[i].map(clean);
//             if (row.includes("paycode") || row.includes("cardno") || row.includes("employeename")) {
//                 headerRowIndex = i;
//                 break;
//             }
//         }

//         if (headerRowIndex === -1) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Could not find header row with required columns (PayCode, Card No, Employee Name).",
//                 debug: { sampleRow: rows2D[0] }
//             });
//         }

//         // Extract column headers and map indices
//         const headers = rows2D[headerRowIndex].map(clean);

//         console.log('📋 Excel Headers:', headers.join(', '));

//         const columnMap = {
//             payCode: headers.findIndex(h => h.includes("paycode") || (h.includes("pay") && h.includes("code"))),
//             cardNo: headers.findIndex(h => h.includes("card") || h.includes("cardno")),
//             // Handle "Employee Name", "Employee I...", "EmployeeName", "Name"
//             employeeName: headers.findIndex(h => (h.includes("employee") && (h.includes("name") || h.includes("i"))) || (h === "name" || h.includes("empname") || h.includes("employeename"))),
//             department: headers.findIndex(h => h.includes("department") || h.includes("dept") || h.includes("section")),
//             designation: headers.findIndex(h => h.includes("designation") || h.includes("desig")),
//             shift: headers.findIndex(h => h.includes("shift")),
//             // Allow "Start Time", "Shift Start", "Start"
//             startTime: headers.findIndex(h => h.includes("start")),
//             inTime: headers.findIndex(h => (h.includes("in") && !h.includes("arriv") && !h.includes("shift") && !h.includes("min")) || h === "in" || h.includes("intime")),
//             outTime: headers.findIndex(h => (h.includes("out") && !h.includes("amount")) || h === "out" || h.includes("outtime")),
//             // Handle "Hrs Works", "Hrs Works Status", "HrsWorked", "Total Hrs"
//             hrsWorked: headers.findIndex(h => (h.includes("hrs") && h.includes("work")) || h.includes("hrswork") || h.includes("totalhrs") || h.includes("workhrs")),
//             // Status might be "Att. Status", "Status", "Present/Absent"
//             status: headers.findIndex(h => h.includes("status") && !h.includes("hrs")),
//             // Handle "Late Arriv", "LateArrival", "Late Arrival"
//             lateArrival: headers.findIndex(h => (h.includes("late") && h.includes("arriv")) || h.includes("late")),
//             // Handle "Shift Early", "Early Departure", "EarlyDeparture"
//             earlyDeparture: headers.findIndex(h => (h.includes("early") && h.includes("depart")) || (h.includes("early") && !h.includes("arriv"))),
//             // Handle "Ot", "OT", "OtHrs"
//             otHrs: headers.findIndex(h => (h.includes("ot") && !h.includes("amount") && !h.includes("other") && !h.includes("total")) || h.includes("othrs")),
//             otAmount: headers.findIndex(h => (h.includes("ot") && h.includes("amount")) || h.includes("otamt")),
//         };

//         console.log('🗺️  Column Mapping:', JSON.stringify(columnMap, null, 2));

//         // Validate required columns
//         if (columnMap.payCode === -1) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Required column 'PayCode' not found in Excel file"
//             });
//         }

//         // --- 2. Extract Report Date from Excel ---
//         let reportDate = null;
//         for (let i = 0; i < Math.min(headerRowIndex, 10); i++) {
//             const row = rows2D[i];
//             for (let cell of row) {
//                 const cellStr = String(cell || "").toLowerCase();
//                 const dateMatch = cellStr.match(/date\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
//                 if (dateMatch) {
//                     const [day, month, year] = dateMatch[1].split('/');
//                     reportDate = `${year}-${month}-${day}`;
//                     break;
//                 }
//             }
//             if (reportDate) break;
//         }

//         // Use query parameter or current date as fallback
//         if (!reportDate) {
//             reportDate = req.query.date || new Date().toISOString().split("T")[0];
//         }

//         console.log('📅 Report Date:', reportDate);

//         // --- 3. Extract Data Rows ---
//         const dataRows = rows2D
//             .slice(headerRowIndex + 1)
//             .filter(row => {
//                 if (!row || row.length === 0) return false;
//                 const payCode = normalizeEmpId(row[columnMap.payCode]);
//                 return payCode && payCode !== 'paycode' && payCode.length > 0;
//             });

//         if (dataRows.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No valid data rows found in Excel file"
//             });
//         }

//         console.log('📊 Total data rows found:', dataRows.length);

//         // Extract unique employee IDs from Excel
//         const excelEmpIds = [...new Set(
//             dataRows.map(row => normalizeEmpId(row[columnMap.payCode]))
//         )].filter(id => id);

//         console.log('👥 Unique PayCodes in Excel:', excelEmpIds.length);

//         // --- 4. Match with Database Users & Auto-Create Missing ---

//         // A. Find existing users (Batched to avoid 2100 parameter limit)
//         const pool = await poolPromise;
//         const existingUsers = [];
//         const chunkSize = 1000;

//         for (let i = 0; i < excelEmpIds.length; i += chunkSize) {
//             const chunk = excelEmpIds.slice(i, i + chunkSize);
//             const lookupRequest = pool.request();
//             const lookupSql = `SELECT id, empId FROM users WHERE empId IN (${chunk.map((_, j) => `@id${j}`).join(',')})`;
//             chunk.forEach((id, j) => lookupRequest.input(`id${j}`, sql.VarChar, id));

//             const result = await lookupRequest.query(lookupSql);
//             existingUsers.push(...result.recordset);
//         }

//         const existingEmpIds = new Set(existingUsers.map(u => normalizeEmpId(u.empId)));
//         const missingEmpIds = excelEmpIds.filter(id => !existingEmpIds.has(id));

//         console.log(`🔍 Existing Users: ${existingUsers.length}, Missing Users: ${missingEmpIds.length}`);

//         // B. Auto-create missing users
//         if (missingEmpIds.length > 0) {
//             console.log('🛠️  Auto-creating missing users...');

//             // Prepare user data for missing employees
//             const newUsersData = [];

//             for (const empId of missingEmpIds) {
//                 // Find first occurrence in dataRows to get details
//                 const row = dataRows.find(r => normalizeEmpId(r[columnMap.payCode]) === empId);
//                 if (!row) continue;

//                 const fullName = String(row[columnMap.employeeName] || row[columnMap.payCode]).trim();
//                 const department = String(row[columnMap.department] || "").trim();

//                 newUsersData.push({
//                     fullName: fullName || `Employee ${empId}`,
//                     userName: empId.toLowerCase(), // Username is PayCode
//                     email: `${empId.toLowerCase()}@furukawa.com`, // Dummy email
//                     phoneNumber: "9999999999", // Dummy phone
//                     password: "Welcome@123", // Default password
//                     role: "STUDENT",
//                     unit: "UNIT_1", // Default unit
//                     empId: empId,
//                     department: department,
//                     isEmployee: 1,
//                     status: "PRESENT",
//                     isVerified: 1,
//                     isDeleted: 0
//                 });
//             }

//             // Create users in loop to ensure hashing/slug logic runs
//             let createdCount = 0;
//             for (const userData of newUsersData) {
//                 try {
//                     await User.create(userData);
//                     createdCount++;
//                 } catch (err) {
//                     console.error(`❌ Failed to auto-create user ${userData.empId}:`, err.message);
//                 }
//             }
//             console.log(`✅ Successfully auto-created ${createdCount} users.`);
//         }

//         // C. Refetch all users (Batched to avoid 2100 parameter limit)
//         const allDbUsers = [];
//         for (let i = 0; i < excelEmpIds.length; i += chunkSize) {
//             const chunk = excelEmpIds.slice(i, i + chunkSize);
//             const refetchRequest = pool.request();
//             const refetchSql = `SELECT id, empId FROM users WHERE empId IN (${chunk.map((_, j) => `@ref${j}`).join(',')})`;
//             chunk.forEach((id, j) => refetchRequest.input(`ref${j}`, sql.VarChar, id));

//             const result = await refetchRequest.query(refetchSql);
//             allDbUsers.push(...result.recordset);
//         }

//         console.log('✅ Final User Match Count:', allDbUsers.length);

//         const userMap = new Map(
//             allDbUsers.map(u => [normalizeEmpId(u.empId), u.id])
//         );

//         // --- 5. Process Rows and Prepare Batch Insert ---
//         const batchValues = [];
//         const missingUsers = [];

//         for (const row of dataRows) {
//             const payCode = normalizeEmpId(row[columnMap.payCode]);
//             const userId = userMap.get(payCode);

//             if (!userId) {
//                 missingUsers.push(payCode);
//                 continue;
//             }

//             // Extract and parse fields
//             const inTime = parseTime(row[columnMap.inTime]);
//             const outTime = parseTime(row[columnMap.outTime]);
//             const startTime = parseTime(row[columnMap.startTime]);
//             const hrsWorked = parseHours(row[columnMap.hrsWorked]);
//             const status = String(row[columnMap.status] || "").trim() || "Absent";

//             // Normalize status to match ENUM values
//             let normalizedStatus = status.toUpperCase();
//             if (normalizedStatus === 'P') normalizedStatus = 'Present';
//             else if (normalizedStatus === 'A') normalizedStatus = 'Absent';
//             else if (normalizedStatus === 'L') normalizedStatus = 'Late';
//             else if (normalizedStatus === 'HD') normalizedStatus = 'Half Day';
//             else if (normalizedStatus === 'WO' || normalizedStatus === 'H') normalizedStatus = 'Holiday';
//             else normalizedStatus = 'Absent'; // Default fallback

//             batchValues.push([
//                 userId,                                                    // userId
//                 payCode,                                                   // payCode
//                 normalizeEmpId(row[columnMap.cardNo]) || null,            // cardNo
//                 String(row[columnMap.employeeName] || "").trim() || null, // employeeName
//                 reportDate,                                                // date
//                 String(row[columnMap.department] || "").trim() || null,   // department
//                 String(row[columnMap.designation] || "").trim() || null,  // designation
//                 String(row[columnMap.shift] || "").trim() || null,        // shift
//                 startTime,                                                 // startTime
//                 inTime,                                                    // inTime
//                 outTime,                                                   // outTime
//                 hrsWorked,                                                 // hrsWorked
//                 normalizedStatus,                                          // status
//                 parseHours(row[columnMap.lateArrival]),                   // lateArrival
//                 parseHours(row[columnMap.earlyDeparture]),                // earlyDeparture
//                 parseHours(row[columnMap.otHrs]),                         // otHrs
//                 parseFloat(row[columnMap.otAmount]) || 0,                 // otAmount
//                 req.user?.id || null,                                     // updatedBy
//                 req.user?.role || null,                                   // updatedByRole
//             ]);
//         }

//         console.log('💾 Records prepared for insertion:', batchValues.length);

//         if (missingUsers.length > 0) {
//             console.log('⚠️  Users not found in DB:', missingUsers.slice(0, 10));
//         }

//         // --- 6. Database Operation ---
//         let affectedRows = 0;
//         if (batchValues.length > 0) {
//             const mergeSql = `
//                 MERGE attendance_logs AS target
//                 USING (SELECT @userId AS userId, @date AS date) AS source
//                 ON (target.userId = source.userId AND target.date = source.date)
//                 WHEN MATCHED THEN
//                     UPDATE SET 
//                         payCode = @payCode, cardNo = @cardNo, employeeName = @empName,
//                         department = @dept, designation = @desig, shift = @shift,
//                         startTime = @start, inTime = @inT, outTime = @outT,
//                         hrsWorked = @hrs, status = @status, lateArrival = @late,
//                         earlyDeparture = @early, otHrs = @otH, otAmount = @otA,
//                         updatedBy = @upBy, updatedByRole = @upRole, updatedAt = GETDATE()
//                 WHEN NOT MATCHED THEN
//                     INSERT (userId, payCode, cardNo, employeeName, date, department, designation, shift, startTime, inTime, outTime, hrsWorked, status, lateArrival, earlyDeparture, otHrs, otAmount, updatedBy, updatedByRole)
//                     VALUES (@userId, @payCode, @cardNo, @empName, @date, @dept, @desig, @shift, @start, @inT, @outT, @hrs, @status, @late, @early, @otH, @otA, @upBy, @upRole);
//             `;

//             for (const vals of batchValues) {
//                 const rowReq = pool.request();
//                 rowReq.input('userId', sql.Int, vals[0]);
//                 rowReq.input('payCode', sql.VarChar, vals[1]);
//                 rowReq.input('cardNo', sql.VarChar, vals[2]);
//                 rowReq.input('empName', sql.VarChar, vals[3]);
//                 rowReq.input('date', sql.Date, vals[4]);
//                 rowReq.input('dept', sql.VarChar, vals[5]);
//                 rowReq.input('desig', sql.VarChar, vals[6]);
//                 rowReq.input('shift', sql.VarChar, vals[7]);
//                 rowReq.input('start', sql.VarChar, vals[8]);
//                 rowReq.input('inT', sql.VarChar, vals[9]);
//                 rowReq.input('outT', sql.VarChar, vals[10]);
//                 rowReq.input('hrs', sql.Float, vals[11]);
//                 rowReq.input('status', sql.VarChar, vals[12]);
//                 rowReq.input('late', sql.Float, vals[13]);
//                 rowReq.input('early', sql.Float, vals[14]);
//                 rowReq.input('otH', sql.Float, vals[15]);
//                 rowReq.input('otA', sql.Float, vals[16]);
//                 rowReq.input('upBy', sql.Int, vals[17]);
//                 rowReq.input('upRole', sql.VarChar, vals[18]);

//                 const result = await rowReq.query(mergeSql);
//                 affectedRows += result.rowsAffected[0] || 0;
//             }
//             console.log('✅ Database operation completed. Affected rows:', affectedRows);
//         }

//         // --- 7. Response ---
//         return res.status(200).json({
//             success: true,
//             message: `Successfully processed attendance data for ${reportDate}`,
//             data: {
//                 reportDate: reportDate,
//                 totalRowsInExcel: dataRows.length,
//                 successfullyProcessed: batchValues.length,
//                 affectedRows: affectedRows,
//                 usersNotFoundInDB: missingUsers.length,
//                 details: {
//                     uniqueEmployeesInExcel: excelEmpIds.length,
//                     matchedInDB: batchValues.length,
//                     notInDB: [...new Set(missingUsers)].slice(0, 20),
//                     headerRowFound: headerRowIndex + 1
//                 }
//             }
//         });

//     } catch (error) {
//         console.error("❌ Attendance Upload Error:", error);
//         return res.status(500).json({
//             success: false,
//             error: error.message,
//             stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//         });
//     }
// };



// Helper to format MSSQL Date/Time objects




export const uploadAttendance = async (req, res, next) => {
    let transaction = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        /*
         * IMPORTANT:
         * We intentionally read worksheet rows with raw: false.
         * This makes SheetJS return the DISPLAYED Excel value instead of the
         * underlying serial value wherever possible. Example:
         *   Excel Start = 5:59  -> "5:59" (not 0.249305555...)
         *   Hrs Works   = 8.59  -> "8.59"
         *   Late Arriv. = 0.35  -> "0.35"
         *
         * This avoids timezone shifting of Start/In/Out and preserves the
         * attendance report's H.MM-style numeric fields exactly as displayed.
         */
        const workbook = xlsx.read(req.file.buffer, {
            type: "buffer",
            cellDates: false,
        });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows2D = xlsx.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            blankrows: false,
            raw: false,
        });

        if (!rows2D.length) {
            return res.status(400).json({
                success: false,
                message: "Sheet is empty"
            });
        }

        const clean = (v) =>
            String(v ?? "")
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

        const normalizeText = (v) => String(v ?? "").trim();

        // Attendance matching rule:
        // Excel PayCode must match users.empId only.
        const normalizePayCode = (v) =>
            String(v ?? "")
                .trim()
                .replace(/\.0$/, "")
                .replace(/\s+/g, "")
                .toUpperCase();

        /*
         * attendance_logs.status has an MSSQL CHECK constraint.
         * Therefore raw Excel codes (P, A, MIS, HLF, WO, EL, ...) must NOT
         * be written directly to attendance_logs.status. Convert them to the
         * DB enum/check values that the existing application already uses.
         *
         * Important for the uploaded HR attendance format:
         *   P   -> Present
         *   A   -> Absent
         *   HLF -> Half Day
         *   WO  -> Holiday
         *   MIS / EL / leave-type / unknown non-present codes -> Absent
         *
         * This keeps upload resilient while the detailed Excel columns
         * (including the final OT column) are still saved independently.
         */
        const normalizeAttendanceStatusForDb = (value) => {
            const status = normalizeText(value).toUpperCase();

            if (!status) return "Absent";

            if (["P", "PRESENT"].includes(status)) {
                return "Present";
            }

            if (["L", "LATE"].includes(status)) {
                return "Late";
            }

            if (["HD", "HLF", "HALF DAY", "HALFDAY", "HALF-DAY"].includes(status)) {
                return "Half Day";
            }

            if (["WO", "H", "HOLIDAY", "WEEK OFF", "WEEKOFF", "WEEK-OFF", "OFF"].includes(status)) {
                return "Holiday";
            }

            // A, MIS, EL, CL, SL, PL, LWP and any other non-present code
            // are intentionally treated as Absent because that value is
            // accepted by the existing attendance status CHECK constraint.
            return "Absent";
        };

        const isPresentStatus = (value) => {
            const status = normalizeText(value).toUpperCase();
            return status === "P" || status === "PRESENT";
        };

        /*
         * Parse Start / In / Out without applying the server's local timezone.
         * Supports:
         * - Excel formatted text: 5:59, 14:54, 05:59:00
         * - AM/PM text
         * - Excel numeric time serials as a safety fallback
         * - Date objects as a safety fallback (UTC getters are intentional)
         */
        const parseTime = (timeVal) => {
            if (timeVal === null || timeVal === undefined || timeVal === "") {
                return null;
            }

            if (timeVal instanceof Date) {
                if (Number.isNaN(timeVal.getTime())) return null;

                const h = timeVal.getUTCHours();
                const m = timeVal.getUTCMinutes();
                const s = timeVal.getUTCSeconds();

                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }

            if (typeof timeVal === "number" && Number.isFinite(timeVal)) {
                const fraction = ((timeVal % 1) + 1) % 1;
                let totalSeconds = Math.round(fraction * 24 * 60 * 60);
                totalSeconds %= 24 * 60 * 60;

                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = totalSeconds % 60;

                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }

            const str = normalizeText(timeVal);
            if (!str || str === "-" || str.toLowerCase() === "nan") return null;

            const match = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/i);
            if (match) {
                let [, h, m, s, mer] = match;
                h = Number.parseInt(h, 10);
                m = Number.parseInt(m, 10);
                s = s ? Number.parseInt(s, 10) : 0;

                if (m > 59 || s > 59 || h > 23) return null;

                if (mer) {
                    if (h > 12) return null;
                    if (mer.toUpperCase() === "PM" && h < 12) h += 12;
                    if (mer.toUpperCase() === "AM" && h === 12) h = 0;
                }

                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }

            // Safety fallback if an Excel decimal time arrives as text.
            const numeric = Number(str);
            if (Number.isFinite(numeric) && numeric >= 0 && numeric < 1) {
                let totalSeconds = Math.round(numeric * 24 * 60 * 60);
                totalSeconds %= 24 * 60 * 60;

                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = totalSeconds % 60;

                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }

            return null;
        };

        /*
         * Hrs Works / Early / Late / Shift Early / OT in this attendance report
         * are report values such as 8.59, 0.35, 3.19 etc. They must be stored
         * exactly as those numeric report values, not converted to decimal hours.
         *
         * If another report provides H:MM text, it is converted to the same H.MM
         * representation (e.g. 3:19 -> 3.19) before saving to the FLOAT column.
         */
        const parseReportNumber = (value) => {
            if (value === null || value === undefined || value === "") return 0;

            if (typeof value === "number") {
                return Number.isFinite(value) ? value : 0;
            }

            if (value instanceof Date) {
                if (Number.isNaN(value.getTime())) return 0;

                const h = value.getUTCHours();
                const m = value.getUTCMinutes();
                return Number(`${h}.${String(m).padStart(2, "0")}`);
            }

            const str = normalizeText(value);
            if (!str || str === "-" || str.toLowerCase() === "nan") return 0;

            // If a duration is formatted as H:MM, preserve report semantics as H.MM.
            const durationMatch = str.match(/^(\d{1,3}):(\d{1,2})(?::\d{1,2})?$/);
            if (durationMatch) {
                const h = Number.parseInt(durationMatch[1], 10);
                const m = Number.parseInt(durationMatch[2], 10);
                if (m <= 59) {
                    return Number(`${h}.${String(m).padStart(2, "0")}`);
                }
            }

            // Handles values like "8.59", "0.35", "1,234.50", "₹123.50".
            const cleaned = str.replace(/,/g, "").replace(/[^0-9.+-]/g, "");
            const n = Number(cleaned);
            return Number.isFinite(n) ? n : 0;
        };

        const formatDateToYMD = (day, month, year) => {
            return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        };

        const parseDateFromFilename = (filename) => {
            if (!filename) return null;

            const base = String(filename).split("/").pop().split("\\").pop();
            const match = base.match(/(\d{1,2})[.\-_\/](\d{1,2})[.\-_\/](\d{4})/);
            if (!match) return null;

            const day = Number.parseInt(match[1], 10);
            const month = Number.parseInt(match[2], 10);
            const year = Number.parseInt(match[3], 10);

            if (!day || !month || !year) return null;
            if (day > 31 || month > 12) return null;

            return formatDateToYMD(day, month, year);
        };

        const parseDateFromSheetText = (rows) => {
            for (let i = 0; i < Math.min(rows.length, 25); i++) {
                const row = rows[i] || [];

                for (const cell of row) {
                    const text = String(cell ?? "").trim();
                    if (!text) continue;

                    const match = text.match(/date\s*[:\-]?\s*(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/i);
                    if (match) {
                        const day = Number.parseInt(match[1], 10);
                        const month = Number.parseInt(match[2], 10);
                        const year = Number.parseInt(match[3], 10);

                        if (!day || !month || !year) return null;
                        return formatDateToYMD(day, month, year);
                    }
                }
            }

            return null;
        };

        const uploadedFileName =
            req.file.originalname ||
            req.file.filename ||
            "";

        const attendanceDate =
            parseDateFromFilename(uploadedFileName) ||
            parseDateFromSheetText(rows2D) ||
            req.query.date;

        if (!attendanceDate) {
            logger.warn(`Could not determine attendance date for file: ${uploadedFileName}`);
            return res.status(400).json({
                success: false,
                message: "Attendance date not found from file name or sheet content. Please ensure the filename contains a date (DD-MM-YYYY) or the sheet has 'Date: DD/MM/YYYY'."
            });
        }

        logger.info(`Processing attendance for date: ${attendanceDate}`);

        let headerRowIndex = -1;

        for (let i = 0; i < Math.min(rows2D.length, 25); i++) {
            const row = rows2D[i].map(clean);

            if (
                row.includes("paycode") ||
                row.includes("cardno") ||
                row.includes("employeename") ||
                (row.some(c => c.includes("pay")) && row.some(c => c.includes("card")))
            ) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            logger.warn("Header row not found in Excel sheet");
            return res.status(400).json({
                success: false,
                message: "Required headers (PayCode, Card No, Employee Name) not found. Please check your Excel format."
            });
        }

        const headers = rows2D[headerRowIndex].map(clean);
        logger.info(`Found headers at row ${headerRowIndex + 1}: ${headers.join(", ")}`);

        const findColumn = (...aliases) => {
            const normalizedAliases = aliases.map(clean);
            return headers.findIndex((header) => normalizedAliases.includes(header));
        };

        const columnMap = {
            payCode: findColumn("PayCode", "Pay Code", "Employee Code", "Emp Code"),
            cardNo: findColumn("Card No", "CardNo", "Card Number", "Card"),
            employeeName: findColumn("Employee Name", "EmployeeName", "Emp Name", "Name"),
            department: findColumn("Department", "Dept", "Section"),
            designation: findColumn("Designation", "Desig"),
            shift: findColumn("Shift", "Shift Name"),
            startTime: findColumn("Start", "Start Time", "Shift Start"),
            inTime: findColumn("In", "In Time", "InTime"),
            outTime: findColumn("Out", "Out Time", "OutTime"),
            hrsWorked: findColumn("Hrs Works", "Hrs Worked", "Hrs", "Total Hrs", "Work Hrs"),
            status: findColumn("Status", "Att Status", "Attendance Status"),
            earlyArrival: findColumn("Early Arriv", "Early Arrival"),
            lateArrival: findColumn("Late Arriv", "Late Arrival", "Late"),
            earlyDeparture: findColumn("Shift Early", "Early Departure", "Early Depart", "Early"),
            excessLunch: findColumn("Excess Lunch", "Lunch Excess"),
            otHrs: findColumn("Ot", "OT", "OT Hrs", "OT Hours", "Overtime", "Overtime Hrs"),
            otAmount: findColumn("OT Amt", "OT Amount", "Overtime Amount")
        };

        logger.info(`Column mapping: ${JSON.stringify(columnMap)}`);

        if (columnMap.payCode === -1) {
            return res.status(400).json({
                success: false,
                message: "Required column 'PayCode' was not found in the Excel file."
            });
        }

        const requiredAttendanceColumns = [
            ["Start", columnMap.startTime],
            ["In", columnMap.inTime],
            ["Out", columnMap.outTime],
            ["Hrs Works", columnMap.hrsWorked],
            ["Status", columnMap.status],
            ["Early Arriv.", columnMap.earlyArrival],
            ["Late Arriv.", columnMap.lateArrival],
            ["Shift Early", columnMap.earlyDeparture],
            ["OT", columnMap.otHrs],
        ];

        const missingAttendanceColumns = requiredAttendanceColumns
            .filter(([, index]) => index === -1)
            .map(([name]) => name);

        if (missingAttendanceColumns.length > 0) {
            logger.warn(`Optional attendance columns not found: ${missingAttendanceColumns.join(", ")}`);
        }

        const dataRows = rows2D
            .slice(headerRowIndex + 1)
            .filter((row) => {
                const payCode = row[columnMap.payCode];
                return Boolean(normalizePayCode(payCode));
            });

        if (dataRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid attendance rows were found in the Excel file."
            });
        }

        logger.info(`Found ${dataRows.length} data rows to process.`);

        const pool = await poolPromise;

        // Build attendance user map from users.empId only.
        const usersResult = await pool.request().query(`
            SELECT id, empId, isDeleted
            FROM users
            WHERE empId IS NOT NULL
              AND LTRIM(RTRIM(CAST(empId AS NVARCHAR(100)))) <> ''
            ORDER BY
                CASE WHEN ISNULL(isDeleted, 0) = 0 THEN 0 ELSE 1 END,
                id DESC
        `);

        const userMapByEmpId = new Map();

        usersResult.recordset.forEach((u) => {
            const normalizedEmpId = normalizePayCode(u.empId);

            if (normalizedEmpId && !userMapByEmpId.has(normalizedEmpId)) {
                userMapByEmpId.set(normalizedEmpId, u.id);
            }
        });

        logger.info(`Users mapped by users.empId only: ${userMapByEmpId.size}.`);

        const mergeSql = `
            MERGE attendance_logs AS target
            USING (SELECT @userId AS userId, CONVERT(date, @date, 23) AS [date]) AS source
            ON target.userId = source.userId AND target.[date] = source.[date]
            WHEN MATCHED THEN
                UPDATE SET
                    payCode = @payCode,
                    cardNo = @cardNo,
                    employeeName = @empName,
                    department = @dept,
                    designation = @desig,
                    shift = @shift,
                    startTime = @startTime,
                    inTime = @inT,
                    outTime = @outT,
                    hrsWorked = @hrs,
                    status = @status,
                    earlyArrival = @earlyArrival,
                    lateArrival = @late,
                    earlyDeparture = @early,
                    otHrs = @otH,
                    otAmount = @otA,
                    updatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (
                    userId, payCode, cardNo, employeeName, [date],
                    department, designation, shift, startTime,
                    inTime, outTime, hrsWorked, status,
                    earlyArrival, lateArrival, earlyDeparture, otHrs, otAmount, updatedAt
                )
                VALUES (
                    @userId, @payCode, @cardNo, @empName, CONVERT(date, @date, 23),
                    @dept, @desig, @shift, @startTime,
                    @inT, @outT, @hrs, @status,
                    @earlyArrival, @late, @early, @otH, @otA, GETDATE()
                );
        `;

        const insertUnmappedSql = `
            INSERT INTO attendance_unmapped_logs (
                payCode, cardNo, employeeName, [date],
                department, designation, shift, startTime,
                inTime, outTime, hrsWorked, status,
                earlyArrival, lateArrival, earlyDeparture, otHrs, otAmount, reason, createdAt
            ) VALUES (
                @payCode, @cardNo, @employeeName, CONVERT(date, @date, 23),
                @department, @designation, @shift, @startTime,
                @inTime, @outTime, @hrsWorked, @status,
                @earlyArrival, @lateArrival, @earlyDeparture, @otHrs, @otAmount, @reason, GETDATE()
            );
        `;

        let matchedRowsSaved = 0;
        let unmappedRowsSaved = 0;
        let presentInAttendanceLogs = 0;
        let presentInUnmappedLogs = 0;

        /*
         * SAME-DATE REUPLOAD = FULL REPLACEMENT
         * --------------------------------------
         * Everything for attendanceDate is deleted and inserted again inside one
         * SQL transaction. If any DB operation fails, the transaction rolls back,
         * so the previously uploaded day's data remains safe and unchanged.
         */
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const deleteAttendanceReq = new sql.Request(transaction);
            deleteAttendanceReq.input("date", sql.VarChar(10), attendanceDate);
            await deleteAttendanceReq.query(`
                DELETE FROM attendance_logs
                WHERE CONVERT(date, [date]) = CONVERT(date, @date, 23)
            `);

            const deleteUnmappedReq = new sql.Request(transaction);
            deleteUnmappedReq.input("date", sql.VarChar(10), attendanceDate);
            await deleteUnmappedReq.query(`
                DELETE FROM attendance_unmapped_logs
                WHERE CONVERT(date, [date]) = CONVERT(date, @date, 23)
            `);

            logger.info(`Existing attendance fully cleared inside transaction for date: ${attendanceDate}`);

            for (let index = 0; index < dataRows.length; index++) {
                const row = dataRows[index];

                const rawPayCode = columnMap.payCode !== -1 ? row[columnMap.payCode] : null;
                const rawCardNo = columnMap.cardNo !== -1 ? row[columnMap.cardNo] : null;
                const normalizedPayCode = normalizePayCode(rawPayCode);
                const userId = normalizedPayCode
                    ? userMapByEmpId.get(normalizedPayCode)
                    : null;

                // Keep raw Excel status only for diagnostics; save a DB-safe value.
                const rawStatus = columnMap.status !== -1
                    ? normalizeText(row[columnMap.status]) || null
                    : null;
                const rowStatus = normalizeAttendanceStatusForDb(rawStatus);

                const startTime = columnMap.startTime !== -1
                    ? parseTime(row[columnMap.startTime])
                    : null;

                const inTime = columnMap.inTime !== -1
                    ? parseTime(row[columnMap.inTime])
                    : null;

                const outTime = columnMap.outTime !== -1
                    ? parseTime(row[columnMap.outTime])
                    : null;

                const hrsWorked = columnMap.hrsWorked !== -1
                    ? parseReportNumber(row[columnMap.hrsWorked])
                    : 0;

                const earlyArrival = columnMap.earlyArrival !== -1
                    ? parseReportNumber(row[columnMap.earlyArrival])
                    : 0;

                const lateArrival = columnMap.lateArrival !== -1
                    ? parseReportNumber(row[columnMap.lateArrival])
                    : 0;

                const earlyDeparture = columnMap.earlyDeparture !== -1
                    ? parseReportNumber(row[columnMap.earlyDeparture])
                    : 0;

                const otHrs = columnMap.otHrs !== -1
                    ? parseReportNumber(row[columnMap.otHrs])
                    : 0;

                // Current uploaded Excel has no OT Amount column, so this is 0.
                // If a future Excel contains OT Amt / OT Amount, the exact numeric value is saved.
                const otAmount = columnMap.otAmount !== -1
                    ? parseReportNumber(row[columnMap.otAmount])
                    : 0;

                if (userId) {
                    const reqDB = new sql.Request(transaction);
                    reqDB.input("userId", sql.Int, userId);
                    reqDB.input("payCode", sql.VarChar, normalizeText(rawPayCode) || null);
                    reqDB.input("cardNo", sql.VarChar, normalizeText(rawCardNo) || null);
                    reqDB.input("empName", sql.VarChar, columnMap.employeeName !== -1 ? normalizeText(row[columnMap.employeeName]) || null : null);
                    reqDB.input("date", sql.VarChar(10), attendanceDate);
                    reqDB.input("dept", sql.VarChar, columnMap.department !== -1 ? normalizeText(row[columnMap.department]) || null : null);
                    reqDB.input("desig", sql.VarChar, columnMap.designation !== -1 ? normalizeText(row[columnMap.designation]) || null : null);
                    reqDB.input("shift", sql.VarChar, columnMap.shift !== -1 ? normalizeText(row[columnMap.shift]) || null : null);
                    reqDB.input("startTime", sql.VarChar, startTime);
                    reqDB.input("inT", sql.VarChar, inTime);
                    reqDB.input("outT", sql.VarChar, outTime);
                    reqDB.input("hrs", sql.Float, hrsWorked);
                    reqDB.input("status", sql.VarChar, rowStatus);
                    reqDB.input("earlyArrival", sql.Float, earlyArrival);
                    reqDB.input("late", sql.Float, lateArrival);
                    reqDB.input("early", sql.Float, earlyDeparture);
                    reqDB.input("otH", sql.Float, otHrs);
                    reqDB.input("otA", sql.Float, otAmount);

                    try {
                        await reqDB.query(mergeSql);
                    } catch (rowError) {
                        const excelRowNumber = headerRowIndex + 2 + index;
                        rowError.message = `Excel row ${excelRowNumber}, PayCode ${normalizeText(rawPayCode) || "N/A"}, raw status ${rawStatus || "blank"}, DB status ${rowStatus}: ${rowError.message}`;
                        throw rowError;
                    }
                    matchedRowsSaved++;

                    if (isPresentStatus(rowStatus)) {
                        presentInAttendanceLogs++;
                    }
                } else {
                    const reqUnmapped = new sql.Request(transaction);
                    reqUnmapped.input("payCode", sql.VarChar, normalizeText(rawPayCode) || null);
                    reqUnmapped.input("cardNo", sql.VarChar, normalizeText(rawCardNo) || null);
                    reqUnmapped.input("employeeName", sql.VarChar, columnMap.employeeName !== -1 ? normalizeText(row[columnMap.employeeName]) || null : null);
                    reqUnmapped.input("date", sql.VarChar(10), attendanceDate);
                    reqUnmapped.input("department", sql.VarChar, columnMap.department !== -1 ? normalizeText(row[columnMap.department]) || null : null);
                    reqUnmapped.input("designation", sql.VarChar, columnMap.designation !== -1 ? normalizeText(row[columnMap.designation]) || null : null);
                    reqUnmapped.input("shift", sql.VarChar, columnMap.shift !== -1 ? normalizeText(row[columnMap.shift]) || null : null);
                    reqUnmapped.input("startTime", sql.VarChar, startTime);
                    reqUnmapped.input("inTime", sql.VarChar, inTime);
                    reqUnmapped.input("outTime", sql.VarChar, outTime);
                    reqUnmapped.input("hrsWorked", sql.Float, hrsWorked);
                    reqUnmapped.input("status", sql.VarChar, rowStatus);
                    reqUnmapped.input("earlyArrival", sql.Float, earlyArrival);
                    reqUnmapped.input("lateArrival", sql.Float, lateArrival);
                    reqUnmapped.input("earlyDeparture", sql.Float, earlyDeparture);
                    reqUnmapped.input("otHrs", sql.Float, otHrs);
                    reqUnmapped.input("otAmount", sql.Float, otAmount);
                    reqUnmapped.input("reason", sql.VarChar, "Excel PayCode not found in users.empId");

                    try {
                        await reqUnmapped.query(insertUnmappedSql);
                    } catch (rowError) {
                        const excelRowNumber = headerRowIndex + 2 + index;
                        rowError.message = `Excel row ${excelRowNumber}, unmapped PayCode ${normalizeText(rawPayCode) || "N/A"}, raw status ${rawStatus || "blank"}, DB status ${rowStatus}: ${rowError.message}`;
                        throw rowError;
                    }
                    unmappedRowsSaved++;

                    if (isPresentStatus(rowStatus)) {
                        presentInUnmappedLogs++;
                    }
                }
            }

            await transaction.commit();
            transaction = null;
        } catch (dbError) {
            try {
                if (transaction) {
                    await transaction.rollback();
                    transaction = null;
                }
            } catch (rollbackError) {
                logger.error(`Attendance rollback error: ${rollbackError.message}`);
            }

            throw dbError;
        }

        logger.info(
            `Upload complete for ${attendanceDate}: ${matchedRowsSaved} matched, ${unmappedRowsSaved} unmapped. Existing date data was fully replaced.`
        );

        return res.status(200).json({
            success: true,
            message: `Successfully replaced attendance for ${attendanceDate}.`,
            data: {
                attendanceDate,
                replaceMode: true,
                totalRows: dataRows.length,
                matchedRowsSaved,
                unmappedRowsSaved,
                skippedRows: 0,
                presentInAttendanceLogs,
                presentInUnmappedLogs,
                totalPresentUploaded: presentInAttendanceLogs + presentInUnmappedLogs,
                missingOptionalColumns: missingAttendanceColumns,
                columnMapping: {
                    start: columnMap.startTime,
                    in: columnMap.inTime,
                    out: columnMap.outTime,
                    hrsWorks: columnMap.hrsWorked,
                    status: columnMap.status,
                    earlyArrival: columnMap.earlyArrival,
                    lateArrival: columnMap.lateArrival,
                    shiftEarly: columnMap.earlyDeparture,
                    otHrs: columnMap.otHrs,
                    otAmount: columnMap.otAmount,
                }
            }
        });
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                logger.error(`Attendance rollback error: ${rollbackError.message}`);
            }
        }

        console.error("Attendance Upload Error:", error);
        logger.error(`Attendance Upload Error: ${error.message}`);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const formatMssqlTime = (val) => {
    if (!val || !(val instanceof Date)) return val;
    // For TIME columns, mssql returns a Date object with date 1970-01-01
    // We only want the HH:mm part
    return val.toISOString().substr(11, 5);
};

const formatMssqlDate = (val) => {
    if (!val || !(val instanceof Date)) return val;
    return formatLocalDate(val);
};

const isDashboardAttendanceDownload = (value) =>
    ["true", "1", "yes"].includes(
        String(value || "").trim().toLowerCase()
    );

const parseAttendanceFilterId = (value, fieldName) => {
    if (
        value === undefined ||
        value === null ||
        value === "" ||
        String(value).toLowerCase() === "all"
    ) {
        return null;
    }

    const parsedValue = Number.parseInt(String(value), 10);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        const error = new Error(
            `${fieldName} must be a valid positive integer or 'all'`
        );
        error.statusCode = 400;
        throw error;
    }

    return parsedValue;
};

/*
 * Same canonical section rule used by Dashboard:
 * 1. Use a valid users.sectionId first.
 * 2. Resolve from line/sub-section only when direct section is missing/invalid.
 * 3. Use sections.users JSON only when neither direct nor line section exists.
 */
const getDashboardAttendanceSectionSql = (alias = "u") => `
    AND (
        EXISTS (
            SELECT 1
            FROM sections directSection
            WHERE directSection.id = ${alias}.sectionId
              AND directSection.departmentId = ${alias}.departmentId
              AND ISNULL(directSection.isActive, 1) = 1
              AND directSection.id = @sectionId
        )

        OR (
            NOT EXISTS (
                SELECT 1
                FROM sections directSection
                WHERE directSection.id = ${alias}.sectionId
                  AND directSection.departmentId = ${alias}.departmentId
                  AND ISNULL(directSection.isActive, 1) = 1
            )
            AND EXISTS (
                SELECT 1
                FROM [lines] resolvedLine
                LEFT JOIN sub_sections resolvedSubSection
                    ON resolvedSubSection.id = ${alias}.subSectionId
                INNER JOIN sections resolvedSection
                    ON resolvedSection.id = resolvedLine.sectionId
                   AND resolvedSection.departmentId = ${alias}.departmentId
                   AND ISNULL(resolvedSection.isActive, 1) = 1
                WHERE resolvedLine.id = COALESCE(
                    ${alias}.lineId,
                    resolvedSubSection.lineId
                )
                  AND ISNULL(resolvedLine.isActive, 1) = 1
                  AND resolvedSection.id = @sectionId
            )
        )

        OR (
            NOT EXISTS (
                SELECT 1
                FROM sections directSection
                WHERE directSection.id = ${alias}.sectionId
                  AND directSection.departmentId = ${alias}.departmentId
                  AND ISNULL(directSection.isActive, 1) = 1
            )
            AND NOT EXISTS (
                SELECT 1
                FROM [lines] anyResolvedLine
                LEFT JOIN sub_sections anyResolvedSubSection
                    ON anyResolvedSubSection.id = ${alias}.subSectionId
                INNER JOIN sections anyResolvedSection
                    ON anyResolvedSection.id = anyResolvedLine.sectionId
                   AND anyResolvedSection.departmentId = ${alias}.departmentId
                   AND ISNULL(anyResolvedSection.isActive, 1) = 1
                WHERE anyResolvedLine.id = COALESCE(
                    ${alias}.lineId,
                    anyResolvedSubSection.lineId
                )
                  AND ISNULL(anyResolvedLine.isActive, 1) = 1
            )
            AND EXISTS (
                SELECT 1
                FROM sections jsonSection
                CROSS APPLY OPENJSON(
                    CASE
                        WHEN ISJSON(
                            CAST(jsonSection.[users] AS NVARCHAR(MAX))
                        ) = 1
                        THEN CAST(jsonSection.[users] AS NVARCHAR(MAX))
                        ELSE N'[]'
                    END
                ) jsonSectionUser
                WHERE jsonSection.departmentId = ${alias}.departmentId
                  AND ISNULL(jsonSection.isActive, 1) = 1
                  AND jsonSection.id = @sectionId
                  AND TRY_CAST(jsonSectionUser.[value] AS INT) = ${alias}.id
                  AND NOT EXISTS (
                      SELECT 1
                      FROM sections earlierJsonSection
                      CROSS APPLY OPENJSON(
                          CASE
                              WHEN ISJSON(
                                  CAST(
                                      earlierJsonSection.[users]
                                      AS NVARCHAR(MAX)
                                  )
                              ) = 1
                              THEN CAST(
                                  earlierJsonSection.[users]
                                  AS NVARCHAR(MAX)
                              )
                              ELSE N'[]'
                          END
                      ) earlierJsonUser
                      WHERE earlierJsonSection.departmentId = ${alias}.departmentId
                        AND ISNULL(earlierJsonSection.isActive, 1) = 1
                        AND earlierJsonSection.id < jsonSection.id
                        AND TRY_CAST(
                            earlierJsonUser.[value] AS INT
                        ) = ${alias}.id
                  )
            )
        )
    )
`;

export const getAttendance = async (req, res, next) => {
    try {
        const {
            date,
            departmentId,
            sectionId,
            lineId,
            dashboardOnly,
        } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Date is required",
            });
        }

        const departmentFilterId = parseAttendanceFilterId(
            departmentId,
            "departmentId"
        );
        const sectionFilterId = parseAttendanceFilterId(
            sectionId,
            "sectionId"
        );
        const lineFilterId = parseAttendanceFilterId(
            lineId,
            "lineId"
        );

        const dashboardDownload =
            isDashboardAttendanceDownload(dashboardOnly);

        const pool = await poolPromise;
        const request = pool.request();

        request.input("date", sql.VarChar, date);

        let normalHierarchySql = "";
        let dashboardHierarchySql = "";

        if (departmentFilterId) {
            normalHierarchySql += " AND u.departmentId = @deptId";
            dashboardHierarchySql += " AND u.departmentId = @deptId";
            request.input("deptId", sql.Int, departmentFilterId);
        }

        if (sectionFilterId) {
            // Existing attendance-page filter remains unchanged.
            normalHierarchySql += " AND u.sectionId = @sectionId";

            // Download follows the Dashboard's canonical section hierarchy.
            dashboardHierarchySql +=
                getDashboardAttendanceSectionSql("u");

            request.input("sectionId", sql.Int, sectionFilterId);
        }

        if (lineFilterId) {
            normalHierarchySql += " AND u.lineId = @lineId";
            dashboardHierarchySql += " AND u.lineId = @lineId";
            request.input("lineId", sql.Int, lineFilterId);
        }

        let sqlQuery;

        if (dashboardDownload) {
            /*
             * Dashboard attendance conditions:
             * - Attendance status must be P/PRESENT/Present.
             * - Common getEligibleUserSql() applies isDeleted = 0,
             *   isTemporary = 0, valid empId and the same shutter/off
             *   designation exclusions used by Dashboard graphs.
             * - COUNT on Dashboard is DISTINCT u.id, so ROW_NUMBER returns
             *   only one downloadable row for each eligible employee.
             */
            sqlQuery = `
                WITH DashboardPresentAttendance AS (
                    SELECT
                        al.id AS attendanceId,
                        al.userId,
                        u.fullName,
                        u.empId,
                        al.[date],
                        al.payCode,
                        al.cardNo,
                        al.employeeName AS attEmployeeName,
                        al.department AS attDepartment,
                        al.designation,
                        al.shift,
                        CONVERT(VARCHAR(5), al.startTime, 108) AS startTime,
                        CONVERT(VARCHAR(5), al.inTime, 108) AS inTime,
                        CONVERT(VARCHAR(5), al.outTime, 108) AS outTime,
                        al.hrsWorked,
                        al.status,
                        al.earlyArrival,
                        al.lateArrival,
                        al.earlyDeparture,
                        al.otHrs,
                        al.otAmount,
                        al.updatedBy,
                        al.updatedByRole,
                        al.updatedAt,
                        ROW_NUMBER() OVER (
                            PARTITION BY u.id
                            ORDER BY
                                CASE
                                    WHEN al.updatedAt IS NULL THEN 1
                                    ELSE 0
                                END,
                                al.updatedAt DESC,
                                al.id DESC
                        ) AS employeeRowNumber
                    FROM attendance_logs al
                    INNER JOIN users u
                        ON al.userId = u.id
                    WHERE CONVERT(DATE, al.[date]) = CONVERT(DATE, @date, 23)
                      AND UPPER(LTRIM(RTRIM(CAST(al.status AS NVARCHAR(100)))))
                          IN ('P', 'PRESENT')
                      ${dashboardHierarchySql}
                      ${getEligibleUserSql("u")}
                )
                SELECT
                    attendanceId,
                    userId,
                    fullName,
                    empId,
                    [date],
                    payCode,
                    cardNo,
                    attEmployeeName,
                    attDepartment,
                    designation,
                    shift,
                    startTime,
                    inTime,
                    outTime,
                    hrsWorked,
                    status,
                    earlyArrival,
                    lateArrival,
                    earlyDeparture,
                    otHrs,
                    otAmount,
                    updatedBy,
                    updatedByRole,
                    updatedAt
                FROM DashboardPresentAttendance
                WHERE employeeRowNumber = 1
                ORDER BY cardNo ASC, empId ASC
            `;
        } else {
            // Original attendance page behavior — unchanged.
            sqlQuery = `
                SELECT
                    al.id AS attendanceId,
                    al.userId,
                    u.fullName,
                    u.empId,
                    al.[date],
                    al.payCode,
                    al.cardNo,
                    al.employeeName AS attEmployeeName,
                    al.department AS attDepartment,
                    al.designation,
                    al.shift,
                    CONVERT(VARCHAR(5), al.startTime, 108) AS startTime,
                    CONVERT(VARCHAR(5), al.inTime, 108) AS inTime,
                    CONVERT(VARCHAR(5), al.outTime, 108) AS outTime,
                    al.hrsWorked,
                    al.status,
                    al.earlyArrival,
                    al.lateArrival,
                    al.earlyDeparture,
                    al.otHrs,
                    al.otAmount,
                    al.updatedBy,
                    al.updatedByRole,
                    al.updatedAt
                FROM attendance_logs al
                LEFT JOIN users u
                    ON al.userId = u.id
                WHERE CONVERT(VARCHAR, al.[date], 23) = @date
                  ${normalHierarchySql}
                ORDER BY al.cardNo ASC
            `;
        }

        logger.info(
            `Attendance SQL mode=${
                dashboardDownload ? "dashboard-download" : "normal"
            }, date=${date}`
        );

        const result = await request.query(sqlQuery);
        const rows = result.recordset || [];

        const attendanceData = rows.map((row) => ({
            id: row.attendanceId,
            userId: row.userId,
            name: row.fullName || row.attEmployeeName || "N/A",
            empId: row.empId,
            date: formatMssqlDate(row.date),
            payCode: row.payCode,
            cardNo: row.cardNo,
            department: row.attDepartment,
            designation: row.designation,
            shift: row.shift,
            startTime: formatMssqlTime(row.startTime),
            inTime: formatMssqlTime(row.inTime),
            outTime: formatMssqlTime(row.outTime),
            hrsWorked: row.hrsWorked,
            status: row.status || "Absent",
            earlyArrival: row.earlyArrival,
            lateArrival: row.lateArrival,
            earlyDeparture: row.earlyDeparture,
            otHrs: row.otHrs,
            otAmount: row.otAmount,
            updatedBy: row.updatedBy,
            updatedByRole: row.updatedByRole,
            updatedAt: row.updatedAt,
        }));

        return res.status(200).json({
            success: true,
            data: attendanceData,
            meta: dashboardDownload
                ? {
                    mode: "dashboard-present-download",
                    totalEmployees: attendanceData.length,
                    date,
                }
                : undefined,
        });
    } catch (error) {
        console.error("Get attendance error:", error);

        if (error?.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        next(error);
    }
};

export const getFilters = async (req, res, next) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();

        // Fetch full hierarchy
        const departments = await request.query("SELECT id, name FROM departments ORDER BY name");
        const sections = await request.query("SELECT id, name, departmentId FROM sections ORDER BY name");
        const lines = await request.query("SELECT id, name, sectionId FROM [lines] ORDER BY name");

        res.status(200).json({
            success: true,
            departments: departments.recordset,
            sections: sections.recordset,
            lines: lines.recordset
        });
    } catch (error) {
        console.error("Get filters error:", error);
        next(error);
    }
};

export const getMissingAttendance = async (req, res, next) => {
    try {
        const { date, departmentId, sectionId, lineId, search, page = 1, limit = 10 } = req.query;

        if (!date) {
            return res.status(400).json({ success: false, message: "Date is required" });
        }

        const pool = await poolPromise;

        let whereClauses = [
            "(u.isDeleted = 0 OR u.isDeleted IS NULL)",
            "(u.status IS NULL OR u.status NOT IN ('LEFT', 'SUSPENDED', 'BANNED'))",
            "al.id IS NULL"
        ];

        const countRequest = pool.request();
        const dataRequest = pool.request();

        countRequest.input('date', sql.VarChar, date);
        dataRequest.input('date', sql.VarChar, date);

        if (departmentId && departmentId !== 'all') {
            whereClauses.push("u.departmentId = @deptId");
            countRequest.input('deptId', sql.Int, departmentId);
            dataRequest.input('deptId', sql.Int, departmentId);
        }

        if (sectionId && sectionId !== 'all') {
            whereClauses.push("u.sectionId = @sectionId");
            countRequest.input('sectionId', sql.Int, sectionId);
            dataRequest.input('sectionId', sql.Int, sectionId);
        }

        if (lineId && lineId !== 'all') {
            whereClauses.push("u.lineId = @lineId");
            countRequest.input('lineId', sql.Int, lineId);
            dataRequest.input('lineId', sql.Int, lineId);
        }

        if (search) {
            whereClauses.push("(u.fullName LIKE @search OR u.empId LIKE @search OR u.idCard LIKE @search)");
            countRequest.input('search', sql.VarChar, `%${search}%`);
            dataRequest.input('search', sql.VarChar, `%${search}%`);
        }

        const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

        const countQuery = `
            SELECT COUNT(DISTINCT u.id) as total
            FROM users u
            LEFT JOIN attendance_logs al
                ON al.userId = u.id
                AND CONVERT(date, al.[date]) = @date
            ${whereSql}
        `;

        const countResult = await countRequest.query(countQuery);
        const totalCount = countResult.recordset[0].total;

        const parsedPage = parseInt(page) || 1;
        const parsedLimit = parseInt(limit) || 10;
        const offset = (parsedPage - 1) * parsedLimit;

        dataRequest.input('offset', sql.Int, offset);
        dataRequest.input('limit', sql.Int, parsedLimit);

        const dataQuery = `
            SELECT DISTINCT
                u.id,
                u.empId,
                u.idCard as cardNo,
                u.fullName,
                COALESCE(d.name, u.department) as department,
                COALESCE(s.name, u.section) as section,
                COALESCE(l.name, u.line) as line,
                u.designation,
                u.shift
            FROM users u
            LEFT JOIN departments d ON u.departmentId = d.id
            LEFT JOIN sections s ON u.sectionId = s.id
            LEFT JOIN [lines] l ON u.lineId = l.id
            LEFT JOIN attendance_logs al
                ON al.userId = u.id
                AND CONVERT(date, al.[date]) = @date
            ${whereSql}
            ORDER BY u.fullName ASC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;

        logger.info(`Missing Attendance SQL Query: ${dataQuery}`);
        const dataResult = await dataRequest.query(dataQuery);
        const rows = dataResult.recordset;

        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                totalCount,
                currentPage: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(totalCount / parsedLimit)
            }
        });

    } catch (error) {
        console.error("Get missing attendance error:", error);
        next(error);
    }
};

export const getUnmappedPresent = async (req, res, next) => {
    try {
        const { date, search, page = 1, limit = 25 } = req.query;

        if (!date) {
            return res.status(400).json({ success: false, message: "Date is required" });
        }

        const pool = await poolPromise;

        const normalizedUnmappedPayCodeSql = `
            UPPER(
                REPLACE(
                    CASE
                        WHEN RIGHT(LTRIM(RTRIM(CAST(attendance_unmapped_logs.payCode AS NVARCHAR(100)))), 2) = '.0'
                        THEN LEFT(
                            LTRIM(RTRIM(CAST(attendance_unmapped_logs.payCode AS NVARCHAR(100)))),
                            LEN(LTRIM(RTRIM(CAST(attendance_unmapped_logs.payCode AS NVARCHAR(100))))) - 2
                        )
                        ELSE LTRIM(RTRIM(CAST(attendance_unmapped_logs.payCode AS NVARCHAR(100))))
                    END,
                    ' ',
                    ''
                )
            )
        `;

        const normalizedUserEmpIdSql = `
            UPPER(
                REPLACE(
                    CASE
                        WHEN RIGHT(LTRIM(RTRIM(CAST(matchedUser.empId AS NVARCHAR(100)))), 2) = '.0'
                        THEN LEFT(
                            LTRIM(RTRIM(CAST(matchedUser.empId AS NVARCHAR(100)))),
                            LEN(LTRIM(RTRIM(CAST(matchedUser.empId AS NVARCHAR(100))))) - 2
                        )
                        ELSE LTRIM(RTRIM(CAST(matchedUser.empId AS NVARCHAR(100))))
                    END,
                    ' ',
                    ''
                )
            )
        `;

        let whereClauses = [
            "CONVERT(date, [date]) = @date",
            "UPPER(LTRIM(RTRIM(status))) = 'PRESENT'",
            `NOT EXISTS (
                SELECT 1
                FROM users matchedUser
                WHERE matchedUser.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(matchedUser.empId AS NVARCHAR(100)))) <> ''
                  AND ${normalizedUserEmpIdSql} = ${normalizedUnmappedPayCodeSql}
            )`
        ];

        const countRequest = pool.request();
        const dataRequest = pool.request();

        countRequest.input('date', sql.VarChar, date);
        dataRequest.input('date', sql.VarChar, date);

        if (search) {
            whereClauses.push("(payCode LIKE @search OR cardNo LIKE @search OR employeeName LIKE @search OR department LIKE @search OR designation LIKE @search OR shift LIKE @search)");
            countRequest.input('search', sql.VarChar, `%${search}%`);
            dataRequest.input('search', sql.VarChar, `%${search}%`);
        }

        const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

        const countQuery = `
            SELECT COUNT(DISTINCT payCode) as total
            FROM attendance_unmapped_logs
            ${whereSql}
        `;

        const countResult = await countRequest.query(countQuery);
        const totalCount = countResult.recordset[0].total;

        const parsedPage = parseInt(page) || 1;
        const parsedLimit = parseInt(limit) || 25;
        const offset = (parsedPage - 1) * parsedLimit;

        dataRequest.input('offset', sql.Int, offset);
        dataRequest.input('limit', sql.Int, parsedLimit);

        const dataQuery = `
            SELECT DISTINCT
                payCode,
                cardNo,
                employeeName,
                department,
                designation,
                shift,
                status,
                CONVERT(VARCHAR(5), inTime, 108) AS inTime,
                CONVERT(VARCHAR(5), outTime, 108) AS outTime,
                hrsWorked,
                reason
            FROM attendance_unmapped_logs
            ${whereSql}
            ORDER BY employeeName ASC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;

        logger.info(`Unmapped Present SQL Query: ${dataQuery}`);
        const dataResult = await dataRequest.query(dataQuery);
        const rows = dataResult.recordset;

        const formatMssqlTime = (val) => {
            if (!val || !(val instanceof Date)) return val;
            return val.toISOString().substr(11, 5);
        };

        const formattedRows = rows.map(row => ({
            ...row,
            inTime: formatMssqlTime(row.inTime),
            outTime: formatMssqlTime(row.outTime)
        }));

        res.status(200).json({
            success: true,
            data: formattedRows,
            pagination: {
                totalCount,
                currentPage: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(totalCount / parsedLimit)
            }
        });

    } catch (error) {
        console.error("Get unmapped present error:", error);
        next(error);
    }
};
