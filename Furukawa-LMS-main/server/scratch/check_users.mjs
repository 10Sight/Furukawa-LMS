import sql from "mssql";
const config = {
    user: "FME_USER", password: "StrongPassword123", database: "FME",
    server: "localhost", port: 1433,
    options: { encrypt: false, trustServerCertificate: true, useUTC: false }
};
const run = async () => {
    const pool = await sql.connect(config);
    
    const query = `
        SELECT TOP 20
            id,
            username,
            joiningDate,
            createdAt,
            CAST(createdAt AS DATE) as casted_created,
            COALESCE(joiningDate, CAST(createdAt AS DATE)) as coalesced_date,
            isTemporary,
            expectedHandover,
            isDeleted
        FROM users
        ORDER BY createdAt DESC
    `;
    const res = await pool.request().query(query);
    console.log("Latest users details:");
    console.table(res.recordset.map(r => ({
        id: r.id,
        username: r.username,
        joiningDate: r.joiningDate,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        casted_created: r.casted_created ? r.casted_created.toISOString() : null,
        coalesced_date: r.coalesced_date ? (r.coalesced_date instanceof Date ? r.coalesced_date.toISOString() : r.coalesced_date) : null,
        isTemporary: r.isTemporary,
        expectedHandover: r.expectedHandover ? r.expectedHandover.toISOString() : null,
        isDeleted: r.isDeleted
    })));

    await pool.close();
};
run().catch(e => { console.error(e); process.exit(1); });
