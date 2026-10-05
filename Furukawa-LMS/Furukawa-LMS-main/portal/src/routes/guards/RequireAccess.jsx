
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const RequireAccess = ({ children, allow }) => {
    const { user } = useSelector((state) => state.auth);
    const location = useLocation();

    if (!user) {
        // Should be handled by ProtectedRoute, but double check
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check if the user has the required permission. `allow` may be a single
    // string or an array of alternatives (any one of which grants access).
    const allowList = Array.isArray(allow) ? allow : [allow];
    const isAdmin = !!user.isAdmin;
    const hasRoleFlag = isAdmin || allowList.some((a) => !!user[a]);
    const hasGranularPermission = allowList.some((a) => user.customRole?.permissions?.includes(a));

    // Layout-based permission fallback
    let hasLayoutPermission = false;
    if (user.role === 'CUSTOM') {
        // For custom roles, if they are entering a layout, we are more permissive
        // because the Layout component itself filters tabs and redirects if no tabs are allowed.
        // This prevents the infinite loop between LandingPage and Layout roots.
        const allowedPages = user.customRole?.allowedPages;
        const normalizedPages = typeof allowedPages === 'string' ? JSON.parse(allowedPages || '[]') : (allowedPages || []);

        if (normalizedPages.length > 0) {
            hasLayoutPermission = true;
        }
    } else if (user.customRole?.targetLayout) {
        const layout = user.customRole.targetLayout.toLowerCase();
        if (allowList.includes('isAdmin') && (layout === 'admin' || layout === 'superadmin')) {
            hasLayoutPermission = true;
        } else if (allowList.includes('isTrainer') && (layout === 'trainer' || layout === 'instructor')) {
            hasLayoutPermission = true;
        } else if (allowList.includes('isEmployee') && (layout === 'student' || layout === 'employee')) {
            hasLayoutPermission = true;
        }
    }

    if (!hasRoleFlag && !hasGranularPermission && !hasLayoutPermission) {
        // Access denied - redirect to landing page
        // If we are already on landing page, don't redirect (avoids loop)
        if (location.pathname === '/') return children;
        return <Navigate to="/" replace />;
    }

    return children;
};

export default RequireAccess;
