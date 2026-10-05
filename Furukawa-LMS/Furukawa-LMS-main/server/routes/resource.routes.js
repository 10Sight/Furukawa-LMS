import express from "express";
import { 
    createResource, 
    getResourcesByModule,
    getResourcesByCourse,
    getResourcesByLesson,
    deleteResource, 
    updateResource,
    getResourceById
} from "../controllers/resource.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Apply JWT verification to all routes
router.use(verifyJWT);

// Get resources by different scopes with permission-based authorization
router.get("/course/:courseId", authorizeRole([SYSTEM_PERMISSIONS.RESOURCE_READ]), getResourcesByCourse);
router.get("/module/:moduleId", authorizeRole([SYSTEM_PERMISSIONS.RESOURCE_READ]), getResourcesByModule);
router.get("/lesson/:lessonId", authorizeRole([SYSTEM_PERMISSIONS.RESOURCE_READ]), getResourcesByLesson);
router.get("/:resourceId", authorizeRole([SYSTEM_PERMISSIONS.RESOURCE_READ]), getResourceById);

// Create resource with file upload (supports course, module, and lesson scopes)
router.post("/", upload.single('file'), authorizeRole([SYSTEM_PERMISSIONS.RESOURCE_CREATE]), createResource);

// Update resource with file upload
router.put("/:resourceId", upload.single('file'), authorizeRole([SYSTEM_PERMISSIONS.RESOURCE_UPDATE]), updateResource);

// Delete resource
router.delete("/:resourceId", authorizeRole([SYSTEM_PERMISSIONS.RESOURCE_DELETE]), deleteResource);

export default router;
