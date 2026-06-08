import { Router } from "express";
import {
    getAllSectionHeads,
    getSectionHeadById,
    createSectionHead,
    updateSectionHead,
    deleteSectionHead
} from "../controllers/sectionHead.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/")
    .get(getAllSectionHeads)
    .post(authorizeRole([SYSTEM_PERMISSIONS.MPS_REQUIREMENT_ADD_EMAILS]), createSectionHead);

router.route("/:id")
    .get(getSectionHeadById)
    .put(authorizeRole([SYSTEM_PERMISSIONS.MPS_REQUIREMENT_ADD_EMAILS]), updateSectionHead)
    .delete(authorizeRole([SYSTEM_PERMISSIONS.MPS_REQUIREMENT_ADD_EMAILS]), deleteSectionHead);

export default router;
