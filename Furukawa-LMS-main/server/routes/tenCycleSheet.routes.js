import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    createTenCycleSheet,
    getTenCycleSheetById,
    listTenCycleSheets,
    updateTenCycleSheetById,
    approveTenCycleSheet,
    deleteTenCycleSheet
} from "../controllers/tenCycleSheet.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "ten_cycle:read", "ten_cycle:manage"), listTenCycleSheets);
router.post("/", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "ten_cycle:create", "ten_cycle:manage"), createTenCycleSheet);
router.get("/:id", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "ten_cycle:read", "ten_cycle:manage"), getTenCycleSheetById);
router.put("/:id", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "ten_cycle:update", "ten_cycle:manage"), updateTenCycleSheetById);
router.patch("/:id/approve", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "ten_cycle:approve", "ten_cycle:manage"), approveTenCycleSheet);
router.delete("/:id", authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "ten_cycle:delete", "ten_cycle:manage"), deleteTenCycleSheet);

export default router;
