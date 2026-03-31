import { ApiError } from "../utils/ApiError.js";

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Check if user has at least one of the required permissions
    const hasPermission = roles.some((role) => {
      const normalizedReqRole = role.toLowerCase();
      
      // 1. Check for role flags (e.g., if role is "ADMIN", check req.user.isAdmin)
      const flagName = role.startsWith('is') ? role : `is${role.charAt(0).toUpperCase()}${role.slice(1).toLowerCase()}`;
      if (req.user[flagName] === true || req.user[role] === true) return true;

      // 2. Fallback: check custom role targetLayout
      if (req.user.role === 'CUSTOM' && req.user.customRole?.targetLayout) {
        const layout = req.user.customRole.targetLayout.toLowerCase();
        if (normalizedReqRole === layout || (normalizedReqRole === 'admin' && layout === 'superadmin')) return true;
        // Also support checks like authorizeRoles("isTrainer") matching targetLayout "trainer"
        if (normalizedReqRole.startsWith('is') && normalizedReqRole.slice(2) === layout) return true;
      }

      // 3. Fallback: strict role string match
      return req.user.role === role;
    });

    if (!hasPermission) {
      throw new ApiError("You do not have permission to perform this action", 403);
    }
    next();
  };
};

export default authorizeRoles;

