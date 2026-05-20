import { Router } from "express";
import multer from "multer";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { checkPrivilege } from "../middlewares/checkPrivilege.middleware.js";
import {
    addRequirements,
    createRequirement,
    getRequirements,
    getRequirementFilters,
    getRequirementById,
    getRequirementLogs,
    updateRequirement,
    batchUpdateRequirements,
    deleteRequirement,
    approveBatchRequirements,
} from "../controllers/requirement.controller.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

// Public approval links from email
router.get("/approve-batch", approveBatchRequirements);

// IMPORTANT: edit requirement approve/reject link
// Example: /api/requirements/123?token=xxx&action=approve
router.get("/:id", (req, res, next) => {
    if (req.query.token && req.query.action) {
        return updateRequirement(req, res, next);
    }
    return next();
});

// Create manually
router.post(
    "/",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    checkPrivilege("setrequirement"),
    createRequirement
);

// Upload Requirements Excel
router.post(
    "/upload",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    checkPrivilege("setrequirement"),
    upload.single("file"),
    addRequirements
);

// Get Filters
router.get(
    "/filters",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getRequirementFilters
);

// Get Logs
router.get(
    "/logs",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getRequirementLogs
);

router.get(
    "/logs/:id",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getRequirementLogs
);

// Batch Update
router.put(
    "/batch-update",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    checkPrivilege("setrequirement"),
    batchUpdateRequirements
);

// Get All
router.get(
    "/",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getRequirements
);

// Get One
router.get(
    "/:id",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getRequirementById
);

// Update One
router.patch(
    "/:id",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    checkPrivilege("setrequirement"),
    updateRequirement
);

// Delete One
router.delete(
    "/:id",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    checkPrivilege("setrequirement"),
    deleteRequirement
);

export default router;