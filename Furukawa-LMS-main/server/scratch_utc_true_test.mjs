import sql from "mssql";

const configTrue = {
    user: "FME_USER", password: "StrongPassword123", database: "FME",
    server: "localhost", port: 1433,
    options: { encrypt: false, trustServerCertificate: true, useUTC: true }
};

const run = async () => {
    const pool = await sql.connect(configTrue);
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tz_test2' and xtype='U')
        CREATE TABLE tz_test2 (id INT IDENTITY(1,1) PRIMARY KEY, createdAt DATETIME)
    `);

    const now = new Date();
    console.log("JS Date now (local IST):", now.toString());
    console.log("JS Date now (UTC):", now.toISOString());

    const insertReq = pool.request();
    insertReq.input("createdAt", now);
    const insertResult = await insertReq.query("INSERT INTO tz_test2 (createdAt) OUTPUT INSERTED.id VALUES (@createdAt)");
    const id = insertResult.recordset[0].id;

    const rawResult = await pool.request().input("id", id).query("SELECT CONVERT(VARCHAR, createdAt, 121) as raw_str FROM tz_test2 WHERE id = @id");
    console.log("Raw stored string with useUTC:true:", rawResult.recordset[0].raw_str);

    // Now read it back through the SAME useUTC:true connection
    const readResult = await pool.request().input("id2", id).query("SELECT createdAt FROM tz_test2 WHERE id = @id2");
    const readBack = readResult.recordset[0].createdAt;
    console.log("Read back (useUTC:true) toString:", readBack.toString());
    console.log("Read back (useUTC:true) toISOString:", readBack.toISOString());
    console.log("Matches original instant?", readBack.getTime() === now.getTime());

    await pool.request().query("DELETE FROM tz_test2 WHERE id = " + id);
    await pool.close();

    // Now read the SAME raw stored pattern via a useUTC:false connection to see cross-mode misinterpretation
    const configFalse = { ...configTrue, options: { ...configTrue.options, useUTC: false } };
    const pool2 = await sql.connect(configFalse);
    await pool2.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tz_test2' and xtype='U')
        CREATE TABLE tz_test2 (id INT IDENTITY(1,1) PRIMARY KEY, createdAt DATETIME)
    `);
    const insertReq2 = pool2.request();
    // reuse same instant
    insertReq2.input("createdAt", now);
    // NOTE: this pool has useUTC:false, so this simulates writing under false then we won't use it here.
    await pool2.close();
};
run().catch(e => { console.error(e); process.exit(1); });
