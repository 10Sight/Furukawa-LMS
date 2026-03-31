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
    deleteRequirement
} from "../controllers/requirement.controller.js";

const router = Router();
// Limit upload size to 5MB? Using memory storage or file storage? 
// Controller expects req.file.buffer (for ExcelJS loaded from buffer), so use memoryStorage.
const upload = multer({ storage: multer.memoryStorage() });

// Create manually
router.post("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("setrequirement"), createRequirement);

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
router.get("/filters", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getRequirementFilters);

// Get Logs
router.get("/logs", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getRequirementLogs);
router.get("/logs/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getRequirementLogs);

// Get All (Filterable)
router.get("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getRequirements);

// Get One
router.get("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getRequirementById);

// Update One
router.patch("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("setrequirement"), updateRequirement);
// Batch Update (metadata like supervisor/mentor/line)
router.put("/batch-update", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("setrequirement"), batchUpdateRequirements);

// Delete One
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("setrequirement"), deleteRequirement);

export default router;
