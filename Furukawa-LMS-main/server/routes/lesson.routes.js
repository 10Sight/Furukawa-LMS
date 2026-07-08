import { Router } from "express";
import {
  createLesson,
  getLessonsByModule,
  getLessonById,
  updateLesson,
  deleteLesson,
  addSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
} from "../controllers/lesson.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

// NOTE: verifyJWT is applied per-route (not via router.use) because this router is mounted
// at the bare "/api" prefix in index.js. A router-wide router.use(verifyJWT) here would run
// for every "/api/*" request in the whole app (e.g. /api/on-job-training/...), not just lesson
// routes, since Express matches app.use(path, router) by prefix.

// Lesson CRUD operations with permission-based authorization
// Direct lesson fetch by ID (no module required)
router.get("/lessons/:lessonId", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_READ]), getLessonById);

// /api/modules/:moduleId/lessons
router.post("/modules/:moduleId/lessons", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_CREATE]), createLesson);
router.get("/modules/:moduleId/lessons", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_READ]), getLessonsByModule);

// /api/modules/:moduleId/lessons/:lessonId
router.get("/modules/:moduleId/lessons/:lessonId", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_READ]), getLessonById);
router.put("/modules/:moduleId/lessons/:lessonId", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_UPDATE]), updateLesson);
router.delete("/modules/:moduleId/lessons/:lessonId", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_DELETE]), deleteLesson);

// Slide-level routes
router.post("/modules/:moduleId/lessons/:lessonId/slides", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_UPDATE]), addSlide);
router.put("/modules/:moduleId/lessons/:lessonId/slides/:slideId", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_UPDATE]), updateSlide);
router.delete("/modules/:moduleId/lessons/:lessonId/slides/:slideId", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_UPDATE]), deleteSlide);
router.patch("/modules/:moduleId/lessons/:lessonId/slides/reorder", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.LESSON_UPDATE]), reorderSlides);

export default router;
