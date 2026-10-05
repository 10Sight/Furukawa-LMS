import { Router } from "express";
import { getAllPrivileges } from "../controllers/privilege.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

// Publicly authenticated route (any logged-in user needs this to check their own perms)
router.use(verifyJWT);

router.get("/", getAllPrivileges);

export default router;
