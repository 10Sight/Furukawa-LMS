import sql from "mssql";
const config = {
    user: "FME_USER", password: "StrongPassword123", database: "FME",
    server: "localhost", port: 1433,
    options: { encrypt: false, trustServerCertificate: true, useUTC: false }
};
const run = async () => {
    const pool = await sql.connect(config);
    
    // Test the exact SQL query executed for daily dojo hiring trend
    const periodExpr = "FORMAT(COALESCE(joiningDate, CAST(createdAt AS DATE)), 'yyyy-MM-dd')";
    const start = "2026-07-01";
    const end = "2026-07-31";
    
    const query = `
        SELECT
            ${periodExpr}                                                               AS period,
            COUNT(*)                                                                    AS total,
            SUM(CASE WHEN gender = 'MALE'   THEN 1 ELSE 0 END)                         AS maleCount,
            SUM(CASE WHEN gender = 'FEMALE' THEN 1 ELSE 0 END)                         AS femaleCount,
            SUM(CASE WHEN gender NOT IN ('MALE','FEMALE') OR gender IS NULL THEN 1 ELSE 0 END) AS otherCount
        FROM users
        WHERE (expectedHandover IS NOT NULL OR isTemporary = 1)
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND COALESCE(joiningDate, CAST(createdAt AS DATE)) >= @start
          AND COALESCE(joiningDate, CAST(createdAt AS DATE)) <= @end
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `;
    const request = pool.request();
    request.input("start", start);
    request.input("end", end);
    const res = await request.query(query);
    console.log("Trend rows returned by SQL:");
    console.table(res.recordset);

    await pool.close();
};
run().catch(e => { console.error(e); process.exit(1); });
