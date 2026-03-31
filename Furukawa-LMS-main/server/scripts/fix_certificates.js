import { pool } from "../db/connectDB.js";
import Certificate from "../models/certificate.model.js";
import User from "../models/auth.model.js";
import Department from "../models/department.model.js";
import Course from "../models/course.model.js";
import Progress from "../models/progress.model.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parseJSON = (data, fallback = []) => {
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

async function fixCertificates() {
    try {
        console.log("Starting certificate fix...");
        await User.init(); // Ensure user table init if needed (mostly for connection check)

        // Fetch all certificates that might be broken (e.g., COURSE_COMPLETION type or all)
        // We can just iterate all and re-generate metadata.
        // Or filter those where metadata.generatedHTML contains '{{'

        // Let's fetch ALL for safety, or just those with type COURSE_COMPLETION
        // Using Mongoose model to fetch all
        // Wait, Certificate model is Mongoose-like wrapper around SQL or actual Mongoose?
        // Let's assume Mongoose interface wrapper as seen in controllers.

        // Actually, let's use SQL directly to find them to be sure.
        const [certs] = await pool.query("SELECT * FROM certificates");
        console.log(`Found ${certs.length} certificates.`);

        for (const certRow of certs) {
            // Re-hydrate full logic
            // We need to rebuild metadata if it's broken.
            // Check if generatedHTML has {{
            let needsFix = false;
            let metadata = typeof certRow.metadata === 'string' ? JSON.parse(certRow.metadata) : certRow.metadata;

            if (!metadata || !metadata.generatedHTML || metadata.generatedHTML.includes('{{')) {
                needsFix = true;
            } else if (metadata.employeeId === undefined || metadata.startDate === undefined) {
                needsFix = true;
            }

            if (!needsFix) {
                // console.log(`Certificate ${certRow.id} seems fine. Skipping.`);
                // continue; 
                // Force update for user satisfaction
                needsFix = true; // FORCE FIX for 'Hussain' case
            }

            console.log(`Fixing Certificate ${certRow.id} for Student ${certRow.student}...`);

            const studentId = certRow.student;
            const courseId = certRow.course;

            const student = await User.findById(studentId);
            const course = await Course.findById(courseId);
            const progress = await Progress.findOne({ student: studentId, course: courseId });

            if (!student || !course || !progress) {
                console.log(`Missing data for cert ${certRow.id}. Skipping.`);
                continue;
            }

            let deptName = 'N/A';
            if (student.department) {
                const d = await Department.findById(student.department);
                if (d) deptName = d.name;
            }

            // Fetch Level Config
            let levelConfig = null;
            const [lConfigs] = await pool.query("SELECT * FROM course_level_configs WHERE isActive = 1 LIMIT 1");
            if (lConfigs.length > 0) {
                const raw = lConfigs[0];
                raw.levels = typeof raw.levels === 'string' ? JSON.parse(raw.levels) : raw.levels;
                levelConfig = raw;
            }
            const levels = levelConfig?.levels || [{ name: 'L1' }, { name: 'L2' }, { name: 'L3' }];
            const currentLevelName = certRow.level || progress.currentLevel || 'L1';
            const currentLevelIndex = levels.findIndex(l => l.name === currentLevelName);

            // Fetch modules - just for total count if needed, or skip.
            // We cannot query level. So we use completedModules from progress to estimate.
            const completedModules = progress.completedModules || [];
            // Sort by completedAt
            completedModules.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

            const totalCompleted = completedModules.length;

            const formatDate = (date) => {
                if (!date) return '-';
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
            };

            const getHeuristicDate = (percent) => {
                if (totalCompleted === 0) return null;
                const idx = Math.ceil(totalCompleted * percent) - 1;
                const safeIdx = Math.max(0, Math.min(idx, totalCompleted - 1));
                const mod = completedModules[safeIdx];
                return mod ? new Date(mod.completedAt) : null;
            };

            let level1DateObj = null;
            let level2DateObj = null;
            let level3DateObj = null;

            if (currentLevelName === 'L3') {
                level1DateObj = getHeuristicDate(0.33);
                level2DateObj = getHeuristicDate(0.66);
                level3DateObj = getHeuristicDate(1.0);
            } else if (currentLevelName === 'L2') {
                level1DateObj = getHeuristicDate(0.5);
                level2DateObj = getHeuristicDate(1.0);
            } else {
                level1DateObj = getHeuristicDate(1.0);
            }

            let startDateObj;
            let completionDateObj;

            // Start date = first module completion or student creation
            if (completedModules.length > 0) {
                // heuristic: start date is a bit before first completion?
                // Or just use student.createdAt as enrollment date usually
                startDateObj = new Date(student.createdAt);
            } else {
                startDateObj = new Date(student.createdAt);
            }

            completionDateObj = level3DateObj || level2DateObj || level1DateObj || new Date(certRow.issueDate);

            // Fallbacks
            if (!startDateObj) startDateObj = new Date();
            if (!completionDateObj) completionDateObj = new Date();

            const totalLevels = levels.length || 3;
            const currentProgressStep = currentLevelIndex + 1;
            const fillPercentage = Math.round((currentProgressStep / totalLevels) * 100);
            const pieChartCss = `background: conic-gradient(#F97316 0% ${fillPercentage}%, #E5E7EB ${fillPercentage}% 100%); border-radius: 50%;`;

            const certData = {
                studentName: student.fullName,
                courseName: course.title,
                departmentName: deptName,
                instructorName: 'N/A', // Could fetch instructor if needed
                level: currentLevelName,
                issueDate: formatDate(new Date(certRow.issueDate)),
                grade: certRow.grade || 'PASS',
                employeeId: student.userName || student.id,
                unit: student.unit || 'N/A',
                startDate: formatDate(startDateObj),
                completionDate: formatDate(completionDateObj),
                level1Date: formatDate(level1DateObj),
                level2Date: formatDate(level2DateObj),
                level3Date: formatDate(level3DateObj),
                userImage: student.avatar?.url || 'https://via.placeholder.com/150',
                pieChart: pieChartCss
            };

            // Re-use existing template string from metadata or fetch default
            let htmlTemplate = metadata?.generatedHTML; // This is BAD if it's already replaced partially
            // Better to fetch template from DB using templateId
            let templateStr = '';
            if (metadata?.templateId) {
                const [tRows] = await pool.query("SELECT template FROM certificate_templates WHERE id = ?", [metadata.templateId]);
                if (tRows.length > 0) templateStr = tRows[0].template;
            }

            if (!templateStr) {
                // Fallback
                const [temps] = await pool.query("SELECT template FROM certificate_templates WHERE isActive = 1 ORDER BY createdAt ASC LIMIT 1");
                if (temps.length > 0) templateStr = temps[0].template;
            }

            if (!templateStr) {
                console.log("No template found for cert " + certRow.id);
                continue;
            }

            let html = templateStr;
            Object.keys(certData).forEach(k => {
                const val = certData[k] !== null && certData[k] !== undefined ? certData[k] : '';
                html = html.split(`{{${k}}}`).join(val);
            });

            const newMetadata = {
                ...metadata,
                ...certData,
                generatedHTML: html
            };

            await pool.query("UPDATE certificates SET metadata = ? WHERE id = ?", [JSON.stringify(newMetadata), certRow.id]);
            console.log(`Updated Certificate ${certRow.id}`);
        }
        console.log("Fix complete.");
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

fixCertificates();
