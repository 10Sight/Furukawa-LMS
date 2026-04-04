import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
    // line param now carries subSectionId from frontend
    const { section, line, machine } = req.query;

    const currentYear = new Date().getFullYear();
    const monthsOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    let reqSql = `
        SELECT month_name as month, CAST(SUM(prod_plan) AS BIGINT) as required_count 
        FROM requirements 
        WHERE year_val = ? 
    `;
    const reqParams = [currentYear];

    if (section && section !== 'ALL') {
        reqSql += " AND section_name = (SELECT name FROM [sections] WHERE id = ?)";
        reqParams.push(section);
    }
    if (line && line !== 'ALL') {
        reqSql += " AND description_line = (SELECT name FROM [lines] WHERE id = ?)";
        reqParams.push(line);
    }
    // Ignoring machine filter as requested effectively

    reqSql += " GROUP BY month_name";

    let reqResults = [];
    try {
        const [rows] = await executeQuery(reqSql, reqParams);
        reqResults = rows;
    } catch (e) {
        console.warn("Requirements table error:", e.message);
    }

    let userWhereClause = "WHERE isEmployee = 1 AND isDeleted = 0 AND YEAR(createdAt) = ?";
    let userParams = [currentYear];

    if (section && section !== 'ALL') {
        userWhereClause += " AND sectionId = ?";
        userParams.push(section);
    }
    if (line && line !== 'ALL') {
        userWhereClause += " AND lineId = ?";
        userParams.push(line);
    }

    const userSql = `
        SELECT 
            DATENAME(month, createdAt) as month, 
            COUNT(*) as added_count 
        FROM users 
        ${userWhereClause}
        GROUP BY MONTH(createdAt), DATENAME(month, createdAt)
    `;

    const [userResults] = await executeQuery(userSql, userParams);

    // Initial count (users created before current year)
    let initialSql = "SELECT COUNT(*) as total FROM users WHERE isEmployee = 1 AND isDeleted = 0 AND YEAR(createdAt) < ?";
    let initialParams = [currentYear];

    if (section && section !== 'ALL') {
        initialSql += " AND sectionId = ?";
        initialParams.push(section);
    }
    if (line && line !== 'ALL') {
        initialSql += " AND lineId = ?";
        initialParams.push(line);
    }

    const [initialCountRes] = await executeQuery(initialSql, initialParams);
    let runningTotal = initialCountRes[0].total;

    const manpowerData = monthsOrder.map(m => {
        const reqItem = reqResults.find(r => r.month === m);
        const userItem = userResults.find(u => u.month === m);

        if (userItem) runningTotal += userItem.added_count;

        const isFuture = new Date(`${m} 1, ${currentYear}`) > new Date();

        return {
            month: m.substring(0, 3),
            required: reqItem ? reqItem.required_count : 0, // Default to 0 instead of 150
            current: isFuture ? null : runningTotal
        };
    });

    const attritionData = monthsOrder.slice(0, 6).map(m => ({
        month: m.substring(0, 3),
        actual: Math.random() * 2,
        target: 2.0
    }));


    const absenteeismData = [];

    // Skill Gap Logic
    let skillSql = "SELECT currentLevel as skill_level, COUNT(*) as avail FROM users WHERE role != 'admin' AND isDeleted = 0";
    const skillParams = [];

    if (section && section.toLowerCase() !== 'all') {
        skillSql += " AND sectionId = ?";
        skillParams.push(section);
    }
    if (line && line.toLowerCase() !== 'all') {
        skillSql += " AND lineId = ?";
        skillParams.push(line);
    }

    skillSql += " GROUP BY currentLevel";
    const [skillRes] = await executeQuery(skillSql, skillParams);

    // Map DB levels (e.g. 'L1', 'Level 1') to standardized L0-L4
    const skillGapData = [
        { level: 'L0', label: 'Trainee', avail: 0, req: 0, color: 'bg-zinc-500' }, // Req is hard to know without data
        { level: 'L1', label: 'Operator', avail: 0, req: 0, color: 'bg-blue-500' },
        { level: 'L2', label: 'Skilled', avail: 0, req: 0, color: 'bg-green-500' },
        { level: 'L3', label: 'Expert', avail: 0, req: 0, color: 'bg-purple-500' },
        { level: 'L4', label: 'Master', avail: 0, req: 0, color: 'bg-amber-500' },
    ];

    skillRes.forEach(row => {
        // match row.skill_level to skillGapData
        // simple parsing
        const lvl = row.skill_level; // e.g. "L1" or "1"
        if (!lvl) return;
        const idx = skillGapData.findIndex(s => s.level === lvl || s.level === `L${lvl}`);
        if (idx !== -1) skillGapData[idx].avail = row.avail;
    });

    res.status(200).json(
        new ApiResponse(200, {
            manpowerData,
            attritionData, // Keeping this placeholder/0 for now
            absenteeismData: [
                { day: 'Mon', actual: 2, limit: 10 }, // Placeholder until attendance is populated
                { day: 'Tue', actual: 5, limit: 10 },
                { day: 'Wed', actual: 1, limit: 10 },
                { day: 'Thu', actual: 3, limit: 10 },
                { day: 'Fri', actual: 4, limit: 10 },
            ],
            skillGapData
        }, "Dashboard stats fetched")
    );
});
