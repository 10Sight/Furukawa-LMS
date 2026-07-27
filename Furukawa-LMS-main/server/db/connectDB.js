import sql from "mssql";
import logger from "../logger/winston.logger.js";
import ENV from "../configs/env.config.js";

// mssql applies requestTimeout at the connection-pool level (there is no per-request
// override), so a single slow query used to be able to hold a connection open for the
// full 300s default under load, starving the pool. Standard queries now fail fast at 30s;
// known long-running operations (PDF generation, bulk import/restore) opt into the
// separate long-running pool below via `{ longRunning: true }`.
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds
const LONG_RUNNING_REQUEST_TIMEOUT = 300000; // 5 minutes
const CONNECTION_TIMEOUT = 120000; // 120 seconds

const LEAK_WARNING_THRESHOLD_MS = 30000; // flag connections/transactions held longer than this
const LEAK_SCAN_INTERVAL_MS = 10000;

const baseConfig = {
    user: ENV.DB_USER,
    password: ENV.DB_PASSWORD,
    database: ENV.DB_NAME,
    server: ENV.DB_HOST,
    port: parseInt(ENV.DB_PORT) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectionTimeout: CONNECTION_TIMEOUT,
        // The DB server's OS clock runs in local (IST) time, not UTC. Tedious defaults to
        // useUTC: true, which mislabels GETDATE()'s naive local value as if it were UTC,
        // shifting every DATETIME read from the DB by the local UTC offset (+5:30 here).
        // useUTC: false makes it read/write DATETIME values as local time instead, matching
        // what the DB server's clock actually is.
        useUTC: false
    }
};

const dbConfig = {
    ...baseConfig,
    pool: {
        max: 20,
        // Keep a few connections warm so a burst after an idle gap doesn't pay full
        // TCP+login setup cost on the request path (that cold-connect cost, not any
        // particular query, was the real driver behind the multi-second [SLOW QUERY]
        // warnings on the Attendance/Trainees dashboards).
        min: 3,
        idleTimeoutMillis: 30000
    },
    options: {
        ...baseConfig.options,
        requestTimeout: DEFAULT_REQUEST_TIMEOUT
    }
};

// Small, separate pool reserved for operations that are known to legitimately run long
// (PDF generation, bulk import/export/restore) so they can use a 5 minute timeout
// without giving every other query in the app the same 5 minute grace period.
const longRunningDbConfig = {
    ...baseConfig,
    pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        ...baseConfig.options,
        requestTimeout: LONG_RUNNING_REQUEST_TIMEOUT
    }
};

// We create a global pool promise so it can be exported and used globally.
const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        logger.info(`MSSQL Connected to '${ENV.DB_NAME}'`);
        return pool;
    })
    .catch(err => {
        logger.error("MSSQL Connection Failed", err.message);
        process.exit(1);
    });

const longRunningPoolPromise = new sql.ConnectionPool(longRunningDbConfig)
    .connect()
    .catch(err => {
        logger.error("MSSQL long-running pool connection failed", err.message);
        throw err;
    });

const connectDB = async () => {
    try {
        await poolPromise;
    } catch (error) {
        logger.error("MSSQL Connection Failed inside connectDB", error.message);
        process.exit(1);
    }
};

// --- Connection leak detection ---------------------------------------------------
// Tracks connections/transactions checked out via pool.getConnection() (used for
// multi-statement transactions). A background scanner flags any held far longer than
// a single request should take, together with a stack trace of where it was acquired.
let nextConnectionId = 1;
const activeConnections = new Map();

const trackConnection = () => {
    const id = nextConnectionId++;
    activeConnections.set(id, {
        acquiredAt: Date.now(),
        stack: new Error("Connection acquired here").stack,
        warned: false
    });
    return id;
};

const untrackConnection = (id) => {
    activeConnections.delete(id);
};

setInterval(() => {
    const now = Date.now();
    for (const [id, info] of activeConnections) {
        if (info.warned) continue;
        const heldForMs = now - info.acquiredAt;
        if (heldForMs > LEAK_WARNING_THRESHOLD_MS) {
            info.warned = true;
            logger.warn(
                `[DB CONNECTION LEAK] Connection/transaction #${id} has been held for ${heldForMs}ms ` +
                `(threshold ${LEAK_WARNING_THRESHOLD_MS}ms). Acquired at:\n${info.stack}`
            );
        }
    }
}, LEAK_SCAN_INTERVAL_MS).unref();

const inspectTarnPool = (dbPool, poolConfig) => {
    const tarnPool = dbPool && dbPool.pool;
    if (!tarnPool) {
        return { used: 0, free: 0, pendingAcquires: 0, pendingCreates: 0, max: poolConfig.max, min: poolConfig.min };
    }
    return {
        used: tarnPool.numUsed(),
        free: tarnPool.numFree(),
        pendingAcquires: tarnPool.numPendingAcquires(),
        pendingCreates: tarnPool.numPendingCreates(),
        max: poolConfig.max,
        min: poolConfig.min
    };
};

/**
 * Returns live metrics for both connection pools plus the count of connections/
 * transactions currently tracked for leak detection.
 */
export const getPoolStatus = async () => {
    const [mainResult, longResult] = await Promise.allSettled([poolPromise, longRunningPoolPromise]);

    return {
        main: inspectTarnPool(mainResult.status === "fulfilled" ? mainResult.value : null, dbConfig.pool),
        longRunning: inspectTarnPool(longResult.status === "fulfilled" ? longResult.value : null, longRunningDbConfig.pool),
        activeTrackedConnections: activeConnections.size
    };
};

// --- Pool contention watchdog -------------------------------------------------------
// pendingAcquires > 0 means requests are actually queuing for a free connection right
// now — the direct symptom of "the API feels slow" under load. Logs once when
// contention starts and once when it clears, rather than every scan, so a sustained
// backlog doesn't spam the logs.
const POOL_CONTENTION_SCAN_INTERVAL_MS = 10000;
let poolContentionWarned = false;

setInterval(async () => {
    const status = await getPoolStatus();
    const isContended = status.main.pendingAcquires > 0 || status.longRunning.pendingAcquires > 0;

    if (isContended && !poolContentionWarned) {
        poolContentionWarned = true;
        logger.warn(
            `[DB POOL CONTENTION] Requests are queuing for a connection: ` +
            `main pendingAcquires=${status.main.pendingAcquires} (used=${status.main.used}/${status.main.max}), ` +
            `longRunning pendingAcquires=${status.longRunning.pendingAcquires} (used=${status.longRunning.used}/${status.longRunning.max})`
        );
    } else if (!isContended && poolContentionWarned) {
        poolContentionWarned = false;
        logger.info(`[DB POOL CONTENTION] Cleared — no requests currently queuing for a connection.`);
    }
}, POOL_CONTENTION_SCAN_INTERVAL_MS).unref();

export const pool = {
    query: async (query, params = [], options = {}) => {
        const { executeQuery } = await import("./mssqlHelper.js");
        return executeQuery(query, params, options);
    },
    getConnection: async (options = {}) => {
        const { runOnRequest } = await import("./mssqlHelper.js");
        const dbPool = await (options.longRunning ? longRunningPoolPromise : poolPromise);
        const transaction = new sql.Transaction(dbPool);
        let started = false;
        let released = false;

        const connectionId = trackConnection();
        const release = () => {
            if (released) return;
            released = true;
            untrackConnection(connectionId);
        };

        return {
            query: async (query, params = []) => {
                const request = started ? transaction.request() : dbPool.request();
                return runOnRequest(request, query, params);
            },
            beginTransaction: async () => {
                await transaction.begin();
                started = true;
            },
            commit: async () => {
                try {
                    await transaction.commit();
                } finally {
                    release();
                }
            },
            rollback: async () => {
                try {
                    if (started) {
                        await transaction.rollback();
                    }
                } finally {
                    release();
                }
            },
            release
        };
    }
};

export { poolPromise, longRunningPoolPromise, sql as mssql, baseConfig };
export default connectDB;
