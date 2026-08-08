-- One-time cleanup: normalize legacy hyphenated 'ON-LEAVE' status values to the
-- canonical underscored 'ON_LEAVE' used by UserStatusEnum (server/constants.js) and
-- every dashboard/report query. Run this once against the production database after
-- deploying the import.controller.js normalizeStatus fix.
--
-- Safe to re-run: the WHERE clause matches zero rows once cleaned up.

SELECT COUNT(*) AS rowsToFix FROM users WHERE status = 'ON-LEAVE';

UPDATE users
SET status = 'ON_LEAVE'
WHERE status = 'ON-LEAVE';
