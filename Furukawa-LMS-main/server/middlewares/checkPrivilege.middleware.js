import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { executeQuery } from "../db/mssqlHelper.js";
import Privilege from "../models/privilege.model.js";

/**
 * Middleware to check if user has a specific privilege by Name
 * @param {string} requiredPrivilegeName - The name of the privilege to check (e.g., "setrequirement")
 */
export const checkPrivilege = (requiredPrivilegeName) => asyncHandler(async (req, res, next) => {
    // 1. Check if user is authenticated (should be used after verifyJWT)
    if (!req.user) {
        throw new ApiError("User not authenticated", 401);
    }

    // SUPERADMIN & ADMIN bypass
    if (req.user.role === 'SUPERADMIN' || req.user.isAdmin) {
        return next();
    }

    // Map legacy privileges to modern permissions if user has customRole permissions
    if (req.user.customRole?.permissions) {
        const permissions = req.user.customRole.permissions;
        
        if (requiredPrivilegeName === "user management") {
            const hasUserPermission = permissions.includes("user:create") ||
                                     permissions.includes("user:read") ||
                                     permissions.includes("user:update") ||
                                     permissions.includes("user:delete") ||
                                     permissions.includes("dojo_hiring:create") ||
                                     permissions.includes("dojo_hiring:read") ||
                                     permissions.includes("dojo_hiring:update") ||
                                     permissions.includes("dojo_hiring:delete") ||
                                     permissions.includes("mentor:create") ||
                                     permissions.includes("mentor:read") ||
                                     permissions.includes("mentor:update") ||
                                     permissions.includes("mentor:delete");
            if (hasUserPermission) {
                return next();
            }
        }
        
        if (requiredPrivilegeName === "setrequirement") {
            const hasRequirementPermission = permissions.includes("line_requirement:update") || 
                                             permissions.includes("line_requirement:read") ||
                                             permissions.includes("mps_requirement:upload_excel") ||
                                             permissions.includes("mps_requirement:edit") ||
                                             permissions.includes("mps_requirement:approve") ||
                                             permissions.includes("mps_requirement:process_approve") ||
                                             permissions.includes("setrequirement");
            if (hasRequirementPermission) {
                return next();
            }
        }
    }

    // 2. Validate input
    if (!requiredPrivilegeName || typeof requiredPrivilegeName !== 'string') {
        throw new ApiError("Invalid privilege check configuration.", 500);
    }

    // 3. Find the Privilege ID for the given Name from DB
    let rows = await executeQuery("SELECT id FROM privileges WHERE name = ?", [requiredPrivilegeName]);

    if (rows.length === 0) {
        // Auto-create privilege if it doesn't exist
        try {
            const newPriv = await Privilege.create({ name: requiredPrivilegeName });
            rows = [{ id: newPriv.id }];
        } catch (error) {
            // If creation fails, try finding again
            rows = await executeQuery("SELECT id FROM privileges WHERE name = ?", [requiredPrivilegeName]);
            if (rows.length === 0) {
                throw new ApiError(`Required privilege '${requiredPrivilegeName}' not found in system and could not be initialized.`, 403);
            }
        }
    }

    const requiredPrivilegeId = rows[0].id;

    // 4. Check if user has this privilege ID
    const privilegeString = req.user.privileges;

    if (!privilegeString) {
        throw new ApiError("You do not have permission to perform this action.", 403);
    }

    const privileges = String(privilegeString).split(',').map(p => parseInt(p.trim(), 10));

    if (!privileges.includes(requiredPrivilegeId)) {
        throw new ApiError("You do not have the required privilege to perform this action.", 403);
    }

    next();
});

