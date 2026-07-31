import sql from "mssql";
const config = {
    user: "FME_USER", password: "StrongPassword123", database: "FME",
    server: "localhost", port: 1433,
    options: { encrypt: false, trustServerCertificate: true, useUTC: false }
};
const run = async () => {
    const pool = await sql.connect(config);
    
    // Check max dates in users
    const usersResult = await pool.request().query("SELECT MIN(createdAt) as minC, MAX(createdAt) as maxC, MIN(joiningDate) as minJ, MAX(joiningDate) as maxJ, COUNT(*) as total FROM users");
    console.log("Users date stats:", usersResult.recordset[0]);

    // Check max dates in attempted_quizzes
    const quizzesResult = await pool.request().query("SELECT MIN(completedAt) as minComp, MAX(completedAt) as maxComp, COUNT(*) as total FROM attempted_quizzes");
    console.log("Attempted quizzes date stats:", quizzesResult.recordset[0]);

    // Check max dates in handover_sheets
    const handoversResult = await pool.request().query("SELECT MIN(date) as minD, MAX(date) as maxD, COUNT(*) as total FROM handover_sheets");
    console.log("Handover sheets date stats:", handoversResult.recordset[0]);

    // Let's also check sample of latest users
    const latestUsers = await pool.request().query("SELECT TOP 5 id, username, joiningDate, createdAt FROM users ORDER BY createdAt DESC");
    console.log("Latest users:", latestUsers.recordset);

    // Let's also check sample of latest attempted quizzes
    const latestQuizzes = await pool.request().query("SELECT TOP 5 id, completedAt FROM attempted_quizzes ORDER BY completedAt DESC");
    console.log("Latest attempted quizzes:", latestQuizzes.recordset);

    await pool.close();
};
run().catch(e => { console.error(e); process.exit(1); });
