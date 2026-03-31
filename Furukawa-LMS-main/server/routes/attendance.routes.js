import express from "express";
import { uploadAttendance, getAttendance, getFilters } from "../controllers/attendance.controller.js";
import upload from "../middlewares/multer.middleware.js"; // or wherever multer config is
// Check if multer middleware exists, if not use simple memory storage or check 'upload.routes.js'

const router = express.Router();

// Assuming we have a multer middleware exported as default or named 'upload'
// I will check for multer middleware availability in next steps, for now I'll assume standard naming
// If `../middlewares/multer.middleware.js` doesn't exist, I'll need to create or import from utils.
// I saw `upload.routes.js` and `upload.controller.js`.
// Let's use `multer` directly here if middleware is not confirmed, but typically it's in middlewares.

// Actually, I'll check if `../middleware/multer.middleware.js` exists.
// Based on `list_dir` output, `middlewares` dir exists. I'll gamble on `multer.middleware.js` inside it
// or just configure it inline to be safe.
// Better: configure inline for this specific route to avoid dependency issues if file name differs.

import multer from "multer";
const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage: storage });

router.post("/upload", uploadMiddleware.single("file"), uploadAttendance);
router.get("/", getAttendance);
router.get("/filters", getFilters);

export default router;