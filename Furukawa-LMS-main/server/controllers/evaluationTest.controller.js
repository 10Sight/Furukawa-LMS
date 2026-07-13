import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import EvaluationTest from "../models/evaluationTest.model.js";
import EvaluationTestAttempt from "../models/evaluationTestAttempt.model.js";
import logAudit from "../utils/auditLogger.js";

export const createEvaluationTest = asyncHandler(async (req, res) => {
    const { title, performDateCount, processType, contentStructure, departmentId } = req.body;
    const createdBy = req.user?.fullName || req.user?.userName || "Admin";

    if (!title) {
        throw new ApiError("Title of the evaluation test is required", 400);
    }

    const testData = {
        title,
        performDateCount: parseInt(performDateCount, 10) || 4,
        processType: processType || 'Former process',
        contentStructure: contentStructure || [],
        departmentId: departmentId !== undefined && departmentId !== null && departmentId !== ''
            ? parseInt(departmentId, 10)
            : null,
        createdBy
    };

    const evaluationTest = await EvaluationTest.create(testData);

    logAudit(req.user?.id, "CREATE_EVALUATION_TEST", {
        title: evaluationTest.title,
        processType: evaluationTest.processType,
        departmentId: evaluationTest.departmentId,
    }, { resourceType: "EvaluationTest", resourceId: evaluationTest.id, req }).catch(err =>
        console.error("logAudit(CREATE_EVALUATION_TEST) failed:", err.message)
    );

    res.status(201).json(
        new ApiResponse(201, evaluationTest, "Evaluation test created successfully")
    );
});

export const getAllEvaluationTests = asyncHandler(async (req, res) => {
    const { departmentId } = req.query;
    const filters = {};
    if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
        filters.departmentId = parseInt(departmentId, 10);
    }

    const tests = await EvaluationTest.findAll(filters);
    res.json(
        new ApiResponse(200, tests, "Evaluation tests fetched successfully")
    );
});

export const getEvaluationTestById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const test = await EvaluationTest.findById(id);

    if (!test) {
        throw new ApiError("Evaluation test not found", 404);
    }

    res.json(
        new ApiResponse(200, test, "Evaluation test fetched successfully")
    );
});

export const updateEvaluationTest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, performDateCount, processType, contentStructure, departmentId } = req.body;

    const existingTest = await EvaluationTest.findById(id);
    if (!existingTest) {
        throw new ApiError("Evaluation test not found", 404);
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (performDateCount !== undefined) updateData.performDateCount = parseInt(performDateCount, 10);
    if (processType !== undefined) updateData.processType = processType;
    if (contentStructure !== undefined) updateData.contentStructure = contentStructure;
    if (departmentId !== undefined) {
        updateData.departmentId = departmentId !== null && departmentId !== ''
            ? parseInt(departmentId, 10)
            : null;
    }

    const updatedTest = await EvaluationTest.update(id, updateData);

    logAudit(req.user?.id, "UPDATE_EVALUATION_TEST", {
        title: updatedTest.title,
        testId: id,
    }, { resourceType: "EvaluationTest", resourceId: id, req }).catch(err =>
        console.error("logAudit(UPDATE_EVALUATION_TEST) failed:", err.message)
    );

    res.json(
        new ApiResponse(200, updatedTest, "Evaluation test updated successfully")
    );
});

export const deleteEvaluationTest = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existingTest = await EvaluationTest.findById(id);
    if (!existingTest) {
        throw new ApiError("Evaluation test not found", 404);
    }

    await EvaluationTest.delete(id);

    logAudit(req.user?.id, "DELETE_EVALUATION_TEST", {
        title: existingTest.title,
        testId: id,
    }, { resourceType: "EvaluationTest", resourceId: id, req }).catch(err =>
        console.error("logAudit(DELETE_EVALUATION_TEST) failed:", err.message)
    );

    res.json(
        new ApiResponse(200, null, "Evaluation test deleted successfully")
    );
});

// Student Evaluation Attempt APIs
export const createEvaluationTestAttempt = asyncHandler(async (req, res) => {
    const { testId, traineeName, employeeNo, educatorName, attemptData, createdBy: reqCreatedBy, triggerEmail } = req.body;
    const createdBy = reqCreatedBy || req.user?.fullName || req.user?.userName || "Admin";

    if (!testId) {
        throw new ApiError("Test ID is required for registering an attempt", 400);
    }

    const parsedTestId = parseInt(testId, 10);
    const { isHandoverEligible, passedDate } = await EvaluationTestAttempt.computeHandoverEligibility(
        parsedTestId, attemptData || {}
    );

    const newAttempt = await EvaluationTestAttempt.create({
        testId: parsedTestId,
        traineeName,
        employeeNo,
        educatorName,
        attemptData,
        createdBy,
        isHandoverEligible,
        passedDate
    });

    logAudit(req.user?.id, "CREATE_EVALUATION_TEST_ATTEMPT", {
        traineeName: newAttempt.traineeName,
        employeeNo: newAttempt.employeeNo,
        testId: parsedTestId,
    }, { resourceType: "EvaluationTestAttempt", resourceId: newAttempt.id, req }).catch(err =>
        console.error("logAudit(CREATE_EVALUATION_TEST_ATTEMPT) failed:", err.message)
    );

    if (triggerEmail) {
        try {
            const NotificationService = (await import("../services/notification.service.js")).default;
            await NotificationService.sendFormReport(
                "Dojo Evaluation Sheet",
                newAttempt.studentDeptId,
                newAttempt,
                newAttempt.userId,
                newAttempt.studentSectionId
            );
        } catch (e) {
            console.error("[EvaluationTestAttempt] Failed to trigger email notification:", e);
        }
    }

    res.status(201).json(
        new ApiResponse(201, newAttempt, "Evaluation test sheet submitted successfully")
    );
});

export const getAllEvaluationTestAttempts = asyncHandler(async (req, res) => {
    const attempts = await EvaluationTestAttempt.findAll();
    res.json(
        new ApiResponse(200, attempts, "Evaluation test sheets fetched successfully")
    );
});

export const getEvaluationTestAttemptById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const attempt = await EvaluationTestAttempt.findById(id);

    if (!attempt) {
        throw new ApiError("Evaluation test sheet record not found", 404);
    }

    res.json(
        new ApiResponse(200, attempt, "Evaluation test sheet record fetched successfully")
    );
});

export const getEvaluationTestAttemptsByTestId = asyncHandler(async (req, res) => {
    const { testId } = req.params;
    const attempts = await EvaluationTestAttempt.findByTestId(testId);
    res.json(
        new ApiResponse(200, attempts, "Evaluation test sheet records fetched successfully")
    );
});

export const updateEvaluationTestAttempt = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { attemptData, traineeName, employeeNo, educatorName, createdBy, triggerEmail } = req.body;

    const existingAttempt = await EvaluationTestAttempt.findById(id);
    if (!existingAttempt) {
        throw new ApiError("Evaluation test sheet record not found", 404);
    }

    // Use the incoming attemptData if provided, otherwise fall back to existing
    const effectiveAttemptData = attemptData ?? existingAttempt.attemptData;
    const { isHandoverEligible, passedDate } = await EvaluationTestAttempt.computeHandoverEligibility(
        existingAttempt.testId, effectiveAttemptData
    );

    const updatedAttempt = await EvaluationTestAttempt.update(id, {
        attemptData,
        traineeName,
        employeeNo,
        educatorName,
        createdBy,
        isHandoverEligible,
        passedDate
    });

    const auditMeta = { resourceType: "EvaluationTestAttempt", resourceId: id, req };
    const auditDetails = {
        traineeName: updatedAttempt.traineeName,
        employeeNo: updatedAttempt.employeeNo,
        attemptId: id,
    };

    const prevApprovedStatus = existingAttempt.attemptData?._approvedStatus;
    const nextApprovedStatus = effectiveAttemptData?._approvedStatus;
    if (nextApprovedStatus && nextApprovedStatus !== prevApprovedStatus) {
        const action = nextApprovedStatus === "APPROVED" ? "APPROVE_EVALUATION_TEST_ATTEMPT" : "REJECT_EVALUATION_TEST_ATTEMPT";
        logAudit(req.user?.id, action, { ...auditDetails, status: nextApprovedStatus }, auditMeta).catch(err =>
            console.error(`logAudit(${action}) failed:`, err.message)
        );
    }

    const prevConfirmedStatus = existingAttempt.attemptData?._confirmedStatus;
    const nextConfirmedStatus = effectiveAttemptData?._confirmedStatus;
    if (nextConfirmedStatus && nextConfirmedStatus !== prevConfirmedStatus) {
        const action = nextConfirmedStatus === "APPROVED" ? "CONFIRM_EVALUATION_TEST_ATTEMPT" : "REJECT_CONFIRM_EVALUATION_TEST_ATTEMPT";
        logAudit(req.user?.id, action, { ...auditDetails, status: nextConfirmedStatus }, auditMeta).catch(err =>
            console.error(`logAudit(${action}) failed:`, err.message)
        );
    }

    if (nextApprovedStatus === prevApprovedStatus && nextConfirmedStatus === prevConfirmedStatus) {
        logAudit(req.user?.id, "UPDATE_EVALUATION_TEST_ATTEMPT", auditDetails, auditMeta).catch(err =>
            console.error("logAudit(UPDATE_EVALUATION_TEST_ATTEMPT) failed:", err.message)
        );
    }

    if (triggerEmail) {
        try {
            const NotificationService = (await import("../services/notification.service.js")).default;
            await NotificationService.sendFormReport(
                "Dojo Evaluation Sheet",
                updatedAttempt.studentDeptId,
                updatedAttempt,
                updatedAttempt.userId,
                updatedAttempt.studentSectionId
            );
        } catch (e) {
            console.error("[EvaluationTestAttempt] Failed to trigger email notification:", e);
        }
    }

    res.json(
        new ApiResponse(200, updatedAttempt, "Evaluation test sheet record updated successfully")
    );
});

export const deleteEvaluationTestAttempt = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existingAttempt = await EvaluationTestAttempt.findById(id);
    if (!existingAttempt) {
        throw new ApiError("Evaluation test sheet record not found", 404);
    }

    await EvaluationTestAttempt.delete(id);

    logAudit(req.user?.id, "DELETE_EVALUATION_TEST_ATTEMPT", {
        traineeName: existingAttempt.traineeName,
        employeeNo: existingAttempt.employeeNo,
        attemptId: id,
    }, { resourceType: "EvaluationTestAttempt", resourceId: id, req }).catch(err =>
        console.error("logAudit(DELETE_EVALUATION_TEST_ATTEMPT) failed:", err.message)
    );

    res.json(
        new ApiResponse(200, null, "Evaluation test sheet record deleted successfully")
    );
});

export const getStudentEvaluationTestAttempts = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    if (!studentId) throw new ApiError("Student ID is required", 400);

    const attempts = await EvaluationTestAttempt.findByStudentId(studentId);
    res.json(new ApiResponse(200, attempts, "Student evaluation attempts fetched successfully"));
});
