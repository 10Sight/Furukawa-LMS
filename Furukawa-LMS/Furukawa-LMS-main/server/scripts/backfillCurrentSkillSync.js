import { executeQuery } from "../db/mssqlHelper.js";

// One-time backfill to repair users whose currentLevel and currentSkill map
// drifted out of sync before the updateUser/deleteEvaluationSheet sync fixes.
//
// Resolution mirrors formatUser's existing display precedence, so no user's
// displayed level changes as a result of this script — it only makes the two
// backing fields agree with whichever value was already winning:
//   - active sub-section HAS a currentSkill entry -> currentLevel is overwritten to match it
//   - active sub-section has NO currentSkill entry -> currentSkill is seeded from currentLevel
//   - no active sub-section (e.g. Mentors) -> left untouched, currentLevel stays authoritative
//
// Usage:
//   node scripts/backfillCurrentSkillSync.js          (dry run, logs only)
//   node scripts/backfillCurrentSkillSync.js --apply  (writes changes)

const parseJSON = (data, fallback = {}) => {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch (e) { return fallback; }
  }
  return data || fallback;
};

async function backfill() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "Running in APPLY mode — changes will be written." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

  const [users] = await executeQuery(
    "SELECT id, fullName, subSectionId, targetSubSectionId, currentLevel, currentSkill FROM users WHERE isDeleted = 0 OR isDeleted IS NULL"
  );
  console.log(`Checked ${users.length} users.`);

  let levelFixed = 0;
  let skillSeeded = 0;

  for (const user of users) {
    const activeSubSecId = user.subSectionId || user.targetSubSectionId;
    if (!activeSubSecId) continue;

    const currentSkillMap = parseJSON(user.currentSkill, {});
    const skillLevel = currentSkillMap[activeSubSecId];

    if (skillLevel && skillLevel !== user.currentLevel) {
      console.log(`[level] user ${user.id} (${user.fullName}): currentLevel '${user.currentLevel}' -> '${skillLevel}' (from currentSkill[${activeSubSecId}])`);
      levelFixed++;
      if (apply) {
        await executeQuery("UPDATE users SET currentLevel = ?, updatedAt = GETDATE() WHERE id = ?", [skillLevel, user.id]);
      }
    } else if (!skillLevel && user.currentLevel) {
      console.log(`[skill] user ${user.id} (${user.fullName}): seeding currentSkill[${activeSubSecId}] = '${user.currentLevel}'`);
      skillSeeded++;
      if (apply) {
        currentSkillMap[activeSubSecId] = user.currentLevel;
        await executeQuery("UPDATE users SET currentSkill = ?, updatedAt = GETDATE() WHERE id = ?", [JSON.stringify(currentSkillMap), user.id]);
      }
    }
  }

  console.log(`Done. currentLevel corrected: ${levelFixed}, currentSkill seeded: ${skillSeeded}.`);
  process.exit(0);
}

backfill().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
