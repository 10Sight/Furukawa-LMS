import CustomRole from "../models/customRole.model.js";
import { withPortalPagePermissions } from "../controllers/rolesPermissions.controller.js";

// One-time fix: custom roles saved before "View Daily HR Meeting" (hr_meeting:read) existed never
// received it, so their users don't see the Daily HR Meeting / Daily Handover Report tabs in the
// Management Information System page. Saving a role adds the permissions its pages need
// (withPortalPagePermissions); this script applies that same rule to every existing role, adding
// ONLY hr_meeting:read, and only where the role's Page Access calls for it:
//   - the MIS Portal given as a whole (no individual MIS pages picked), or
//   - the "Daily HR Meeting" page picked.
// Roles restricted to other MIS pages (e.g. only Daily Morning Meeting) are listed, not changed:
// an administrator decides whether they should see the HR reports.
//
// Dry run by default (prints what would change). Point the server's DB env config at the target
// database first. Safe to re-run.
//
// Usage (from server/):
//   node scripts/grantHrMeetingPermission.js            # dry run
//   node scripts/grantHrMeetingPermission.js --apply    # write the changes

const HR_MEETING_READ = "hr_meeting:read";
const MIS_PAGE_KEYS = ["daily-meeting", "mis-hr-meeting", "mis-morning-meeting", "mis-monthly-report"];

(async () => {
    const apply = process.argv.includes("--apply");
    try {
        const roles = await CustomRole.findAll();
        const toGrant = [];
        const notChanged = [];

        for (const role of roles) {
            const current = role.permissions || [];
            if (current.includes(HR_MEETING_READ)) continue;

            const expected = withPortalPagePermissions(role.allowedPages, current);
            if (expected.includes(HR_MEETING_READ)) {
                toGrant.push(role);
            } else {
                const hasMis = (role.allowedPages || []).some((p) => MIS_PAGE_KEYS.includes(p))
                    || current.includes("daily_meeting:read");
                if (hasMis) notChanged.push(role);
            }
        }

        console.log(`${apply ? "Granting" : "Would grant"} ${HR_MEETING_READ} to ${toGrant.length} role(s):`);
        for (const role of toGrant) {
            console.log(`  - #${role.id} ${role.name}`);
            if (apply) {
                await CustomRole.update(role.id, { permissions: [...role.permissions, HR_MEETING_READ] });
            }
        }

        if (notChanged.length) {
            console.log(`\nNot changed: ${notChanged.length} role(s) with MIS access but not given the Daily HR Meeting page.`);
            console.log("Edit them in Roles & Permissions if they should see the HR tabs:");
            for (const role of notChanged) {
                console.log(`  - #${role.id} ${role.name}  pages=${JSON.stringify(role.allowedPages)}`);
            }
        }

        if (!apply && toGrant.length) console.log("\nDry run only. Re-run with --apply to write the changes.");
        if (apply && toGrant.length) console.log("\nDone. Affected users must log out and back in to see the tabs.");
        process.exit(0);
    } catch (error) {
        console.error("Failed:", error);
        process.exit(1);
    }
})();
