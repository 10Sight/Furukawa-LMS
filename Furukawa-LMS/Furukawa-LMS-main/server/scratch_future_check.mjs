import sql from "mssql";
const config = {
    user: "FME_USER", password: "StrongPassword123", database: "FME",
    server: "localhost", port: 1433,
    options: { encrypt: false, trustServerCertificate: true, useUTC: false }
};
const run = async () => {
    const pool = await sql.connect(config);
    const now = await pool.request().query("SELECT CONVERT(VARCHAR, GETDATE(), 121) as now_str");
    console.log("GETDATE() now:", now.recordset[0].now_str);

    const future = await pool.request().query("SELECT COUNT(*) as cnt FROM audits WHERE createdAt > GETDATE()");
    console.log("Audits with createdAt in the future (vs GETDATE):", future.recordset[0].cnt);

    const [minMax] = (await pool.request().query("SELECT MIN(createdAt) as minC, MAX(createdAt) as maxC, COUNT(*) as total FROM audits")).recordset;
    console.log("Min/Max createdAt in table:", minMax);

    const sample = await pool.request().query("SELECT TOP 3 id, action, CONVERT(VARCHAR, createdAt, 121) as raw FROM audits WHERE createdAt > DATEADD(HOUR, 1, GETDATE()) ORDER BY createdAt DESC");
    console.log("Sample rows > 1hr in future:", sample.recordset);

    await pool.close();
};
run().catch(e => { console.error(e); process.exit(1); });
