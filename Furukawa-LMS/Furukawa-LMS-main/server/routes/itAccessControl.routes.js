import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getRegister, saveRegister, getRowHistory } from "../controllers/itAccessControl.controller.js";

// IT Access Control Register: it_access_control:read for every GET, it_access_control:update
// for saving. No other MIS Portal permission grants anything here.
const router = Router();

router.use(verifyJWT);

const canRead = authorizeRoles("it_access_control:read", "isAdmin", "SUPERADMIN");
const canWrite = authorizeRoles("it_access_control:update", "isAdmin", "SUPERADMIN");

router.get("/", canRead, getRegister);
router.put("/", canWrite, saveRegister);
router.get("/history/:userId", canRead, getRowHistory);

export default router;
