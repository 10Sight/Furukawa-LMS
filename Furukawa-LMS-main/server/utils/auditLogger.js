import Audit from "../models/audit.model.js";

const logAudit = async (userId, action, details = {}) => {
    try {
        await Audit.create({
            user: userId || null,
            action,
            details,
        });
    } catch (error) {
        console.error("Audit log error:", error.message);
    }
};

export default logAudit;