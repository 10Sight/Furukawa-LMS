import sql from "mssql";
const config = {
    user: "FME_USER", password: "StrongPassword123", database: "FME",
    server: "localhost", port: 1433,
    options: { encrypt: false, trustServerCertificate: true, useUTC: false }
};
const run = async () => {
    const pool = await sql.connect(config);
    // Hour-of-day histogram for rows created BEFORE today's connectDB.js fix (17:19 IST today)
    const before = await pool.request().query(`
        SELECT DATEPART(HOUR, createdAt) as hr, COUNT(*) as cnt
        FROM audits
        WHERE createdAt < '2026-07-23 17:19:00'
        GROUP BY DATEPART(HOUR, createdAt)
        ORDER BY hr
    `);
    console.log("Hour-of-day histogram (raw stored value) for rows BEFORE today's fix:");
    console.table(before.recordset);

    const after = await pool.request().query(`
        SELECT DATEPART(HOUR, createdAt) as hr, COUNT(*) as cnt
        FROM audits
        WHERE createdAt >= '2026-07-23 17:19:00'
        GROUP BY DATEPART(HOUR, createdAt)
        ORDER BY hr
    `);
    console.log("Hour-of-day histogram (raw stored value) for rows AFTER today's fix:");
    console.table(after.recordset);

    await pool.close();
};
run().catch(e => { console.error(e); process.exit(1); });
