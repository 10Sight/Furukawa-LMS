import { Router } from "express";
import upload from "../middlewares/multer.middleware.js";
import { uploadSingleFile, uploadMultipleFiles } from "../controllers/upload.controller.js";

const router = Router();

router.post("/single", upload.single("file"), uploadSingleFile);
router.post("/multiple", upload.array("files", 5), uploadMultipleFiles); // up to 5 files

export default router;
