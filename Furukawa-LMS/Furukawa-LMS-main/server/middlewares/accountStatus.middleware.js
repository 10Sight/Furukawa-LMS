import { ApiError } from "../utils/ApiError.js";
import { UserStatusEnum, mapLegacyStatusToNew } from "../constants.js";

/**
 * Middleware to check user account status and restrict access accordingly
 * - PRESENT: Full access
 * - ON_LEAVE: Limited access to specific routes when allowedForPending = true
 * - ABSENT: Cannot access any student routes
 */
const checkAccountStatus = (allowedForPending = false) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError("User not authenticated", 401);
    }

    const rawStatus = req.user.status;
    const userStatus = mapLegacyStatusToNew(rawStatus);
    const userRole = req.user.role;

    // Only apply restrictions to STUDENT role
    if (userRole !== "STUDENT") {
      return next();
    }

    switch (userStatus) {
      case UserStatusEnum.PRESENT:
        // Present users have full access
        return next();
        
      case UserStatusEnum.ON_LEAVE:
        // On-leave users can only access specific routes (e.g. profile) when explicitly allowed
        if (allowedForPending) {
          return next();
        }
        throw new ApiError(
          "Your account is currently marked as On Leave. You can only access limited pages. Please contact your instructor for more information.",
          403
        );
        
      case UserStatusEnum.ABSENT:
        throw new ApiError(
          "Your account is currently marked as Absent. Please contact your instructor for more information.",
          403
        );
        
      default:
        throw new ApiError("Invalid account status", 400);
    }
  };
};

export default checkAccountStatus;
