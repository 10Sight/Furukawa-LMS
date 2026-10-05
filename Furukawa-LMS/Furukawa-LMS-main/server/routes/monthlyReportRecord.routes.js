import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import monthlyReportUpload from "../middleware/monthlyReportUpload.js";
import { getRecordsForFolder, getRecordDetail, createRecord, deleteRecord } from "../controllers/monthlyReportRecord.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/folder/:folderId", authorizeRoles("monthly_report:read", "isAdmin", "SUPERADMIN"), getRecordsForFolder);
router.get("/:id", authorizeRoles("monthly_report:read", "isAdmin", "SUPERADMIN"), getRecordDetail);

// Permission check runs before multer parses the upload, so an unauthorized
// request never spends time/disk writing the file to a temp directory.
router.post("/", authorizeRoles("monthly_report:create", "isAdmin", "SUPERADMIN"), monthlyReportUpload.single("file"), createRecord);
router.delete("/:id", authorizeRoles("monthly_report:delete", "isAdmin", "SUPERADMIN"), deleteRecord);

export default router;
