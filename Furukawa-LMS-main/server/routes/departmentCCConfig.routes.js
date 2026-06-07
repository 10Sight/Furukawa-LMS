import { Router } from "express";
import {
    getAllDepartmentCCConfigs,
    getDepartmentCCConfigById,
    createDepartmentCCConfig,
    updateDepartmentCCConfig,
    deleteDepartmentCCConfig
} from "../controllers/departmentCCConfig.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.route("/")
    .get(getAllDepartmentCCConfigs)
    .post(createDepartmentCCConfig);

router.route("/:id")
    .get(getDepartmentCCConfigById)
    .put(updateDepartmentCCConfig)
    .delete(deleteDepartmentCCConfig);

export default router;
