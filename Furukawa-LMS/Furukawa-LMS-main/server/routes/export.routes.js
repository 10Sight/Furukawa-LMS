import { Router } from 'express';
import verifyJWT from '../middlewares/auth.middleware.js';
import authorizeRoles from '../middlewares/authrization.middleware.js';
import { exportCourses, exportDepartments, exportStudents } from '../controllers/export.controller.js';

const router = Router();

router.use(verifyJWT);

// Courses and Departments: Admin or SuperAdmin
router.get('/courses', authorizeRoles('isAdmin', 'SUPERADMIN'), exportCourses);
router.get('/departments', authorizeRoles('isAdmin', 'SUPERADMIN'), exportDepartments);

// Students: Admin/SuperAdmin can export all; Instructor limited to own departments
router.get('/students', authorizeRoles('isAdmin', 'SUPERADMIN', 'isTrainer'), exportStudents);

export default router;
