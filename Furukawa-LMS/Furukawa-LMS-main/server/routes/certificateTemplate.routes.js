import { Router } from "express";
import {
    createCertificateTemplate,
    getCertificateTemplates,
    getCertificateTemplateById,
    getDefaultCertificateTemplate,
    updateCertificateTemplate,
    deleteCertificateTemplate,
    setDefaultCertificateTemplate,
} from "../controllers/certificateTemplate.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

// Admin only routes
router.post("/", verifyJWT, authorizeRoles("isAdmin"), createCertificateTemplate);
router.get("/", verifyJWT, authorizeRoles("isAdmin"), getCertificateTemplates);
router.get("/default", verifyJWT, authorizeRoles("isAdmin", "isTrainer"), getDefaultCertificateTemplate);
router.get("/:id", verifyJWT, authorizeRoles("isAdmin"), getCertificateTemplateById);
router.put("/:id", verifyJWT, authorizeRoles("isAdmin"), updateCertificateTemplate);
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin"), deleteCertificateTemplate);
router.patch("/:id/set-default", verifyJWT, authorizeRoles("isAdmin"), setDefaultCertificateTemplate);

export default router;
