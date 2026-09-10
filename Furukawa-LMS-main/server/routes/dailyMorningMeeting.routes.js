import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    getMeetingsForSection,
    getMeetingDetail,
    createMeeting,
    cloneMeeting,
    updateMeeting,
    saveMeetingSheet,
    migrateMeetingToM365,
    refreshMeetingEmbedUrl,
    getMeetingM365Snapshot,
    deleteMeeting
} from "../controllers/dailyMorningMeeting.controller.js";

const router = Router();

router.use(verifyJWT);

// Read access is permission-only (no department/section lock) — any user
// holding daily_meeting:read can view meetings across every department/section.
router.get("/section/:sectionId", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), getMeetingsForSection);
router.get("/:id", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), getMeetingDetail);
router.get("/:id/m365-snapshot", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), getMeetingM365Snapshot);

// Write actions additionally require the user be assigned to the target
// department/section (enforced in the controller via canModifyDailyMeetingSection),
// unless they're an admin/superadmin.
router.post("/", authorizeRoles("daily_meeting:create", "isAdmin", "SUPERADMIN"), createMeeting);
router.post("/:id/clone", authorizeRoles("daily_meeting:create", "isAdmin", "SUPERADMIN"), cloneMeeting);
router.put("/:id", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), updateMeeting);
router.post("/:id/sheet", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), saveMeetingSheet);
router.post("/:id/migrate-to-m365", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), migrateMeetingToM365);
router.post("/:id/refresh-embed-url", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), refreshMeetingEmbedUrl);
router.delete("/:id", authorizeRoles("daily_meeting:delete", "isAdmin", "SUPERADMIN"), deleteMeeting);

export default router;
