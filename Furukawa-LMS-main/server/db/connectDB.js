import sql from "mssql";
import logger from "../logger/winston.logger.js";
import ENV from "../configs/env.config.js";

const dbConfig = {
    user: ENV.DB_USER,
    password: ENV.DB_PASSWORD,
    database: ENV.DB_NAME,
    server: ENV.DB_HOST,
    port: parseInt(ENV.DB_PORT) || 1433,
    pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true,
        requestTimeout: 300000, // 300 seconds
        connectionTimeout: 120000 // 120 seconds
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

const connectDB = async () => {
    try {
        await poolPromise;
    } catch (error) {
        logger.error("MSSQL Connection Failed inside connectDB", error.message);
        process.exit(1);
    }
};

export const pool = {
    query: async (query, params = []) => {
        const { executeQuery } = await import("./mssqlHelper.js");
        return executeQuery(query, params);
    },
    getConnection: async () => {
        return { release: () => { } };
    }
};

export { poolPromise, sql as mssql };
export default connectDB;