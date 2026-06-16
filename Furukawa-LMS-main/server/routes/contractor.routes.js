import { Router } from "express";
import {
    createContractor,
    getAllContractors,
    getContractorById,
    updateContractor,
    deleteContractor,
} from "../controllers/contractor.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.get("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "contractor:read"), getAllContractors);
router.post("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "contractor:create"), createContractor);
router.get("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "contractor:read"), getContractorById);
router.patch("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "contractor:update"), updateContractor);
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "contractor:delete"), deleteContractor);

export default router;
