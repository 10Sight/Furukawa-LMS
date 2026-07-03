import express from "express";
import multer from "multer";
import verifyJWT from "../middlewares/auth.middleware.js";
import {
    importEmployees,
    downloadImportTemplate,
    importInstructors,
    downloadInstructorTemplate,
    getImportLogs,
    getImportLogDetails,
    importDojoUsers,
    downloadDojoImportTemplate,
    startImportEmployees,
    processEmployeesChunk,
    finalizeImportEmployees
} from "../controllers/import.controller.js";

const router = express.Router();

// Import Log routes
router.get("/employees/logs", verifyJWT, getImportLogs);
router.get("/employees/logs/:id", verifyJWT, getImportLogDetails);

// Configure multer for file upload (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only Excel files
        if (
            file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.mimetype === "application/vnd.ms-excel"
        ) {
            cb(null, true);
        } else {
            cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
        }
    },
});

// Import employees from Excel
router.post("/employees", verifyJWT, upload.single("file"), importEmployees);

// Chunked import employees (client-side parsed, streamed in chunks with live progress)
router.post("/employees/start", verifyJWT, startImportEmployees);
router.post("/employees/process-chunk", verifyJWT, processEmployeesChunk);
router.post("/employees/finalize", verifyJWT, finalizeImportEmployees);

// Download import template
router.get("/employees/template", verifyJWT, downloadImportTemplate);

// Import instructors
router.post("/instructors", verifyJWT, upload.single("file"), importInstructors);

// Download instructor template
router.get("/instructors/template", verifyJWT, downloadInstructorTemplate);

// Import DOJO candidates
router.post("/dojo-candidates", verifyJWT, upload.single("file"), importDojoUsers);

// Download DOJO import template
router.get("/dojo-candidates/template", verifyJWT, downloadDojoImportTemplate);

export default router;
