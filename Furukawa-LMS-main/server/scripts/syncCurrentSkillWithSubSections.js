import { executeQuery } from "../db/mssqlHelper.js";

// currentSkill is a JSON map keyed by subSectionId (plus "<id>_locked" / "<id>_lockedLevel"
// companion keys used by the level-lock feature - see progress.controller.js/department.controller.js).
// A user's *assigned* sub-sections are: subSections[] (multi-station assignment) plus the
// single-value subSectionId / targetSubSectionId fields. When a user is moved off a station,
// nothing today prunes their old currentSkill entry, so currentSkill can accumulate stale
// levels for sub-sections the user no longer belongs to (e.g. subSections=[18] but
// currentSkill has entries for 18, 25 and 26). This script removes those orphaned entries so
// currentSkill only ever reflects sub-sections the user is currently assigned to.
//
// Users with NO active sub-section at all (subSections=[], subSectionId=null,
// targetSubSectionId=null) are deliberately SKIPPED, not pruned - for them "orphaned" would
// mean "every key", and wiping all skill history for someone who's simply between stations
// (or awaiting reassignment) is a distinct, much riskier operation than trimming excess
// entries. Those users are only reported so they can be reviewed manually.
//
// Usage:
//   node scripts/syncCurrentSkillWithSubSections.js          (dry run, logs only)
//   node scripts/syncCurrentSkillWithSubSections.js --apply  (writes changes)

const parseJSON = (data, fallback) => {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch (e) { return fallback; }
  }
  return data || fallback;
};

const baseSubSectionId = (key) => key.replace(/_lockedLevel$/, "").replace(/_locked$/, "");

async function sync() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "Running in APPLY mode — changes will be written." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

  const [users] = await executeQuery(
    "SELECT id, fullName, subSectionId, targetSubSectionId, subSections, currentSkill FROM users WHERE isDeleted = 0 OR isDeleted IS NULL"
  );
  console.log(`Checked ${users.length} users.`);

  let usersFixed = 0;
  let entriesRemoved = 0;
  let skippedUsers = [];

  for (const user of users) {
    const currentSkill = parseJSON(user.currentSkill, {});
    const skillKeys = Object.keys(currentSkill);
    if (skillKeys.length === 0) continue;

    const subSections = parseJSON(user.subSections, []);
    const allowedIds = new Set(subSections.map(String));
    if (user.subSectionId) allowedIds.add(String(user.subSectionId));
    if (user.targetSubSectionId) allowedIds.add(String(user.targetSubSectionId));

    const orphanedKeys = skillKeys.filter(k => !allowedIds.has(baseSubSectionId(k)));
    if (orphanedKeys.length === 0) continue;

    if (allowedIds.size === 0) {
      skippedUsers.push({ id: user.id, name: user.fullName, orphanedCount: orphanedKeys.length });
      continue;
    }

    const cleanedSkill = {};
    for (const k of skillKeys) {
      if (!orphanedKeys.includes(k)) cleanedSkill[k] = currentSkill[k];
    }

    console.log(`[prune] user ${user.id} (${user.fullName}): subSections=[${[...allowedIds].join(",")}] — removing currentSkill key(s) ${orphanedKeys.join(", ")}`);
    usersFixed++;
    entriesRemoved += orphanedKeys.length;

    if (apply) {
      await executeQuery("UPDATE users SET currentSkill = ?, updatedAt = GETDATE() WHERE id = ?", [JSON.stringify(cleanedSkill), user.id]);
    }
  }

  console.log(`Done. Users pruned: ${usersFixed}, orphaned entries removed: ${entriesRemoved}.`);

  if (skippedUsers.length > 0) {
    console.log(`\nSkipped ${skippedUsers.length} user(s) with NO active sub-section assignment (would have wiped ALL their currentSkill entries — needs manual review, not auto-pruned):`);
    skippedUsers.forEach(u => console.log(`  - user ${u.id} (${u.name}): ${u.orphanedCount} currentSkill entr${u.orphanedCount === 1 ? "y" : "ies"}`));
  }

  process.exit(0);
}

sync().catch(err => {
  console.error("Sync failed:", err);
  process.exit(1);
});
