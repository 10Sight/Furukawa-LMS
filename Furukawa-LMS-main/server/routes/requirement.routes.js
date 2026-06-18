import { Router } from "express";
import multer from "multer";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { checkPrivilege } from "../middlewares/checkPrivilege.middleware.js";
import { hasPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
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
    approveSingleRequirement,
    approveDashboardRequirements,
} from "../controllers/requirement.controller.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

// Custom middleware to support both role permissions and privilege fallback
const authorizeUpload = (req, res, next) => {
    if (req.user && (req.user.role === "SUPERADMIN" || req.user.isAdmin || hasPermission(req.user, SYSTEM_PERMISSIONS.MPS_REQUIREMENT_UPLOAD))) {
        return next();
    }
    return checkPrivilege("setrequirement")(req, res, next);
};

// Public approval links from email
router.route("/approve-batch").get(approveBatchRequirements).post(approveBatchRequirements);
router.route("/approve-single").get(approveSingleRequirement).post(approveSingleRequirement);

// Create manually
router.post(
    "/",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    checkPrivilege("setrequirement"),
    createRequirement
);

// Upload Requirements Excel
router.post(
    "/upload",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    authorizeUpload,
    upload.single("file"),
    addRequirements
);

// Get Filters
router.get(
    "/filters",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    getRequirementFilters
);

// Get Logs
router.get(
    "/logs",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    getRequirementLogs
);

router.post("/approve-dashboard", verifyJWT, approveDashboardRequirements);

router.get(
    "/logs/:id",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    getRequirementLogs
);

// Batch Update
router.put(
    "/batch-update",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    checkPrivilege("setrequirement"),
    batchUpdateRequirements
);

// Get All
router.get(
    "/",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    getRequirements
);

// Get One
router.get(
    "/:id",
    (req, res, next) => {
        const token = req.query.token || req.query["amp;token"];
        if (token) {
            req.query.id = req.params.id;
            return approveSingleRequirement(req, res, next);
        }
        return next();
    },
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    getRequirementById
);

// Update One
router.patch(
    "/:id",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    checkPrivilege("setrequirement"),
    updateRequirement
);

// Delete One
router.delete(
    "/:id",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN", "CUSTOM"),
    checkPrivilege("setrequirement"),
    deleteRequirement
);

export default router;