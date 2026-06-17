import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import EvaluationTest from "../models/evaluationTest.model.js";
import EvaluationTestAttempt from "../models/evaluationTestAttempt.model.js";

export const createEvaluationTest = asyncHandler(async (req, res) => {
    const { title, performDateCount, processType, contentStructure } = req.body;
    const createdBy = req.user?.fullName || req.user?.userName || "Admin";

    if (!title) {
        throw new ApiError("Title of the evaluation test is required", 400);
    }

    const testData = {
        title,
        performDateCount: parseInt(performDateCount, 10) || 4,
        processType: processType || 'Former process',
        contentStructure: contentStructure || [],
        createdBy
    };

    const evaluationTest = await EvaluationTest.create(testData);

    res.status(201).json(
        new ApiResponse(201, evaluationTest, "Evaluation test created successfully")
    );
});

export const getAllEvaluationTests = asyncHandler(async (req, res) => {
    const tests = await EvaluationTest.findAll();
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
    const { title, performDateCount, processType, contentStructure } = req.body;

    const existingTest = await EvaluationTest.findById(id);
    if (!existingTest) {
        throw new ApiError("Evaluation test not found", 404);
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (performDateCount !== undefined) updateData.performDateCount = parseInt(performDateCount, 10);
    if (processType !== undefined) updateData.processType = processType;
    if (contentStructure !== undefined) updateData.contentStructure = contentStructure;

    const updatedTest = await EvaluationTest.update(id, updateData);

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

    res.json(
        new ApiResponse(200, null, "Evaluation test deleted successfully")
    );
});

// Student Evaluation Attempt APIs
export const createEvaluationTestAttempt = asyncHandler(async (req, res) => {
    const { testId, traineeName, employeeNo, educatorName, attemptData, createdBy: reqCreatedBy } = req.body;
    const createdBy = reqCreatedBy || req.user?.fullName || req.user?.userName || "Admin";

    if (!testId) {
        throw new ApiError("Test ID is required for registering an attempt", 400);
    }

    const newAttempt = await EvaluationTestAttempt.create({
        testId: parseInt(testId, 10),
        traineeName,
        employeeNo,
        educatorName,
        attemptData,
        createdBy
    });

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
    const { attemptData, traineeName, employeeNo, educatorName, createdBy } = req.body;

    const existingAttempt = await EvaluationTestAttempt.findById(id);
    if (!existingAttempt) {
        throw new ApiError("Evaluation test sheet record not found", 404);
    }

    const updatedAttempt = await EvaluationTestAttempt.update(id, {
        attemptData,
        traineeName,
        employeeNo,
        educatorName,
        createdBy
    });

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
