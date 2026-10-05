import { Router } from "express";
import {
    createComparison,
    getAllComparisons,
    getComparisonById,
    updateComparison,
    deleteComparison,
    downloadFile,
    getGroups
} from "../controllers/learningComparison.controller.js";
import upload from "../middlewares/multer.middleware.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

// Protect all routes
router.use(verifyJWT);

const uploadFields = [
    { name: "beforeVideo", maxCount: 10 },
    { name: "beforePdf", maxCount: 10 },
    { name: "beforeExcel", maxCount: 10 },
    { name: "beforeWord", maxCount: 10 },
    { name: "beforePpt", maxCount: 10 },
    { name: "beforeImage", maxCount: 10 },
    { name: "afterVideo", maxCount: 10 },
    { name: "afterPdf", maxCount: 10 },
    { name: "afterExcel", maxCount: 10 },
    { name: "afterWord", maxCount: 10 },
    { name: "afterPpt", maxCount: 10 },
    { name: "afterImage", maxCount: 10 }
];

router.post("/", upload.fields(uploadFields), createComparison);
router.get("/", getAllComparisons);
router.get("/groups", getGroups);
router.get("/download", downloadFile);
router.get("/:id", getComparisonById);
router.put("/:id", upload.fields(uploadFields), updateComparison);
router.delete("/:id", deleteComparison);

export default router;
