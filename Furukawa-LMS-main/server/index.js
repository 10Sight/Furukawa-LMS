import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import ENV from "./configs/env.config.js";
import logger from "./logger/winston.logger.js";
import connectDB from "./db/connectDB.js";
import path from "path";
import fs from "fs";
import socketIOService from "./utils/socketIO.js";
// import morganMiddleware from "./logger/morgan.logger.js";
// Routes
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.routes.js";
import designationRoutes from "./routes/designation.routes.js";
import courseRoutes from "./routes/course.routes.js";
import quizRoutes from "./routes/quiz.routes.js";
import attemptedQuizRoutes from "./routes/attemptedQuiz.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import assignmentRoutes from "./routes/assignment.routes.js";
import submissionRoutes from "./routes/submission.routes.js";
import certificateRoutes from "./routes/certificate.routes.js";
import certificateTemplateRoutes from "./routes/certificateTemplate.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import enrollmentRoutes from "./routes/enrollment.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import resourceRoutes from "./routes/resource.routes.js";
import moduleRoutes from "./routes/module.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import lessonRoutes from "./routes/lesson.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import instructorRoutes from "./routes/instructor.routes.js";
import systemSettingsRoutes from "./routes/systemSettings.routes.js";
import dataManagementRoutes from "./routes/dataManagement.routes.js";
import bulkOperationsRoutes from "./routes/bulkOperations.routes.js";
import rolesPermissionsRoutes from "./routes/rolesPermissions.routes.js";
import moduleTimelineRoutes from "./routes/moduleTimeline.routes.js";
import exportRoutes from "./routes/export.routes.js";
import courseLevelConfigRoutes from "./routes/courseLevelConfig.routes.js";
import languageRoutes from "./routes/language.routes.js";
import onJobTrainingRoutes from "./routes/onJobTraining.routes.js";
import importRoutes from "./routes/import.route.js";
import requirementRoutes from "./routes/requirement.routes.js";
import lineRequirementRoutes from "./routes/lineRequirement.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import privilegeRoutes from "./routes/privilegeroutes.js";
import reportRoutes from "./routes/report.routes.js";
import sectionHeadRoutes from "./routes/sectionHead.routes.js";

import sectionRoutes from "./routes/section.routes.js";
import subSectionRoutes from "./routes/subSection.routes.js";
import OnJobTraining from "./models/onJobTraining.model.js"; // Initialize table
import timelineScheduler from "./services/timelineScheduler.js";
import departmentStatusScheduler from "./services/departmentStatusScheduler.js";
import reportScheduler from "./services/reportScheduler.js";
import handoverNotificationScheduler from "./services/handoverNotificationScheduler.js";
import sixteenDayMonitoringScheduler from "./services/sixteenDayMonitoringScheduler.js";
import planNotificationScheduler from "./services/planNotificationScheduler.js";
import operatorObservanceRoutes from "./routes/operatorObservance.routes.js";
import daily5MRoutes from "./routes/daily5M.routes.js";
import dailyProductionReportRoutes from "./routes/dailyProductionReport.routes.js";
import sixteenDayMonitoringRoutes from "./routes/sixteenDayMonitoring.routes.js";
import threeDayMonitoringRoutes from "./routes/threeDayMonitoring.routes.js";
import tenCycleSheetRoutes from "./routes/tenCycleSheet.routes.js";
import reportClubRoutes from "./routes/reportClub.routes.js";
import menteeFeedbackRoutes from "./routes/menteeFeedback.routes.js";
import learningComparisonRoutes from "./routes/learningComparison.routes.js";
import evaluationTestRoutes from "./routes/evaluationTest.routes.js";
import adminHomeRoutes from "./routes/adminHome.routes.js";
import abnormalConditionRoutes from "./routes/abnormalCondition.routes.js";
import contractorRoutes from "./routes/contractor.routes.js";
// import cleanupOldFiles from './scripts/cleanup.js';

import machineRoutes from "./routes/machine.routes.js";
import lineRoutes from "./routes/line.routes.js";
import sectionRoutesModel from "./models/section.model.js";
import skillMatrixRoutes from "./routes/skillMatrix.route.js";
import emailConfigurationRoutes from "./routes/emailConfiguration.routes.js";
import Machine from "./models/machine.model.js";
import Line from "./models/line.model.js";
import SkillMatrix from "./models/skillMatrix.model.js";
import SystemSettings from "./models/systemSettings.model.js";
import SkillMatrixConfig from "./models/skillMatrixConfig.model.js";
import SkillMatrixEvaluation from "./models/skillMatrixEvaluation.model.js";
import MonitoringConfig from "./models/monitoringConfig.model.js";
import Resource from "./models/resource.model.js";
import Certificate from "./models/certificate.model.js";
import HandoverSheet from "./models/handoverSheet.model.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import multiSkillingPlanRoutes from "./routes/multiSkillingPlan.routes.js";
import skillUpgradationPlanRoutes from "./routes/skillUpgradationPlan.routes.js";
import HeadcountReport from "./models/headcountReport.model.js";
import HandoverSheetConfig from "./models/handoverSheetConfig.model.js";
import MultiSkillingPlanConfig from "./models/multiSkillingPlanConfig.model.js";
import SkillUpgradationPlan from "./models/skillUpgradationPlan.model.js";
import SkillUpgradationPlanConfig from "./models/skillUpgradationPlanConfig.model.js";
import SkillMatrixDashboardConfig from "./models/skillMatrixDashboardConfig.model.js";
import Requirement from "./models/requirement.model.js";
import SubSection from "./models/subSection.model.js";
import SectionHead from "./models/sectionHead.model.js";

import LineRequirement from "./models/lineRequirement.model.js";
import LineRequirementHistory from "./models/lineRequirementHistory.model.js";
import ReportClub from "./models/reportClub.model.js";
import UserHierarchySnapshot from "./models/userHierarchySnapshot.model.js";
import MenteeFeedback from "./models/menteeFeedback.model.js";
import Course from "./models/course.model.js";
import Quiz from "./models/quiz.model.js";
import EvaluationTest from "./models/evaluationTest.model.js";
import EvaluationTestAttempt from "./models/evaluationTestAttempt.model.js";

const app = express();
const allowedOrigins = [
    "http://192.168.90.19:5174"
];
// Matches localhost/127.0.0.1 and any private LAN address (10.x, 172.16-31.x, 192.168.x) on any port,
// so the app is reachable from other devices on the same network (e.g. shared OJT links) without
// having to hardcode every machine's IP.
const LAN_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})(?::\d+)?$/;
const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    return LAN_ORIGIN_REGEX.test(origin);
};
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) return callback(null, true);
            return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
        },
        credentials: true,
        methods: ["GET", "POST"]
    }
});

// CORS with caching for preflight
const corsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`HTTP CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    optionsSuccessStatus: 200, // For legacy browser support
    maxAge: 86400, // Cache preflight for 24 hours
};
app.use(cors(corsOptions));

// Performance optimizations
app.use(compression()); // Enable gzip/deflate compression

// Body parsing middleware
app.use(express.json({ limit: '500mb' })); // Increased limit for file uploads (e.g. large PDFs)
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(cookieParser()); // Add cookie parser middleware

// Serve static files from uploads directory
const uploadPath = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}
app.use("/uploads", express.static(uploadPath, {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();

        // Map extensions to content types
        const typeMap = {
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.txt': 'text/plain',
            '.mp3': 'audio/mpeg'
        };

        if (typeMap[ext]) {
            res.setHeader('Content-Type', typeMap[ext]);
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));


// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// GLOBAL DEBUG LOGGER - TOP OF STACK
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
        console.log(`[DEBUG] API Request: ${req.method} ${req.url} - Query: ${JSON.stringify(req.query)}`);
        logger.info(`[DEBUG] API Request: ${req.method} ${req.url} - Query: ${JSON.stringify(req.query)}`);
    }
    next();
});

const PORT = ENV.PORT;

app.get("/", (req, res) => {
    res.send("This is Backend");
});

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "Server is running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.use("/api/v1/auth/", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/attempts", attemptedQuizRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/certificate-templates", certificateTemplateRoutes);
app.use("/api/attendance", attendanceRoutes);

// Test route to verify server is reachable at this path
app.get("/api/test-departments", (req, res) => {
    res.send("Departments API is reachable");
});

app.use("/api/departments", (req, res, next) => {
    next();
}, departmentRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/audits", auditRoutes);
app.use("/api/email-configurations", emailConfigurationRoutes);
// Mount lesson routes before modules to ensure /api/modules/:moduleId/lessons resolves correctly
app.use("/api", lessonRoutes);
// Also mount lesson routes at /api/lessons for backward compatibility
app.use("/api/lessons", lessonRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/instructor", instructorRoutes);
app.use("/system/settings", systemSettingsRoutes);
app.use("/api/data-management", dataManagementRoutes);
app.use("/api/bulk-operations", bulkOperationsRoutes);
app.use("/api/roles-permissions", rolesPermissionsRoutes);
app.use("/api/module-timelines", moduleTimelineRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api/course-level-config", courseLevelConfigRoutes);
app.use("/api/languages", languageRoutes);
app.use("/api/on-job-training", onJobTrainingRoutes);

app.use("/api/machines", machineRoutes);
app.use("/api/lines", lineRoutes);
app.use("/api/skill-matrix", skillMatrixRoutes);
app.use("/api/multi-skilling-plan", multiSkillingPlanRoutes);
app.use("/api/skill-upgradation-plan", skillUpgradationPlanRoutes);
app.use("/api/import", importRoutes);
app.use("/api/requirements", requirementRoutes);
app.use("/api/line-requirements", lineRequirementRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/privileges", privilegeRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/operator-observance", operatorObservanceRoutes);
app.use("/api/daily-5m", daily5MRoutes);
app.use("/api/daily-production-report", dailyProductionReportRoutes);
app.use("/api/v1/daily-production-report", dailyProductionReportRoutes);
app.use("/api/sixteen-day-monitoring", sixteenDayMonitoringRoutes);
app.use("/api/three-day-monitoring", threeDayMonitoringRoutes);
app.use("/api/ten-cycle-sheets", tenCycleSheetRoutes);
app.use("/api/section-heads", sectionHeadRoutes);

app.use("/api/sections", sectionRoutes);
app.use("/api/sub-sections", subSectionRoutes);
app.use("/api/report-clubs", reportClubRoutes);
app.use("/api/mentee-feedback", menteeFeedbackRoutes);
app.use("/api/learning-comparisons", learningComparisonRoutes);
app.use("/api/evaluation-tests", evaluationTestRoutes);
app.use("/api/admin-home", adminHomeRoutes);
app.use("/api/abnormal-conditions", abnormalConditionRoutes);
app.use("/api/contractors", contractorRoutes);


// Initialize Socket.IO service
socketIOService.initialize(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);

    // Handle user authentication and room joining
    socket.on('authenticate', (userData) => {
        socket.userId = userData.userId;
        socket.userRole = userData.role;
        socket.userName = userData.name;

        // Auto-join user to their departments/courses
        if (userData.departments && Array.isArray(userData.departments)) {
            userData.departments.forEach(departmentId => {
                socket.join(`department-${departmentId}`);
                logger.info(`User ${userData.name} joined department room: department-${departmentId}`);
            });
        }

        // Join user-specific room for direct notifications
        socket.join(`user-${userData.userId}`);

        // Notify user of successful connection
        socket.emit('authenticated', {
            message: 'Successfully connected to real-time notifications',
            connectedUsers: socketIOService.getConnectedUsersCount()
        });
    });

    // Handle manual room joining
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        logger.info(`User ${socket.id} joined room: ${roomId}`);
        socket.to(roomId).emit('user-joined', {
            userId: socket.userId,
            userName: socket.userName,
            roomId
        });
    });

    // Handle leaving rooms
    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        logger.info(`User ${socket.id} left room: ${roomId}`);
        socket.to(roomId).emit('user-left', {
            userId: socket.userId,
            userName: socket.userName,
            roomId
        });
    });

    // Handle quiz events
    socket.on('quiz-started', (data) => {
        socketIOService.notifyQuizStarted(data.departmentId, data.quizData);
    });

    socket.on('quiz-submitted', (data) => {
        socketIOService.notifyQuizSubmitted(data.departmentId, {
            ...data.submissionData,
            studentName: socket.userName
        });
    });

    // Handle assignment events
    socket.on('assignment-created', (data) => {
        socketIOService.notifyAssignmentCreated(data.departmentId, data.assignmentData);
    });

    socket.on('assignment-submitted', (data) => {
        socketIOService.notifyAssignmentSubmitted(data.departmentId, {
            ...data.submissionData,
            studentName: socket.userName
        });
    });

    // Handle general notifications
    socket.on('send-notification', (data) => {
        socketIOService.emitToRoom(data.targetRoom, 'notification', {
            message: data.message,
            type: data.type,
            timestamp: new Date(),
            from: socket.userName || data.from
        });
    });

    // Handle typing indicators (for chat features)
    socket.on('typing', (data) => {
        socket.to(data.roomId).emit('user-typing', {
            userId: socket.userId,
            userName: socket.userName,
            roomId: data.roomId
        });
    });

    socket.on('stop-typing', (data) => {
        socket.to(data.roomId).emit('user-stopped-typing', {
            userId: socket.userId,
            userName: socket.userName,
            roomId: data.roomId
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        logger.info(`User disconnected: ${socket.id} (${socket.userName || 'Unknown'})`);
    });
});

// Make io and socketIOService accessible to other parts of the application
app.set('socketio', io);
app.set('socketIOService', socketIOService);

// Global Error Handler (must be after all routes)
app.use((err, req, res, next) => {

    // Default error values
    let statusCode = err.statuscode || err.status || 500;
    let message = err.message || 'Internal Server Error';
    let success = false;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map(e => e.message).join(', ');
    } else if (err.code === 'ER_DUP_ENTRY') { // MySQL Duplicate Entry
        statusCode = 400;
        message = 'Duplicate field value';
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') { // MySQL FK Constraint
        statusCode = 400;
        message = 'Invalid reference (Foreign Key)';
    }

    // Send JSON error response
    res.status(statusCode).json({
        success,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        message: `API route ${req.originalUrl} not found`
    });
});

const startServer = async () => {
    try {
        // Validate DB Connection
        await connectDB();

        // Initialize Schedulers
        timelineScheduler.init();
        departmentStatusScheduler.init();
        reportScheduler.init();
        handoverNotificationScheduler.init();
        sixteenDayMonitoringScheduler.init();
        planNotificationScheduler.init();

        // Initialize Core Tables
        await HandoverSheet.init();
        await Requirement.init();
        await SectionHead.init();

        await HeadcountReport.init();
        await import("./models/skillMatrixConfig.model.js").then(m => m.SkillMatrixConfig.init());
        await import("./models/skillMatrixEvaluation.model.js").then(m => m.SkillMatrixEvaluation.init());
        await MonitoringConfig.init();
        await HandoverSheetConfig.init();
        await MultiSkillingPlanConfig.init();
        await SkillUpgradationPlan.init();
        await SkillUpgradationPlanConfig.init();
        await SkillMatrixDashboardConfig.init();
        await Course.init();
        await Quiz.init();
        await EvaluationTest.init();
        await EvaluationTestAttempt.init();

        // Initialize Hierarchy in Order: Section -> Line -> SubSection
        const Section = (await import("./models/section.model.js")).default;
        await Section.init();
        await Line.init();
        await SubSection.init();

        await LineRequirement.init();
        await LineRequirementHistory.init();
        await ReportClub.init();
        await UserHierarchySnapshot.init();
        await MenteeFeedback.init();
        await import("./models/abnormalCondition.model.js").then(m => m.default.init());
        await import("./models/designationShutter.model.js").then(m => m.default.init());

        server.listen(PORT, () => {
            logger.info(`Server with Socket.IO running at http://localhost:${PORT}`);
        });

        // Graceful shutdown handling
        process.on('SIGINT', () => {
            timelineScheduler.stop();
            departmentStatusScheduler.stop();
            handoverNotificationScheduler.stop();
            sixteenDayMonitoringScheduler.stop();
            planNotificationScheduler.stop();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            timelineScheduler.stop();
            departmentStatusScheduler.stop();
            handoverNotificationScheduler.stop();
            sixteenDayMonitoringScheduler.stop();
            planNotificationScheduler.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};
startServer();
// cleanupOldFiles();
