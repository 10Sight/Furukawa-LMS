import sql from "mssql";

const config = {
    user: "FME_USER", password: "StrongPassword123", database: "FME",
    server: "localhost", port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
    // useUTC intentionally omitted -- testing the actual default
};

const run = async () => {
    const pool = await sql.connect(config);
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tz_test4' and xtype='U')
        CREATE TABLE tz_test4 (id INT IDENTITY(1,1) PRIMARY KEY, createdAt DATETIME)
    `);

    const now = new Date();
    console.log("JS Date now (local IST):", now.toString());
    console.log("JS Date now (UTC):", now.toISOString());

    const insertReq = pool.request();
    insertReq.input("createdAt", now);
    const insertResult = await insertReq.query("INSERT INTO tz_test4 (createdAt) OUTPUT INSERTED.id VALUES (@createdAt)");
    const id = insertResult.recordset[0].id;

    const rawResult = await pool.request().input("id", id).query("SELECT CONVERT(VARCHAR, createdAt, 121) as raw_str, createdAt FROM tz_test4 WHERE id = @id");
    console.log("Raw stored string (DEFAULT useUTC):", rawResult.recordset[0].raw_str);
    const readBack = rawResult.recordset[0].createdAt;
    console.log("Read back toString:", readBack.toString());
    console.log("Matches original instant?", readBack.getTime() === now.getTime());

    await pool.request().query("DELETE FROM tz_test4 WHERE id = " + id);
    await pool.close();
};
run().catch(e => { console.error(e); process.exit(1); });
