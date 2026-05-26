import { ApiError } from "../utils/ApiError.js";
import { DEFAULT_ROLES } from "../controllers/rolesPermissions.controller.js";

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Check if user has at least one of the required roles or permissions
    const hasPermission = roles.some((role) => {
      const normalizedReqRole = role.toLowerCase();
      
      // Get all permissions currently available to the user (System level + Custom Role level)
      const userRole = req.user.role;
      const defaultPermissions = (userRole !== 'CUSTOM' && DEFAULT_ROLES[userRole]) ? (DEFAULT_ROLES[userRole].permissions || []) : [];
      const customPermissions = req.user.customRole?.permissions || [];
      const allUserPermissions = [...new Set([...defaultPermissions, ...customPermissions])];

      // 1. Check for fine-grained permissions match (e.g. "sixteen_day:manage")
      if (allUserPermissions.includes(role)) return true;

      // 2. Check for role flags (e.g. if role is "isAdmin", check req.user.isAdmin)
      // Use == true for BIT columns that might arrive as 1/0
      const flagName = role.startsWith('is') ? role : `is${role.charAt(0).toUpperCase()}${role.slice(1).toLowerCase()}`;
      if (req.user[flagName] == true || req.user[role] == true) return true;

      // 3. Check for targetLayout match (for Custom Roles)
      if (userRole === 'CUSTOM' && req.user.customRole?.targetLayout) {
        const layout = req.user.customRole.targetLayout.toLowerCase();
        if (normalizedReqRole === layout || (normalizedReqRole === 'admin' && layout === 'superadmin')) return true;
        
        // Also support checks like authorizeRoles("isTrainer") matching targetLayout "trainer" or "instructor"
        const target = normalizedReqRole.startsWith('is') ? normalizedReqRole.slice(2) : normalizedReqRole;
        if (target === layout) return true;
        if (target === 'trainer' && layout === 'instructor') return true;
        if (target === 'instructor' && layout === 'trainer') return true;
        if (target === 'student' && layout === 'employee') return true;
        if (target === 'employee' && layout === 'student') return true;

        // Custom Dashboard roles get admin/superadmin equivalence for Dashboard API endpoints
        if (layout === 'dashboard' && (target === 'admin' || target === 'superadmin')) return true;
      }

      // 4. Fallback: strict role string match
      return String(userRole).toUpperCase() === String(role).toUpperCase();
    });

    if (!hasPermission) {
      console.log(`[AUTH_DEBUG] Authorization failed for user ${req.user.id}. Required one of: ${roles.join(", ")}. User Role: ${req.user.role}, Permissions: ${JSON.stringify(req.user.customRole?.permissions || [])}`);
      throw new ApiError("You do not have permission to perform this action", 403);
    }
    next();
  };
};

export default authorizeRoles;

