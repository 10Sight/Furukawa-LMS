import { Router } from "express";
import { 
    createComparison, 
    getAllComparisons, 
    getComparisonById,
    updateComparison,
    deleteComparison 
} from "../controllers/learningComparison.controller.js";
import upload from "../middlewares/multer.middleware.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

// Protect all routes
router.use(verifyJWT);

const uploadFields = [
    { name: "beforeVideo", maxCount: 1 },
    { name: "beforePdf", maxCount: 1 },
    { name: "beforeExcel", maxCount: 1 },
    { name: "beforeWord", maxCount: 1 },
    { name: "beforePpt", maxCount: 1 },
    { name: "beforeImage", maxCount: 1 },
    { name: "afterVideo", maxCount: 1 },
    { name: "afterPdf", maxCount: 1 },
    { name: "afterExcel", maxCount: 1 },
    { name: "afterWord", maxCount: 1 },
    { name: "afterPpt", maxCount: 1 },
    { name: "afterImage", maxCount: 1 }
];

router.post("/", upload.fields(uploadFields), createComparison);
router.get("/", getAllComparisons);
router.get("/:id", getComparisonById);
router.put("/:id", upload.fields(uploadFields), updateComparison);
router.delete("/:id", deleteComparison);

export default router;
