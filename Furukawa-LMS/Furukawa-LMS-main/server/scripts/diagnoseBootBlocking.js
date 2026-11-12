import { executeQuery } from "../db/mssqlHelper.js";

// Read-only diagnostic. Polls SQL Server's DMVs while the app server boots and reports which
// statements other sessions were waiting on (lock blocking), so slow startup can be traced to
// its actual cause instead of guessed. Needs VIEW SERVER STATE on the DB login. Writes nothing.
//
// Usage (start it, then start/restart the app server):
//   node scripts/diagnoseBootBlocking.js [seconds=600] [minWaitMs=1000]

const durationSec = Number(process.argv[2]) || 600;
const minWaitMs = Number(process.argv[3]) || 1000;
const POLL_MS = 500;

const oneLine = (sql, max = 220) => String(sql ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const SESSIONS_SQL = `
    SELECT s.session_id, s.program_name, s.host_name, s.status, s.open_transaction_count
    FROM sys.dm_exec_sessions s
    WHERE s.is_user_process = 1 AND s.database_id = DB_ID() AND s.session_id <> @@SPID`;

// Every request in this database that has been waiting at least minWaitMs, with the statement
// of the session blocking it. An idle blocker (open transaction, no running request) has no
// request row, so its last statement comes from the connection's most_recent_sql_handle.
const WAITS_SQL = `
    SELECT r.session_id, r.blocking_session_id, r.wait_type, r.wait_time, r.wait_resource,
           ws.program_name AS waiter_program, ws.host_name AS waiter_host,
           SUBSTRING(wt.text, (r.statement_start_offset / 2) + 1,
               ((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(wt.text) ELSE r.statement_end_offset END
                 - r.statement_start_offset) / 2) + 1) AS waiter_sql,
           bs.program_name AS blocker_program, bs.host_name AS blocker_host, bs.status AS blocker_status,
           bs.open_transaction_count AS blocker_open_tran,
           COALESCE(
               SUBSTRING(bt.text, (br.statement_start_offset / 2) + 1,
                   ((CASE br.statement_end_offset WHEN -1 THEN DATALENGTH(bt.text) ELSE br.statement_end_offset END
                     - br.statement_start_offset) / 2) + 1),
               bct.text) AS blocker_sql
    FROM sys.dm_exec_requests r
    JOIN sys.dm_exec_sessions ws ON ws.session_id = r.session_id
    CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) wt
    LEFT JOIN sys.dm_exec_sessions bs ON bs.session_id = r.blocking_session_id
    LEFT JOIN sys.dm_exec_requests br ON br.session_id = r.blocking_session_id
    OUTER APPLY sys.dm_exec_sql_text(br.sql_handle) bt
    LEFT JOIN sys.dm_exec_connections bc ON bc.session_id = r.blocking_session_id
    OUTER APPLY sys.dm_exec_sql_text(bc.most_recent_sql_handle) bct
    WHERE r.database_id = DB_ID() AND r.session_id <> @@SPID AND r.wait_time >= ?`;

const [sessions] = await executeQuery(SESSIONS_SQL);
const byClient = {};
for (const s of sessions) {
    const key = `${s.host_name || "?"} | ${s.program_name || "?"}`;
    byClient[key] = (byClient[key] || 0) + 1;
}
console.log(`Other sessions on this database at start (${sessions.length}):`);
for (const [k, n] of Object.entries(byClient)) console.log(`  ${n} x ${k}`);
console.log(`\nPolling every ${POLL_MS}ms for ${durationSec}s (waits >= ${minWaitMs}ms). Start/restart the app server now.\n`);

const blockers = new Map();   // blocker statement -> aggregate
const waitTypes = new Map();
const seen = new Set();
const deadline = Date.now() + durationSec * 1000;
let stop = false;
process.on("SIGINT", () => { stop = true; });

while (!stop && Date.now() < deadline) {
    try {
        const [rows] = await executeQuery(WAITS_SQL, [minWaitMs]);
        for (const r of rows) {
            waitTypes.set(r.wait_type || "(none)", Math.max(waitTypes.get(r.wait_type || "(none)") || 0, r.wait_time));
            if (!r.blocking_session_id) continue;
            const key = oneLine(r.blocker_sql) || `(session ${r.blocking_session_id}, no statement)`;
            const agg = blockers.get(key) || {
                blocker: key, maxWaitMs: 0, waiters: new Set(), waitTypes: new Set(),
                program: `${r.blocker_host || "?"} | ${r.blocker_program || "?"}`,
                status: r.blocker_status, openTran: r.blocker_open_tran,
            };
            agg.maxWaitMs = Math.max(agg.maxWaitMs, r.wait_time);
            agg.waiters.add(oneLine(r.waiter_sql, 140));
            agg.waitTypes.add(r.wait_type);
            blockers.set(key, agg);

            const sig = `${r.session_id}|${r.blocking_session_id}|${oneLine(r.waiter_sql, 60)}`;
            if (!seen.has(sig)) {
                seen.add(sig);
                console.log(`[${new Date().toLocaleTimeString()}] ${r.wait_type} ${r.wait_time}ms  session ${r.session_id} waits on ${r.blocking_session_id} (${r.blocker_status}, open_tran=${r.blocker_open_tran})`);
                console.log(`    waiter : ${oneLine(r.waiter_sql, 160)}`);
                console.log(`    blocker: ${oneLine(r.blocker_sql, 160)}`);
            }
        }
    } catch (err) {
        console.error("poll failed:", err.message);
    }
    await new Promise((res) => setTimeout(res, POLL_MS));
}

console.log("\n=== Blocking statements, worst first ===");
const ranked = [...blockers.values()].sort((a, b) => b.maxWaitMs - a.maxWaitMs);
if (ranked.length === 0) console.log("  none captured");
for (const b of ranked) {
    console.log(`\n${b.maxWaitMs}ms max wait | ${b.waiters.size} distinct waiting statements | ${[...b.waitTypes].join(",")} | ${b.program} | blocker ${b.status}, open_tran=${b.openTran}`);
    console.log(`  BLOCKER: ${b.blocker}`);
    for (const w of [...b.waiters].slice(0, 5)) console.log(`    waiter: ${w}`);
}
console.log("\n=== Longest waits by type (incl. non-lock waits) ===");
for (const [t, ms] of [...waitTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${t}: ${ms}ms`);
process.exit(0);
