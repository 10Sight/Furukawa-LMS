import EvaluationTestAttempt from "../server/models/evaluationTestAttempt.model.js";

async function checkData() {
    try {
        console.log("--- EvaluationTestAttempt.findAll() output check ---");
        const attempts = await EvaluationTestAttempt.findAll();
        console.dir(attempts.map(a => ({ id: a.id, traineeName: a.traineeName, employeeNo: a.employeeNo, userName: a.userName, isTemporary: a.isTemporary })), { depth: null });
    } catch (error) {
        console.error("Query failed:", error);
    }
}

checkData();
