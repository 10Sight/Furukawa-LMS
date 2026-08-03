import 'dotenv/config';
import connectDB from '../db/connectDB.js';
import { executeQuery } from '../db/mssqlHelper.js';
import Department from '../models/department.model.js';

/**
 * Handover Sheet Eligibility Diagnostic Tool (Enhanced)
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

    console.log("==================================================================");
    console.log("🔍   HANDOVER SHEET ELIGIBILITY DIAGNOSTIC TOOL                  ");
    console.log("==================================================================\n");

    console.log("🔌 Connecting to database...");
    await connectDB();
    console.log("✅ Connected successfully.\n");

    // 1. Fetch User details
    console.log(`👤 Fetching user info for identifier: "${userIdentifier}"...`);
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
    console.log(`   - Trainee: ${user.fullName} (${user.userName})`);
    console.log(`   - Is Temporary (Trainee): ${user.isTemporary ? "Yes ✅" : "No ⚠️"}`);
    console.log(`   - Target Department ID: ${user.targetDeptId || "None (NULL) ⚠️"}`);
    console.log(`   - Target Section ID: ${user.targetSectionId || "None (NULL)"}`);
    console.log(`   - Is Deleted: ${user.isDeleted === 1 ? "Yes ⚠️" : "No"}`);
    console.log("");

    // 2. Resolve Department
    let deptId = deptIdentifier ? parseInt(deptIdentifier) : user.targetDeptId;
    let dept;

    if (!deptId && deptIdentifier) {
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
        process.exit(1);
    }

    console.log(`🏢 Target Department:`);
    console.log(`   - Name: ${dept.name} (ID: ${dept.id})`);
    console.log(`   - Dojo Specific Department: ${dept.isDojoSpecificDept ? "Yes" : "No"}`);
    console.log("");

    // Parse configurations
    const handoverQuizIds = (dept.dojoHandoverQuizId || []).map(Number).filter(id => !isNaN(id) && id > 0);
    const eligibilityEvalIds = (dept.dojoEligibilityEvaluationId || []).map(Number).filter(id => !isNaN(id) && id > 0);
    const interviewQuizIds = (dept.dojoInterviewQuizId || []).map(Number).filter(id => !isNaN(id) && id > 0);
    const interviewEvalIds = (dept.dojoInterviewEvaluationId || []).map(Number).filter(id => !isNaN(id) && id > 0);
    const isSpecificDept = !!dept.isDojoSpecificDept;
    const isStrictConfig = eligibilityEvalIds.length > 0;

    console.log(`⚙️ Handover Policy Mode: ${isStrictConfig ? "STRICT (Dojo Eligibility Evaluation-based) 🛡️" : "LEGACY (Quiz-based fallback) 📜"}\n`);

    // Fetch Quiz Titles from DB
    const allQuizIds = [...handoverQuizIds, ...interviewQuizIds];
    const quizTitles = new Map();
    if (allQuizIds.length > 0) {
        const [quizzes] = await executeQuery(`SELECT id, title FROM quizzes WHERE id IN (?)`, [allQuizIds]);
        quizzes.forEach(q => quizTitles.set(Number(q.id), q.title));
    }

    // Fetch Evaluation Test Titles from DB
    const allEvalIds = [...eligibilityEvalIds, ...interviewEvalIds];
    const evalTitles = new Map();
    if (allEvalIds.length > 0) {
        const [tests] = await executeQuery(`SELECT id, title FROM evaluation_tests WHERE id IN (?)`, [allEvalIds]);
        tests.forEach(t => evalTitles.set(Number(t.id), t.title));
    }

    // 3. Fetch attempts from DB
    const [quizAttempts] = await executeQuery(`
        SELECT aq.id, aq.quiz, q.title as quizTitle, aq.score, aq.status, aq.completedAt
        FROM attempted_quizzes aq
        JOIN quizzes q ON CAST(q.id AS NVARCHAR(255)) = aq.quiz
        WHERE aq.student = ? OR aq.student = ?
    `, [String(user.id), user.userName]);

    const [evalAttempts] = await executeQuery(`
        SELECT eta.id, eta.testId, t.title as testTitle, eta.isHandoverEligible, eta.passedDate, eta.createdAt
        FROM evaluation_test_attempts eta
        LEFT JOIN evaluation_tests t ON eta.testId = t.id
        WHERE eta.userId = ?
    `, [user.id]);

    // Helper functions for checking paper details
    const analyzeQuizRequirement = (quizId, label = "Handover Quiz") => {
        const matchingAttempts = quizAttempts.filter(aq => Number(aq.quiz) === Number(quizId));
        const passed = matchingAttempts.some(aq => aq.status === 'PASSED' || aq.status === 'PASS');
        const title = quizTitles.get(Number(quizId)) || `Quiz ID ${quizId}`;
        
        let status = "PENDING ⏳";
        if (matchingAttempts.length > 0) {
            status = passed ? "PASSED ✅" : "FAILED ❌";
        }

        return { id: quizId, title, type: "Quiz", label, status, attempts: matchingAttempts, passed };
    };

    const analyzeEvalRequirement = (testId, label = "Eligibility Test") => {
        const matchingAttempts = evalAttempts.filter(eta => Number(eta.testId) === Number(testId));
        const passed = matchingAttempts.some(eta => eta.isHandoverEligible === 1);
        const title = evalTitles.get(Number(testId)) || `Test ID ${testId}`;

        let status = "PENDING ⏳";
        if (matchingAttempts.length > 0) {
            status = passed ? "PASSED ✅" : "FAILED ❌";
        }

        return { id: testId, title, type: "Evaluation Test", label, status, attempts: matchingAttempts, passed };
    };

    const printRequirementBlock = (titleBlock, requirements) => {
        console.log(`==================================================================`);
        console.log(`📋 ${titleBlock}`);
        console.log(`==================================================================`);
        if (requirements.length === 0) {
            console.log("   No specific requirements configured.");
            console.log("");
            return;
        }

        requirements.forEach(req => {
            console.log(`• [${req.type} ${req.id}] "${req.title}" (${req.label})`);
            console.log(`  Current Status: ${req.status}`);
            
            if (req.attempts.length === 0) {
                console.log(`  Attempts: No attempts found (PENDING).`);
            } else {
                console.log(`  Attempts (${req.attempts.length} total):`);
                req.attempts.forEach((att, idx) => {
                    if (req.type === "Quiz") {
                        console.log(`     [${idx + 1}] Date: ${att.completedAt} - Score: ${att.score} | Status: ${att.status}`);
                    } else {
                        console.log(`     [${idx + 1}] Date: ${att.createdAt} - Result: ${att.isHandoverEligible === 1 ? "PASSED ✅" : "FAILED ❌"} (Passed Date: ${att.passedDate || 'N/A'})`);
                    }
                });
            }
            console.log("");
        });
    };

    let isEligible = true;
    const missingCriteria = [];

    // Analyze Trainee/Dept mismatch first
    if (!user.isTemporary) {
        isEligible = false;
        missingCriteria.push("User is not marked as a Temporary Trainee (isTemporary must be true)");
    }
    if (parseInt(user.targetDeptId) !== parseInt(dept.id)) {
        isEligible = false;
        missingCriteria.push(`Trainee target department (ID ${user.targetDeptId}) does not match current sheet department (ID ${dept.id})`);
    }

    const eligibilityReqs = [];
    const interviewReqs = [];

    if (isStrictConfig) {
        // Strict requirements mapping
        eligibilityEvalIds.forEach(id => eligibilityReqs.push(analyzeEvalRequirement(id, "Required Eligibility")));
        
        const hasPassedEligibility = eligibilityReqs.length === 0 || eligibilityReqs.some(r => r.passed);
        if (!hasPassedEligibility) {
            isEligible = false;
            missingCriteria.push("Has not passed any of the required Dojo Eligibility Evaluation test papers.");
        }

        // Interview requirements mapping
        const requiresInterview = isSpecificDept && interviewEvalIds.length > 0;
        if (requiresInterview) {
            interviewEvalIds.forEach(id => interviewReqs.push(analyzeEvalRequirement(id, "Required Interview")));
            interviewQuizIds.forEach(id => interviewReqs.push(analyzeQuizRequirement(id, "Required Interview Quiz")));

            const evalReqs = interviewReqs.filter(r => r.type === "Evaluation Test");
            const quizReqs = interviewReqs.filter(r => r.type === "Quiz");

            const passedEval = evalReqs.length === 0 || evalReqs.some(r => r.passed);
            const passedQuiz = quizReqs.length === 0 || quizReqs.some(r => r.passed);
            const hasPassedInterview = passedEval && passedQuiz;

            if (!hasPassedInterview) {
                isEligible = false;
                missingCriteria.push("Has not passed the required Dojo Interview Evaluation papers/quizzes.");
            }
        }
    } else {
        // Legacy Mode: Check any configured handover quizzes or falls back to any Dojo handover quiz
        if (handoverQuizIds.length > 0) {
            handoverQuizIds.forEach(id => eligibilityReqs.push(analyzeQuizRequirement(id, "Handover Quiz")));
        } else {
            // Find any attempted quizzes flagged as Dojo & Handover
            const matchingGeneralAttempts = quizAttempts.filter(aq => aq.isDojo === 1 && aq.isHandover === 1);
            const passedGeneral = matchingGeneralAttempts.some(aq => aq.status === 'PASSED' || aq.status === 'PASS');
            eligibilityReqs.push({
                id: "Any",
                title: "Dojo Handover Quiz Fallback (Any)",
                type: "General Quiz",
                label: "Legacy Default",
                status: matchingGeneralAttempts.length > 0 ? (passedGeneral ? "PASSED ✅" : "FAILED ❌") : "PENDING ⏳",
                attempts: matchingGeneralAttempts,
                passed: passedGeneral
            });
        }

        // Also check if they have any passed evaluation test (isHandoverEligible = 1)
        const hasPassedEval = evalAttempts.some(eta => eta.isHandoverEligible === 1);
        const hasPassedQuiz = eligibilityReqs.some(r => r.passed);

        if (hasPassedEval) {
            eligibilityReqs.push({
                id: "Any",
                title: "Any Handover Eligible Test Attempt",
                type: "Evaluation Test",
                label: "Alternative Pass",
                status: "PASSED ✅",
                attempts: evalAttempts.filter(eta => eta.isHandoverEligible === 1),
                passed: true
            });
        }

        if (!hasPassedQuiz && !hasPassedEval) {
            isEligible = false;
            missingCriteria.push("Has not passed any of the configured handover quizzes OR any evaluation test marked as handover-eligible.");
        }
    }

    // Print grouped lists
    printRequirementBlock("CONFIGURED ELIGIBILITY PAPERS STATUS", eligibilityReqs);
    if (isStrictConfig && isSpecificDept && interviewEvalIds.length > 0) {
        printRequirementBlock("CONFIGURED INTERVIEW PAPERS STATUS", interviewReqs);
    }

    // 6. Summary Output
    console.log("==================================================================");
    console.log("📊 FINAL STATUS SUMMARY:");
    console.log("==================================================================");
    console.log(`• Trainee Status:   ${user.isTemporary ? "PASSED ✅ (Trainee)" : "FAILED ❌ (Not a Trainee)"}`);
    console.log(`• Dept Alignment:   ${parseInt(user.targetDeptId) === parseInt(dept.id) ? "PASSED ✅ (Matches)" : "FAILED ❌ (Mismatch)"}`);
    
    if (isStrictConfig) {
        const passedEligibilityCount = eligibilityReqs.filter(r => r.passed).length;
        console.log(`• Eligibility Tests: ${passedEligibilityCount === eligibilityReqs.length ? "PASSED ✅" : "FAILED ❌"} (${passedEligibilityCount}/${eligibilityReqs.length} passed)`);
        
        if (isSpecificDept && interviewEvalIds.length > 0) {
            const passedInterviewCount = interviewReqs.filter(r => r.passed).length;
            console.log(`• Interview Tests:   ${passedInterviewCount === interviewReqs.length ? "PASSED ✅" : "FAILED ❌"} (${passedInterviewCount}/${interviewReqs.length} passed)`);
        }
    } else {
        const passedQuiz = eligibilityReqs.some(r => r.passed && r.type !== "Evaluation Test");
        const passedEval = evalAttempts.some(eta => eta.isHandoverEligible === 1);
        console.log(`• Legacy Handover:  ${(passedQuiz || passedEval) ? "PASSED ✅" : "FAILED ❌"} (Requires 1 pass: Quiz Pass = ${passedQuiz ? "Yes" : "No"}, Eval Pass = ${passedEval ? "Yes" : "No"})`);
    }

    console.log("\n------------------------------------------------------------------");
    if (isEligible) {
        console.log("🟢 DIAGNOSIS: USER IS ELIGIBLE FOR THE HANDOVER SHEET!");
        console.log(`   User "${user.fullName}" can be successfully added to the sheet for "${dept.name}".`);
    } else {
        console.log("🔴 DIAGNOSIS: USER IS NOT ELIGIBLE FOR THE HANDOVER SHEET.");
        console.log("   Reasons for Ineligibility:");
        missingCriteria.forEach((reason, i) => {
            console.log(`     ${i + 1}. ${reason}`);
        });
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
