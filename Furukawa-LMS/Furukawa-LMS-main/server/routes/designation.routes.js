import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
import {
  getUniqueDesignations,
  getDesignationsWithCounts,
  shutterDesignation,
  unshutterDesignation,
} from "../controllers/designation.controller.js";

const router = Router();

router.get("/unique", verifyJWT, getUniqueDesignations);
router.get("/counts", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getDesignationsWithCounts);
router.post("/shutter", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_UPDATE]), shutterDesignation);
router.post("/unshutter", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_UPDATE]), unshutterDesignation);

export default router;
