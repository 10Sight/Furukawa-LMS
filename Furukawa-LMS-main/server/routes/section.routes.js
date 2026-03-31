import { Router } from "express";
import {
    createSection,
    getSectionsByDepartment,
    updateSection,
    deleteSection
} from "../controllers/section.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware to all routes
router.use(verifyJWT);

router.route("/")
    .post(createSection);

router.route("/department/:departmentId")
    .get(getSectionsByDepartment);

router.route("/:id")
    .put(updateSection)
    .delete(deleteSection);

export default router;
