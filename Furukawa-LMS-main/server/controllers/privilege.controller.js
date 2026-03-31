import Privilege from "../models/privilege.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const getAllPrivileges = asyncHandler(async (req, res) => {
    const privileges = await Privilege.findAll();
    return res.status(200).json(
        new ApiResponse(200, privileges, "Privileges fetched successfully")
    );
});
