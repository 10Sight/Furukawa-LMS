import express from "express";
import {
    createOnJobTraining,
    getStudentOnJobTrainings,
    getOnJobTrainingById,
    updateOnJobTraining
} from "../controllers/onJobTraining.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = express.Router();

// Routes
router.post("/create", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer"), createOnJobTraining);
router.get("/student/:studentId", verifyJWT, getStudentOnJobTrainings);
router.get("/:id", verifyJWT, getOnJobTrainingById);
router.patch("/:id", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer"), updateOnJobTraining);

export default router;
