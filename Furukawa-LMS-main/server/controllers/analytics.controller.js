import { executeQuery } from "../db/mssqlHelper.js";
import User from "../models/auth.model.js";
import Course from "../models/course.model.js";
import Department from "../models/department.model.js";
import AttemptedQuiz from "../models/attemptedQuiz.model.js";
import Progress from "../models/progress.model.js";
import Audit from "../models/audit.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// Helper for uptime
const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

// Helper for DB health check (MySQL)
const checkDatabaseHealth = async () => {
    try {
        const start = Date.now();
        await executeQuery("SELECT 1");
        const latency = Date.now() - start;
        return {
            status: 'healthy',
            latency: `${latency}ms`
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
};

const calculateHealthScore = ({ recentErrors, memoryUsage, dbHealth, uptime }) => {
    let score = 100;
    const alerts = [];

    // Deduct for errors
    if (recentErrors > 0) {
        score -= Math.min(recentErrors * 2, 20);
        if (recentErrors > 5) alerts.push("High error rate detected");
    }

    // Deduct for memory (assuming heapUsed in MB, rough threshold 500MB?)
    // Node default heap can be 2-4GB depending on flags, but let's say 800MB is high for this app logic
    if (memoryUsage > 800) {
        score -= 10;
        alerts.push("High memory usage");
    }

    // Deduct for DB
    if (dbHealth !== 'healthy') {
        score -= 30;
        alerts.push("Database is unhealthy");
    }

    // Deduct active uptime if too low (unstable?) or just fine? Usually high uptime is good.
    // If very low < 1 min, maybe just restarted.
    if (uptime < 60) {
        // Just info, not penalty usually, unless flapping.
    }

    return {
        score: Math.max(0, score),
        status: score > 80 ? 'healthy' : score > 50 ? 'degraded' : 'critical',
        alerts
    };
};

// Get dashboard statistics
export const getDashboardStats = asyncHandler(async (req, res) => {
    try {
        // Counts
        const totalStudents = await User.countDocuments({ role: "STUDENT" });
        const totalInstructors = await User.countDocuments({ role: "INSTRUCTOR" });
        const totalCourses = await Course.countDocuments();

        // Departments: isDeleted != true. In MySQL typically isDeleted = 1 or 0.
        // Assuming isDeleted defaults to 0 (false).
        const [deptRows] = await executeQuery("SELECT COUNT(*) as count FROM departments WHERE isDeleted = 0 OR isDeleted IS NULL");
        const totalDepartments = deptRows[0].count;

        // Active counts
        const activeStudents = await User.countDocuments({ role: "STUDENT", status: "PRESENT" });

        const [activeDeptRows] = await executeQuery("SELECT COUNT(*) as count FROM departments WHERE status = 'ONGOING' AND (isDeleted = 0 OR isDeleted IS NULL)");
        const activeDepartments = activeDeptRows[0].count;

        const [publishedCourseRows] = await executeQuery("SELECT COUNT(*) as count FROM courses WHERE (isDeleted = 0 OR isDeleted IS NULL)");
        const publishedCourses = publishedCourseRows[0].count;

        // Recent activity
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        let auditSql = "SELECT COUNT(*) as count FROM audits WHERE createdAt >= ?";
        let auditParams = [sevenDaysAgo];

        if (req.user && req.user.role === 'ADMIN') {
            const superAdmins = await User.find({ role: 'SUPERADMIN' });
            const superAdminIds = superAdmins.map(u => u.id);

            // MSSQL doesn't have REGEXP, using multiple NOT LIKE
            // Define actions to filter out for non-SuperAdmins if needed
            const filters = ['DELETE_COURSE_PERMANENT', 'RESTORE_COURSE', 'SYSTEM_UPDATE'];
            const likeClauses = filters.map(() => "action NOT LIKE ?").join(" AND ");

            auditSql = `
                SELECT COUNT(*) as count FROM audits 
                WHERE createdAt >= ? 
                AND (${likeClauses})
            `;
            // Add % to filters
            auditParams.push(...filters.map(f => `%${f}%`));

            if (superAdminIds.length > 0) {
                auditSql += ` AND ([user] NOT IN (${superAdminIds.map(() => '?').join(',')}) OR [user] IS NULL)`;
                auditParams.push(...superAdminIds);
            }
        }

        const [auditRows] = await executeQuery(auditSql, auditParams);
        const recentActivitiesCount = auditRows[0].count;

        // Metrics
        const studentEngagement = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
        const departmentUtilization = totalDepartments > 0 ? Math.round((activeDepartments / totalDepartments) * 100) : 0;
        const courseCompletion = totalCourses > 0 ? Math.round((publishedCourses / totalCourses) * 100) : 0;

        const stats = {
            totals: {
                students: totalStudents,
                instructors: totalInstructors,
                courses: totalCourses,
                departments: totalDepartments
            },
            active: {
                students: activeStudents,
                departments: activeDepartments,
                publishedCourses
            },
            engagement: {
                studentEngagement,
                departmentUtilization,
                courseCompletion
            },
            recentActivitiesCount
        };

        res.json(new ApiResponse(200, stats, "Dashboard statistics fetched successfully"));
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        throw new ApiError("Failed to fetch dashboard statistics", 500);
    }
});

// Get user statistics
export const getUserStats = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    try {
        let days = 30;
        if (period === '7d') days = 7;
        if (period === '90d') days = 90;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        let roleFilter = "";
        if (req.user && req.user.role === 'ADMIN') {
            roleFilter = " AND role != 'SUPERADMIN'";
        }

        // User Registrations over time
        // Group by FORMAT(createdAt, 'yyyy-MM-dd')
        const [userRegistrations] = await executeQuery(`
            SELECT 
                FORMAT(createdAt, 'yyyy-MM-dd') as date,
                role,
                COUNT(*) as count
            FROM users
            WHERE createdAt >= ? ${roleFilter}
            GROUP BY FORMAT(createdAt, 'yyyy-MM-dd'), role
            ORDER BY date ASC
        `, [startDate]);

        // Transform to match structure: _id: { date, role }, count
        // Original expected: { _id: { date, role }, count }
        const formattedRegistrations = userRegistrations.map(row => ({
            _id: { date: row.date, role: row.role },
            count: row.count
        }));

        // Users by role
        const [usersByRole] = await executeQuery(`
            SELECT 
                role as _id,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as active
            FROM users
            WHERE 1=1 ${roleFilter}
            GROUP BY role
        `);
        // Transform to match structure: _id: role, count, active

        const stats = {
            registrations: formattedRegistrations,
            byRole: usersByRole,
            period
        };

        res.json(new ApiResponse(200, stats, "User statistics fetched successfully"));
    } catch (error) {
        console.error("Error fetching user stats:", error);
        throw new ApiError("Failed to fetch user statistics", 500);
    }
});

// Get course statistics
export const getCourseStats = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    try {
        // Courses by status
        const [coursesByStatus] = await executeQuery(`
            SELECT status as _id, COUNT(*) as count 
            FROM courses 
            GROUP BY status
        `);
        // Total enrollments
        const [enrollRows] = await executeQuery(`SELECT COUNT(DISTINCT student) as count FROM enrollments`);
        const totalEnrollments = enrollRows[0].count;

        // Quiz stats
        const [quizAttemptStats] = await executeQuery(`
            SELECT 
                status as _id, 
                COUNT(*) as count, 
                AVG(score) as averageScore 
            FROM attempted_quizzes 
            GROUP BY status
        `);

        const stats = {
            coursesByStatus,
            totalEnrollments,
            quizAttemptStats,
            period
        };

        res.json(new ApiResponse(200, stats, "Course statistics fetched successfully"));
    } catch (error) {
        console.error("Error fetching course stats:", error);
        throw new ApiError("Failed to fetch course statistics", 500);
    }
});

// Get engagement statistics
export const getEngagementStats = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    try {
        let days = 30;
        if (period === '7d') days = 7;
        if (period === '90d') days = 90;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Quiz attempts over time
        // Group by DATE(createdAt)
        const [quizAttemptsOverTimeResults] = await executeQuery(`
            SELECT 
                FORMAT(createdAt, 'yyyy-MM-dd') as date,
                COUNT(*) as attempts,
                SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed
            FROM attempted_quizzes
            WHERE createdAt >= ?
            GROUP BY FORMAT(createdAt, 'yyyy-MM-dd')
            ORDER BY date ASC
        `, [startDate]);

        // Transform key
        const quizAttemptsOverTime = quizAttemptsOverTimeResults.map(r => ({
            _id: { date: r.date },
            attempts: r.attempts,
            passed: r.passed
        }));

        // Progress stats
        // Avg size of JSON arrays `completedModules` and `completedLessons`
        // MySQL `JSON_LENGTH` returns length.
        const [progressStats] = await executeQuery(`
            SELECT 
                currentLevel as _id,
                COUNT(*) as count,
                AVG(CAST((SELECT COUNT(*) FROM OPENJSON(COALESCE(completedModules, '[]'))) AS FLOAT)) as avgCompletedModules,
                AVG(CAST((SELECT COUNT(*) FROM OPENJSON(COALESCE(completedLessons, '[]'))) AS FLOAT)) as avgCompletedLessons
            FROM progress
            GROUP BY currentLevel
        `);

        // Login activity
        let loginSql = "SELECT COUNT(*) as count FROM audits WHERE action LIKE '%login%' AND createdAt >= ?";
        let loginParams = [startDate];

        if (req.user && req.user.role === 'ADMIN') {
            const superAdmins = await User.find({ role: 'SUPERADMIN' });
            const sIds = superAdmins.map(u => u.id);
            if (sIds.length > 0) {
                loginSql += ` AND ([user] NOT IN (${sIds.join(',')}) OR [user] IS NULL)`;
            }
        }

        const [loginRows] = await executeQuery(loginSql, loginParams);
        const loginActivity = loginRows[0].count;

        const stats = {
            quizAttemptsOverTime,
            progressStats,
            loginActivity,
            period
        };

        res.json(new ApiResponse(200, stats, "Engagement statistics fetched successfully"));
    } catch (error) {
        console.error("Error fetching engagement stats:", error);
        throw new ApiError("Failed to fetch engagement stats", 500);
    }
});

// Exam history stats
export const getExamHistoryStats = asyncHandler(async (req, res) => {
    const { groupBy = 'month', studentId, startDate, endDate, year } = req.query;

    let whereClauses = [];
    let params = [];

    if (studentId) {
        whereClauses.push("student = ?");
        params.push(studentId);
    }

    if (startDate) {
        whereClauses.push("createdAt >= ?");
        params.push(new Date(startDate));
    }
    if (endDate) {
        whereClauses.push("createdAt < ?");
        params.push(new Date(endDate));
    }
    if (year && groupBy === 'month') {
        const y = parseInt(year);
        if (!isNaN(y)) {
            whereClauses.push("createdAt >= ? AND createdAt < ?");
            params.push(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y + 1, 0, 1)));
        }
    } else if (groupBy === 'year' && !startDate && !endDate && !year) {
        // Just defaults or all time? Original didn't restrict all time if no params.
    }

    let whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    let groupSql = "";
    let selectSql = "";

    if (groupBy === 'year') {
        selectSql = "YEAR(createdAt) as year";
        groupSql = "GROUP BY year ORDER BY year ASC";
    } else {
        selectSql = "YEAR(createdAt) as year, MONTH(createdAt) as month";
        groupSql = "GROUP BY year, month ORDER BY year ASC, month ASC";
    }

    const query = `
        SELECT 
            ${selectSql},
            COUNT(*) as total,
            SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
        FROM attempted_quizzes
        ${whereSql}
        ${groupSql}
    `;

    const [rows] = await executeQuery(query, params);

    // Transform for response
    // Original output structure: _id: { year, month? }, total, passed, failed
    const agg = rows.map(r => ({
        _id: groupBy === 'year' ? { year: r.year } : { year: r.year, month: r.month },
        total: r.total,
        passed: r.passed,
        failed: r.failed
    }));

    const labels = agg.map(i => groupBy === 'year' ? `${i._id.year}` : `${i._id.year}-${String(i._id.month).padStart(2, '0')}`);
    const series = {
        total: agg.map(i => i.total),
        passed: agg.map(i => i.passed),
        failed: agg.map(i => i.failed)
    };

    return res.json(new ApiResponse(200, { labels, series }, 'Exam history stats fetched'));
});

// Utils for Export
const sendExcel = async (res, filename, columns, rows) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 20 }));
    rows.forEach(r => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.status(200).send(Buffer.from(buffer));
};

// Helper for PDF
const sendPDF = (res, filename, title, columns, rows) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    doc.pipe(res);
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    const headers = columns.map(c => c.header);
    const widths = columns.map(c => c.width || 100);
    const draw = (vals, bold = false) => {
        const y = doc.y; let x = doc.page.margins.left;
        vals.forEach((v, i) => {
            if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
            doc.text(String(v ?? ''), x, y, { width: widths[i] });
            x += widths[i] + 8;
        });
        doc.moveDown(0.5);
    };
    draw(headers, true);
    rows.forEach(r => draw(columns.map(c => r[c.key])));
    doc.end();
};

// Export Exam History Stats
export const exportExamHistoryStats = asyncHandler(async (req, res) => {
    const { format = 'excel' } = req.query;
    // Re-implement logic here or refactor to reuse. For simplicity, duplicating query build logic.
    const { groupBy = 'month', studentId, startDate, endDate, year } = req.query;
    let whereClauses = [];
    let params = [];
    if (studentId) { whereClauses.push("student = ?"); params.push(studentId); }
    if (startDate) { whereClauses.push("createdAt >= ?"); params.push(new Date(startDate)); }
    if (endDate) { whereClauses.push("createdAt < ?"); params.push(new Date(endDate)); }
    if (year && groupBy === 'month') {
        const y = parseInt(year);
        if (!isNaN(y)) {
            whereClauses.push("createdAt >= ? AND createdAt < ?");
            params.push(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y + 1, 0, 1)));
        }
    }
    let whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
    let selectSql = groupBy === 'year' ? "YEAR(createdAt) as year" : "YEAR(createdAt) as year, MONTH(createdAt) as month";
    let groupSql = groupBy === 'year' ? "GROUP BY year ORDER BY year ASC" : "GROUP BY year, month ORDER BY year ASC, month ASC";

    const [rowsDB] = await executeQuery(`
        SELECT ${selectSql}, COUNT(*) as total, SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed, SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
        FROM attempted_quizzes ${whereSql} ${groupSql}
    `, params);

    const agg = rowsDB.map(r => ({
        _id: groupBy === 'year' ? { year: r.year } : { year: r.year, month: r.month },
        total: r.total, passed: r.passed, failed: r.failed
    }));

    const columns = [
        { header: groupBy === 'year' ? 'Year' : 'Period', key: 'period', width: 18 },
        { header: 'Total Attempts', key: 'total', width: 16 },
        { header: 'Passed', key: 'passed', width: 12 },
        { header: 'Failed', key: 'failed', width: 12 },
    ];
    const rows = agg.map(i => ({
        period: groupBy === 'year' ? `${i._id.year}` : `${i._id.year}-${String(i._id.month).padStart(2, '0')}`,
        total: i.total,
        passed: i.passed,
        failed: i.failed,
    }));

    const filename = `exam_history_${groupBy}_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'pdf') return sendPDF(res, filename, 'Exam History Stats', columns, rows);
    return sendExcel(res, filename, columns, rows);
});

// Get Audit Stats
export const getAuditStats = asyncHandler(async (req, res) => {
    const { groupBy = 'month', userId, startDate, endDate, year } = req.query;
    let whereClauses = [];
    let params = [];
    if (userId) { whereClauses.push("[user] = ?"); params.push(userId); }
    if (startDate) { whereClauses.push("createdAt >= ?"); params.push(new Date(startDate)); }
    if (endDate) { whereClauses.push("createdAt < ?"); params.push(new Date(endDate)); }
    if (year && groupBy === 'month') {
        const y = parseInt(year);
        if (!isNaN(y)) {
            whereClauses.push("createdAt >= ? AND createdAt < ?");
            params.push(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y + 1, 0, 1)));
        }
    }
    let whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
    let selectSql = groupBy === 'year' ? "YEAR(createdAt) as year" : "YEAR(createdAt) as year, MONTH(createdAt) as month";
    let groupSql = groupBy === 'year' ? "GROUP BY year ORDER BY year ASC" : "GROUP BY year, month ORDER BY year ASC, month ASC";

    const [rows] = await executeQuery(`SELECT ${selectSql}, COUNT(*) as total FROM audits ${whereSql} ${groupSql}`, params);

    const agg = rows.map(r => ({
        _id: groupBy === 'year' ? { year: r.year } : { year: r.year, month: r.month },
        total: r.total
    }));

    const labels = agg.map(i => groupBy === 'year' ? `${i._id.year}` : `${i._id.year}-${String(i._id.month).padStart(2, '0')}`);
    const series = { total: agg.map(i => i.total) };
    res.json(new ApiResponse(200, { labels, series }, 'Audit stats fetched'));
});

// Export Audit Stats
export const exportAuditStats = asyncHandler(async (req, res) => {
    const { format = 'excel' } = req.query;
    const { groupBy = 'month', userId, startDate, endDate, year } = req.query;
    let whereClauses = [];
    let params = [];
    if (userId) { whereClauses.push("[user] = ?"); params.push(userId); }
    if (startDate) { whereClauses.push("createdAt >= ?"); params.push(new Date(startDate)); }
    if (endDate) { whereClauses.push("createdAt < ?"); params.push(new Date(endDate)); }
    if (year && groupBy === 'month') {
        const y = parseInt(year);
        if (!isNaN(y)) {
            whereClauses.push("createdAt >= ? AND createdAt < ?");
            params.push(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y + 1, 0, 1)));
        }
    }
    let whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
    let selectSql = groupBy === 'year' ? "YEAR(createdAt) as year" : "YEAR(createdAt) as year, MONTH(createdAt) as month";
    let groupSql = groupBy === 'year' ? "GROUP BY year ORDER BY year ASC" : "GROUP BY year, month ORDER BY year ASC, month ASC";

    const [rowsDB] = await executeQuery(`SELECT ${selectSql}, COUNT(*) as total FROM audits ${whereSql} ${groupSql}`, params);

    const agg = rowsDB.map(r => ({
        _id: groupBy === 'year' ? { year: r.year } : { year: r.year, month: r.month },
        total: r.total
    }));

    const columns = [
        { header: groupBy === 'year' ? 'Year' : 'Period', key: 'period', width: 18 },
        { header: 'Total Events', key: 'total', width: 14 }
    ];
    const rows = agg.map(i => ({ period: groupBy === 'year' ? `${i._id.year}` : `${i._id.year}-${String(i._id.month).padStart(2, '0')}`, total: i.total }));
    const filename = `audit_stats_${groupBy}_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'pdf') return sendPDF(res, filename, 'Audit Logs Stats', columns, rows);
    return sendExcel(res, filename, columns, rows);
});

// Get system health overview
export const getSystemHealth = asyncHandler(async (req, res) => {
    try {
        const collections = {
            users: await User.countDocuments(),
            courses: await Course.countDocuments(),
            departments: await Department.countDocuments(),
            quizAttempts: await AttemptedQuiz.countDocuments(),
            progress: await Progress.countDocuments(),
            audits: await Audit.countDocuments()
        };

        const [errorRows] = await executeQuery(`SELECT COUNT(*) as count FROM audits WHERE action LIKE '%error%' AND createdAt >= ?`, [new Date(Date.now() - 24 * 60 * 60 * 1000)]);
        const recentErrors = errorRows[0].count;

        const activeUsers = await User.countDocuments({ status: "PRESENT" }); // role filtered if needed in param default or SQL

        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        const memoryMetrics = {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024),
            arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024)
        };

        const dbHealth = await checkDatabaseHealth();

        const systemMetrics = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: Math.round(uptime),
            uptimeFormatted: formatUptime(uptime),
            memory: memoryMetrics,
            pid: process.pid
        };

        const healthScore = calculateHealthScore({
            recentErrors,
            memoryUsage: memoryMetrics.heapUsed,
            dbHealth: dbHealth.status,
            uptime
        });

        const systemHealth = {
            status: healthScore.status,
            score: healthScore.score,
            collections,
            recentErrors,
            activeUsers,
            database: dbHealth,
            server: systemMetrics,
            alerts: healthScore.alerts,
            timestamp: new Date()
        };

        res.json(new ApiResponse(200, systemHealth, "System health data fetched successfully"));
    } catch (error) {
        console.error("Error fetching system health:", error);
        throw new ApiError("Failed to fetch system health data", 500);
    }
});

// Detailed server metrics
export const getServerMetrics = asyncHandler(async (req, res) => {
    try {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        const memoryMetrics = {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024),
            arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024)
        };
        const heapUsagePercent = Math.round((memoryMetrics.heapUsed / memoryMetrics.heapTotal) * 100);

        const metrics = {
            timestamp: new Date(),
            uptime: {
                seconds: Math.round(uptime),
                formatted: formatUptime(uptime)
            },
            memory: {
                ...memoryMetrics,
                heapUsagePercent,
                limit: Math.round(memoryMetrics.heapTotal)
            },
            process: {
                pid: process.pid,
                ppid: process.ppid,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            },
            environment: {
                nodeEnv: process.env.NODE_ENV || 'development',
                port: process.env.PORT || 8000
            }
        };

        res.json(new ApiResponse(200, metrics, "Server metrics fetched successfully"));
    } catch (error) {
        console.error("Error fetching server metrics:", error);
        throw new ApiError("Failed to fetch server metrics", 500);
    }
});

// Database Metrics
export const getDatabaseMetrics = asyncHandler(async (req, res) => {
    try {
        const dbHealth = await checkDatabaseHealth();

        const collectionStats = {
            users: await User.countDocuments(),
            courses: await Course.countDocuments(),
            departments: await Department.countDocuments(),
            quizAttempts: await AttemptedQuiz.countDocuments(),
            progress: await Progress.countDocuments(),
            audits: await Audit.countDocuments()
        };

        const connectionInfo = {
            readyState: 1, // Connected in pool
            readyStateText: "connected",
            // host/port/name extraction tricky from pool object without inspecting config
            host: "localhost",
            port: 3306,
            name: "learning management system"
        };

        // Recent activity by hour
        const [recentActivity] = await executeQuery(`
            SELECT DATEPART(hour, createdAt) as _id, COUNT(*) as count 
            FROM audits 
            WHERE createdAt >= ? 
            GROUP BY DATEPART(hour, createdAt)
            ORDER BY _id ASC
        `, [new Date(Date.now() - 24 * 60 * 60 * 1000)]);

        const metrics = {
            health: dbHealth,
            connection: connectionInfo,
            collections: collectionStats,
            recentActivity,
            timestamp: new Date()
        };

        res.json(new ApiResponse(200, metrics, "Database metrics fetched successfully"));
    } catch (error) {
        console.error("Error fetching database metrics:", error);
        throw new ApiError("Failed to fetch database metrics", 500);
    }
});

// Get System Alerts
export const getSystemAlerts = asyncHandler(async (req, res) => {
    try {
        const alerts = [];
        const memoryUsage = process.memoryUsage();
        const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

        if (heapUsagePercent > 80) {
            alerts.push({ type: 'error', category: 'memory', title: 'High Memory Usage', message: `Heap ${Math.round(heapUsagePercent)}%`, value: Math.round(heapUsagePercent), threshold: 80, timestamp: new Date() });
        } else if (heapUsagePercent > 60) {
            alerts.push({ type: 'warning', category: 'memory', title: 'Moderate Memory Usage', message: `Heap ${Math.round(heapUsagePercent)}%`, value: Math.round(heapUsagePercent), threshold: 60, timestamp: new Date() });
        }

        // DB check
        try {
            await executeQuery("SELECT 1");
        } catch (e) {
            alerts.push({ type: 'error', category: 'database', title: 'Database Connection Issue', message: `DB unreachable`, value: 0, threshold: 1, timestamp: new Date() });
        }

        const [errRows] = await executeQuery(`SELECT COUNT(*) as count FROM audits WHERE action LIKE '%error%' AND createdAt >= ?`, [new Date(Date.now() - 60 * 60 * 1000)]);
        const recentErrors = errRows[0].count;

        if (recentErrors > 10) alerts.push({ type: 'error', category: 'errors', title: 'High Error Rate', message: `${recentErrors} errors/hr`, value: recentErrors, threshold: 10, timestamp: new Date() });
        else if (recentErrors > 5) alerts.push({ type: 'warning', category: 'errors', title: 'Elevated Error Rate', message: `${recentErrors} errors/hr`, value: recentErrors, threshold: 5, timestamp: new Date() });

        const uptime = process.uptime();
        if (uptime < 300) alerts.push({ type: 'info', category: 'uptime', title: 'Recent Restart', message: `Restarted ${formatUptime(uptime)} ago`, value: uptime, threshold: 300, timestamp: new Date() });

        res.json(new ApiResponse(200, { alerts, count: alerts.length }, "System alerts fetched successfully"));
    } catch (error) {
        console.error("Error fetching alerts:", error);
        throw new ApiError("Failed to fetch alerts", 500);
    }
});

// Dummy for performance history if needed, or implement actual historical tracking table
export const getSystemPerformanceHistory = asyncHandler(async (req, res) => {
    // Requires a metrics history table. Returning empty or current snapshot.
    res.json(new ApiResponse(200, [], "Not implemented in SQL migration yet"));
});

// Get Comprehensive Analytics
export const getComprehensiveAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    let params = [];
    let dateFilter = "";
    if (startDate && endDate) {
        dateFilter = "AND createdAt >= ? AND createdAt <= ?";
        params.push(new Date(startDate), new Date(endDate));
    }

    const [userCount] = await executeQuery(`SELECT COUNT(*) as c FROM users WHERE 1=1 ${dateFilter}`, params);
    const [courseCount] = await executeQuery(`SELECT COUNT(*) as c FROM courses WHERE 1=1 ${dateFilter}`, params);
    const [quizCount] = await executeQuery(`SELECT COUNT(*) as c FROM attempted_quizzes WHERE 1=1 ${dateFilter}`, params);

    res.json(new ApiResponse(200, {
        users: userCount[0].c,
        courses: courseCount[0].c,
        quizAttempts: quizCount[0].c
    }, "Comprehensive analytics fetched"));
});

// Generate Custom Report
export const generateCustomReport = asyncHandler(async (req, res) => {
    const { reportType, startDate, endDate, format = 'json' } = req.body;

    // Logic dependent on reportType
    // Example: 'USER_ACTIVITY', 'COURSE_PERFORMANCE'

    let data = [];
    let params = [];
    let dateSql = "";
    if (startDate && endDate) {
        dateSql = "AND createdAt >= ? AND createdAt <= ?";
        params.push(new Date(startDate), new Date(endDate));
    }

    if (reportType === 'USER_ACTIVITY') {
        const [rows] = await executeQuery(`SELECT TOP 1000 * FROM audits WHERE 1=1 ${dateSql}`, params);
        data = rows;
    } else if (reportType === 'COURSE_PERFORMANCE') {
        // Aggregate course stats
        const [rows] = await executeQuery(`
             SELECT c.title, COUNT(e.id) as enrollments 
             FROM courses c 
             LEFT JOIN enrollments e ON c.id = e.course 
             WHERE 1=1 ${dateSql ? dateSql.replace('createdAt', 'e.enrolledAt') : ''}
             GROUP BY c.id, c.title
             ORDER BY enrollments DESC
        `, params);
        data = rows;
    }

    if (format === 'csv') {
        // ... simple CSV implementation
        return res.json({ message: "CSV export not fully implemented here", data });
    }

    res.json(new ApiResponse(200, data, "Custom report generated"));
});

// Get Department Quiz Stats
export const getDepartmentQuizStats = asyncHandler(async (req, res) => {
    // Get Pass/Fail counts for quizzes grouped by department or section (if departmentId is provided)
    const { startDate, endDate, departmentId } = req.query;
    let dateFilter = "";
    let params = [];

    if (startDate && endDate) {
        dateFilter = "AND aq.createdAt >= ? AND aq.createdAt <= ?";
        params.push(new Date(startDate), new Date(endDate));
    }

    // attempted_quizzes.quiz/student are NVARCHAR; casting the subquery side to INT (instead of
    // casting quizzes.id/users.id to NVARCHAR) lets these joins seek on the INT PK indexes.
    let query = "";
    if (departmentId) {
        // Fetch stats grouped by sections under this department
        query = `
            SELECT
                s.name as departmentName,
                COALESCE(SUM(CASE WHEN aq.status = 'PASSED' THEN 1 ELSE 0 END), 0) as passedCount,
                COALESCE(SUM(CASE WHEN aq.status = 'FAILED' THEN 1 ELSE 0 END), 0) as failedCount,
                COUNT(aq.id) as totalAttempts
            FROM [sections] s
            LEFT JOIN users u ON u.sectionId = s.id AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
            LEFT JOIN (
                SELECT aq_sub.*
                FROM attempted_quizzes aq_sub
                JOIN quizzes q ON q.id = TRY_CAST(aq_sub.quiz AS INT)
                WHERE COALESCE(q.isDojo, 0) = 0
            ) aq ON TRY_CAST(aq.student AS INT) = u.id ${dateFilter}
            WHERE s.departmentId = ?
            GROUP BY s.id, s.name, s.category
            ORDER BY passedCount DESC
        `;
        params.push(parseInt(departmentId));
    } else {
        // Global departments view. Prefer the indexed u.departmentId FK; fall back to the
        // legacy string-based u.department match only when departmentId hasn't been set.
        query = `
            SELECT
                d.name as departmentName,
                COALESCE(SUM(CASE WHEN aq.status = 'PASSED' THEN 1 ELSE 0 END), 0) as passedCount,
                COALESCE(SUM(CASE WHEN aq.status = 'FAILED' THEN 1 ELSE 0 END), 0) as failedCount,
                COUNT(aq.id) as totalAttempts
            FROM departments d
            LEFT JOIN users u ON (
                u.departmentId = d.id
                OR (u.departmentId IS NULL AND (u.department = CAST(d.id AS NVARCHAR(50)) OR u.department = d.name))
            ) AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
            LEFT JOIN (
                SELECT aq_sub.*
                FROM attempted_quizzes aq_sub
                JOIN quizzes q ON q.id = TRY_CAST(aq_sub.quiz AS INT)
                WHERE COALESCE(q.isDojo, 0) = 0
            ) aq ON TRY_CAST(aq.student AS INT) = u.id ${dateFilter}
            WHERE d.isDeleted = 0
            GROUP BY d.id, d.name
            ORDER BY passedCount DESC
        `;
    }

    const [rows] = await executeQuery(query, params);

    res.json(new ApiResponse(200, rows, "Quiz statistics fetched successfully"));
});

// Export Analytics Data
export const exportAnalyticsData = asyncHandler(async (req, res) => {
    const { type, format = 'excel', startDate, endDate } = req.body;

    let columns = [];
    let rows = [];
    let filename = `export_${type || 'data'}_${Date.now()} `;

    let params = [];
    let dateSql = "";
    if (startDate && endDate) {
        dateSql = "AND createdAt >= ? AND createdAt <= ?";
        params.push(new Date(startDate), new Date(endDate));
    }

    if (type === 'USERS') {
        columns = [{ header: 'Name', key: 'fullName' }, { header: 'Email', key: 'email' }, { header: 'Role', key: 'role' }];
        const [data] = await executeQuery(`SELECT fullName, email, role FROM users WHERE 1 = 1 ${dateSql} `, params);
        rows = data;
    } else if (type === 'COURSES') {
        columns = [{ header: 'Title', key: 'title' }, { header: 'Status', key: 'status' }];
        const [data] = await executeQuery(`SELECT title, status FROM courses WHERE 1 = 1 ${dateSql} `, params);
        rows = data;
    } else {
        // Default generic export?
        return res.status(400).json(new ApiResponse(400, null, "Invalid export type"));
    }

    if (format === 'pdf') return sendPDF(res, filename, `${type} Report`, columns, rows);
    return sendExcel(res, filename, columns, rows);
});
