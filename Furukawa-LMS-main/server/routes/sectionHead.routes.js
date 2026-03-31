import { Router } from "express";
import {
    getAllSectionHeads,
    getSectionHeadById,
    createSectionHead,
    updateSectionHead,
    deleteSectionHead
} from "../controllers/sectionHead.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.route("/")
    .get(getAllSectionHeads)
    .post(createSectionHead);

router.route("/:id")
    .get(getSectionHeadById)
    .put(updateSectionHead)
    .delete(deleteSectionHead);

export default router;
