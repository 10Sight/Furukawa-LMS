import { Router } from "express";
import {
    applyLeftRequest,
    bulkApplyLeftRequest,
    getAllLeftRequests,
    getPendingLeftRequestCount,
    getLeftRequestById,
    approveLeftRequest,
    rejectLeftRequest,
    bulkApproveLeftRequests,
    bulkRejectLeftRequests,
    cancelLeftRequest,
} from "../controllers/leftRequest.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.get("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:apply_left", "user:approve_left"), getAllLeftRequests);
router.get("/pending-count", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:apply_left", "user:approve_left"), getPendingLeftRequestCount);
router.get("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:apply_left", "user:approve_left"), getLeftRequestById);

router.post("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:apply_left"), applyLeftRequest);
router.post("/bulk", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:apply_left"), bulkApplyLeftRequest);

router.patch("/bulk-approve", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:approve_left"), bulkApproveLeftRequests);
router.patch("/bulk-reject", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:approve_left"), bulkRejectLeftRequests);

router.patch("/:id/approve", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:approve_left"), approveLeftRequest);
router.patch("/:id/reject", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:approve_left"), rejectLeftRequest);
router.delete("/:id/cancel", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "user:apply_left", "user:approve_left"), cancelLeftRequest);

export default router;
