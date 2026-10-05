import { Router } from "express";
import {
    issueCertificate,
    getCertificateById,
    getStudentCertificates,
    getCourseCertificates,
    revokeCertificate,
    checkCertificateEligibility,
    issueCertificateWithTemplate,
    generateCertificatePreview
} from "../controllers/certificate.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

// Existing routes
router.post("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "isTrainer"), issueCertificate);
router.get("/student", verifyJWT, authorizeRoles("isEmployee"), getStudentCertificates);
router.get("/course/:courseId", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "isTrainer"), getCourseCertificates);
router.get("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "isTrainer", "isEmployee"), getCertificateById);
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "isTrainer"), revokeCertificate);

// Certificate workflow routes (SuperAdmin, Admin, and Instructor access)
router.get("/check-eligibility/:studentId/:courseId", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer", "isEmployee"), checkCertificateEligibility);
router.post("/issue-with-template", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer", "isEmployee"), issueCertificateWithTemplate);
router.post("/preview", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin", "isTrainer"), generateCertificatePreview);

export default router;
