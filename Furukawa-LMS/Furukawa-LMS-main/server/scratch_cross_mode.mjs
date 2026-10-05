import sql from "mssql";

const base = {
    user: "FME_USER", password: "StrongPassword123", database: "FME",
    server: "localhost", port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

const run = async () => {
    // Step 1: write a row the OLD way (useUTC:true, simulating pre-fix behavior)
    const poolTrue = await sql.connect({ ...base, options: { ...base.options, useUTC: true } });
    await poolTrue.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tz_test3' and xtype='U')
        CREATE TABLE tz_test3 (id INT IDENTITY(1,1) PRIMARY KEY, createdAt DATETIME)
    `);
    const trueNow = new Date();
    console.log("=== TRUE EVENT TIME ===");
    console.log("Local (IST):", trueNow.toString());
    console.log("UTC:", trueNow.toISOString());

    const insertReq = poolTrue.request();
    insertReq.input("createdAt", trueNow);
    const insertResult = await insertReq.query("INSERT INTO tz_test3 (createdAt) OUTPUT INSERTED.id VALUES (@createdAt)");
    const id = insertResult.recordset[0].id;

    const rawResult = await poolTrue.request().input("id", id).query("SELECT CONVERT(VARCHAR, createdAt, 121) as raw_str FROM tz_test3 WHERE id = @id");
    console.log("Raw stored string (written under useUTC:true):", rawResult.recordset[0].raw_str);
    await poolTrue.close();

    // Step 2: read that SAME row the NEW way (useUTC:false, matching today's connectDB.js)
    const poolFalse = await sql.connect({ ...base, options: { ...base.options, useUTC: false } });
    const readResult = await poolFalse.request().input("id2", id).query("SELECT createdAt FROM tz_test3 WHERE id = @id2");
    const misread = readResult.recordset[0].createdAt;
    console.log("\n=== READ TODAY (useUTC:false) OF THAT OLD ROW ===");
    console.log("Local (IST) as displayed by toLocaleString-equivalent:", misread.toString());
    console.log("UTC:", misread.toISOString());

    const diffMs = misread.getTime() - trueNow.getTime();
    console.log("\nDifference (misread - true) in hours:", diffMs / 1000 / 60 / 60);
    console.log("Is misread AFTER (future relative to) true event?", diffMs > 0);

    await poolFalse.request().query("DELETE FROM tz_test3 WHERE id = " + id);
    await poolFalse.close();
};
run().catch(e => { console.error(e); process.exit(1); });
