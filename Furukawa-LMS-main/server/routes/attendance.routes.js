import express from "express";
import { uploadAttendance, getAttendance, getFilters, getMissingAttendance, getUnmappedPresent } from "../controllers/attendance.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
import multer from "multer";

const router = express.Router();
const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage: storage });

router.post("/upload", uploadMiddleware.single("file"), uploadAttendance);
router.get("/", getAttendance);
router.get("/filters", getFilters);
router.get("/missing", getMissingAttendance);
router.get("/unmapped-present", getUnmappedPresent);

export default router;