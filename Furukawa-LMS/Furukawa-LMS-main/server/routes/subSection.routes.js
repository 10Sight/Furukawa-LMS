import express from "express";
import {
    createSubSection,
    getSubSectionsByLine,
    updateSubSection,
    deleteSubSection,
    getAllSubSections,
    getSubSectionById
} from "../controllers/subSection.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = express.Router();

router.use(verifyJWT);

router.get("/", getAllSubSections);
router.post("/", authorizeRoles("isAdmin", "SUPERADMIN"), createSubSection);
router.get("/line/:lineId", getSubSectionsByLine);
router.get("/:id", getSubSectionById);
router.put("/:id", authorizeRoles("isAdmin", "SUPERADMIN"), updateSubSection);
router.delete("/:id", authorizeRoles("isAdmin", "SUPERADMIN"), deleteSubSection);

export default router;
