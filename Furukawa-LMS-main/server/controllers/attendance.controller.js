
// New 
import AttendanceLog from "../models/attendanceLog.model.js";
import User from "../models/auth.model.js";
import xlsx from "xlsx";
import logger from "../logger/winston.logger.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";

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
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        const workbook = xlsx.read(req.file.buffer, {
            type: "buffer",
            cellDates: true,
            raw: false,
        });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows2D = xlsx.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            blankrows: false
        });

        if (!rows2D.length) {
            return res.status(400).json({
                success: false,
                message: "Sheet is empty"
            });
        }

        const clean = (v) =>
            String(v || "")
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

        const normalizeText = (v) =>
            String(v || "").trim();

        const normalizeCardNo = (v) =>
            String(v || "")
                .trim()
                .replace(/\.0$/, "")
                .replace(/\s+/g, "")
                .toLowerCase();

        const normalizeStatus = (v) => {
            const val = String(v || "").trim().toLowerCase();

            if (val === "p" || val === "present") return "Present";
            if (val === "a" || val === "absent") return "Absent";
            if (val === "hd" || val === "halfday" || val === "half day") return "Half Day";
            if (val === "l" || val === "leave") return "Leave";

            return "Present";
        };

        const parseTime = (timeVal) => {
            if (!timeVal) return null;

            if (timeVal instanceof Date) {
                const h = timeVal.getHours();
                const m = timeVal.getMinutes();
                const s = timeVal.getSeconds();
                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }

            const str = String(timeVal).trim();

            const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
            if (match) {
                let [, h, m, s, mer] = match;
                h = parseInt(h, 10);
                m = parseInt(m, 10);
                s = s ? parseInt(s, 10) : 0;

                if (mer) {
                    if (mer.toUpperCase() === "PM" && h < 12) h += 12;
                    if (mer.toUpperCase() === "AM" && h === 12) h = 0;
                }

                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }

            return null;
        };

        const parseHours = (v) => {
            const n = parseFloat(String(v || "").trim());
            return isNaN(n) ? 0 : n;
        };

        const formatDateToYMD = (day, month, year) => {
            return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        };

        const parseDateFromFilename = (filename) => {
            if (!filename) return null;

            const base = String(filename).split("/").pop().split("\\").pop();

            const match = base.match(/(\d{1,2})[.\-_\/](\d{1,2})[.\-_\/](\d{4})/);
            if (!match) return null;

            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const year = parseInt(match[3], 10);

            if (!day || !month || !year) return null;
            if (day > 31 || month > 12) return null;

            return formatDateToYMD(day, month, year);
        };

        const parseDateFromSheetText = (rows) => {
            for (let i = 0; i < Math.min(rows.length, 15); i++) {
                const row = rows[i] || [];

                for (const cell of row) {
                    const text = String(cell || "").trim();
                    if (!text) continue;

                    const match = text.match(/date\s*[:\-]?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
                    if (match) {
                        const day = parseInt(match[1], 10);
                        const month = parseInt(match[2], 10);
                        const year = parseInt(match[3], 10);

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
            parseDateFromSheetText(rows2D);

        if (!attendanceDate) {
            return res.status(400).json({
                success: false,
                message: "Attendance date not found from file name or sheet content"
            });
        }

        let headerRowIndex = -1;

        for (let i = 0; i < Math.min(rows2D.length, 20); i++) {
            const row = rows2D[i].map(clean);

            if (
                row.includes("paycode") ||
                row.includes("cardno") ||
                (row.some(c => c.includes("pay")) && row.some(c => c.includes("card")))
            ) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            return res.status(400).json({
                success: false,
                message: "Header row not found"
            });
        }

        const headers = rows2D[headerRowIndex].map(clean);

        const columnMap = {
            payCode: headers.findIndex(h => h === "paycode" || h.includes("paycode") || h.includes("pay")),
            cardNo: headers.findIndex(h => h === "cardno" || h.includes("card")),
            employeeName: headers.findIndex(h => h === "employeename" || h.includes("name")),
            department: headers.findIndex(h => h.includes("department") || h.includes("dept")),
            shift: headers.findIndex(h => h.includes("shift")),
            inTime: headers.findIndex(h => h === "in" || h.includes("intime")),
            outTime: headers.findIndex(h => h === "out" || h.includes("outtime")),
            hrsWorked: headers.findIndex(h => h.includes("hrsworks") || h.includes("hrsworked") || h.includes("hrs")),
            status: headers.findIndex(h => h.includes("status"))
        };

        if (columnMap.cardNo === -1) {
            return res.status(400).json({
                success: false,
                message: "Card No column not found in Excel"
            });
        }

        const dataRows = rows2D
            .slice(headerRowIndex + 1)
            .filter(row => {
                const cardNo = row[columnMap.cardNo];
                return normalizeText(cardNo);
            });

        const pool = await poolPromise;

        const usersResult = await pool.request().query(`
            SELECT id, idCard
            FROM users
            WHERE idCard IS NOT NULL
              AND LTRIM(RTRIM(idCard)) <> ''
        `);

        const userMapByIdCard = new Map();

        usersResult.recordset.forEach((u) => {
            const normalizedIdCard = normalizeCardNo(u.idCard);
            if (normalizedIdCard) {
                userMapByIdCard.set(normalizedIdCard, u.id);
            }
        });

        // ✅ FIXED: Removed createdAt from INSERT — column does not exist in attendance_logs table
        const mergeSql = `
            MERGE attendance_logs AS target
            USING (SELECT @userId AS userId, @date AS [date]) AS source
            ON target.userId = source.userId AND target.[date] = source.[date]
            WHEN MATCHED THEN 
                UPDATE SET
                    payCode = @payCode,
                    cardNo = @cardNo,
                    employeeName = @empName,
                    department = @dept,
                    shift = @shift,
                    inTime = @inT,
                    outTime = @outT,
                    hrsWorked = @hrs,
                    status = @status,
                    updatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (
                    userId,
                    payCode,
                    cardNo,
                    employeeName,
                    [date],
                    department,
                    shift,
                    inTime,
                    outTime,
                    hrsWorked,
                    status,
                    updatedAt
                )
                VALUES (
                    @userId,
                    @payCode,
                    @cardNo,
                    @empName,
                    @date,
                    @dept,
                    @shift,
                    @inT,
                    @outT,
                    @hrs,
                    @status,
                    GETDATE()
                );
        `;

        let inserted = 0;
        let skipped = 0;
        const skippedRows = [];

        for (let index = 0; index < dataRows.length; index++) {
            const row = dataRows[index];

            const rawCardNo = row[columnMap.cardNo];
            const normalizedCardNo = normalizeCardNo(rawCardNo);

            if (!normalizedCardNo) {
                skipped++;
                skippedRows.push({
                    rowNumber: headerRowIndex + 2 + index,
                    reason: "Card No missing"
                });
                continue;
            }

            const userId = userMapByIdCard.get(normalizedCardNo);

            if (!userId) {
                skipped++;
                skippedRows.push({
                    rowNumber: headerRowIndex + 2 + index,
                    cardNo: rawCardNo,
                    reason: "No matching user found by idCard"
                });
                continue;
            }

            const payCode =
                columnMap.payCode !== -1
                    ? normalizeText(row[columnMap.payCode]).replace(/\.0$/, "")
                    : null;

            const reqDB = pool.request();

            reqDB.input("userId", sql.Int, userId);
            reqDB.input("payCode", sql.VarChar, payCode || null);
            reqDB.input("cardNo", sql.VarChar, normalizeText(rawCardNo) || null);
            reqDB.input("empName", sql.VarChar, columnMap.employeeName !== -1 ? normalizeText(row[columnMap.employeeName]) || null : null);
            reqDB.input("date", sql.Date, attendanceDate);
            reqDB.input("dept", sql.VarChar, columnMap.department !== -1 ? normalizeText(row[columnMap.department]) || null : null);
            reqDB.input("shift", sql.VarChar, columnMap.shift !== -1 ? normalizeText(row[columnMap.shift]) || null : null);
            reqDB.input("inT", sql.VarChar, columnMap.inTime !== -1 ? parseTime(row[columnMap.inTime]) : null);
            reqDB.input("outT", sql.VarChar, columnMap.outTime !== -1 ? parseTime(row[columnMap.outTime]) : null);
            reqDB.input("hrs", sql.Float, columnMap.hrsWorked !== -1 ? parseHours(row[columnMap.hrsWorked]) : 0);
            reqDB.input("status", sql.VarChar, columnMap.status !== -1 ? normalizeStatus(row[columnMap.status]) : "Present");

            await reqDB.query(mergeSql);
            inserted++;
        }

        return res.status(200).json({
            success: true,
            message: "Attendance uploaded successfully",
            fileName: uploadedFileName,
            attendanceDate,
            insertedRecords: inserted,
            skippedEmployees: skipped,
            totalRows: dataRows.length,
            skippedRows
        });

    } catch (error) {
        console.error("Attendance Upload Error:", error);

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
    return val.toISOString().split('T')[0];
};

export const getAttendance = async (req, res, next) => {
    try {
        console.log("getAttendance called");
        const { date, sectionId, lineId } = req.query;

        if (!date) {
            return res.status(400).json({ success: false, message: "Date is required" });
        }

        const pool = await poolPromise;
        const request = pool.request();

        // Ab hum sirf attendance_logs se data le rahe hain, par empId users table se chahiye
        let sqlQuery = `
            SELECT 
                al.id as attendanceId,
                al.userId,
                u.fullName, 
                u.empId,
                al.date,
                al.payCode,
                al.cardNo,
                al.department as attDepartment,
                al.designation,
                al.shift,
                al.startTime,
                al.inTime,
                al.outTime,
                al.hrsWorked,
                al.status,
                al.lateArrival,
                al.earlyDeparture,
                al.otHrs,
                al.otAmount,
                al.updatedBy,
                al.updatedByRole,
                al.updatedAt
            FROM attendance_logs al
            LEFT JOIN users u ON al.userId = u.id
            WHERE CONVERT(VARCHAR, al.date, 23) = @date
        `;

        request.input('date', sql.VarChar, date);

        // Filters
        if (sectionId && sectionId !== 'all') {
            const isNumeric = !isNaN(parseInt(sectionId));
            if (isNumeric) {
                sqlQuery += ` AND u.sectionId = @sectionId`;
                request.input('sectionId', sql.Int, sectionId);
            } else {
                // If it's a name like 'C&C'
                sqlQuery += ` AND u.department = @sectionName`;
                request.input('sectionName', sql.VarChar, sectionId);
            }
        }

        if (lineId && lineId !== 'all') {
            const isNumeric = !isNaN(parseInt(lineId));
            if (isNumeric) {
                sqlQuery += ` AND u.subSectionId = @lineId`;
                request.input('lineId', sql.Int, lineId);
            } else {
                // If it's a name
                sqlQuery += ` AND u.lineName = @lineName`;
                request.input('lineName', sql.VarChar, lineId);
            }
        }

        logger.info(`📝 SQL Query: ${sqlQuery}`);

        sqlQuery += ` ORDER BY al.cardNo ASC`;

        const result = await request.query(sqlQuery);
        const rows = result.recordset;

        // Format response
        const attendanceData = rows.map(row => ({
            id: row.attendanceId,
            userId: row.userId,
            name: row.fullName || "N/A",
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
            status: row.status || 'Absent',
            lateArrival: row.lateArrival,
            earlyDeparture: row.earlyDeparture,
            otHrs: row.otHrs,
            otAmount: row.otAmount,
            updatedBy: row.updatedBy,
            updatedByRole: row.updatedByRole,
            updatedAt: row.updatedAt
        }));

        res.status(200).json({ success: true, data: attendanceData });

    } catch (error) {
        console.error("Get attendance error:", error);
        next(error);
    }
};

export const getFilters = async (req, res, next) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const sections = await request.query("SELECT id, name FROM departments ORDER BY name");
        const lines = await request.query("SELECT id, name, sectionId FROM [lines] ORDER BY name");

        res.status(200).json({
            success: true,
            sections: sections.recordset,
            lines: lines.recordset
        });
    } catch (error) {
        next(error);
    }
};