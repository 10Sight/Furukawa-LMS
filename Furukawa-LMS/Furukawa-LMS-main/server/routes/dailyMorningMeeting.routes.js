import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    getMeetingsForSection,
    getMeetingDetail,
    getMeetingPatchesAfter,
    createMeeting,
    cloneMeeting,
    updateMeeting,
    saveMeetingSheet,
    saveMeetingSheetPatch,
    migrateMeetingToM365,
    refreshMeetingEmbedUrl,
    openMeetingInM365,
    syncSectionMeetingsFromM365,
    getMeetingM365Snapshot,
    deleteMeeting
} from "../controllers/dailyMorningMeeting.controller.js";
import {
    getMeetingComments,
    createCommentThread,
    addCommentReply,
    setCommentStatus,
    editCommentMessage,
    deleteCommentMessage,
    deleteCommentThread
} from "../controllers/sheetComment.controller.js";

const router = Router();

router.use(verifyJWT);

// Read access is permission-only (no department/section lock) — any user
// holding daily_meeting:read can view meetings across every department/section.
router.get("/section/:sectionId", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), getMeetingsForSection);
router.get("/:id", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), getMeetingDetail);
router.get("/:id/patches", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), getMeetingPatchesAfter);
router.get("/:id/m365-snapshot", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), getMeetingM365Snapshot);
// Read-gated only (like the routes above) — the edit-vs-view split is decided
// server-side per requester in the controller, not by route-level permissions.
router.post("/:id/open-m365", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), openMeetingInM365);

// Write actions additionally require the user be assigned to the target
// department/section (enforced in the controller via canModifyDailyMeetingSection),
// unless they're an admin/superadmin.
router.post("/", authorizeRoles("daily_meeting:create", "isAdmin", "SUPERADMIN"), createMeeting);
router.post("/:id/clone", authorizeRoles("daily_meeting:create", "isAdmin", "SUPERADMIN"), cloneMeeting);
router.put("/:id", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), updateMeeting);
router.post("/:id/sheet", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), saveMeetingSheet);
router.post("/:id/sheet/patch", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), saveMeetingSheetPatch);
router.post("/:id/migrate-to-m365", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), migrateMeetingToM365);
router.post("/:id/refresh-embed-url", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), refreshMeetingEmbedUrl);
// Reconciliation creates new rows for files found in SharePoint, so it's gated
// like other section-scoped write actions (daily_meeting:create + the controller's
// own canModifyDailyMeetingSection check), not merely read access.
router.post("/section/:sectionId/sync-m365", authorizeRoles("daily_meeting:create", "isAdmin", "SUPERADMIN"), syncSectionMeetingsFromM365);
router.delete("/:id", authorizeRoles("daily_meeting:delete", "isAdmin", "SUPERADMIN"), deleteMeeting);

// Cell comments. Anyone who can open a meeting can read, reply to and resolve them.
// Starting one takes the right to save the sheet, since that is what puts the comment
// on a cell; editing and deleting are limited to the author in the controller.
router.get("/:id/comments", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), getMeetingComments);
router.post("/:id/comments", authorizeRoles("daily_meeting:update", "isAdmin", "SUPERADMIN"), createCommentThread);
router.post("/:id/comments/:threadId/replies", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), addCommentReply);
router.patch("/:id/comments/:threadId", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), setCommentStatus);
router.put("/:id/comments/:threadId/messages/:messageId", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), editCommentMessage);
router.delete("/:id/comments/:threadId/messages/:messageId", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), deleteCommentMessage);
router.delete("/:id/comments/:threadId", authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN"), deleteCommentThread);

export default router;
