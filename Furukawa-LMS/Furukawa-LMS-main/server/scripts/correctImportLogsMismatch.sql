-- Corrects historical import_logs rows where totalRows does not equal
-- successCount + failCount. Older imports counted empty/skipped Excel rows
-- toward totalRows even though they were never included in success/fail
-- counts; this script recalculates totalRows to match the actual outcome
-- counts recorded for each log.
--
-- Usage: run against whichever DB server needs correcting. Safe to re-run;
-- it only touches rows that are currently mismatched.

SELECT id, fileName, totalRows, successCount, failCount,
       (COALESCE(successCount, 0) + COALESCE(failCount, 0)) AS correctedTotalRows
FROM import_logs
WHERE totalRows <> (COALESCE(successCount, 0) + COALESCE(failCount, 0));

UPDATE import_logs
SET totalRows = COALESCE(successCount, 0) + COALESCE(failCount, 0)
WHERE totalRows <> (COALESCE(successCount, 0) + COALESCE(failCount, 0));
