import { executeQuery } from "../db/mssqlHelper.js";
import 'dotenv/config';

async function main() {
    try {
        console.log("=== Benchmarking user.controller.js counts query ===");

        const originalJoin = `
            OUTER APPLY (
                SELECT TOP 1 ss.id as subSectionId, ss.name as subSectionName, ss.lineId as ssLineId 
                FROM sub_sections ss 
                WHERE ss.id = COALESCE(u.subSectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END))
            ) ss_res
            OUTER APPLY (
                SELECT TOP 1 l.id as lineId, l.name as lineName, l.sectionId as lSectionId, l.department as lDeptId
                FROM [lines] l 
                WHERE l.id = COALESCE(u.lineId, (CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END), ss_res.ssLineId)
            ) l_res
            OUTER APPLY (
                SELECT TOP 1 s.id as sectionId, s.name as sectionName, s.departmentId as sDeptId
                FROM [sections] s 
                WHERE s.id = COALESCE(u.sectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END), l_res.lSectionId)
            ) s_res
            OUTER APPLY (
                SELECT TOP 1 d.id, d.name as deptName, d.instructor as deptInstructor
                FROM departments d 
                WHERE d.id = COALESCE(u.departmentId, (CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END), s_res.sDeptId, l_res.lDeptId)
                   OR (u.departmentId IS NULL AND u.targetDeptId IS NULL AND (u.department = d.name OR TRY_CAST(u.department AS INT) = d.id))
            ) d
            OUTER APPLY (
                SELECT TOP 1 name as stationName FROM machines 
                WHERE id = COALESCE(u.stationId, (CASE WHEN u.isTemporary = 1 THEN u.targetStationId ELSE NULL END))
            ) st
            OUTER APPLY (
                SELECT TOP 1 name as contractorName FROM contractors 
                WHERE id = u.contractorId
            ) c_res
        `;

        const optimizedJoin = `
            OUTER APPLY (
                SELECT TOP 1 ss.id as subSectionId, ss.name as subSectionName, ss.lineId as ssLineId 
                FROM sub_sections ss 
                WHERE ss.id = COALESCE(u.subSectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END))
            ) ss_res
            OUTER APPLY (
                SELECT TOP 1 l.id as lineId, l.name as lineName, l.sectionId as lSectionId, l.department as lDeptId
                FROM [lines] l 
                WHERE l.id = COALESCE(u.lineId, (CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END), ss_res.ssLineId)
            ) l_res
            OUTER APPLY (
                SELECT TOP 1 s.id as sectionId, s.name as sectionName, s.departmentId as sDeptId
                FROM [sections] s 
                WHERE s.id = COALESCE(u.sectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END), l_res.lSectionId)
            ) s_res
            OUTER APPLY (
                SELECT TOP 1 d.id, d.name as deptName, d.instructor as deptInstructor
                FROM departments d 
                WHERE d.id = COALESCE(u.departmentId, (CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END), s_res.sDeptId, l_res.lDeptId)
                   OR (u.departmentId IS NULL AND u.targetDeptId IS NULL AND u.department = d.name)
            ) d
            OUTER APPLY (
                SELECT TOP 1 name as stationName FROM machines 
                WHERE id = COALESCE(u.stationId, (CASE WHEN u.isTemporary = 1 THEN u.targetStationId ELSE NULL END))
            ) st
            OUTER APPLY (
                SELECT TOP 1 name as contractorName FROM contractors 
                WHERE id = u.contractorId
            ) c_res
        `;

        const queryTemplate = (joinSql) => `
            SELECT
                SUM(CASE WHEN al.logStatus = 'Present' AND (u.status IS NULL OR u.status != 'LEFT' OR TRY_CONVERT(date, ISNULL(u.leavingDate, u.updatedAt)) > '2026-07-24') THEN 1 ELSE 0 END) as presentCount,
                SUM(CASE WHEN (al.logStatus != 'Present' OR al.userId IS NULL) AND (u.status IS NULL OR u.status != 'LEFT' OR TRY_CONVERT(date, ISNULL(u.leavingDate, u.updatedAt)) > '2026-07-24') THEN 1 ELSE 0 END) as absentCount,
                SUM(CASE WHEN u.status = 'LEFT' THEN 1 ELSE 0 END) as leftCount
            FROM users u
            ${joinSql}
            LEFT JOIN (
                SELECT userId, MAX(status) as logStatus, MAX(shift) as logShift FROM attendance_logs 
                WHERE date = '2026-07-24' GROUP BY userId
            ) al ON u.id = al.userId
            WHERE u.isDeleted = 0 OR u.isDeleted IS NULL
        `;

        // Test 1: Original Join
        const start1 = Date.now();
        const [res1] = await executeQuery(queryTemplate(originalJoin));
        console.log(`Original counts query time: ${Date.now() - start1}ms | presentCount=${res1[0]?.presentCount}`);

        // Test 2: Optimized Join
        const start2 = Date.now();
        const [res2] = await executeQuery(queryTemplate(optimizedJoin));
        console.log(`Optimized counts query time: ${Date.now() - start2}ms | presentCount=${res2[0]?.presentCount}`);

    } catch (err) {
        console.error("Error executing query:", err);
    }
    process.exit(0);
}

main();
