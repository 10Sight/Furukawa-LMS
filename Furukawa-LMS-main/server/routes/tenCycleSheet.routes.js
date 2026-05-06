import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    createTenCycleSheet,
    getTenCycleSheetById,
    listTenCycleSheets,
    updateTenCycleSheetById,
    approveTenCycleSheet
} from "../controllers/tenCycleSheet.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), listTenCycleSheets);
router.post("/", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), createTenCycleSheet);
router.get("/:id", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), getTenCycleSheetById);
router.put("/:id", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), updateTenCycleSheetById);
router.patch("/:id/approve", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), approveTenCycleSheet);

export default router;
