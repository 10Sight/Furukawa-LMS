import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { createClub, getAllClubs, deleteClub, updateClub } from "../controllers/reportClub.controller.js";

const router = Router();

// Secure all routes in this prefix
router.use(verifyJWT);

// Create and List
router.route("/")
    .post(authorizeRoles("ADMIN", "SUPERADMIN"), createClub)
    .get(getAllClubs);

// Update and Delete
router.route("/:id")
    .patch(authorizeRoles("ADMIN", "SUPERADMIN"), updateClub)
    .delete(authorizeRoles("ADMIN", "SUPERADMIN"), deleteClub);

export default router;
