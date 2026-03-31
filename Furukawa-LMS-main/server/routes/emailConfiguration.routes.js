import { Router } from "express";
import {
    getAllConfigurations,
    getConfigurationById,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration
} from "../controllers/emailConfiguration.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

// All email config routes require authentication and admin access
router.use(verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"));

router.route("/")
    .get(getAllConfigurations)
    .post(createConfiguration);

router.route("/:id")
    .get(getConfigurationById)
    .put(updateConfiguration)
    .delete(deleteConfiguration);

export default router;
