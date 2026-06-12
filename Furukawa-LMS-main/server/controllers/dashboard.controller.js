import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";

const parseMultiParam = (value) => {
    if (!value) return [];
    const strVal = String(value).trim();
    const upperVal = strVal.toUpperCase();
    if (upperVal === "ALL" || upperVal === "UNDEFINED" || upperVal === "NULL" || strVal === "") return [];
    return strVal
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .filter(item => {
            const upper = item.toUpperCase();
            return upper !== "ALL" && upper !== "UNDEFINED" && upper !== "NULL" && item !== "";
        });
};

export const getDashboardStats = asyncHandler(async (req, res) => {
    const {
        department,
        section,
        line,
        startDate,
        endDate,
        stateFilter,
        districtFilter,
        masterAttendanceMode,
        shift,
    } = req.query;

    const selectedShiftValue = shift && String(shift).trim().toUpperCase() !== 'ALL' ? String(shift).trim() : null;


    function addShiftFilter(sqlText, params, alias = "al") {
        if (!selectedShiftValue) return sqlText;

        const shiftColumn = `UPPER(LTRIM(RTRIM(CAST(${alias}.shift AS NVARCHAR(100)))))`;
        const shiftColumnCompact = `REPLACE(REPLACE(REPLACE(${shiftColumn}, ' ', ''), '-', ''), '_', '')`;

        sqlText += `
            AND (
                ${shiftColumn} = UPPER(LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = 'SHIFT' + REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '') + 'SHIFT'
                OR ${shiftColumnCompact} LIKE '%' + REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '') + '%'
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND ${shiftColumnCompact} IN ('G', 'GEN', 'GENERAL', 'GENERALSHIFT', 'SHIFTG', 'GSHIFT')
                )
            )
        `;

        params.push(
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue
        );

        return sqlText;
    }

    // Same shift matching logic, but for users table.
    // This is used for Users Total/master bars so they are fetched from users table,
    // not from attendance_logs. It fixes missing employees in Contractor and other master graphs.
    function addUserShiftFilter(sqlText, params, alias = "u") {
        if (!selectedShiftValue) return sqlText;

        const shiftColumn = `UPPER(LTRIM(RTRIM(CAST(${alias}.shift AS NVARCHAR(100)))))`;
        const shiftColumnCompact = `REPLACE(REPLACE(REPLACE(${shiftColumn}, ' ', ''), '-', ''), '_', '')`;

        sqlText += `
            AND (
                ${shiftColumn} = UPPER(LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = 'SHIFT' + REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '')
                OR ${shiftColumnCompact} = REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '') + 'SHIFT'
                OR ${shiftColumnCompact} LIKE '%' + REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(?))), ' ', ''), '-', ''), '_', '') + '%'
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND ${shiftColumnCompact} IN ('G', 'GEN', 'GENERAL', 'GENERALSHIFT', 'SHIFTG', 'GSHIFT')
                )
            )
        `;

        params.push(
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue
        );

        return sqlText;
    }

    const isMasterAttendanceMode =
        String(masterAttendanceMode || "").toUpperCase() === "YES";

    // Jab user date/date-range select kare, to selected attendance date available hai ya nahi check hoga.
    // Agar attendance upload nahi hai, to dashboard me old/master/snapshot data show nahi hoga.
    const hasSelectedDateForDashboard = Boolean(startDate);

    const safeName = (s) => String(s || "").replace(/'/g, "''");

    const departmentIds = parseMultiParam(department);
    const sectionIds = parseMultiParam(section);
    const lineIds = parseMultiParam(line);

    const getNamesByIds = async (table, ids) => {
        if (!ids.length) return [];

        const numericIds = ids
            .map(id => parseInt(id, 10))
            .filter(id => !Number.isNaN(id));

        if (!numericIds.length) return [];

        try {
            const placeholders = numericIds.map(() => "?").join(",");
            const [rows] = await executeQuery(
                `SELECT name FROM [${table}] WHERE id IN (${placeholders})`,
                numericIds
            );
            return rows.map(row => String(row.name || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn(`[DASHBOARD] ${table} lookup failed:`, e.message);
            return [];
        }
    };

    const departmentNames = await getNamesByIds("departments", departmentIds);
    const sectionNames = await getNamesByIds("sections", sectionIds);
    const lineNames = await getNamesByIds("lines", lineIds);

    const departmentName = departmentNames[0] || null;
    const sectionName = sectionNames[0] || null;
    const lineName = lineNames[0] || null;

    const buildNameInCondition = (columnSql, names) => {
        if (!names || names.length === 0) return "";
        const safeValues = names.map(name => `'${safeName(name)}'`).join(",");
        return ` AND UPPER(LTRIM(RTRIM(${columnSql}))) IN (${safeValues.split(",").map(v => `UPPER(${v})`).join(",")})`;
    };

    let hierCondition = "";
    hierCondition += buildNameInCondition("uhs.[department]", departmentNames);
    hierCondition += buildNameInCondition("uhs.[section]", sectionNames);
    hierCondition += buildNameInCondition("uhs.[lines]", lineNames);

    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ⚠️ TIMEZONE FIX:
    // new Date("2026-05-17") parses as UTC midnight (2026-05-17T00:00:00Z).
    // In IST (UTC+5:30), setHours(0,0,0,0) then resets to IST midnight
    // which is 2026-05-16T18:30:00Z — so formatDateLocal returns "2026-05-16"!
    // Fix: parse date strings manually so date is created in LOCAL timezone.
    const parseDateLocal = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = String(dateStr).split("-").map(Number);
        if (!y || !m || !d) return null;
        const date = new Date(y, m - 1, d, 0, 0, 0, 0); // local timezone
        return date;
    };

    let rangeStart;
    let rangeEnd;

    if (startDate) {
        rangeStart = parseDateLocal(startDate) || new Date(today);
        rangeEnd = parseDateLocal(endDate || startDate) || new Date(today);
    } else {
        rangeEnd = new Date(today);
        rangeStart = new Date(today);
        rangeStart.setDate(rangeStart.getDate() - 29);
    }

    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const sqlStartDate = formatDateLocal(rangeStart);
    const sqlEndDate = formatDateLocal(rangeEnd);

    let loopDates = [];
    let currDate = new Date(rangeStart);

    while (currDate <= rangeEnd) {
        loopDates.push(new Date(currDate));
        currDate.setDate(currDate.getDate() + 1);
    }

    const yearsInRange = [...new Set(loopDates.map((d) => d.getFullYear()))];

    // ============================================================
    // FIX: Selected date attendance gate
    // ============================================================
    // Pehle problem:
    // 17/05/2026 ki attendance upload nahi thi, fir bhi graph me data aa raha tha.
    // Reason:
    // getDashboardStats me attendance availability check nahi tha.
    // Snapshot, requirement, users master aur leavingDate se data aa raha tha.
    //
    // Ab logic:
    // Agar user date/date-range select kare aur us range me attendance_logs me data nahi hai,
    // to all graphs zero/empty return honge.
    // ============================================================
    if (hasSelectedDateForDashboard) {
        try {
            let attendanceGateSql = `
                SELECT COUNT(DISTINCT al.payCode) AS cnt
                FROM attendance_logs al
                LEFT JOIN users u
                    ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE CONVERT(DATE, al.[date]) >= '${sqlStartDate}'
                  AND CONVERT(DATE, al.[date]) <= '${sqlEndDate}'
                  ${hierCondition}
            `;
            const gateParams = [];
            attendanceGateSql = addShiftFilter(attendanceGateSql, gateParams, "al");

            const [gateRows] = await executeQuery(attendanceGateSql, gateParams);
            const attendanceRowsAvailable = Number(gateRows?.[0]?.cnt || 0) > 0;

            if (!attendanceRowsAvailable && !selectedShiftValue) {
                const emptyManpowerData = loopDates.map((iterDateRaw) => {
                    const iterDate = new Date(iterDateRaw);
                    const day = iterDate.getDate();
                    const monthShort = iterDate.toLocaleString("en-US", { month: "short" });

                    return {
                        month: `${day} ${monthShort}`,
                        day,
                        required: 0,
                        current: 0,
                        present: 0,
                        absent: 0,
                    };
                });

                const emptyAbsenteeismData = loopDates.map((iterDateRaw) => {
                    const iterDate = new Date(iterDateRaw);
                    const day = iterDate.getDate();
                    const monthShort = iterDate.toLocaleString("en-US", { month: "short" });

                    return {
                        day: `${day} ${monthShort}`,
                        actual: 0,
                        absent: 0,
                        total: 0,
                        limit: 10,
                    };
                });

                const emptyAttritionData = loopDates.map((iterDateRaw) => {
                    const iterDate = new Date(iterDateRaw);
                    const day = iterDate.getDate();
                    const monthShort = iterDate.toLocaleString("en-US", { month: "short" });

                    return {
                        day: `${day} ${monthShort}`,
                        actual: 0,
                        leftCount: 0,
                        totalHeadcount: 0,
                        target: 2.0,
                    };
                });

                const [sOptions, dOptions] = await Promise.all([
                    getStateOptions().catch(() => []),
                    getDistrictOptions().catch(() => []),
                ]);

                return res.status(200).json(
                    new ApiResponse(
                        200,
                        {
                            manpowerData: emptyManpowerData,
                            absenteeismData: emptyAbsenteeismData,
                            attritionData: emptyAttritionData,
                            skillGapData: [],
                            pieCharts: {
                                skillLevels: [],
                                gender: [],
                                state: [],
                                district: [],
                                designation: [],
                                leaderExpert: [],
                                leaderExpertTotalEmployees: 0,
                                contractorPrefix: [],
                                stateOptions: sOptions,
                                districtOptions: dOptions,
                                education: [],
                            },
                            filters: {
                                departmentName,
                                sectionName,
                                lineName,
                                snapshotTotal: 0,
                                startDate: sqlStartDate,
                                endDate: sqlEndDate,
                                masterStartDate: sqlStartDate,
                                masterEndDate: sqlEndDate,
                                stateFilter: stateFilter || "ALL",
                                districtFilter: districtFilter || "ALL",
                                masterAttendanceMode: "YES",
                                masterAttendanceDate: null,
                                attendanceDateAvailable: false,
                                attendanceLogic:
                                    "Selected date/range attendance not found in attendance_logs. All dashboard graphs returned as zero/empty to avoid wrong data.",
                            },
                            debug: {
                                requiredStartDate: sqlStartDate,
                                requiredEndDate: sqlEndDate,
                                attendanceRows: 0,
                                reason:
                                    "No attendance found in attendance_logs for selected date/range after selected hierarchy/shift filters.",
                            },
                        },
                        "Selected date attendance not uploaded. No dashboard data shown."
                    )
                );
            }
        } catch (e) {
            console.warn("[DASHBOARD] Attendance gate check failed:", e.message);

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        manpowerData: [],
                        absenteeismData: [],
                        attritionData: [],
                        skillGapData: [],
                        pieCharts: {
                            skillLevels: [],
                            gender: [],
                            state: [],
                            district: [],
                            designation: [],
                            leaderExpert: [],
                            leaderExpertTotalEmployees: 0,
                            contractorPrefix: [],
                            stateOptions: [],
                            districtOptions: [],
                            education: [],
                        },
                        filters: {
                            departmentName,
                            sectionName,
                            lineName,
                            snapshotTotal: 0,
                            startDate: sqlStartDate,
                            endDate: sqlEndDate,
                            attendanceDateAvailable: false,
                            attendanceLogic:
                                "Attendance check failed. Wrong data avoid karne ke liye dashboard graphs empty return kiye gaye.",
                        },
                        debug: {
                            requiredStartDate: sqlStartDate,
                            requiredEndDate: sqlEndDate,
                            error: e.message,
                        },
                    },
                    "Attendance check failed. No dashboard data shown."
                )
            );
        }
    }

    let reqResults = [];

    const buildInByNames = (columnName, names) => {
        if (!names || names.length === 0) return "";
        const safeValues = names.map(name => `UPPER('${safeName(name)}')`).join(",");
        return ` AND UPPER(LTRIM(RTRIM(${columnName}))) IN (${safeValues})`;
    };

    const buildReqFilterCamel = () => {
        let extra = "";
        extra += buildInByNames("departmentName", departmentNames);
        extra += buildInByNames("sectionName", sectionNames);
        extra += buildInByNames("lineDescription", lineNames);
        return extra;
    };

    const buildReqFilterSnake = () => {
        let extra = "";
        extra += buildInByNames("department_name", departmentNames);
        extra += buildInByNames("section_name", sectionNames);
        extra += buildInByNames("description_line", lineNames);
        return extra;
    };

    try {
        const filter = buildReqFilterCamel();

        const sql1 = `
            SELECT 
                [year] AS yearVal,
                monthName AS month,
                CAST(SUM(ISNULL(salesPlan,0) + ISNULL(prodPlan,0)) AS BIGINT) AS required_count
            FROM requirements
            WHERE [year] IN (${yearsInRange.join(",")}) ${filter}
            AND ISNULL(is_active, 0) = 1
            AND ISNULL(approvalStatus, 'approved') IN ('approved', 'system_approved')
            GROUP BY [year], monthName
        `;

        const [rows] = await executeQuery(sql1, []);
        reqResults = rows;
    } catch (e1) {
        try {
            const filter = buildReqFilterSnake();

            const sql2 = `
                SELECT 
                    year_val AS yearVal,
                    month_name AS month,
                    CAST(SUM(ISNULL(sales_plan,0) + ISNULL(prod_plan,0)) AS BIGINT) AS required_count
                FROM requirements
                WHERE year_val IN (${yearsInRange.join(",")}) ${filter}
                GROUP BY year_val, month_name
            `;

            const [rows] = await executeQuery(sql2, []);
            reqResults = rows;
        } catch (e2) {
            console.warn("[DASHBOARD] requirements query failed:", e2.message);
        }
    }

    const getRequirementForDate = (dateObj) => {
        const yearVal = dateObj.getFullYear();
        const monthName = dateObj.toLocaleString("en-US", { month: "long" });

        const currentReqItem = reqResults.find(
            (r) =>
                Number(r.yearVal) === Number(yearVal) &&
                String(r.month || "").trim().toLowerCase() === monthName.toLowerCase()
        );

        return currentReqItem ? Number(currentReqItem.required_count) || 0 : 0;
    };

    let snapshotTotal = 0;

    let userHierCondition = "";
    userHierCondition += buildNameInCondition("u.[department]", departmentNames);
    userHierCondition += buildNameInCondition("u.[section]", sectionNames);
    userHierCondition += buildNameInCondition("u.[line]", lineNames);

    try {
        let snapshotSql = `
            SELECT COUNT(DISTINCT u.empId) AS total
            FROM users u
            WHERE ISNULL(u.isDeleted, 0) = 0
            AND u.empId IS NOT NULL
            AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
            ${userHierCondition}
        `;
        const snapshotParams = [];
        // Current/Total Headcount users table se aata hai, isliye shift filter apply nahi hoga.
        // Shift filter sirf attendance/present related data par apply hoga.

        const [snapRows] = await executeQuery(snapshotSql, snapshotParams);

        snapshotTotal = Number(snapRows[0]?.total) || 0;
    } catch (e) {
        console.warn("[DASHBOARD] Snapshot headcount query failed:", e.message);
    }

    let dailyAttendance = [];

    try {
        let attSql = `
            SELECT
                CONVERT(VARCHAR, al.[date], 23) AS fullDate,
                DAY(al.[date]) AS dayNum,
                COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' AND u.id IS NOT NULL THEN al.payCode END) AS mappedPresentCount,
                COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' AND u.id IS NULL THEN al.payCode END) AS unmappedPresentCount,
                COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN al.payCode END) AS totalPresentCount,
                COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','LEAVE','HALF DAY') THEN al.payCode END) AS absentCount,
                COUNT(DISTINCT al.payCode) AS totalCount
            FROM attendance_logs al
            LEFT JOIN users u
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                 = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
            LEFT JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
            WHERE 1=1
              AND CONVERT(DATE, al.[date]) >= '${sqlStartDate}'
              AND CONVERT(DATE, al.[date]) <= '${sqlEndDate}'
              ${hierCondition}
        `;
        const attParams = [];
        attSql = addShiftFilter(attSql, attParams, "al");
        attSql += `
            GROUP BY al.[date], DAY(al.[date])
            ORDER BY al.[date]
        `;

        const [attRows] = await executeQuery(attSql, attParams);
        dailyAttendance = attRows;
    } catch (e) {
        console.warn("[DASHBOARD] Daily attendance query failed:", e.message);
    }

    let dailyUnmapped = [];
    try {
        let unmappedSql = `
            SELECT
                CONVERT(VARCHAR, unm.[date], 23) AS fullDate,
                COUNT(DISTINCT unm.payCode) AS unmappedCount
            FROM attendance_unmapped_logs unm
            WHERE UPPER(LTRIM(RTRIM(unm.status))) = 'PRESENT'
              AND CONVERT(DATE, unm.[date]) >= '${sqlStartDate}'
              AND CONVERT(DATE, unm.[date]) <= '${sqlEndDate}'
        `;
        const unmappedParams = [];
        unmappedSql = addShiftFilter(unmappedSql, unmappedParams, "unm");
        unmappedSql += `
            GROUP BY unm.[date]
        `;
        const [unmappedRows] = await executeQuery(unmappedSql, unmappedParams);
        dailyUnmapped = unmappedRows;
    } catch (e) {
        console.warn("[DASHBOARD] Daily unmapped query failed:", e.message);
    }

    const manpowerData = loopDates.map((iterDateRaw) => {
        const iterDate = new Date(iterDateRaw);
        const day = iterDate.getDate();
        const monthShort = iterDate.toLocaleString("en-US", { month: "short" });
        const dateStr = formatDateLocal(iterDate);

        const attItem = dailyAttendance.find((a) => a.fullDate === dateStr);
        const unmappedItem = dailyUnmapped.find((u) => u.fullDate === dateStr);

        const hasHierFilter = departmentNames.length > 0 || sectionNames.length > 0 || lineNames.length > 0;
        const unmappedCount = (!hasHierFilter && unmappedItem) ? Number(unmappedItem.unmappedCount) || 0 : 0;

        iterDate.setHours(0, 0, 0, 0);
        const isFuture = iterDate > today;

        const mappedPresent = attItem ? Number(attItem.mappedPresentCount) || 0 : 0;

        return {
            month: `${day} ${monthShort}`,
            day,
            required: getRequirementForDate(iterDate),

            // Current Headcount = total active employees from users table
            current: isFuture ? null : snapshotTotal,

            // Actual / Present = attendance present count
            present: isFuture ? null : mappedPresent,
            unmappedPresent: isFuture ? null : unmappedCount,
            totalPresent: isFuture ? null : (mappedPresent + unmappedCount),

            // Absent = attendance absent/leave/half day count
            absent: attItem ? Number(attItem.absentCount) || 0 : isFuture ? null : 0,
        };
    });

    let attritionData = [];

    try {
        let attrSql = `
            SELECT
                CONVERT(VARCHAR, parsed.leaving_date, 23) AS fullDate,
                COUNT(DISTINCT parsed.empId) AS leftCount
            FROM (
                SELECT
                    u.empId,
                    u.shift,
                    u.state,
                    u.district,
                    COALESCE(
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(u.leavingDate)), ''), 23),
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(u.leavingDate)), ''), 103),
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(u.leavingDate)), ''), 105),
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(u.leavingDate)), ''), 120)
                    ) AS leaving_date,
                    uhs.department,
                    uhs.section,
                    uhs.lines
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                    = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                WHERE u.leavingDate IS NOT NULL
                AND LTRIM(RTRIM(u.leavingDate)) != ''
            ) parsed
            WHERE parsed.leaving_date IS NOT NULL
            AND parsed.leaving_date >= '${sqlStartDate}'
            AND parsed.leaving_date <= '${sqlEndDate}'
            ${departmentName ? `AND UPPER(LTRIM(RTRIM(parsed.department))) = UPPER('${safeName(departmentName)}')` : ""}
            ${sectionName ? `AND UPPER(LTRIM(RTRIM(parsed.section))) = UPPER('${safeName(sectionName)}')` : ""}
            ${lineName ? `AND UPPER(LTRIM(RTRIM(parsed.lines))) = UPPER('${safeName(lineName)}')` : ""}
        `;
        const attrParams = [];
        if (selectedShiftValue) {
            attrSql += ` AND UPPER(LTRIM(RTRIM(parsed.shift))) = UPPER(LTRIM(RTRIM(?)))`;
            attrParams.push(selectedShiftValue);
        }
        attrSql += `
            GROUP BY parsed.leaving_date
            ORDER BY parsed.leaving_date
        `;

        const [attrRows] = await executeQuery(attrSql, attrParams);

        attritionData = loopDates
            .map((iterDateRaw) => {
                const iterDate = new Date(iterDateRaw);
                const day = iterDate.getDate();
                const monthShort = iterDate.toLocaleString("en-US", { month: "short" });
                const dateStr = formatDateLocal(iterDate);

                iterDate.setHours(0, 0, 0, 0);
                const isFuture = iterDate > today;

                if (isFuture) return null;

                const row = attrRows.find((r) => r.fullDate === dateStr);

                const leftCount = row ? Number(row.leftCount) || 0 : 0;
                const totalHeadcount = Number(snapshotTotal) || 0;

                const rate =
                    totalHeadcount > 0
                        ? Number(((leftCount / totalHeadcount) * 100).toFixed(2))
                        : 0;

                return {
                    day: `${day} ${monthShort}`,
                    actual: rate,
                    leftCount,
                    totalHeadcount,
                    target: 2.0,
                };
            })
            .filter(Boolean);
    } catch (e) {
        console.warn("[DASHBOARD] Attrition daily query failed:", e.message);
        attritionData = [];
    }

    let absenteeismData = [];

    try {
        let absSql = `
            SELECT
                CONVERT(VARCHAR, al.[date], 23) AS fullDate,
                DAY(al.[date]) AS dayNum,
                COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','LEAVE','HALF DAY') THEN al.payCode END) AS absent_count,
                COUNT(DISTINCT al.payCode) AS total_count
            FROM attendance_logs al
            LEFT JOIN users u
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                 = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
            LEFT JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
            WHERE 1=1
              AND CONVERT(DATE, al.[date]) >= '${sqlStartDate}'
              AND CONVERT(DATE, al.[date]) <= '${sqlEndDate}'
              ${hierCondition}
        `;
        const absParams = [];
        absSql = addShiftFilter(absSql, absParams, "al");
        absSql += `
            GROUP BY al.[date], DAY(al.[date])
            ORDER BY al.[date]
        `;

        const [absRows] = await executeQuery(absSql, absParams);

        absenteeismData = loopDates
            .map((iterDateRaw) => {
                const iterDate = new Date(iterDateRaw);
                const day = iterDate.getDate();
                const monthShort = iterDate.toLocaleString("en-US", { month: "short" });
                const dateStr = formatDateLocal(iterDate);

                iterDate.setHours(0, 0, 0, 0);
                const isFuture = iterDate > today;

                if (isFuture) return null;

                const row = absRows.find((r) => r.fullDate === dateStr);

                const absent = row ? Number(row.absent_count) || 0 : 0;

                // IMPORTANT:
                // Absenteeism % denominator attendance_logs ka uploaded total nahi hoga.
                // Example: agar 21 employees ka data/category available hai aur total active employees 2900 hain,
                // to percentage = absent / 2900 * 100 hoga, not absent / 21 * 100.
                const total = Number(snapshotTotal) || 0;

                const absenteeismPercentage =
                    total > 0 ? Math.round((absent / total) * 1000) / 10 : 0;

                return {
                    day: `${day} ${monthShort}`,
                    actual: absenteeismPercentage,
                    absent,
                    total,
                    limit: 10,
                };
            })
            .filter(Boolean);
    } catch (e) {
        console.warn("[DASHBOARD] Daily absenteeism query failed:", e.message);
        absenteeismData = [];
    }

    const indiaNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    indiaNow.setHours(0, 0, 0, 0);

    const yesterday = new Date(indiaNow);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdaySqlDate = formatDateLocal(yesterday);

    // Master / pie graph date range.
    // Jab date select hogi to pie/master graphs bhi selected attendance date/range se aayenge.
    let masterRangeStart = new Date(yesterday);
    let masterRangeEnd = new Date(yesterday);

    if (startDate) {
        masterRangeStart = parseDateLocal(startDate) || new Date(yesterday);
        masterRangeEnd = parseDateLocal(endDate || startDate) || new Date(yesterday);
    }

    masterRangeStart.setHours(0, 0, 0, 0);
    masterRangeEnd.setHours(0, 0, 0, 0);

    const masterSqlStartDate = formatDateLocal(masterRangeStart);
    const masterSqlEndDate = formatDateLocal(masterRangeEnd);

    function appendMultiHierarchyFilter({
        sqlText,
        params,
        unicodeColumn,
        nameColumn,
        idColumn,
        ids,
        names,
        alias,
    }) {
        const numericIds = (ids || [])
            .map(id => parseInt(id, 10))
            .filter(id => !Number.isNaN(id));

        if ((!names || names.length === 0) && numericIds.length === 0) return sqlText;

        const parts = [];

        if (numericIds.length) {
            const placeholders = numericIds.map(() => "?").join(",");
            parts.push(`${alias}.${idColumn} IN (${placeholders})`);
            params.push(...numericIds);

            parts.push(`UPPER(LTRIM(RTRIM(CAST(uhs.${unicodeColumn} AS NVARCHAR(100))))) IN (${placeholders})`);
            params.push(...numericIds.map(String));
        }

        if (names && names.length) {
            const placeholders = names.map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))").join(",");
            parts.push(`UPPER(LTRIM(RTRIM(CAST(uhs.${nameColumn} AS NVARCHAR(510))))) IN (${placeholders})`);
            params.push(...names);
        }

        if (!parts.length) return sqlText;
        return `${sqlText} AND (${parts.join(" OR ")})`;
    }

    function addUserMasterFilters(baseSql, params, alias = "u") {
        let sqlText = baseSql;

        sqlText = appendMultiHierarchyFilter({
            sqlText,
            params,
            unicodeColumn: "department_unicode",
            nameColumn: "department",
            idColumn: "departmentId",
            ids: departmentIds,
            names: departmentNames,
            alias,
        });

        sqlText = appendMultiHierarchyFilter({
            sqlText,
            params,
            unicodeColumn: "section_unicode",
            nameColumn: "section",
            idColumn: "sectionId",
            ids: sectionIds,
            names: sectionNames,
            alias,
        });

        sqlText = appendMultiHierarchyFilter({
            sqlText,
            params,
            unicodeColumn: "line_unicode",
            nameColumn: "lines",
            idColumn: "lineId",
            ids: lineIds,
            names: lineNames,
            alias,
        });

        return sqlText;
    }

    function addStateDistrictFilters(baseSql, params, options = {}) {
        let sqlText = baseSql;
        const { includeState = true, includeDistrict = true, alias = "u" } = options;

        const stateValues = parseMultiParam(stateFilter);
        const districtValues = parseMultiParam(districtFilter);

        if (includeState && stateValues.length > 0) {
            const placeholders = stateValues
                .map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))")
                .join(",");

            sqlText += `
                    AND UPPER(LTRIM(RTRIM(CAST(ISNULL(${alias}.state, '') AS NVARCHAR(510))))) IN (${placeholders})
                `;
            params.push(...stateValues);
        }

        if (includeDistrict && districtValues.length > 0) {
            const placeholders = districtValues
                .map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))")
                .join(",");

            sqlText += `
                    AND UPPER(LTRIM(RTRIM(CAST(ISNULL(${alias}.district, '') AS NVARCHAR(510))))) IN (${placeholders})
                `;
            params.push(...districtValues);
        }

        return sqlText;
    }

    const attendanceMasterBaseFrom = `
        FROM attendance_logs al
        LEFT JOIN users u
            ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
             = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
        LEFT JOIN user_hierarchy_snapshots uhs
            ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
             = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
        WHERE CONVERT(DATE, al.[date]) >= '${masterSqlStartDate}'
          AND CONVERT(DATE, al.[date]) <= '${masterSqlEndDate}'
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
    `;

    const shouldUseAttendanceMaster = true;

    const getAttendanceMasterTotal = async () => {
        try {
            let sqlText = `
                SELECT COUNT(DISTINCT al.payCode) AS total
                ${attendanceMasterBaseFrom}
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params);
            sqlText = addShiftFilter(sqlText, params, "al");

            const [rows] = await executeQuery(sqlText, params);
            return Number(rows?.[0]?.total || 0);
        } catch (e) {
            console.warn("[DASHBOARD] Attendance master total failed:", e.message);
            return 0;
        }
    };

    let attendanceMasterTotal = 0;
    if (shouldUseAttendanceMaster) {
        attendanceMasterTotal = await getAttendanceMasterTotal();
    }

    const makeEmptyPieData = () => ({
        skillLevels: [],
        gender: [],
        state: [],
        district: [],
        designation: [],
        leaderExpert: [],
        leaderExpertTotalEmployees: 0,
        contractorPrefix: [],
        stateOptions: [],
        districtOptions: [],
        education: [],
    });

    let pieCharts = makeEmptyPieData();

    const normalizeChartName = (value) => {
        const text = String(value || "").trim();
        if (!text) return "Not Provided";
        if (["NULL", "UNDEFINED", "UNKNOWN"].includes(text.toUpperCase())) return "Not Provided";
        return text;
    };

    const getGroupedAttendanceChart = async ({ columnSql, labelKey = "name", valueKey = "value", includeState = true, includeDistrict = true }) => {
        try {
            let sqlText = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT al.payCode) AS total
                ${attendanceMasterBaseFrom}
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params, { includeState, includeDistrict });
            sqlText = addShiftFilter(sqlText, params, "al");
            sqlText += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [rows] = await executeQuery(sqlText, params);
            return rows.map(row => ({
                [labelKey]: normalizeChartName(row.rawName),
                [valueKey]: Number(row.total || 0),
            })).filter(item => Number(item[valueKey] || 0) > 0);
        } catch (e) {
            console.warn("[DASHBOARD] Attendance grouped chart failed:", e.message);
            return [];
        }
    };

    const getGroupedUsersChart = async ({ columnSql, labelKey = "name", valueKey = "value", includeState = true, includeDistrict = true }) => {
        try {
            let sqlText = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT u.empId) AS total
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params, { includeState, includeDistrict });
            // Users total chart should ignore shift filter.
            sqlText += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [rows] = await executeQuery(sqlText, params);
            return rows.map(row => ({
                [labelKey]: normalizeChartName(row.rawName),
                [valueKey]: Number(row.total || 0),
            })).filter(item => Number(item[valueKey] || 0) > 0);
        } catch (e) {
            console.warn("[DASHBOARD] Users grouped chart failed:", e.message);
            return [];
        }
    };

    async function getStateOptions() {
        try {
            let sqlText = `
                SELECT DISTINCT
                    LTRIM(RTRIM(CAST(u.state AS NVARCHAR(510)))) AS stateName
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND u.state IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.state AS NVARCHAR(510)))) != ''
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addUserShiftFilter(sqlText, params, "u");
            sqlText += ` ORDER BY stateName`;
            const [rows] = await executeQuery(sqlText, params);
            return rows.map(row => String(row.stateName || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn("[DASHBOARD] state options failed:", e.message);
            return [];
        }
    }

    async function getDistrictOptions() {
        try {
            let sqlText = `
                SELECT DISTINCT
                    LTRIM(RTRIM(CAST(u.district AS NVARCHAR(510)))) AS districtName
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND u.district IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.district AS NVARCHAR(510)))) != ''
            `;
            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params, { includeState: true, includeDistrict: false });
            sqlText = addUserShiftFilter(sqlText, params, "u");
            sqlText += ` ORDER BY districtName`;
            const [rows] = await executeQuery(sqlText, params);
            return rows.map(row => String(row.districtName || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn("[DASHBOARD] district options failed:", e.message);
            return [];
        }
    }

    const getUsersTotalDenominator = async ({ includeState = true, includeDistrict = true } = {}) => {
        try {
            let sqlText = `
                SELECT COUNT(DISTINCT u.empId) AS total
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
            `;

            const params = [];
            sqlText = addUserMasterFilters(sqlText, params, "u");
            sqlText = addStateDistrictFilters(sqlText, params, { includeState, includeDistrict });

            // IMPORTANT:
            // Percentage denominator hamesha total active employees se hoga.
            // Isme category-specific WHERE (skillLevelWhere / leaderExpertWhere) apply nahi hoga,
            // warna sirf 21 skill-level employees hi 100% ban jayenge.
            // Shift filter bhi users-total denominator par apply nahi hoga.
            const [rows] = await executeQuery(sqlText, params);
            return Number(rows?.[0]?.total || 0);
        } catch (e) {
            console.warn("[DASHBOARD] Users total denominator failed:", e.message);
            return Number(snapshotTotal) || 0;
        }
    };

    const getGroupedComparisonChart = async ({
        columnSql,
        labelKey = "name",
        includeState = true,
        includeDistrict = true,
        extraWhere = "",
    }) => {
        const mapByName = {};

        const addToMap = (name, key, value) => {
            const cleanName = normalizeChartName(name);
            if (!mapByName[cleanName]) {
                mapByName[cleanName] = {
                    [labelKey]: cleanName,
                    name: cleanName,
                    value: 0,
                    attendanceValue: 0,
                    masterValue: 0,
                    rawValue: 0,
                    percentage: 0,
                };
            }
            mapByName[cleanName][key] = Number(value || 0);
        };

        try {
            let attendanceSql = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT al.payCode) AS total
                ${attendanceMasterBaseFrom}
                ${extraWhere}
            `;

            const attendanceParams = [];
            attendanceSql = addUserMasterFilters(attendanceSql, attendanceParams, "u");
            attendanceSql = addStateDistrictFilters(attendanceSql, attendanceParams, { includeState, includeDistrict });
            attendanceSql = addShiftFilter(attendanceSql, attendanceParams, "al");
            attendanceSql += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [attendanceRows] = await executeQuery(attendanceSql, attendanceParams);
            attendanceRows.forEach(row => addToMap(row.rawName, "attendanceValue", row.total));
        } catch (e) {
            console.warn("[DASHBOARD] Attendance comparison chart failed:", e.message);
        }

        try {
            let masterSql = `
                SELECT
                    ${columnSql} AS rawName,
                    COUNT(DISTINCT u.empId) AS total
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  ${extraWhere}
            `;

            const masterParams = [];
            masterSql = addUserMasterFilters(masterSql, masterParams, "u");
            masterSql = addStateDistrictFilters(masterSql, masterParams, { includeState, includeDistrict });
            // IMPORTANT:
            // Users Total / dark yellow bar par shift filter apply nahi hoga.
            // Baaki filters (department, section, line, state, district) apply rahenge.
            // Shift filter sirf Attendance / purple bar par apply hoga.

            masterSql += `
                GROUP BY ${columnSql}
                ORDER BY total DESC
            `;

            const [masterRows] = await executeQuery(masterSql, masterParams);
            masterRows.forEach(row => addToMap(row.rawName, "masterValue", row.total));
        } catch (e) {
            console.warn("[DASHBOARD] Master comparison chart failed:", e.message);
        }

        const totalEmployeesDenominator = await getUsersTotalDenominator({ includeState, includeDistrict });

        return Object.values(mapByName)
            .map(item => {
                const attendanceCount = Number(item.attendanceValue || 0);
                const masterCount = Number(item.masterValue || 0);

                return {
                    ...item,
                    value: attendanceCount,
                    rawValue: attendanceCount,

                    // IMPORTANT:
                    // Percentage category ke available records se nahi, total active employees se calculate hoga.
                    // Example: L1+L2+L3+L4 me sirf 21 employees hain aur total employees 2900 hain,
                    // to denominator 2900 rahega, 21 nahi.
                    percentage:
                        totalEmployeesDenominator > 0
                            ? Number(((attendanceCount / totalEmployeesDenominator) * 100).toFixed(1))
                            : 0,
                    attendancePercentage:
                        totalEmployeesDenominator > 0
                            ? Number(((attendanceCount / totalEmployeesDenominator) * 100).toFixed(1))
                            : 0,
                    masterPercentage:
                        totalEmployeesDenominator > 0
                            ? Number(((masterCount / totalEmployeesDenominator) * 100).toFixed(1))
                            : 0,
                    totalEmployees: totalEmployeesDenominator,
                    denominatorTotal: totalEmployeesDenominator,
                };
            })
            .filter(item => Number(item.attendanceValue || 0) > 0 || Number(item.masterValue || 0) > 0)
            .sort((a, b) => Number(b.attendanceValue || 0) - Number(a.attendanceValue || 0));
    };

    try {
        const skillColumnSql = `
            CASE
                WHEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.currentLevel)))) IN ('L1','L2','L3','L4')
                    THEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.currentLevel))))
                WHEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), u.currentSkill)))) = 'L4'
                    OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%"L4"%'
                    OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%:L4%'
                    THEN 'L4'
                WHEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), u.currentSkill)))) = 'L3'
                    OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%"L3"%'
                    OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%:L3%'
                    THEN 'L3'
                WHEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), u.currentSkill)))) = 'L2'
                    OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%"L2"%'
                    OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%:L2%'
                    THEN 'L2'
                WHEN UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), u.currentSkill)))) = 'L1'
                    OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%"L1"%'
                    OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%:L1%'
                    THEN 'L1'
                ELSE 'Not Provided'
            END
        `;

        const leaderExpertWhere = `
            AND (
                UPPER(LTRIM(RTRIM(CAST(u.designation AS NVARCHAR(510))))) LIKE '%LINE LEADER%'
                OR UPPER(LTRIM(RTRIM(CAST(u.designation AS NVARCHAR(510))))) LIKE '%EXPERT%'
            )
        `;

        const skillLevelWhere = `
            AND (
                UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.currentLevel)))) IN ('L1','L2','L3','L4')
                OR UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), u.currentSkill)))) IN ('L1','L2','L3','L4')
                OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%"L1"%'
                OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%"L2"%'
                OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%"L3"%'
                OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%"L4"%'
                OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%:L1%'
                OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%:L2%'
                OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%:L3%'
                OR UPPER(CONVERT(NVARCHAR(MAX), u.currentSkill)) LIKE '%:L4%'
            )
        `;

        const [
            skillLevels,
            genderData,
            stateData,
            districtData,
            designationData,
            leaderExpert,
            stateOptions,
            districtOptions,
            educationData,
        ] = await Promise.all([
            getGroupedComparisonChart({ columnSql: skillColumnSql, extraWhere: skillLevelWhere }).catch(err => { console.warn("[DASHBOARD] skillLevels query failed:", err.message); return []; }),
            getGroupedComparisonChart({ columnSql: "ISNULL(NULLIF(LTRIM(RTRIM(CAST(u.gender AS NVARCHAR(100)))), ''), 'Not Provided')" }).catch(err => { console.warn("[DASHBOARD] genderData query failed:", err.message); return []; }),
            getGroupedComparisonChart({ columnSql: "ISNULL(NULLIF(LTRIM(RTRIM(CAST(u.state AS NVARCHAR(510)))), ''), 'Not Provided')", includeState: true, includeDistrict: true }).catch(err => { console.warn("[DASHBOARD] stateData query failed:", err.message); return []; }),
            getGroupedComparisonChart({ columnSql: "ISNULL(NULLIF(LTRIM(RTRIM(CAST(u.district AS NVARCHAR(510)))), ''), 'Not Provided')", includeState: true, includeDistrict: true }).catch(err => { console.warn("[DASHBOARD] districtData query failed:", err.message); return []; }),
            getGroupedComparisonChart({ columnSql: "ISNULL(NULLIF(LTRIM(RTRIM(CAST(u.designation AS NVARCHAR(510)))), ''), 'Not Provided')" }).catch(err => { console.warn("[DASHBOARD] designationData query failed:", err.message); return []; }),
            getGroupedComparisonChart({
                columnSql: "ISNULL(NULLIF(LTRIM(RTRIM(CAST(u.designation AS NVARCHAR(510)))), ''), 'Not Provided')",
                extraWhere: leaderExpertWhere,
            }).catch(err => { console.warn("[DASHBOARD] leaderExpert query failed:", err.message); return []; }),
            getStateOptions().catch(err => { console.warn("[DASHBOARD] stateOptions query failed:", err.message); return []; }),
            getDistrictOptions().catch(err => { console.warn("[DASHBOARD] districtOptions query failed:", err.message); return []; }),
            getGroupedComparisonChart({ columnSql: "ISNULL(NULLIF(LTRIM(RTRIM(CAST(u.education AS NVARCHAR(510)))), ''), 'Not Provided')" }).catch(err => { console.warn("[DASHBOARD] educationData query failed:", err.message); return []; }),
        ]);

        pieCharts = {
            ...pieCharts,
            skillLevels,
            gender: genderData,
            state: stateData,
            district: districtData,
            designation: designationData,
            leaderExpert,
            leaderExpertTotalEmployees: shouldUseAttendanceMaster ? attendanceMasterTotal : snapshotTotal,
            stateOptions,
            districtOptions,
            education: educationData,
        };
    } catch (e) {
        console.warn("[DASHBOARD] Pie/comparison charts failed:", e.message);
    }

    try {
        const contractorMap = {};

        const contractorColumnSql = `
        ISNULL(
            NULLIF(LTRIM(RTRIM(CAST(u.contractor AS NVARCHAR(510)))), ''),
            LEFT(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))), 3)
        )
    `;

        const addContractor = (prefix, key, value) => {
            const cleanPrefix = normalizeChartName(prefix);

            if (!contractorMap[cleanPrefix]) {
                contractorMap[cleanPrefix] = {
                    name: cleanPrefix,
                    value: 0,
                    attendanceValue: 0,
                    masterValue: 0,
                    rawValue: 0,
                    percentage: 0,
                };
            }

            contractorMap[cleanPrefix][key] = Number(value || 0);
        };

        // ============================================================
        // 1) ATTENDANCE BAR: attendance_logs se aayega
        // Agar attendance query fail/zero ho jaye, graph blank nahi hoga.
        // ============================================================
        try {
            let contractorAttendanceSql = `
            SELECT
                ${contractorColumnSql} AS prefix,
                COUNT(DISTINCT al.payCode) AS total
            FROM attendance_logs al
            LEFT JOIN users u
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                 = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
            LEFT JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
            WHERE CONVERT(DATE, al.[date]) >= '${masterSqlStartDate}'
              AND CONVERT(DATE, al.[date]) <= '${masterSqlEndDate}'
              AND al.payCode IS NOT NULL
              AND LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))) != ''
        `;

            const contractorAttendanceParams = [];

            contractorAttendanceSql = addUserMasterFilters(contractorAttendanceSql, contractorAttendanceParams, "u");
            contractorAttendanceSql = addStateDistrictFilters(contractorAttendanceSql, contractorAttendanceParams);

            // Attendance shift attendance_logs.shift se hi filter hoga
            contractorAttendanceSql = addShiftFilter(contractorAttendanceSql, contractorAttendanceParams, "al");

            contractorAttendanceSql += `
            GROUP BY ${contractorColumnSql}
            ORDER BY total DESC
        `;

            const [contractorAttendanceRows] = await executeQuery(
                contractorAttendanceSql,
                contractorAttendanceParams
            );

            contractorAttendanceRows.forEach(row => {
                addContractor(row.prefix, "attendanceValue", row.total);
            });
        } catch (e) {
            console.warn("[DASHBOARD] Contractor attendance query failed:", e.message);
        }

        // ============================================================
        // 2) USERS TOTAL BAR: direct users table se aayega
        // IMPORTANT: Isme attendance_logs ka join bilkul nahi hoga.
        // Shift users.shift se filter hoga.
        // ============================================================
        try {
            let contractorMasterSql = `
            SELECT
                ${contractorColumnSql} AS prefix,
                COUNT(DISTINCT u.empId) AS total
            FROM users u
            LEFT JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
            WHERE ISNULL(u.isDeleted, 0) = 0
              AND u.empId IS NOT NULL
              AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
        `;

            const contractorMasterParams = [];

            contractorMasterSql = addUserMasterFilters(contractorMasterSql, contractorMasterParams, "u");
            contractorMasterSql = addStateDistrictFilters(contractorMasterSql, contractorMasterParams);

            // IMPORTANT:
            // Users Total / dark yellow bar par shift filter apply nahi hoga.
            // Department, section, line, state, district filters apply rahenge.
            // Shift filter sirf Attendance / purple bar par apply hoga.

            contractorMasterSql += `
            GROUP BY ${contractorColumnSql}
            ORDER BY total DESC
        `;

            const [contractorMasterRows] = await executeQuery(
                contractorMasterSql,
                contractorMasterParams
            );

            contractorMasterRows.forEach(row => {
                addContractor(row.prefix, "masterValue", row.total);
            });
        } catch (e) {
            console.warn("[DASHBOARD] Contractor users total query failed:", e.message);
        }

        const totalMasterEmployees = Object.values(contractorMap).reduce(
            (sum, item) => sum + Number(item.masterValue || 0),
            0
        );

        const contractorDenominator =
            totalMasterEmployees > 0
                ? totalMasterEmployees
                : await getUsersTotalDenominator();

        pieCharts.contractorPrefix = Object.values(contractorMap)
            .map(item => {
                const attendanceCount = Number(item.attendanceValue || 0);
                const masterCount = Number(item.masterValue || 0);

                return {
                    ...item,
                    value: attendanceCount,
                    rawValue: attendanceCount,
                    percentage:
                        contractorDenominator > 0
                            ? Number(((attendanceCount / contractorDenominator) * 100).toFixed(1))
                            : 0,
                    attendancePercentage:
                        contractorDenominator > 0
                            ? Number(((attendanceCount / contractorDenominator) * 100).toFixed(1))
                            : 0,
                    masterPercentage:
                        contractorDenominator > 0
                            ? Number(((masterCount / contractorDenominator) * 100).toFixed(1))
                            : 0,
                    totalEmployees: contractorDenominator,
                    denominatorTotal: contractorDenominator,
                };
            })
            .filter(item => Number(item.attendanceValue || 0) > 0 || Number(item.masterValue || 0) > 0)
            .sort((a, b) => {
                const attendanceDiff = Number(b.attendanceValue || 0) - Number(a.attendanceValue || 0);
                if (attendanceDiff !== 0) return attendanceDiff;
                return Number(b.masterValue || 0) - Number(a.masterValue || 0);
            });
    } catch (e) {
        console.warn("[DASHBOARD] Contractor prefix comparison chart failed:", e.message);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                manpowerData,
                absenteeismData,
                attritionData,
                skillGapData: [],
                pieCharts,
                filters: {
                    departmentName,
                    sectionName,
                    lineName,
                    snapshotTotal,
                    startDate: sqlStartDate,
                    endDate: sqlEndDate,
                    masterStartDate: masterSqlStartDate,
                    masterEndDate: masterSqlEndDate,
                    stateFilter: stateFilter || "ALL",
                    districtFilter: districtFilter || "ALL",
                    masterAttendanceMode: "YES",
                    masterAttendanceDate: yesterdaySqlDate,
                    attendanceDateAvailable: true,
                    shift: selectedShiftValue || "ALL",
                    attendanceLogic:
                        "Contractor graph: labels are fetched from users.contractor column, with Emp ID first three characters only as fallback when contractor is blank. Attendance/purple bar uses attendance_logs and selected shift. Users Total/dark yellow bar uses users table and ignores shift, but department/section/line/state/district filters still apply.",
                },
                debug: {
                    requiredStartDate: sqlStartDate,
                    requiredEndDate: sqlEndDate,
                    masterStartDate: masterSqlStartDate,
                    masterEndDate: masterSqlEndDate,
                    shift: selectedShiftValue || "ALL",
                },
            },
            "Dashboard stats fetched successfully"
        )
    );
});


export const getDashboardAttendance = asyncHandler(async (req, res) => {
    const {
        department,
        section,
        line,
        startDate,
        endDate,
        shift,
    } = req.query;

    const selectedShiftValue = shift && String(shift).trim().toUpperCase() !== 'ALL' ? String(shift).trim() : null;

    const addShiftFilter = (sqlText, params, alias = "al") => {
        if (!selectedShiftValue) return sqlText;

        const shiftColumn = `UPPER(LTRIM(RTRIM(CAST(${alias}.shift AS NVARCHAR(100)))))`;

        sqlText += `
            AND (
                ${shiftColumn} = UPPER(LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR ${shiftColumn} = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND ${shiftColumn} IN ('G', 'GEN', 'GENERAL', 'GENERAL SHIFT')
                )
            )
        `;

        params.push(selectedShiftValue, selectedShiftValue, selectedShiftValue, selectedShiftValue);
        return sqlText;
    };

    const safeName = (s) => String(s || "").replace(/'/g, "''");

    const departmentIds = parseMultiParam(department);
    const sectionIds = parseMultiParam(section);
    const lineIds = parseMultiParam(line);

    const getNamesByIds = async (table, ids) => {
        if (!ids.length) return [];

        const numericIds = ids
            .map(id => parseInt(id, 10))
            .filter(id => !Number.isNaN(id));

        if (!numericIds.length) return [];

        try {
            const placeholders = numericIds.map(() => "?").join(",");
            const [rows] = await executeQuery(
                `SELECT name FROM [${table}] WHERE id IN (${placeholders})`,
                numericIds
            );
            return rows.map(row => String(row.name || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn(`[DASHBOARD ATTENDANCE] ${table} lookup failed:`, e.message);
            return [];
        }
    };

    const departmentNames = await getNamesByIds("departments", departmentIds);
    const sectionNames = await getNamesByIds("sections", sectionIds);
    const lineNames = await getNamesByIds("lines", lineIds);

    const buildNameInCondition = (columnSql, names) => {
        if (!names || names.length === 0) return "";
        const safeValues = names.map(name => `UPPER('${safeName(name)}')`).join(",");
        return ` AND UPPER(LTRIM(RTRIM(${columnSql}))) IN (${safeValues})`;
    };

    let hierCondition = "";
    hierCondition += buildNameInCondition("uhs.[department]", departmentNames);
    hierCondition += buildNameInCondition("uhs.[section]", sectionNames);
    hierCondition += buildNameInCondition("uhs.[lines]", lineNames);

    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const parseDateLocal = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = String(dateStr).split("-").map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let rangeStart;
    let rangeEnd;

    if (startDate) {
        rangeStart = parseDateLocal(startDate) || new Date(today);
        rangeEnd = parseDateLocal(endDate || startDate) || new Date(today);
    } else {
        rangeEnd = new Date(today);
        rangeStart = new Date(today);
        rangeStart.setDate(rangeStart.getDate() - 29);
    }

    const sqlStartDate = formatDateLocal(rangeStart);
    const sqlEndDate = formatDateLocal(rangeEnd);

    let sqlText = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS fullDate,
            DAY(al.[date]) AS dayNum,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN al.payCode END) AS present,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','LEAVE','HALF DAY') THEN al.payCode END) AS absent,
            COUNT(DISTINCT al.payCode) AS total
        FROM attendance_logs al
        LEFT JOIN users u
            ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
             = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
        LEFT JOIN user_hierarchy_snapshots uhs
            ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
             = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
        WHERE CONVERT(DATE, al.[date]) >= '${sqlStartDate}'
          AND CONVERT(DATE, al.[date]) <= '${sqlEndDate}'
          ${hierCondition}
    `;

    const params = [];
    sqlText = addShiftFilter(sqlText, params, "al");
    sqlText += `
        GROUP BY al.[date], DAY(al.[date])
        ORDER BY al.[date]
    `;

    const [rows] = await executeQuery(sqlText, params);

    const data = rows.map(row => ({
        date: row.fullDate,
        day: row.dayNum,
        present: Number(row.present || 0),
        absent: Number(row.absent || 0),
        total: Number(row.total || 0),
    }));

    return res.status(200).json(
        new ApiResponse(200, { data }, "Dashboard attendance fetched successfully")
    );
});


export const getDashboardTenureStats = asyncHandler(async (req, res) => {
    const {
        department,
        section,
        line,
        startDate,
        endDate,
        customTenureFrom,
        customTenureTo,
        shift,
    } = req.query;

    const selectedShiftValue =
        shift && String(shift).trim().toUpperCase() !== "ALL"
            ? String(shift).trim()
            : null;

    const safeName = (s) => String(s || "").replace(/'/g, "''");

    const departmentIds = parseMultiParam(department);
    const sectionIds = parseMultiParam(section);
    const lineIds = parseMultiParam(line);

    const getNamesByIds = async (table, ids) => {
        if (!ids.length) return [];

        const numericIds = ids
            .map((id) => parseInt(id, 10))
            .filter((id) => !Number.isNaN(id));

        if (!numericIds.length) return [];

        try {
            const placeholders = numericIds.map(() => "?").join(",");
            const [rows] = await executeQuery(
                `SELECT name FROM [${table}] WHERE id IN (${placeholders})`,
                numericIds
            );
            return rows.map((row) => String(row.name || "").trim()).filter(Boolean);
        } catch (e) {
            console.warn(`[TENURE] ${table} lookup failed:`, e.message);
            return [];
        }
    };

    const departmentNames = await getNamesByIds("departments", departmentIds);
    const sectionNames = await getNamesByIds("sections", sectionIds);
    const lineNames = await getNamesByIds("lines", lineIds);

    const buildNameInCondition = (columnSql, names) => {
        if (!names || names.length === 0) return "";
        const safeValues = names.map((name) => `UPPER('${safeName(name)}')`).join(",");
        return ` AND UPPER(LTRIM(RTRIM(${columnSql}))) IN (${safeValues})`;
    };

    let hierCondition = "";
    hierCondition += buildNameInCondition("uhs.[department]", departmentNames);
    hierCondition += buildNameInCondition("uhs.[section]", sectionNames);
    hierCondition += buildNameInCondition("uhs.[lines]", lineNames);

    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const parseDateLocal = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = String(dateStr).split("-").map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    };

    const indiaNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    indiaNow.setHours(0, 0, 0, 0);

    const yesterday = new Date(indiaNow);
    yesterday.setDate(yesterday.getDate() - 1);

    let rangeStart;
    let rangeEnd;

    if (startDate) {
        rangeStart = parseDateLocal(startDate) || new Date(yesterday);
        rangeEnd = parseDateLocal(endDate || startDate) || new Date(rangeStart);
    } else {
        rangeStart = new Date(yesterday);
        rangeEnd = new Date(yesterday);
    }

    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const sqlStartDate = formatDateLocal(rangeStart);
    const sqlEndDate = formatDateLocal(rangeEnd);

    const customFromDays = Number(customTenureFrom);
    const customToDays = Number(customTenureTo);

    const hasCustomTenureRange =
        customTenureFrom !== undefined &&
        customTenureTo !== undefined &&
        customTenureFrom !== "" &&
        customTenureTo !== "" &&
        Number.isFinite(customFromDays) &&
        Number.isFinite(customToDays) &&
        customFromDays >= 0 &&
        customToDays >= customFromDays;

    const emptyBuckets = () => ({
        "0-16d": 0,
        "17-30d": 0,
        "31-60d": 0,
        "61-90d": 0,
        "3m-6m": 0,
        "6m-9m": 0,
        "9m-1y": 0,
        "1y-2y": 0,
        "2y-3y": 0,
        "3y-others": 0,
        ...(hasCustomTenureRange ? { CUSTOM: 0 } : {}),
    });

    const BUCKET_LABELS = {
        "0-16d": "0–16 days",
        "17-30d": "17–30 days",
        "31-60d": "31–60 days",
        "61-90d": "61–90 days",
        "3m-6m": "3m–6m",
        "6m-9m": "6m–9m",
        "9m-1y": "9m–1y",
        "1y-2y": "1y–2y",
        "2y-3y": "2y–3y",
        "3y-others": "3y & others",
        ...(hasCustomTenureRange ? { CUSTOM: `${customFromDays}–${customToDays} days` } : {}),
    };

    const joinDateSQL = `
        COALESCE(
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 23),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 103),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 105),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 120),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 121),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 101),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 110),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 106),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 107)
        )
    `;

    const leaveDateSQL = `
        COALESCE(
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 23),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 103),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 105),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 120),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 121),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 101),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 110),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 106),
            TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 107)
        )
    `;

    const bucketCaseSQL = `
        CASE
            WHEN tenureDays BETWEEN 0 AND 16 THEN '0-16d'
            WHEN tenureDays BETWEEN 17 AND 30 THEN '17-30d'
            WHEN tenureDays BETWEEN 31 AND 60 THEN '31-60d'
            WHEN tenureDays BETWEEN 61 AND 90 THEN '61-90d'
            WHEN tenureDays BETWEEN 91 AND 180 THEN '3m-6m'
            WHEN tenureDays BETWEEN 181 AND 270 THEN '6m-9m'
            WHEN tenureDays BETWEEN 271 AND 365 THEN '9m-1y'
            WHEN tenureDays BETWEEN 366 AND 730 THEN '1y-2y'
            WHEN tenureDays BETWEEN 731 AND 1095 THEN '2y-3y'
            ELSE '3y-others'
        END
    `;

    const addShiftFilterOnAttendance = (sqlText, params) => {
        if (!selectedShiftValue) return sqlText;
        sqlText += `
            AND (
                UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) IN ('G', 'GEN', 'GENERAL', 'GENERAL SHIFT')
                )
            )
        `;
        params.push(selectedShiftValue, selectedShiftValue, selectedShiftValue, selectedShiftValue);
        return sqlText;
    };

    const addShiftFilterOnUser = (sqlText, params) => {
        if (!selectedShiftValue) return sqlText;
        sqlText += `
            AND (
                UPPER(LTRIM(RTRIM(CAST(u.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(CAST(u.shift AS NVARCHAR(100))))) = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                OR UPPER(LTRIM(RTRIM(CAST(u.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                OR (
                    UPPER(LTRIM(RTRIM(?))) = 'G'
                    AND UPPER(LTRIM(RTRIM(CAST(u.shift AS NVARCHAR(100))))) IN ('G', 'GEN', 'GENERAL', 'GENERAL SHIFT')
                )
            )
        `;
        params.push(selectedShiftValue, selectedShiftValue, selectedShiftValue, selectedShiftValue);
        return sqlText;
    };

    const addFlexibleShiftFilterOnUser = (sqlText, params) => {
        if (!selectedShiftValue) return sqlText;

        // Optimized: avoid slow row-by-row EXISTS. Use IN with selected shift employees
        // from attendance_logs for selected date/range. This fixes users.shift blank/mismatch.
        sqlText += `
            AND UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100))))) IN (
                SELECT DISTINCT UPPER(LTRIM(RTRIM(CAST(alShift.payCode AS NVARCHAR(100)))))
                FROM attendance_logs alShift
                WHERE CONVERT(DATE, alShift.[date]) >= ?
                  AND CONVERT(DATE, alShift.[date]) <= ?
                  AND (
                      UPPER(LTRIM(RTRIM(CAST(alShift.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)))
                      OR UPPER(LTRIM(RTRIM(CAST(alShift.shift AS NVARCHAR(100))))) = UPPER('SHIFT ' + LTRIM(RTRIM(?)))
                      OR UPPER(LTRIM(RTRIM(CAST(alShift.shift AS NVARCHAR(100))))) = UPPER(LTRIM(RTRIM(?)) + ' SHIFT')
                      OR (
                          UPPER(LTRIM(RTRIM(?))) = 'G'
                          AND UPPER(LTRIM(RTRIM(CAST(alShift.shift AS NVARCHAR(100))))) IN ('G', 'GEN', 'GENERAL', 'GENERAL SHIFT')
                      )
                  )
            )
        `;

        params.push(
            sqlStartDate,
            sqlEndDate,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue,
            selectedShiftValue
        );

        return sqlText;
    };

    let attendance = emptyBuckets();
    let absenteeism = emptyBuckets();
    let attrition = emptyBuckets();
    let masterTenure = emptyBuckets();

    try {
        let attendanceSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(attendanceStatus))) = 'PRESENT' THEN 1 ELSE 0 END) AS presentCount,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(attendanceStatus))) IN ('ABSENT', 'LEAVE', 'HALF DAY') THEN 1 ELSE 0 END) AS absentCount
            FROM (
                SELECT
                    u.empId,
                    al.status AS attendanceStatus,
                    DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) AS tenureDays
                FROM attendance_logs al
                INNER JOIN users u
                    ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE CONVERT(DATE, al.[date]) >= ?
                  AND CONVERT(DATE, al.[date]) <= ?
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND ${joinDateSQL} IS NOT NULL
                  ${hierCondition}
        `;

        const attendanceParams = [sqlStartDate, sqlEndDate];
        attendanceSql = addShiftFilterOnAttendance(attendanceSql, attendanceParams);
        attendanceSql += `
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;

        const [attendanceRows] = await executeQuery(attendanceSql, attendanceParams);
        attendanceRows.forEach((row) => {
            if (row.bucket && attendance[row.bucket] !== undefined) {
                attendance[row.bucket] = Number(row.presentCount || 0);
                absenteeism[row.bucket] = Number(row.absentCount || 0);
            }
        });

        if (hasCustomTenureRange) {
            let customAttendanceSql = `
                SELECT
                    SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS presentCount,
                    SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT', 'LEAVE', 'HALF DAY') THEN 1 ELSE 0 END) AS absentCount
                FROM attendance_logs al
                INNER JOIN users u
                    ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE CONVERT(DATE, al.[date]) >= ?
                  AND CONVERT(DATE, al.[date]) <= ?
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND ${joinDateSQL} IS NOT NULL
                  AND DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN ? AND ?
                  ${hierCondition}
            `;

            const customAttendanceParams = [sqlStartDate, sqlEndDate, customFromDays, customToDays];
            customAttendanceSql = addShiftFilterOnAttendance(customAttendanceSql, customAttendanceParams);
            const [rows] = await executeQuery(customAttendanceSql, customAttendanceParams);
            attendance.CUSTOM = Number(rows?.[0]?.presentCount || 0);
            absenteeism.CUSTOM = Number(rows?.[0]?.absentCount || 0);
        }
    } catch (e) {
        console.warn("[TENURE] attendance/absenteeism failed:", e.message);
        attendance = emptyBuckets();
        absenteeism = emptyBuckets();
    }

    try {
        let masterTenureSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                COUNT(DISTINCT empId) AS totalCount
            FROM (
                SELECT
                    u.empId,
                    DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, ?)) AS tenureDays
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND ${joinDateSQL} IS NOT NULL
                  AND ${joinDateSQL} <= ?
                  AND (${leaveDateSQL} IS NULL OR ${leaveDateSQL} >= ?)
                  ${hierCondition}
        `;

        const masterTenureParams = [sqlEndDate, sqlEndDate, sqlStartDate];
        // IMPORTANT:
        // Users Total / master tenure bar par shift filter apply nahi hoga.
        // Shift filter sirf attendance/absenteeism/attrition values par apply hoga.
        masterTenureSql += `
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;

        const [masterRows] = await executeQuery(masterTenureSql, masterTenureParams);
        masterRows.forEach((row) => {
            if (row.bucket && masterTenure[row.bucket] !== undefined) {
                masterTenure[row.bucket] = Number(row.totalCount || 0);
            }
        });

        if (hasCustomTenureRange) {
            let customMasterSql = `
                SELECT COUNT(DISTINCT u.empId) AS totalCount
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND ${joinDateSQL} IS NOT NULL
                  AND ${joinDateSQL} <= ?
                  AND (${leaveDateSQL} IS NULL OR ${leaveDateSQL} >= ?)
                  AND DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, ?)) BETWEEN ? AND ?
                  ${hierCondition}
            `;
            const customMasterParams = [sqlEndDate, sqlStartDate, sqlEndDate, customFromDays, customToDays];
            // IMPORTANT:
            // Custom tenure Users Total par shift filter apply nahi hoga.
            const [rows] = await executeQuery(customMasterSql, customMasterParams);
            masterTenure.CUSTOM = Number(rows?.[0]?.totalCount || 0);
        }
    } catch (e) {
        console.warn("[TENURE] users/master tenure failed:", e.message);
        masterTenure = emptyBuckets();
    }

    try {
        let attritionSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                COUNT(DISTINCT empId) AS leftCount
            FROM (
                SELECT
                    u.empId,
                    DATEDIFF(DAY, ${joinDateSQL}, ${leaveDateSQL}) AS tenureDays
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND ${joinDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} >= ?
                  AND ${leaveDateSQL} <= ?
                  ${hierCondition}
        `;

        const attritionParams = [sqlStartDate, sqlEndDate];
        attritionSql = addShiftFilterOnUser(attritionSql, attritionParams);
        attritionSql += `
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;

        const [attritionRows] = await executeQuery(attritionSql, attritionParams);
        attritionRows.forEach((row) => {
            if (row.bucket && attrition[row.bucket] !== undefined) {
                attrition[row.bucket] = Number(row.leftCount || 0);
            }
        });

        if (hasCustomTenureRange) {
            let customAttritionSql = `
                SELECT COUNT(DISTINCT u.empId) AS leftCount
                FROM users u
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND ${joinDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} >= ?
                  AND ${leaveDateSQL} <= ?
                  AND DATEDIFF(DAY, ${joinDateSQL}, ${leaveDateSQL}) BETWEEN ? AND ?
                  ${hierCondition}
            `;

            const customAttritionParams = [sqlStartDate, sqlEndDate, customFromDays, customToDays];
            customAttritionSql = addShiftFilterOnUser(customAttritionSql, customAttritionParams);
            const [rows] = await executeQuery(customAttritionSql, customAttritionParams);
            attrition.CUSTOM = Number(rows?.[0]?.leftCount || 0);
        }
    } catch (e) {
        console.warn("[TENURE] attrition failed:", e.message);
        attrition = emptyBuckets();
    }

    const toArray = (bucketObj) =>
        Object.entries(bucketObj).map(([bucket, value]) => ({
            bucket,
            name: BUCKET_LABELS[bucket] || bucket,
            value: Number(value || 0),
        }));

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                attendance,
                absenteeism,
                attrition,
                masterTenure,
                usersTotalByTenure: masterTenure,

                tenureManpower: toArray(attendance),
                tenureAbsenteeism: toArray(absenteeism),
                tenureAttrition: toArray(attrition),
                tenureMaster: toArray(masterTenure),

                buckets: BUCKET_LABELS,

                filters: {
                    startDate: sqlStartDate,
                    endDate: sqlEndDate,
                    shift: selectedShiftValue || "ALL",
                    attendanceLogic:
                        "Tenure attendance/absenteeism selected date attendance_logs se calculate hoga. Shift filter attendance_logs.shift par lagega.",
                    masterLogic:
                        "Grey/dark yellow Users Total bar users table ka total active employee count hai. Shift filter ka effect is bar par nahi padega; baaki hierarchy/date filters apply rahenge.",
                    attritionLogic:
                        "Attrition users.leavingDate se calculate hoga. Shift filter users.shift par lagega.",
                    matchingLogic:
                        "attendance_logs.payCode = users.empId and joiningDate se tenure bucket calculate hota hai.",
                    customTenureFrom: hasCustomTenureRange ? customFromDays : null,
                    customTenureTo: hasCustomTenureRange ? customToDays : null,
                },
            },
            "Tenure stats fetched successfully"
        )
    );
});


export const getDashboardDepartments = asyncHandler(async (req, res) => {
    const [rows] = await executeQuery(
        `
        SELECT DISTINCT
            d.id,
            d.name
        FROM departments d
        ORDER BY d.name
        `,
        []
    );

    const departments = rows
        .filter(row => row.id !== null && row.id !== undefined && row.name)
        .map(row => ({
            id: String(row.id),
            name: String(row.name),
        }));

    return res.status(200).json(
        new ApiResponse(200, { departments }, "Departments fetched successfully")
    );
});


export const getDashboardSections = asyncHandler(async (req, res) => {
    const { departmentId } = req.query;

    const departmentIds = String(departmentId || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .filter(item => item.toUpperCase() !== "ALL")
        .map(item => parseInt(item, 10))
        .filter(item => !Number.isNaN(item));

    if (!departmentIds.length) {
        return res.status(200).json(
            new ApiResponse(200, { sections: [] }, "Invalid department selected")
        );
    }

    const placeholders = departmentIds.map(() => "?").join(",");

    const [rows] = await executeQuery(
        `
        SELECT DISTINCT
            s.id,
            s.name
        FROM sections s
        WHERE s.departmentId IN (${placeholders})
        ORDER BY s.name
        `,
        departmentIds
    );

    const sections = rows
        .filter(row => row.id !== null && row.id !== undefined && row.name)
        .map(row => ({
            id: String(row.id),
            name: String(row.name),
        }));

    return res.status(200).json(
        new ApiResponse(200, { sections }, "Sections fetched successfully")
    );
});


export const getDashboardLines = asyncHandler(async (req, res) => {
    const { sectionId } = req.query;

    const sectionIds = String(sectionId || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .filter(item => item.toUpperCase() !== "ALL")
        .map(item => parseInt(item, 10))
        .filter(item => !Number.isNaN(item));

    if (!sectionIds.length) {
        return res.status(200).json(
            new ApiResponse(200, { lines: [] }, "Invalid section selected")
        );
    }

    const placeholders = sectionIds.map(() => "?").join(",");

    const [rows] = await executeQuery(
        `
        SELECT DISTINCT
            l.id,
            l.name
        FROM lines l
        WHERE l.sectionId IN (${placeholders})
        ORDER BY l.name
        `,
        sectionIds
    );

    const lines = rows
        .filter(row => row.id !== null && row.id !== undefined && row.name)
        .map(row => ({
            id: String(row.id),
            name: String(row.name),
        }));

    return res.status(200).json(
        new ApiResponse(200, { lines }, "Lines fetched successfully")
    );
}); 