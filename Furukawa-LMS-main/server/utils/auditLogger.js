import Audit from "../models/audit.model.js";

// meta.req (an Express request) is the preferred way to supply ip/userAgent;
// meta.ip/meta.userAgent are accepted directly for callers that don't have a req in scope.
const logAudit = async (userId, action, details = {}, meta = {}) => {
    const { resourceType = null, resourceId = null, req = null, ip = null, userAgent = null } = meta;
    try {
        await Audit.create({
            user: userId || null,
            action,
            details,
            resourceType,
            resourceId: resourceId ? String(resourceId) : null,
            ip: req ? req.ip : ip,
            userAgent: req ? req.get("User-Agent") : userAgent,
        });
    } catch (error) {
        console.error("Audit log error:", error.message);
    }
};

export default logAudit;