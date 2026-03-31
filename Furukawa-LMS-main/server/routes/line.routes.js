import express from "express";
import {
    createLine,
    getLinesByDepartment,
    getLinesBySection,
    updateLine,
    deleteLine,
    getAllLines
} from "../controllers/line.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = express.Router();

router.use(verifyJWT);

router.get("/", getAllLines); // New route for fetching all lines with optional filtering
router.post("/", authorizeRoles("isAdmin", "SUPERADMIN"), createLine);
router.get("/department/:departmentId", getLinesByDepartment);
router.get("/section/:sectionId", getLinesBySection);
router.put("/:id", authorizeRoles("isAdmin", "SUPERADMIN"), updateLine);
router.delete("/:id", authorizeRoles("isAdmin", "SUPERADMIN"), deleteLine);

export default router;
