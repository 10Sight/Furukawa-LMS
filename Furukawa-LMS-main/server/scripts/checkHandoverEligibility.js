import 'dotenv/config';
import connectDB from '../db/connectDB.js';
import { executeQuery } from '../db/mssqlHelper.js';
import Department from '../models/department.model.js';

/**
 * Handover Sheet Eligibility Diagnostic Tool
 * 
 * Usage:
 *   node scripts/checkHandoverEligibility.js <username_or_userId> [departmentId_or_slug]
 */

const getUsage = () => {
    return `
Usage:
  node scripts/checkHandoverEligibility.js <username_or_userId> [departmentId_or_slug]

Examples:
  node scripts/checkHandoverEligibility.js emp123
  node scripts/checkHandoverEligibility.js 45 3
  node scripts/checkHandoverEligibility.js emp123 quality-assurance
`;
};

const runDiagnostic = async () => {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(getUsage());
        process.exit(1);
    }

    const userIdentifier = args[0];
    const deptIdentifier = args[1];

    console.log("------------------------------------------------------------------");
    console.log("   📋 HANDOVER SHEET ELIGIBILITY DIAGNOSTIC TOOL                  ");
    console.log("------------------------------------------------------------------\n");

    console.log("🔌 Connecting to database...");
    await connectDB();
    console.log("✅ Connected successfully.\n");

    // 1. Fetch User details
    console.log(`🔍 Fetching user info for identifier: "${userIdentifier}"...`);
    const isIdNumeric = !isNaN(userIdentifier);
    const userQuery = `
        SELECT id, fullName, userName, targetDeptId, targetSectionId, isTemporary, isDeleted 
        FROM users 
        WHERE userName = ? OR id = ?
    `;
    const [users] = await executeQuery(userQuery, [userIdentifier, isIdNumeric ? parseInt(userIdentifier) : -1]);

    if (users.length === 0) {
        console.error(`❌ User not found in database using username or ID: "${userIdentifier}"`);
        process.exit(1);
    }

    const user = users[0];
    console.log(`👤 User Found:`);
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Full Name: ${user.fullName}`);
    console.log(`   - Employee Code / Username: ${user.userName}`);
    console.log(`   - Is Temporary (Trainee): ${user.isTemporary ? "Yes ✅" : "No ⚠️"}`);
    console.log(`   - Target Department ID: ${user.targetDeptId || "None (NULL) ⚠️"}`);
    console.log(`   - Target Section ID: ${user.targetSectionId || "None (NULL)"}`);
    console.log(`   - Is Deleted: ${user.isDeleted === 1 ? "Yes ⚠️" : "No"}`);
    console.log("");

    // 2. Resolve Department
    let deptId = deptIdentifier ? parseInt(deptIdentifier) : user.targetDeptId;
    let dept;

    if (!deptId && deptIdentifier) {
        // Try searching department by slug
        console.log(`🔍 Searching department by slug: "${deptIdentifier}"...`);
        dept = await Department.findOne({ slug: deptIdentifier });
    } else if (deptId) {
        console.log(`🔍 Fetching department details for ID: ${deptId}...`);
        dept = await Department.findById(deptId);
    }

    if (!dept) {
        console.error(`❌ Target Department could not be resolved.`);
        if (!deptIdentifier && !user.targetDeptId) {
            console.error("   Reason: User has no targetDeptId set, and no department argument was provided.");
        } else {
            console.error(`   Reason: No department found matching identifier: "${deptIdentifier || deptId}"`);
        }
        console.log(getUsage());
        process.exit(1);
    }

    console.log(`🏢 Department Found:`);
    console.log(`   - ID: ${dept.id}`);
    console.log(`   - Name: ${dept.name}`);
    console.log(`   - Slug: ${dept.slug}`);
    console.log(`   - Is Dojo Specific Department: ${dept.isDojoSpecificDept ? "Yes" : "No"}`);
    console.log("");

    // Parse configurations (Department model does this, but log them nicely)
    const handoverQuizIds = dept.dojoHandoverQuizId || [];
    const eligibilityEvalIds = dept.dojoEligibilityEvaluationId || [];
    const interviewQuizIds = dept.dojoInterviewQuizId || [];
    const interviewEvalIds = dept.dojoInterviewEvaluationId || [];
    const isSpecificDept = !!dept.isDojoSpecificDept;
    const isStrictConfig = eligibilityEvalIds.length > 0;

    console.log(`⚙️ Department Handover Configuration:`);
    console.log(`   - Mode: ${isStrictConfig ? "STRICT (Dojo Eligibility Evaluation-based) 🛡️" : "LEGACY (Quiz-based fallback) 📜"}`);
    console.log(`   - Dojo Eligibility Evaluation Test IDs: ${JSON.stringify(eligibilityEvalIds)}`);
    console.log(`   - Dojo Handover Quiz IDs: ${JSON.stringify(handoverQuizIds)}`);
    console.log(`   - Dojo Interview Quiz IDs: ${JSON.stringify(interviewQuizIds)}`);
    console.log(`   - Dojo Interview Evaluation Test IDs: ${JSON.stringify(interviewEvalIds)}`);
    console.log("");

    // 3. Fetch Attempted Quizzes
    console.log(`📝 Fetching quiz attempts for ${user.fullName}...`);
    const [quizAttempts] = await executeQuery(`
        SELECT aq.id, aq.quiz, q.title as quizTitle, aq.score, aq.status, aq.completedAt, q.isDojo, q.isHandover
        FROM attempted_quizzes aq
        JOIN quizzes q ON CAST(q.id AS NVARCHAR(255)) = aq.quiz
        WHERE aq.student = ? OR aq.student = ?
        ORDER BY aq.completedAt DESC
    `, [String(user.id), user.userName]);

    console.log(`   Found ${quizAttempts.length} quiz attempts:`);
    quizAttempts.forEach(aq => {
        const isConfiguredHandover = handoverQuizIds.includes(parseInt(aq.quiz)) || handoverQuizIds.includes(String(aq.quiz));
        const isLegacyMatching = !isStrictConfig && aq.isDojo === 1 && aq.isHandover === 1;
        const marker = isConfiguredHandover ? "⭐ [Configured Handover]" : (isLegacyMatching ? "✨ [Legacy Dojo Handover]" : "");
        console.log(`     • [Quiz ${aq.quiz}] "${aq.title || aq.quizTitle}" - Score: ${aq.score}, Status: ${aq.status}, Date: ${aq.completedAt} ${marker}`);
    });
    console.log("");

    // 4. Fetch Evaluation Test Attempts
    console.log(`📋 Fetching evaluation test attempts for ${user.fullName}...`);
    const [evalAttempts] = await executeQuery(`
        SELECT eta.id, eta.testId, t.title as testTitle, eta.isHandoverEligible, eta.passedDate, eta.createdAt
        FROM evaluation_test_attempts eta
        LEFT JOIN evaluation_tests t ON eta.testId = t.id
        WHERE eta.userId = ?
        ORDER BY eta.createdAt DESC
    `, [user.id]);

    console.log(`   Found ${evalAttempts.length} evaluation test attempts:`);
    evalAttempts.forEach(eta => {
        const isConfiguredEval = eligibilityEvalIds.includes(parseInt(eta.testId)) || eligibilityEvalIds.includes(String(eta.testId));
        const isConfiguredInterview = interviewEvalIds.includes(parseInt(eta.testId)) || interviewEvalIds.includes(String(eta.testId));
        
        let marker = "";
        if (isConfiguredEval) marker = "⭐ [Configured Eligibility Test]";
        else if (isConfiguredInterview) marker = "🎙️ [Configured Interview Test]";

        console.log(`     • [Test ${eta.testId}] "${eta.testTitle || 'Evaluation'}" - Handover Eligible: ${eta.isHandoverEligible === 1 ? "Passed ✅" : "Failed ❌"}, Passed Date: ${eta.passedDate || 'N/A'}, Date: ${eta.createdAt} ${marker}`);
    });
    console.log("");

    // 5. Evaluate Eligibility Rules
    console.log("🏁 Analyzing eligibility rules...\n");
    const diagnostics = [];
    let isEligible = true;

    // Rule A: User must be temporary (trainee)
    if (!user.isTemporary) {
        diagnostics.push({
            rule: "Trainee Status",
            status: "FAILED ❌",
            details: "User must be a temporary trainee to be handed over to shop floor. This user is marked as permanent/trainer/admin."
        });
        isEligible = false;
    } else {
        diagnostics.push({
            rule: "Trainee Status",
            status: "PASSED ✅",
            details: "User is a temporary trainee."
        });
    }

    // Rule B: Target Department Match
    if (parseInt(user.targetDeptId) !== parseInt(dept.id)) {
        diagnostics.push({
            rule: "Department Assignment",
            status: "FAILED ❌",
            details: `User target department (ID: ${user.targetDeptId}) does not match current sheet department (ID: ${dept.id}).`
        });
        isEligible = false;
    } else {
        diagnostics.push({
            rule: "Department Assignment",
            status: "PASSED ✅",
            details: `User target department matches sheet department.`
        });
    }

    // Rule C: Test Paper / Evaluation Pass Status
    if (isStrictConfig) {
        // STRICT MODE: Must have evaluation_test_attempts with passed testId in dojoEligibilityEvaluationId
        const hasPassedEval = evalAttempts.some(eta => {
            const matchesId = eligibilityEvalIds.map(Number).includes(Number(eta.testId));
            return matchesId && eta.isHandoverEligible === 1;
        });

        if (hasPassedEval) {
            diagnostics.push({
                rule: "Dojo Eligibility Test",
                status: "PASSED ✅",
                details: `User passed the configured Dojo Eligibility Evaluation Test (${JSON.stringify(eligibilityEvalIds)}).`
            });
        } else {
            diagnostics.push({
                rule: "Dojo Eligibility Test",
                status: "FAILED ❌",
                details: `No passed attempt found in evaluation_test_attempts for eligibility test IDs: ${JSON.stringify(eligibilityEvalIds)}.`
            });
            isEligible = false;
        }

        // Check Interview if required
        const requiresInterview = isSpecificDept && interviewEvalIds.length > 0;
        if (requiresInterview) {
            const hasPassedInterview = evalAttempts.some(eta => {
                const matchesId = interviewEvalIds.map(Number).includes(Number(eta.testId));
                return matchesId && eta.isHandoverEligible === 1;
            });

            if (hasPassedInterview) {
                diagnostics.push({
                    rule: "Dojo Interview Test",
                    status: "PASSED ✅",
                    details: `User passed the required Dojo Interview Evaluation Test (${JSON.stringify(interviewEvalIds)}).`
                });
            } else {
                diagnostics.push({
                    rule: "Dojo Interview Test",
                    status: "FAILED ❌",
                    details: `This is a specific department requiring a passed interview, but no passed attempt was found for interview test IDs: ${JSON.stringify(interviewEvalIds)}.`
                });
                isEligible = false;
            }
        }
    } else {
        // LEGACY MODE: Passed quiz OR passed evaluation test
        const hasPassedQuiz = quizAttempts.some(aq => {
            const matchesQuiz = handoverQuizIds.length > 0
                ? handoverQuizIds.map(Number).includes(Number(aq.quiz))
                : aq.isDojo === 1 && aq.isHandover === 1;
            const statusPassed = aq.status === 'PASSED' || aq.status === 'PASS';
            return matchesQuiz && statusPassed;
        });

        const hasPassedEval = evalAttempts.some(eta => eta.isHandoverEligible === 1);

        if (hasPassedQuiz || hasPassedEval) {
            let passedDetail = "";
            if (hasPassedQuiz && hasPassedEval) passedDetail = "User passed both a handover quiz and an evaluation test.";
            else if (hasPassedQuiz) passedDetail = "User passed a handover quiz.";
            else passedDetail = "User passed an evaluation test (isHandoverEligible = 1).";

            diagnostics.push({
                rule: "Handover Test/Quiz (Legacy Mode)",
                status: "PASSED ✅",
                details: passedDetail
            });
        } else {
            const quizList = handoverQuizIds.length > 0 ? JSON.stringify(handoverQuizIds) : "any Dojo Handover quiz";
            diagnostics.push({
                rule: "Handover Test/Quiz (Legacy Mode)",
                status: "FAILED ❌",
                details: `User has neither passed the configured handover quiz(zes) (${quizList}) nor has any evaluation test marked as handover eligible.`
            });
            isEligible = false;
        }
    }

    // 6. Summary Output
    console.log("==================================================================");
    console.log("📊 DIAGNOSTIC RESULTS:");
    console.log("==================================================================");
    diagnostics.forEach((d, i) => {
        console.log(`${i + 1}. [${d.rule}] - Status: ${d.status}`);
        console.log(`   Detail: ${d.details}`);
        console.log("");
    });

    console.log("------------------------------------------------------------------");
    if (isEligible) {
        console.log("🟢 FINAL DIAGNOSIS: USER IS ELIGIBLE FOR THE HANDOVER SHEET!");
        console.log(`   User "${user.fullName}" meets all eligibility criteria for department "${dept.name}".`);
    } else {
        console.log("🔴 FINAL DIAGNOSIS: USER IS NOT ELIGIBLE FOR THE HANDOVER SHEET.");
        console.log(`   User "${user.fullName}" is missing one or more required conditions for department "${dept.name}".`);
    }
    console.log("------------------------------------------------------------------\n");
};

runDiagnostic()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Diagnostic Script Error:", error);
        process.exit(1);
    });
