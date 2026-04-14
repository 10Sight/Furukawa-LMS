import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { get5MConfig, save5MConfig, getConfigHistory, getAllConfigHistory, send5MPDF } from "../controllers/daily5M.controller.js";
import { create5MRecord, get5MRecords, get5MRecordById, delete5MRecord, get5MRecordByDate, submit5MRecord } from "../controllers/daily5MRecord.controller.js";
import { getAssignments, addAssignment, removeAssignment } from "../controllers/daily5MAssignment.controller.js";

const router = Router();

// PDF & Email Routes
router.post("/pdf/send", verifyJWT, send5MPDF);

// Config Routes
router.get("/config/:departmentId", verifyJWT, get5MConfig); // Changed path to disambiguate
router.post("/config/save", verifyJWT, authorizeRoles("ADMIN", "SUPERADMIN"), save5MConfig);
router.get("/history/all", verifyJWT, authorizeRoles("ADMIN", "SUPERADMIN"), getAllConfigHistory);
router.get("/history/:departmentId", verifyJWT, authorizeRoles("ADMIN", "SUPERADMIN"), getConfigHistory);

// Assignment Routes
router.get("/assignments/:departmentId", verifyJWT, getAssignments);
router.post("/assignments/add", verifyJWT, authorizeRoles("ADMIN", "SUPERADMIN"), addAssignment);
router.delete("/assignments/:id", verifyJWT, authorizeRoles("ADMIN", "SUPERADMIN"), removeAssignment);

// Record Routes
router.post("/record/create", verifyJWT, create5MRecord);
router.post("/record/:id/submit", verifyJWT, submit5MRecord);
router.get("/record/date", verifyJWT, get5MRecordByDate);
router.get("/records/:departmentId", verifyJWT, get5MRecords);
router.get("/record/:id", verifyJWT, get5MRecordById);
router.delete("/record/:id", verifyJWT, authorizeRoles("ADMIN", "SUPERADMIN"), delete5MRecord);

// Legacy/Compatibility: The previous fetchConfig was "GET /:departmentId". 
// To avoid breaking the existing frontend immediately, I'll keep the root GET for config, 
// OR I will update the Frontend to use "/config/:deptId". 
// Let's check Daily5MRecording.jsx. It calls `/api/daily-5m/${deptId}`.
// So I will keep the original route for now or handle the collision.
// Collision: GET /records/:deptId vs GET /:deptId. They are different.
// But GET /:deptId is ambiguous if I add GET /record/:id. 
// "record" is not an ID, so it is fine, but "records" is.
// Actually, I can just leave the original ones as is.

router.get("/:departmentId", verifyJWT, get5MConfig); // Original config fetch
router.post("/save", verifyJWT, authorizeRoles("ADMIN", "SUPERADMIN"), save5MConfig); // Original config save

export default router;
