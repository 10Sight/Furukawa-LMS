import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getAllRecords, getHistoryLogs, getRecordBySheetKey, updateRecord, upsertRecordForScope } from "../controllers/revisionRecord.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/", getAllRecords);
router.get("/history", getHistoryLogs);
router.get("/sheet/:sheetKey", getRecordBySheetKey);
router.put("/sheet/:sheetKey", authorizeRoles("ADMIN", "SUPERADMIN"), upsertRecordForScope);
router.put("/:id", authorizeRoles("ADMIN", "SUPERADMIN"), updateRecord);

export default router;
