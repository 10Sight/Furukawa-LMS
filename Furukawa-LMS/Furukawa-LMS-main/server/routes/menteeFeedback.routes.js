import { Router } from "express";
import {
    getMenteeFeedback,
    saveMenteeFeedback,
    sendMenteeFeedbackEmail
} from "../controllers/menteeFeedback.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.get("/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "mentee_feedback:view", "mentee_feedback:manage"), getMenteeFeedback);
router.post("/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "mentee_feedback:manage"), saveMenteeFeedback);
router.post("/:studentId/email", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "mentee_feedback:manage"), sendMenteeFeedbackEmail);

export default router;
