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

router.get("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAllContractors);
router.post("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), createContractor);
router.get("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getContractorById);
router.patch("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), updateContractor);
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), deleteContractor);

export default router;
