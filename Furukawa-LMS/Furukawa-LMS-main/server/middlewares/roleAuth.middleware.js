import { ApiError } from "../utils/ApiError.js";
import { SYSTEM_PERMISSIONS, DEFAULT_ROLES } from "../controllers/rolesPermissions.controller.js";

/**
 * Authorization middleware based on role permissions
 * @param {string[]} requiredPermissions - Array of permission strings required to access the route
 * @returns {Function} Express middleware function
 */
export const authorizeRole = (requiredPermissions) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        console.log(`[AUTH_DEBUG] User not authenticated for route: ${req.originalUrl}`);
        throw new ApiError("User not authenticated", 401);
      }

      const userRole = req.user.role;
      const userId = req.user.id || req.user._id;

      // Check if user role exists
      if (!userRole || (!DEFAULT_ROLES[userRole] && userRole !== 'CUSTOM')) {
        console.log(`[AUTH_DEBUG] User ${userId} has invalid role: ${userRole}`);
        throw new ApiError("Invalid user role", 403);
      }

      // SuperAdmin has all permissions
      if (userRole === 'SUPERADMIN') {
        return next();
      }

      // Merge default system permissions with custom role permissions.
      // CUSTOM roles must NOT inherit the full permission set of their targetLayout
      // (e.g. 'admin') - that would silently grant every ADMIN permission, including
      // destructive ones like user:delete, regardless of what the custom role actually
      // configures. A CUSTOM role's permissions come strictly from its own configuration.
      const defaultPermissions = userRole !== 'CUSTOM'
        ? (DEFAULT_ROLES[userRole]?.permissions || [])
        : [];
      const customPermissions = req.user.customRole?.permissions || [];
      const allPermissions = [...new Set([...defaultPermissions, ...customPermissions])];

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every(permission =>
        allPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        const missingPermissions = requiredPermissions.filter(permission =>
          !allPermissions.includes(permission)
        );

        console.log(`[AUTH_DEBUG] Authorization Failed:
          User ID: ${userId}
          Role: ${userRole}
          Custom Role: ${req.user.customRole?.name || 'None'} (${req.user.customRole?.id || 'N/A'})
          isEmployee: ${!!req.user.isEmployee}, isTrainer: ${!!req.user.isTrainer}
          Required: ${requiredPermissions.join(', ')}
          Missing: ${missingPermissions.join(', ')}
          Available Count: ${allPermissions.length}
        `);

        throw new ApiError(
          `Insufficient permissions. Missing: ${missingPermissions.join(', ')}`,
          403
        );
      }

      // Log success for debugging (can be removed in production)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUTH_DEBUG] Authorization Success for User ${userId} on ${req.originalUrl}`);
      }

      next();

    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user has specific permission
 * @param {Object} user - User object with role property
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
export const hasPermission = (user, permission) => {
  if (!user || !user.role) return false;

  const userRole = user.role;

  // SuperAdmin has all permissions
  if (userRole === 'SUPERADMIN') return true;

  const rolePermissions = userRole !== 'CUSTOM'
    ? (DEFAULT_ROLES[userRole]?.permissions || [])
    : [];
  const customPermissions = user.customRole?.permissions || [];

  return rolePermissions.includes(permission) || customPermissions.includes(permission);
};

/**
 * Check if user has any of the specified permissions
 * @param {Object} user - User object with role property
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} True if user has at least one permission
 */
export const hasAnyPermission = (user, permissions) => {
  if (!user || !user.role || !Array.isArray(permissions)) return false;

  const userRole = user.role;

  // SuperAdmin has all permissions
  if (userRole === 'SUPERADMIN') return true;

  const rolePermissions = userRole !== 'CUSTOM'
    ? (DEFAULT_ROLES[userRole]?.permissions || [])
    : [];
  const customPermissions = user.customRole?.permissions || [];
  const allPermissions = [...new Set([...rolePermissions, ...customPermissions])];

  return permissions.some(permission => allPermissions.includes(permission));
};

/**
 * Middleware to check if user can access their own resources or if they have admin permissions
 * @param {string} userIdParam - Parameter name for user ID in request params
 * @param {string[]} adminPermissions - Permissions that allow access to any user's data
 * @returns {Function} Express middleware function
 */
export const authorizeResourceAccess = (userIdParam = 'userId', adminPermissions = ['USER_READ']) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError("User not authenticated", 401);
      }

      const targetUserId = req.params[userIdParam];
      const currentUserId = req.user._id.toString();

      // Users can always access their own resources
      if (targetUserId === currentUserId) {
        return next();
      }

      // Check if user has admin permissions to access other users' data
      const userRole = req.user.role;

      if (!userRole || !DEFAULT_ROLES[userRole]) {
        throw new ApiError("Invalid user role", 403);
      }

      const rolePermissions = DEFAULT_ROLES[userRole].permissions;

      // SuperAdmin has access to everything
      if (userRole === 'SUPERADMIN') {
        return next();
      }

      // Check if user has required admin permissions
      const hasAdminAccess = adminPermissions.some(permission =>
        rolePermissions.includes(permission)
      );

      if (!hasAdminAccess) {
        throw new ApiError("Insufficient permissions to access this resource", 403);
      }

      next();

    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user can only perform action on subordinate roles
 * Prevents users from assigning roles higher than their own level
 * @returns {Function} Express middleware function
 */
export const authorizeRoleHierarchy = () => {
  // Define role hierarchy levels (higher number = more privilege)
  const roleHierarchy = {
    'STUDENT': 1,
    'INSTRUCTOR': 2,
    'ADMIN': 3,
    'SUPERADMIN': 4
  };

  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError("User not authenticated", 401);
      }

      const userRole = req.user.role;
      const targetRole = req.body.roleId || req.params.roleId;

      if (!userRole || !DEFAULT_ROLES[userRole]) {
        throw new ApiError("Invalid user role", 403);
      }

      // SuperAdmin can manage all roles
      if (userRole === 'SUPERADMIN') {
        return next();
      }

      // Get role levels
      const userLevel = roleHierarchy[userRole] || 0;
      const targetLevel = roleHierarchy[targetRole] || 0;

      // Users cannot assign roles equal to or higher than their own
      if (targetLevel >= userLevel) {
        throw new ApiError(
          `Cannot assign role '${targetRole}'. Insufficient privilege level.`,
          403
        );
      }

      next();

    } catch (error) {
      next(error);
    }
  };
};

/**
 * Authorization middleware based on having ANY of the required permissions
 * @param {string[]} allowedPermissions - Array of permission strings of which at least one is required
 * @returns {Function} Express middleware function
 */
export const authorizeAnyPermission = (allowedPermissions) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError("User not authenticated", 401);
      }

      const userRole = req.user.role;

      if (!userRole || (!DEFAULT_ROLES[userRole] && userRole !== 'CUSTOM')) {
        throw new ApiError("Invalid user role", 403);
      }

      // SuperAdmin has all privileges
      if (userRole === 'SUPERADMIN') {
        return next();
      }

      const defaultPermissions = userRole !== 'CUSTOM'
        ? (DEFAULT_ROLES[userRole]?.permissions || [])
        : [];
      const customPermissions = req.user.customRole?.permissions || [];
      const allPermissions = [...new Set([...defaultPermissions, ...customPermissions])];

      const hasAny = allowedPermissions.some(permission =>
        allPermissions.includes(permission)
      );

      if (!hasAny) {
        throw new ApiError(
          `Insufficient permissions. Requires one of: ${allowedPermissions.join(', ')}`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
