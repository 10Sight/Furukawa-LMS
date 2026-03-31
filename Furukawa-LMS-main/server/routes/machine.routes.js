import { Router } from "express";
import {
    createMachine,
    getMachinesBySubSection,
    getMachinesByLine,
    updateMachine,
    deleteMachine,
    assignEmployee,
    removeEmployee,
    getMachineEmployees,
    getMachineById
} from "../controllers/machine.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.use(verifyJWT);

router.post("/", authorizeRoles("isAdmin", "SUPERADMIN"), createMachine);
router.get("/sub-section/:subSectionId", getMachinesBySubSection);
router.get("/line/:lineId", getMachinesByLine);
router.get("/:id", getMachineById); // Add this line
router.put("/:id", authorizeRoles("isAdmin", "SUPERADMIN"), updateMachine);
router.delete("/:id", authorizeRoles("isAdmin", "SUPERADMIN"), deleteMachine);

// User assignment routes
router.post("/:id/employees", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), assignEmployee);
router.delete("/:id/employees/:userId", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), removeEmployee);
router.get("/:id/employees", getMachineEmployees);

export default router;
