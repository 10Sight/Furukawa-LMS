import { Router } from "express";
import {
    bulkEnrollUsers,
    bulkSendEmails,
    bulkGenerateCertificates,
    getBulkOperationHistory
} from "../controllers/bulkOperations.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

// All bulk operations require authentication and at least instructor role
router.use(verifyJWT);

// === BULK USER ENROLLMENT ===

// Bulk enroll users (Admin/SuperAdmin only)
router.post("/enroll",
    authorizeRoles("isAdmin", "SUPERADMIN"),
    bulkEnrollUsers
);

// === BULK EMAIL OPERATIONS ===

// Send bulk emails (Admin/SuperAdmin only)
router.post("/email",
    authorizeRoles("isAdmin", "SUPERADMIN"),
    bulkSendEmails
);

// === BULK CERTIFICATE GENERATION ===

// Generate certificates in bulk (Admin/SuperAdmin only)
router.post("/certificates",
    authorizeRoles("isAdmin", "SUPERADMIN"),
    bulkGenerateCertificates
);

// === BULK OPERATION HISTORY ===

// Get bulk operation history (Admin/SuperAdmin only)
router.get("/history",
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getBulkOperationHistory
);

export default router;
