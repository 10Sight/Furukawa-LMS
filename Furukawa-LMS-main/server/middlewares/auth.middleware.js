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