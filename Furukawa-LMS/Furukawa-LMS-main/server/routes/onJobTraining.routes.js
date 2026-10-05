import express from "express";
import {
    createOnJobTraining,
    getStudentOnJobTrainings,
    getOnJobTrainingById,
    getOnJobTrainingByShareToken,
    getServerLanIp,
    updateOnJobTraining,
    getAllOnJobTrainings,
    deleteOnJobTraining
} from "../controllers/onJobTraining.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = express.Router();

// Routes
router.post("/create", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer", "on_job_training:create"), createOnJobTraining);
router.get("/student/:studentId", verifyJWT, getStudentOnJobTrainings);
router.get("/lan-ip", verifyJWT, getServerLanIp);
// Public read-only share link (no auth) - looked up by unguessable shareToken, never by numeric id
router.get("/public/:token", getOnJobTrainingByShareToken);
router.get("/", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer", "on_job_training:read"), getAllOnJobTrainings);
router.get("/:id", verifyJWT, getOnJobTrainingById);
router.patch("/:id", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer", "on_job_training:update", "on_job_training:checked_by", "on_job_training:approved_by"), updateOnJobTraining);
router.delete("/:id", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer", "on_job_training:delete"), deleteOnJobTraining);

export default router;
