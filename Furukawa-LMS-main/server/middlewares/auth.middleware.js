import jwt from "jsonwebtoken";
import User from "../models/auth.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ENV from "../configs/env.config.js";

const verifyJWT = asyncHandler(async (req, res, next) => {

    const token = req?.cookies?.accessToken || req?.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError("You are not logged in!", 401);
    }

    try {
        const decodedToken = jwt.verify(token, ENV.JWT_ACCESS_SECRET);

        if (decodedToken.exp * 1000 < Date.now()) {
            throw new ApiError("Access Token Expired!", 401);
        }

        const user = await User.findById(decodedToken?.id);

        if (!user) {
            throw new ApiError("Invalid Access Token!", 401);
        }

        // Attach customRole details to req.user for fine-grained permissions check in middlewares
        if (user.customRoleId) {
            try {
                const { executeQuery } = await import("../db/mssqlHelper.js");
                const [rows] = await executeQuery(
                    "SELECT id, name, description, color, allowedPages, permissions, targetLayout FROM custom_roles WHERE id = ?",
                    [user.customRoleId]
                );
                if (rows.length) {
                    user.customRole = {
                        ...rows[0],
                        allowedPages: typeof rows[0].allowedPages === "string"
                            ? JSON.parse(rows[0].allowedPages || "[]")
                            : (rows[0].allowedPages || []),
                        permissions: typeof rows[0].permissions === "string"
                            ? JSON.parse(rows[0].permissions || "[]")
                            : (rows[0].permissions || [])
                    };
                }
            } catch (e) {
                console.error("[AUTH_MIDDLEWARE] Failed to attach customRole:", e);
            }
        } else {
            // Fallback for default roles based on user type (Operator/Trainer) if they have no customRoleId set
            let defaultRoleName = "";
            if (user.isEmployee) defaultRoleName = "Operator";
            else if (user.isTrainer) defaultRoleName = "Trainer";

            if (defaultRoleName) {
                try {
                    const { executeQuery } = await import("../db/mssqlHelper.js");
                    const [rows] = await executeQuery(
                        "SELECT id, name, description, color, allowedPages, permissions, targetLayout FROM custom_roles WHERE name = ?",
                        [defaultRoleName]
                    );
                    if (rows.length) {
                        user.customRole = {
                            ...rows[0],
                            allowedPages: typeof rows[0].allowedPages === "string"
                                ? JSON.parse(rows[0].allowedPages || "[]")
                                : (rows[0].allowedPages || []),
                            permissions: typeof rows[0].permissions === "string"
                                ? JSON.parse(rows[0].permissions || "[]")
                                : (rows[0].permissions || [])
                        };
                    }
                } catch (e) {
                    console.error("[AUTH_MIDDLEWARE] Failed to attach fallback customRole:", e);
                }
            }
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ApiError("Access Token expired! Please login again.", 401);
        }
        throw new ApiError(error?.message || "Invalid Access Token!", 401);
    }
});

export default verifyJWT;