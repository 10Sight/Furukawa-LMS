import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole, authorizeAnyPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
import { getAllRecords, getHistoryLogs, getRecordBySheetKey, getPropagationPreview, updateRecord, upsertRecordForScope } from "../controllers/revisionRecord.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/", authorizeRole([SYSTEM_PERMISSIONS.REVISION_READ]), getAllRecords);
// Not permission-gated beyond login: it only returns a row count, and the 10-Cycle /
// 16-Day layout editors (gated by their own edit_layout permissions, not revision:*)
// need it for their save confirmation.
router.get("/propagation-preview", getPropagationPreview);
router.get("/history",authorizeAnyPermission([SYSTEM_PERMISSIONS.REVISION_READ, SYSTEM_PERMISSIONS.DEPT_REVISION_LOGS_READ]), getHistoryLogs);
// Intentionally not permission-gated: consumed by useRevisionInfo on student/operator-facing forms (Daily 5M, 16-Day Monitoring, OJT, etc.)
router.get("/sheet/:sheetKey", getRecordBySheetKey);
router.put("/sheet/:sheetKey", authorizeAnyPermission([SYSTEM_PERMISSIONS.REVISION_CREATE, SYSTEM_PERMISSIONS.REVISION_UPDATE]), upsertRecordForScope);
router.put("/:id", authorizeRole([SYSTEM_PERMISSIONS.REVISION_UPDATE]), updateRecord);

export default router;
