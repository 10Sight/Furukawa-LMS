import { Router } from "express";
import {
    createSection,
    getSectionsByDepartment,
    updateSection,
    deleteSection,
    getAllSections
} from "../controllers/section.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

// Apply auth middleware to all routes
router.use(verifyJWT);

router.route("/")
    .get(authorizeRole([SYSTEM_PERMISSIONS.SECTION_READ]), getAllSections)
    .post(authorizeRole([SYSTEM_PERMISSIONS.SECTION_CREATE]), createSection);

router.route("/department/:departmentId")
    .get(authorizeRole([SYSTEM_PERMISSIONS.SECTION_READ]), getSectionsByDepartment);

router.route("/:id")
    .put(authorizeRole([SYSTEM_PERMISSIONS.SECTION_UPDATE]), updateSection)
    .delete(authorizeRole([SYSTEM_PERMISSIONS.SECTION_DELETE]), deleteSection);

export default router;
