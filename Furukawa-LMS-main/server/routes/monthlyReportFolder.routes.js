import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getFoldersForSection, createFolder, deleteFolder } from "../controllers/monthlyReportFolder.controller.js";

const router = Router();

router.use(verifyJWT);

// Read access is permission-only (no department/section lock) — any user
// holding monthly_report:read can view folders across every department/section.
router.get("/section/:sectionId", authorizeRoles("monthly_report:read", "isAdmin", "SUPERADMIN"), getFoldersForSection);

// Write actions additionally require the user be assigned to the target
// department/section (enforced in the controller via canModifyMonthlyReportSection),
// unless they're an admin/superadmin.
router.post("/", authorizeRoles("monthly_report:create", "isAdmin", "SUPERADMIN"), createFolder);
router.delete("/:id", authorizeRoles("monthly_report:delete", "isAdmin", "SUPERADMIN"), deleteFolder);

export default router;
