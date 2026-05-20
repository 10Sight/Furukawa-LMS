import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";


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
    } = req.query;

    const isMasterAttendanceMode =
        String(masterAttendanceMode || "").toUpperCase() === "YES";

    // Jab user date/date-range select kare, to selected attendance date available hai ya nahi check hoga.
    // Agar attendance upload nahi hai, to dashboard me old/master/snapshot data show nahi hoga.
    const hasSelectedDateForDashboard = Boolean(startDate);

    const safeName = (s) => String(s || "").replace(/'/g, "''");

    const parseMultiParam = (value) => {
        if (!value || String(value).toUpperCase() === "ALL") return [];
        return String(value)
            .split(",")
            .map(item => item.trim())
            .filter(Boolean)
            .filter(item => item.toUpperCase() !== "ALL");
    };

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
            const attendanceGateSql = `
                SELECT COUNT(*) AS cnt
                FROM attendance_logs al
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                WHERE CONVERT(DATE, al.[date]) >= '${sqlStartDate}'
                  AND CONVERT(DATE, al.[date]) <= '${sqlEndDate}'
                  ${hierCondition}
            `;

            const [gateRows] = await executeQuery(attendanceGateSql, []);
            const attendanceRowsAvailable = Number(gateRows?.[0]?.cnt || 0) > 0;

            if (!attendanceRowsAvailable) {
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
                                stateOptions: [],
                                districtOptions: [],
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
                                    "No attendance found in attendance_logs for selected date/range after selected hierarchy filters.",
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

    try {
        const [snapRows] = await executeQuery(
            `
            SELECT COUNT(DISTINCT u.empId) AS total
            FROM users u
            LEFT JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
            WHERE ISNULL(u.isDeleted, 0) = 0
            AND u.empId IS NOT NULL
            AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
            ${hierCondition}
            `,
            []
        );

        snapshotTotal = Number(snapRows[0]?.total) || 0;
    } catch (e) {
        console.warn("[DASHBOARD] Snapshot headcount query failed:", e.message);
    }

    let dailyAttendance = [];

    try {
        const attSql = `
            SELECT
                CONVERT(VARCHAR, al.[date], 23) AS fullDate,
                DAY(al.[date]) AS dayNum,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS presentCount,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE') THEN 1 ELSE 0 END) AS absentCount,
                COUNT(*) AS totalCount
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE 1=1
              AND CONVERT(DATE, al.[date]) >= '${sqlStartDate}'
              AND CONVERT(DATE, al.[date]) <= '${sqlEndDate}'
              ${hierCondition}
            GROUP BY al.[date], DAY(al.[date])
            ORDER BY al.[date]
        `;

        const [attRows] = await executeQuery(attSql, []);
        dailyAttendance = attRows;
    } catch (e) {
        console.warn("[DASHBOARD] Daily attendance query failed:", e.message);
    }

    const manpowerData = loopDates.map((iterDateRaw) => {
        const iterDate = new Date(iterDateRaw);
        const day = iterDate.getDate();
        const monthShort = iterDate.toLocaleString("en-US", { month: "short" });
        const dateStr = formatDateLocal(iterDate);

        const attItem = dailyAttendance.find((a) => a.fullDate === dateStr);

        iterDate.setHours(0, 0, 0, 0);
        const isFuture = iterDate > today;

        return {
            month: `${day} ${monthShort}`,
            day,
            required: getRequirementForDate(iterDate),

            // Current Headcount = total active employees from users table
            current: isFuture ? null : snapshotTotal,

            // Actual / Present = attendance present count
            present: attItem ? Number(attItem.presentCount) || 0 : isFuture ? null : 0,

            // Absent = attendance absent/leave/half day count
            absent: attItem ? Number(attItem.absentCount) || 0 : isFuture ? null : 0,
        };
    });

    let attritionData = [];

    try {
        const attrSql = `
            SELECT
                CONVERT(VARCHAR, parsed.leaving_date, 23) AS fullDate,
                COUNT(DISTINCT parsed.empId) AS leftCount
            FROM (
                SELECT
                    u.empId,
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
                INNER JOIN user_hierarchy_snapshots uhs
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
            GROUP BY parsed.leaving_date
            ORDER BY parsed.leaving_date
        `;

        const [attrRows] = await executeQuery(attrSql, []);

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
        const absSql = `
            SELECT
                CONVERT(VARCHAR, al.[date], 23) AS fullDate,
                DAY(al.[date]) AS dayNum,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','LEAVE','HALF DAY') THEN 1 ELSE 0 END) AS absent_count,
                COUNT(*) AS total_count
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE 1=1
              AND CONVERT(DATE, al.[date]) >= '${sqlStartDate}'
              AND CONVERT(DATE, al.[date]) <= '${sqlEndDate}'
              ${hierCondition}
            GROUP BY al.[date], DAY(al.[date])
            ORDER BY al.[date]
        `;

        const [absRows] = await executeQuery(absSql, []);

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
                const total = row ? Number(row.total_count) || 0 : 0;

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
        masterRangeStart = new Date(startDate);
        masterRangeEnd = new Date(endDate || startDate);
    }

    masterRangeStart.setHours(0, 0, 0, 0);
    masterRangeEnd.setHours(0, 0, 0, 0);

    const masterSqlStartDate = formatDateLocal(masterRangeStart);
    const masterSqlEndDate = formatDateLocal(masterRangeEnd);

    const appendMultiHierarchyFilter = ({
        sqlText,
        params,
        unicodeColumn,
        nameColumn,
        idColumn,
        ids,
        names,
        alias,
    }) => {
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
    };

    const addUserMasterFilters = (baseSql, params, alias = "u") => {
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
    };

    const addStateDistrictFilters = (baseSql, params, options = {}) => {
        let sqlText = baseSql;
        const { includeState = true, includeDistrict = true } = options;

        const stateValues = parseMultiParam(stateFilter);
        const districtValues = parseMultiParam(districtFilter);

        if (includeState && stateValues.length > 0) {
            const placeholders = stateValues
                .map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))")
                .join(",");

            sqlText += `
                AND UPPER(LTRIM(RTRIM(
                    CASE
                        WHEN u.state IS NULL OR LTRIM(RTRIM(u.state)) = '' THEN 'NOT PROVIDED'
                        ELSE u.state
                    END
                ))) IN (${placeholders})
            `;
            params.push(...stateValues);
        }

        if (includeDistrict && districtValues.length > 0) {
            const placeholders = districtValues
                .map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))")
                .join(",");

            sqlText += `
                AND UPPER(LTRIM(RTRIM(
                    CASE
                        WHEN u.district IS NULL OR LTRIM(RTRIM(u.district)) = '' THEN 'NOT PROVIDED'
                        ELSE u.district
                    END
                ))) IN (${placeholders})
            `;
            params.push(...districtValues);
        }

        return sqlText;
    };

    const attendanceMasterBaseFrom = `
        FROM attendance_logs al
        INNER JOIN users u
            ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
             = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
        INNER JOIN user_hierarchy_snapshots uhs
            ON UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
             = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
        WHERE ISNULL(u.isDeleted, 0) = 0
          AND al.payCode IS NOT NULL
          AND LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))) != ''
          AND CONVERT(DATE, al.[date]) >= ?
          AND CONVERT(DATE, al.[date]) <= ?
    `;

    const normalUserMasterBaseFrom = `
        FROM users u
        LEFT JOIN user_hierarchy_snapshots uhs
            ON UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
             = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
        WHERE ISNULL(u.isDeleted, 0) = 0
    `;

    const getMasterBase = (params) => {
        // FIX:
        // Date select hone par pie/master graphs users master se nahi,
        // selected attendance date/range se aayenge.
        if (isMasterAttendanceMode || hasSelectedDateForDashboard) {
            params.push(masterSqlStartDate, masterSqlEndDate);
            return attendanceMasterBaseFrom;
        }

        return normalUserMasterBaseFrom;
    };

    let skillGapData = [];
    const levelColors = [
        "bg-zinc-500",
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-amber-500",
        "bg-rose-500",
        "bg-teal-500",
        "bg-orange-500",
    ];

    try {
        const skillParams = [];

        let skillSql = `
            SELECT
                UPPER(LTRIM(RTRIM(u.currentLevel))) AS skill_level,
                COUNT(DISTINCT u.empId) AS avail
            ${getMasterBase(skillParams)}
              AND u.currentLevel IN ('L0', 'L1', 'L2', 'L3', 'L4')
              AND u.currentLevel IS NOT NULL
              AND LTRIM(RTRIM(u.currentLevel)) != ''
        `;

        skillSql = addUserMasterFilters(skillSql, skillParams, "u");

        skillSql += `
            GROUP BY UPPER(LTRIM(RTRIM(u.currentLevel)))
            ORDER BY UPPER(LTRIM(RTRIM(u.currentLevel)))
        `;

        const [skillRes] = await executeQuery(skillSql, skillParams);

        skillGapData = skillRes.map((row, i) => {
            const rawLvl = String(row.skill_level || "").trim().toUpperCase();
            const displayLevel = /^L\d+$/.test(rawLvl) ? rawLvl : `L${rawLvl}`;

            return {
                level: displayLevel,
                avail: Number(row.avail) || 0,
                color: levelColors[i % levelColors.length],
            };
        });
    } catch (e) {
        console.warn("[DASHBOARD] Skill gap query failed:", e.message);
    }

    let stateData = [];
    let districtData = [];
    let designationData = [];
    let genderData = [];
    let stateOptions = [];
    let districtOptions = [];
    let contractorPrefixData = [];
    let leaderExpertData = [];
    let leaderExpertTotalEmployees = 0;

    const buildMasterDistribution = async ({
        selectSql,
        groupSql,
        orderSql = "ORDER BY COUNT(DISTINCT u.empId) DESC",
        includeState = true,
        includeDistrict = true,
        topPrefix = "",
    }) => {
        const params = [];
        let sqlText = `
            SELECT ${topPrefix}
                ${selectSql} AS name,
                COUNT(DISTINCT u.empId) AS count
            ${getMasterBase(params)}
        `;

        sqlText = addUserMasterFilters(sqlText, params, "u");
        sqlText = addStateDistrictFilters(sqlText, params, { includeState, includeDistrict });

        sqlText += `
            GROUP BY ${groupSql}
            ${orderSql}
        `;

        const [rows] = await executeQuery(sqlText, params);

        return rows.map((row) => ({
            name: row.name,
            value: Number(row.count) || 0,
        }));
    };

    const stateExpr = `
        CASE
            WHEN u.state IS NULL OR LTRIM(RTRIM(u.state)) = '' THEN 'NOT PROVIDED'
            ELSE UPPER(LTRIM(RTRIM(u.state)))
        END
    `;

    const districtExpr = `
        CASE
            WHEN u.district IS NULL OR LTRIM(RTRIM(u.district)) = '' THEN 'NOT PROVIDED'
            ELSE UPPER(LTRIM(RTRIM(u.district)))
        END
    `;

    const genderExpr = `
        CASE
            WHEN u.gender IS NULL OR LTRIM(RTRIM(u.gender)) = '' THEN 'UNKNOWN'
            ELSE UPPER(LTRIM(RTRIM(u.gender)))
        END
    `;

    const designationExpr = `
        CASE
            WHEN u.designation IS NULL OR LTRIM(RTRIM(u.designation)) = '' THEN 'NOT PROVIDED'
            ELSE UPPER(LTRIM(RTRIM(u.designation)))
        END
    `;

    const leaderExpertExpr = `
        CASE
            WHEN UPPER(LTRIM(RTRIM(u.designation))) = 'LINE LEADER' THEN 'Line Leader'
            WHEN UPPER(LTRIM(RTRIM(u.designation))) = 'EXPERT' THEN 'Expert'
        END
    `;

    try {
        genderData = await buildMasterDistribution({
            selectSql: genderExpr,
            groupSql: genderExpr,
            includeState: true,
            includeDistrict: true,
        });
    } catch (e) {
        console.warn("[DASHBOARD] Gender distribution query failed:", e.message);
    }

    try {
        stateData = await buildMasterDistribution({
            selectSql: stateExpr,
            groupSql: stateExpr,
            includeState: true,
            includeDistrict: false,
            topPrefix: "TOP 20",
        });
    } catch (e) {
        console.warn("[DASHBOARD] State distribution query failed:", e.message);
    }

    try {
        districtData = await buildMasterDistribution({
            selectSql: districtExpr,
            groupSql: districtExpr,
            includeState: true,
            includeDistrict: true,
            topPrefix: "TOP 20",
        });
    } catch (e) {
        console.warn("[DASHBOARD] District distribution query failed:", e.message);
    }

    try {
        designationData = await buildMasterDistribution({
            selectSql: designationExpr,
            groupSql: designationExpr,
            includeState: true,
            includeDistrict: true,
            topPrefix: "TOP 20",
        });
    } catch (e) {
        console.warn("[DASHBOARD] Designation distribution query failed:", e.message);
    }

    try {
        const totalParams = [];

        let totalSql = `
            SELECT COUNT(DISTINCT u.empId) AS totalEmployees
            ${getMasterBase(totalParams)}
            AND u.empId IS NOT NULL
            AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
        `;

        totalSql = addUserMasterFilters(totalSql, totalParams, "u");

        const [totalRows] = await executeQuery(totalSql, totalParams);
        leaderExpertTotalEmployees = Number(totalRows?.[0]?.totalEmployees) || 0;

        const params = [];

        let sqlText = `
            SELECT
                ${leaderExpertExpr} AS name,
                COUNT(DISTINCT u.empId) AS count
            ${getMasterBase(params)}
            AND UPPER(LTRIM(RTRIM(u.designation))) IN ('LINE LEADER', 'EXPERT')
        `;

        sqlText = addUserMasterFilters(sqlText, params, "u");

        sqlText += `
            GROUP BY ${leaderExpertExpr}
            ORDER BY COUNT(DISTINCT u.empId) DESC
        `;

        const [leaderExpertRows] = await executeQuery(sqlText, params);

        leaderExpertData = leaderExpertRows.map((row) => {
            const count = Number(row.count) || 0;
            const percentage =
                leaderExpertTotalEmployees > 0
                    ? Number(((count / leaderExpertTotalEmployees) * 100).toFixed(2))
                    : 0;

            return {
                name: row.name,
                value: count,
                percentage,
                totalEmployees: leaderExpertTotalEmployees,
            };
        });
    } catch (e) {
        console.warn("[DASHBOARD] Line Leader / Expert pie query failed:", e.message);
        leaderExpertData = [];
        leaderExpertTotalEmployees = 0;
    }

    try {
        const params = [];
        let sqlText = `
            SELECT DISTINCT
                ${stateExpr} AS name
            ${getMasterBase(params)}
        `;

        sqlText = addUserMasterFilters(sqlText, params, "u");
        sqlText += ` ORDER BY name`;

        const [rows] = await executeQuery(sqlText, params);
        stateOptions = rows.map((row) => row.name).filter(Boolean);
    } catch (e) {
        console.warn("[DASHBOARD] State options query failed:", e.message);
    }

    try {
        const params = [];
        let sqlText = `
            SELECT DISTINCT
                ${districtExpr} AS name
            ${getMasterBase(params)}
        `;

        sqlText = addUserMasterFilters(sqlText, params, "u");
        sqlText = addStateDistrictFilters(sqlText, params, {
            includeState: true,
            includeDistrict: false,
        });

        sqlText += ` ORDER BY name`;

        const [rows] = await executeQuery(sqlText, params);
        districtOptions = rows.map((row) => row.name).filter(Boolean);
    } catch (e) {
        console.warn("[DASHBOARD] District options query failed:", e.message);
    }

    try {
        const contractorPrefixParams = [];

        let contractorPrefixSql = `
            SELECT TOP 30
                x.prefix,
                COUNT(DISTINCT x.payCode) AS count
            FROM (
                SELECT
                    CASE
                        WHEN al.payCode IS NULL OR LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))) = ''
                            THEN 'NOT PROVIDED'
                        WHEN PATINDEX('%[0-9]%', LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100))))) > 1
                            THEN UPPER(
                                SUBSTRING(
                                    LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))),
                                    1,
                                    PATINDEX('%[0-9]%', LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100))))) - 1
                                )
                            )
                        WHEN PATINDEX('%[0-9]%', LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100))))) = 1
                            THEN 'NUMERIC START'
                        ELSE UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                    END AS prefix,
                    LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))) AS payCode
                FROM attendance_logs al
                LEFT JOIN users u
                    ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
                LEFT JOIN user_hierarchy_snapshots uhs
                    ON UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
                     = UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
                WHERE CONVERT(DATE, al.[date]) >= ?
                  AND CONVERT(DATE, al.[date]) <= ?
                  AND al.payCode IS NOT NULL
                  AND LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))) != ''
        `;

        contractorPrefixParams.push(sqlStartDate, sqlEndDate);
        contractorPrefixSql = addUserMasterFilters(contractorPrefixSql, contractorPrefixParams, "u");

        contractorPrefixSql += `
            ) x
            WHERE x.prefix IS NOT NULL
              AND LTRIM(RTRIM(x.prefix)) != ''
            GROUP BY x.prefix
            ORDER BY COUNT(DISTINCT x.payCode) DESC, x.prefix ASC
        `;

        const [contractorPrefixRows] = await executeQuery(contractorPrefixSql, contractorPrefixParams);

        contractorPrefixData = contractorPrefixRows.map((row) => ({
            name: row.prefix,
            value: Number(row.count) || 0,
        }));
    } catch (e) {
        console.warn("[DASHBOARD] Contractor prefix graph query failed:", e.message);
        contractorPrefixData = [];
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                manpowerData,
                absenteeismData,
                attritionData,
                skillGapData,
                pieCharts: {
                    skillLevels: skillGapData.map((gap, i) => ({
                        name: gap.level,
                        value: gap.avail,
                        color: levelColors[i % levelColors.length].replace("bg-", ""),
                    })),
                    gender: genderData,
                    state: stateData,
                    district: districtData,
                    designation: designationData,
                    leaderExpert: leaderExpertData,
                    leaderExpertTotalEmployees,
                    contractorPrefix: contractorPrefixData,
                    stateOptions,
                    districtOptions,
                },
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
                    masterAttendanceMode: isMasterAttendanceMode ? "YES" : "NO",
                    masterAttendanceDate: isMasterAttendanceMode ? yesterdaySqlDate : null,
                    attendanceDateAvailable: true,
                    attendanceLogic: hasSelectedDateForDashboard
                        ? "Selected date/range attendance found. Dashboard data is attendance-based."
                        : "Default dashboard range loaded.",
                },
            },
            "Dashboard stats fetched"
        )
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
    } = req.query;

    /*
        IMPORTANT:
        Custom tenure range is dynamic.
        Example:
        /api/dashboard/tenure-stats?customTenureFrom=20&customTenureTo=45

        If frontend does not send customTenureFrom/customTenureTo,
        then CUSTOM bucket will NOT be added.
    */
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

    const hasSelectedDate =
        Boolean(startDate && endDate) ||
        Boolean(startDate && !endDate);

    const BUCKET_LABELS = {
        "0-15d": "0–15 days",
        "16-30d": "16–30 days",
        "31-60d": "31–60 days",
        "61-90d": "61–90 days",
        "3m-6m": "3m–6m",
        "6m-9m": "6m–9m",
        "9m-1y": "9m–1y",
        "1y-2y": "1y–2y",
        "2y-3y": "2y–3y",
        "3y-others": "3y & others",
    };

    const getBucketLabels = () => ({
        ...BUCKET_LABELS,
        ...(hasCustomTenureRange
            ? {
                CUSTOM: `${customFromDays}–${customToDays} days`,
            }
            : {}),
    });

    const emptyBuckets = () => ({
        "0-15d": 0,
        "16-30d": 0,
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

    const formatDateLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const indiaNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    indiaNow.setHours(0, 0, 0, 0);

    const yesterday = new Date(indiaNow);
    yesterday.setDate(yesterday.getDate() - 1);

    let rangeStart;
    let rangeEnd;

    // ⚠️ TIMEZONE FIX: new Date("2026-05-17") = UTC midnight, shifts to 16 May in IST.
    // Use manual parse to keep date in local timezone.
    const parseDateLocal2 = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = String(dateStr).split("-").map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    };

    if (hasSelectedDate) {
        rangeStart = parseDateLocal2(startDate) || new Date(yesterday);
        rangeEnd = parseDateLocal2(endDate || startDate) || new Date(yesterday);
    } else {
        rangeStart = new Date(yesterday);
        rangeEnd = new Date(yesterday);
    }

    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    const sqlStartDate = formatDateLocal(rangeStart);
    const sqlEndDate = formatDateLocal(rangeEnd);

    const parseMultiParam = (value) => {
        if (!value || String(value).toUpperCase() === "ALL") return [];

        return String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .filter((item) => item.toUpperCase() !== "ALL");
    };

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

            return rows
                .map((row) => String(row.name || "").trim())
                .filter(Boolean);
        } catch (e) {
            console.warn(`[TENURE] ${table} lookup failed:`, e.message);
            return [];
        }
    };

    const departmentNames = await getNamesByIds("departments", departmentIds);
    const sectionNames = await getNamesByIds("sections", sectionIds);
    const lineNames = await getNamesByIds("lines", lineIds);

    const departmentName = departmentNames[0] || null;
    const sectionName = sectionNames[0] || null;
    const lineName = lineNames[0] || null;

    const hierarchyFilter = [];
    const hierarchyParams = [];

    const addHierarchyFilter = ({ unicodeColumn, nameColumn, ids, names }) => {
        const parts = [];

        const numericIds = (ids || [])
            .map((id) => parseInt(id, 10))
            .filter((id) => !Number.isNaN(id));

        if (numericIds.length) {
            const placeholders = numericIds.map(() => "?").join(",");

            parts.push(`
                UPPER(LTRIM(RTRIM(CAST(uhs.${unicodeColumn} AS NVARCHAR(100)))))
                IN (${placeholders})
            `);

            hierarchyParams.push(...numericIds.map(String));
        }

        if (names && names.length) {
            const placeholders = names
                .map(() => "UPPER(LTRIM(RTRIM(CAST(? AS NVARCHAR(510)))))")
                .join(",");

            parts.push(`
                UPPER(LTRIM(RTRIM(CAST(uhs.${nameColumn} AS NVARCHAR(510)))))
                IN (${placeholders})
            `);

            hierarchyParams.push(...names);
        }

        if (parts.length) {
            hierarchyFilter.push(`(${parts.join(" OR ")})`);
        }
    };

    addHierarchyFilter({
        unicodeColumn: "department_unicode",
        nameColumn: "department",
        ids: departmentIds,
        names: departmentNames,
    });

    addHierarchyFilter({
        unicodeColumn: "section_unicode",
        nameColumn: "section",
        ids: sectionIds,
        names: sectionNames,
    });

    addHierarchyFilter({
        unicodeColumn: "line_unicode",
        nameColumn: "lines",
        ids: lineIds,
        names: lineNames,
    });

    const hierarchyFilterSQL = hierarchyFilter.length
        ? ` AND ${hierarchyFilter.join(" AND ")}`
        : "";

    try {
        const attendanceGateSql = `
            SELECT COUNT(*) AS cnt
            FROM attendance_logs
            WHERE CONVERT(DATE, [date]) >= ?
              AND CONVERT(DATE, [date]) <= ?
        `;

        const [gateRows] = await executeQuery(attendanceGateSql, [
            sqlStartDate,
            sqlEndDate,
        ]);

        const attendanceRowsAvailable = Number(gateRows?.[0]?.cnt || 0) > 0;

        if (!attendanceRowsAvailable) {
            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        attendance: emptyBuckets(),
                        absenteeism: emptyBuckets(),
                        attrition: emptyBuckets(),
                        filters: {
                            departmentName,
                            sectionName,
                            lineName,
                            startDate: sqlStartDate,
                            endDate: sqlEndDate,
                            attendanceDateAvailable: false,
                            attendanceLogic: hasSelectedDate
                                ? "Selected date/range attendance not found. All tenure graphs are zero."
                                : "Yesterday attendance not found. All tenure graphs are zero.",
                            customTenureFrom: hasCustomTenureRange
                                ? customFromDays
                                : null,
                            customTenureTo: hasCustomTenureRange
                                ? customToDays
                                : null,
                        },
                        buckets: getBucketLabels(),
                        debug: {
                            mode: hasSelectedDate
                                ? "selected-date"
                                : "default-yesterday",
                            requiredStartDate: sqlStartDate,
                            requiredEndDate: sqlEndDate,
                            attendanceRows: 0,
                            reason:
                                "No attendance found in attendance_logs for selected/default date.",
                        },
                    },
                    hasSelectedDate
                        ? "Selected date attendance not found. No tenure data shown."
                        : "Yesterday attendance not uploaded. No tenure data shown."
                )
            );
        }
    } catch (e) {
        console.warn("[TENURE] attendance gate check failed:", e.message);

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    attendance: emptyBuckets(),
                    absenteeism: emptyBuckets(),
                    attrition: emptyBuckets(),
                    filters: {
                        departmentName,
                        sectionName,
                        lineName,
                        startDate: sqlStartDate,
                        endDate: sqlEndDate,
                        attendanceDateAvailable: false,
                        attendanceLogic:
                            "Attendance check failed. Wrong data avoid karne ke liye teeno graph 0 return kiye gaye.",
                        customTenureFrom: hasCustomTenureRange
                            ? customFromDays
                            : null,
                        customTenureTo: hasCustomTenureRange
                            ? customToDays
                            : null,
                    },
                    buckets: getBucketLabels(),
                    debug: {
                        mode: hasSelectedDate
                            ? "selected-date"
                            : "default-yesterday",
                        requiredStartDate: sqlStartDate,
                        requiredEndDate: sqlEndDate,
                        error: e.message,
                    },
                },
                "Attendance check failed. No tenure data shown."
            )
        );
    }

    const cleanJoiningDateSQL = `
        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), '')
    `;

    const cleanLeavingDateSQL = `
        NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), '')
    `;

    const joinDateSQL = `
        COALESCE(
            TRY_CONVERT(DATE, ${cleanJoiningDateSQL}, 23),
            TRY_CONVERT(DATE, ${cleanJoiningDateSQL}, 103),
            TRY_CONVERT(DATE, ${cleanJoiningDateSQL}, 105),
            TRY_CONVERT(DATE, ${cleanJoiningDateSQL}, 120),
            TRY_CONVERT(DATE, ${cleanJoiningDateSQL}, 121),
            TRY_CAST(${cleanJoiningDateSQL} AS DATE)
        )
    `;

    const actualLeaveDateSQL = `
        COALESCE(
            TRY_CONVERT(DATE, ${cleanLeavingDateSQL}, 23),
            TRY_CONVERT(DATE, ${cleanLeavingDateSQL}, 103),
            TRY_CONVERT(DATE, ${cleanLeavingDateSQL}, 105),
            TRY_CONVERT(DATE, ${cleanLeavingDateSQL}, 120),
            TRY_CONVERT(DATE, ${cleanLeavingDateSQL}, 121),
            TRY_CAST(${cleanLeavingDateSQL} AS DATE)
        )
    `;

    const attendanceToUserJoinSQL = `
        UPPER(LTRIM(RTRIM(CAST(al.payCode AS NVARCHAR(100)))))
            = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
    `;

    const hierarchyJoinSQL = `
        UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS NVARCHAR(100)))))
            = UPPER(LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))))
    `;

    const attendanceCustomBucketSQL = hasCustomTenureRange
        ? `WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN ${customFromDays} AND ${customToDays} THEN 'CUSTOM'`
        : "";

    const attritionCustomBucketSQL = hasCustomTenureRange
        ? `WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN ${customFromDays} AND ${customToDays} THEN 'CUSTOM'`
        : "";

    const attendanceBucketSQL = `
        CASE
            ${attendanceCustomBucketSQL}
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 0 AND 15 THEN '0-15d'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 16 AND 30 THEN '16-30d'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 31 AND 60 THEN '31-60d'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 61 AND 90 THEN '61-90d'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 91 AND 180 THEN '3m-6m'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 181 AND 270 THEN '6m-9m'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 271 AND 365 THEN '9m-1y'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 366 AND 730 THEN '1y-2y'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) BETWEEN 731 AND 1095 THEN '2y-3y'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, al.[date])) > 1095 THEN '3y-others'
            ELSE NULL
        END
    `;

    const attritionBucketSQL = `
        CASE
            ${attritionCustomBucketSQL}
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 0 AND 15 THEN '0-15d'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 16 AND 30 THEN '16-30d'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 31 AND 60 THEN '31-60d'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 61 AND 90 THEN '61-90d'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 91 AND 180 THEN '3m-6m'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 181 AND 270 THEN '6m-9m'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 271 AND 365 THEN '9m-1y'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 366 AND 730 THEN '1y-2y'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 731 AND 1095 THEN '2y-3y'
            WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) > 1095 THEN '3y-others'
            ELSE NULL
        END
    `;

    const fillBuckets = (target, rows) => {
        rows.forEach((r) => {
            if (
                r.bucket &&
                Object.prototype.hasOwnProperty.call(target, r.bucket)
            ) {
                target[r.bucket] = Number(r.cnt) || 0;
            }
        });
    };

    let attendanceBuckets = emptyBuckets();
    let absenteeismBuckets = emptyBuckets();
    let attritionBuckets = emptyBuckets();

    try {
        const attendanceSql = `
            SELECT bucket, COUNT(DISTINCT userId) AS cnt
            FROM (
                SELECT
                    u.id AS userId,
                    ${attendanceBucketSQL} AS bucket
                FROM attendance_logs al
                INNER JOIN users u
                    ON ${attendanceToUserJoinSQL}
                INNER JOIN user_hierarchy_snapshots uhs
                    ON ${hierarchyJoinSQL}
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND ${joinDateSQL} IS NOT NULL
                  AND CONVERT(DATE, al.[date]) >= ?
                  AND CONVERT(DATE, al.[date]) <= ?
                  AND UPPER(LTRIM(RTRIM(CAST(al.status AS NVARCHAR(100))))) IN 
                      ('PRESENT', 'P', 'PR', 'PRESENTED')
                  ${hierarchyFilterSQL}
            ) x
            WHERE bucket IS NOT NULL
            GROUP BY bucket
        `;

        const [rows] = await executeQuery(attendanceSql, [
            sqlStartDate,
            sqlEndDate,
            ...hierarchyParams,
        ]);

        fillBuckets(attendanceBuckets, rows);

        console.log("[TENURE] Attendance buckets:", attendanceBuckets);
    } catch (e) {
        console.warn("[TENURE] Attendance query failed:", e.message);
    }

    try {
        const absenteeismSql = `
            SELECT bucket, COUNT(DISTINCT userId) AS cnt
            FROM (
                SELECT
                    u.id AS userId,
                    ${attendanceBucketSQL} AS bucket
                FROM attendance_logs al
                INNER JOIN users u
                    ON ${attendanceToUserJoinSQL}
                INNER JOIN user_hierarchy_snapshots uhs
                    ON ${hierarchyJoinSQL}
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND ${joinDateSQL} IS NOT NULL
                  AND CONVERT(DATE, al.[date]) >= ?
                  AND CONVERT(DATE, al.[date]) <= ?
                  AND UPPER(LTRIM(RTRIM(CAST(al.status AS NVARCHAR(100))))) IN 
                      ('ABSENT', 'A', 'LEAVE', 'L', 'HALF DAY', 'HALFDAY', 'HD')
                  ${hierarchyFilterSQL}
            ) x
            WHERE bucket IS NOT NULL
            GROUP BY bucket
        `;

        const [rows] = await executeQuery(absenteeismSql, [
            sqlStartDate,
            sqlEndDate,
            ...hierarchyParams,
        ]);

        fillBuckets(absenteeismBuckets, rows);

        console.log("[TENURE] Absenteeism buckets:", absenteeismBuckets);
    } catch (e) {
        console.warn("[TENURE] Absenteeism query failed:", e.message);
    }

    try {
        const attritionSql = `
            SELECT bucket, COUNT(DISTINCT userId) AS cnt
            FROM (
                SELECT
                    u.id AS userId,
                    ${attritionBucketSQL} AS bucket
                FROM users u
                INNER JOIN user_hierarchy_snapshots uhs
                    ON ${hierarchyJoinSQL}
                WHERE ${joinDateSQL} IS NOT NULL
                  AND ${actualLeaveDateSQL} IS NOT NULL
                  AND ${actualLeaveDateSQL} >= ?
                  AND ${actualLeaveDateSQL} <= ?
                  ${hierarchyFilterSQL}
            ) x
            WHERE bucket IS NOT NULL
            GROUP BY bucket
        `;

        const [rows] = await executeQuery(attritionSql, [
            sqlStartDate,
            sqlEndDate,
            ...hierarchyParams,
        ]);

        fillBuckets(attritionBuckets, rows);

        console.log("[TENURE] Attrition buckets:", attritionBuckets);
    } catch (e) {
        console.warn("[TENURE] Attrition query failed:", e.message);
    }

    let debugData = {};

    try {
        const debugAttendanceSql = `
            SELECT
                COUNT(*) AS attendanceRows,
                COUNT(DISTINCT al.payCode) AS attendancePayCodes,
                COUNT(DISTINCT u.id) AS matchedUsers,
                COUNT(DISTINCT uhs.employeeid) AS matchedHierarchyEmployees,
                SUM(CASE WHEN u.id IS NULL THEN 1 ELSE 0 END) AS unmatchedUserRows,
                SUM(CASE WHEN uhs.employeeid IS NULL THEN 1 ELSE 0 END) AS unmatchedHierarchyRows,
                SUM(CASE WHEN ${joinDateSQL} IS NULL THEN 1 ELSE 0 END) AS nullJoiningDateCount,
                MIN(CONVERT(DATE, al.[date])) AS minAttendanceDate,
                MAX(CONVERT(DATE, al.[date])) AS maxAttendanceDate
            FROM attendance_logs al
            LEFT JOIN users u
                ON ${attendanceToUserJoinSQL}
            LEFT JOIN user_hierarchy_snapshots uhs
                ON ${hierarchyJoinSQL}
            WHERE CONVERT(DATE, al.[date]) >= ?
              AND CONVERT(DATE, al.[date]) <= ?
              ${hierarchyFilterSQL}
        `;

        const [debugAttendanceRows] = await executeQuery(debugAttendanceSql, [
            sqlStartDate,
            sqlEndDate,
            ...hierarchyParams,
        ]);

        const debugAttritionSql = `
            SELECT
                COUNT(DISTINCT u.id) AS totalUsersWithLeavingDateInRange,
                COUNT(DISTINCT uhs.employeeid) AS usersWithLeavingDateMatchedWithHierarchy,
                SUM(CASE WHEN ${joinDateSQL} IS NULL THEN 1 ELSE 0 END) AS nullJoiningDateCount,
                MIN(${joinDateSQL}) AS minJoiningDate,
                MAX(${joinDateSQL}) AS maxJoiningDate,
                MIN(${actualLeaveDateSQL}) AS minLeavingDate,
                MAX(${actualLeaveDateSQL}) AS maxLeavingDate,

                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 0 AND 15 THEN 1 ELSE 0 END) AS debug_0_15,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 16 AND 30 THEN 1 ELSE 0 END) AS debug_16_30,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS debug_31_60,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS debug_61_90,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 91 AND 180 THEN 1 ELSE 0 END) AS debug_3m_6m,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 181 AND 270 THEN 1 ELSE 0 END) AS debug_6m_9m,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 271 AND 365 THEN 1 ELSE 0 END) AS debug_9m_1y,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 366 AND 730 THEN 1 ELSE 0 END) AS debug_1y_2y,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN 731 AND 1095 THEN 1 ELSE 0 END) AS debug_2y_3y,
                SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) > 1095 THEN 1 ELSE 0 END) AS debug_3y_others,
                ${hasCustomTenureRange
                ? `SUM(CASE WHEN DATEDIFF(DAY, ${joinDateSQL}, ${actualLeaveDateSQL}) BETWEEN ${customFromDays} AND ${customToDays} THEN 1 ELSE 0 END) AS debug_custom`
                : `CAST(0 AS INT) AS debug_custom`
            }
            FROM users u
            LEFT JOIN user_hierarchy_snapshots uhs
                ON ${hierarchyJoinSQL}
            WHERE ${actualLeaveDateSQL} IS NOT NULL
              AND ${actualLeaveDateSQL} >= ?
              AND ${actualLeaveDateSQL} <= ?
              ${hierarchyFilterSQL}
        `;

        const [debugAttritionRows] = await executeQuery(debugAttritionSql, [
            sqlStartDate,
            sqlEndDate,
            ...hierarchyParams,
        ]);

        debugData = {
            mode: hasSelectedDate ? "selected-date" : "default-yesterday",
            requiredStartDate: sqlStartDate,
            requiredEndDate: sqlEndDate,
            customTenureFrom: hasCustomTenureRange ? customFromDays : null,
            customTenureTo: hasCustomTenureRange ? customToDays : null,
            attendanceDebug: debugAttendanceRows?.[0] || {},
            attritionDebug: debugAttritionRows?.[0] || {},
        };

        console.log("[TENURE DEBUG]", {
            selectedFilters: {
                department,
                departmentName,
                section,
                sectionName,
                line,
                lineName,
            },
            ...debugData,
        });
    } catch (e) {
        console.warn("[TENURE DEBUG] failed:", e.message);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                attendance: attendanceBuckets,
                absenteeism: absenteeismBuckets,
                attrition: attritionBuckets,
                filters: {
                    departmentName,
                    sectionName,
                    lineName,
                    startDate: sqlStartDate,
                    endDate: sqlEndDate,
                    attendanceDateAvailable: true,
                    attendanceLogic: hasSelectedDate
                        ? "Selected date/range attendance available hai, isliye attendance and absenteeism tenure graphs calculated."
                        : "Yesterday attendance available hai, isliye attendance and absenteeism tenure graphs calculated.",
                    attendanceMatchingLogic:
                        "attendance_logs.payCode matched with users.empId only.",
                    hierarchyLogic:
                        "user_hierarchy_snapshots.employeeid matched with users.empId.",
                    attritionLogic:
                        "Attrition users.leavingDate se calculated hai. Tenure = joiningDate to leavingDate. Selected date/range leavingDate par apply hoti hai.",
                    customTenureFrom: hasCustomTenureRange
                        ? customFromDays
                        : null,
                    customTenureTo: hasCustomTenureRange
                        ? customToDays
                        : null,
                },
                buckets: getBucketLabels(),
                debug: debugData,
            },
            "Tenure stats fetched successfully"
        )
    );
});


export const getDashboardAttendance = asyncHandler(async (req, res) => {
    const { section, line } = req.query;

    let sectionName = null;
    let lineName = null;

    if (section && section !== 'ALL') {
        if (!isNaN(section)) {
            const [rows] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [section]);
            if (rows.length > 0) sectionName = rows[0].name.trim();
        } else {
            sectionName = section.trim();
        }
    }

    if (line && line !== 'ALL') {
        if (!isNaN(line)) {
            const [rows] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [line]);
            if (rows.length > 0) lineName = rows[0].name.trim();
        } else {
            lineName = line.trim();
        }
    }

    const pool = await poolPromise;
    const safeName = (s) => String(s || '').replace(/'/g, "''");

    const conditions = [];

    if (sectionName) {
        conditions.push(`UPPER(LTRIM(RTRIM(uhs.[section]))) = UPPER('${safeName(sectionName)}')`);
    }

    if (lineName) {
        conditions.push(`UPPER(LTRIM(RTRIM(uhs.[lines]))) = UPPER('${safeName(lineName)}')`);
    }

    const hierarchyFilter = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';
    const todayStr = new Date().toISOString().slice(0, 10);

    const summarySQL = `
        SELECT
            SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'ABSENT' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'HALF DAY' THEN 1 ELSE 0 END) AS halfDay,
            SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'LEAVE' THEN 1 ELSE 0 END) AS onLeave,
            COUNT(*) AS total
        FROM attendance_logs al
        LEFT JOIN user_hierarchy_snapshots uhs
            ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
             = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
        WHERE CONVERT(DATE, al.[date]) = @todayStr
          ${hierarchyFilter}
    `;

    const summaryReq = pool.request();
    summaryReq.input('todayStr', sql.VarChar, todayStr);
    const summaryResult = await summaryReq.query(summarySQL);
    const summaryRow = summaryResult.recordset[0] || {};

    const summary = {
        present: Number(summaryRow.present) || 0,
        absent: Number(summaryRow.absent) || 0,
        halfDay: Number(summaryRow.halfDay) || 0,
        onLeave: Number(summaryRow.onLeave) || 0,
        total: Number(summaryRow.total) || 0,
    };

    summary.attendanceRate = summary.total > 0
        ? Math.round((summary.present / summary.total) * 100)
        : 0;

    res.status(200).json(
        new ApiResponse(200, {
            date: todayStr,
            filters: { sectionName, lineName },
            summary,
            trend: [],
            breakdown: [],
        }, "Attendance data fetched successfully")
    );
});


export const getDashboardSections = asyncHandler(async (req, res) => {
    const { departmentId, department } = req.query;

    const rawDepartment = departmentId || department;

    if (!rawDepartment || String(rawDepartment).toUpperCase() === "ALL") {
        return res.status(200).json(
            new ApiResponse(200, { sections: [] }, "No department selected")
        );
    }

    const departmentIds = String(rawDepartment)
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
    const { sectionId, section } = req.query;

    const rawSection = sectionId || section;

    if (!rawSection || String(rawSection).toUpperCase() === "ALL") {
        return res.status(200).json(
            new ApiResponse(200, { lines: [] }, "No section selected")
        );
    }

    const sectionIds = String(rawSection)
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