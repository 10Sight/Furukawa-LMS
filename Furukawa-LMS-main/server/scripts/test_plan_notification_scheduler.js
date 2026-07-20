/**
 * Test script for planNotificationScheduler.
 *
 * Runs the scheduler's row-scanning logic against the real DB and prints
 * which rows would trigger an email today, WITHOUT actually sending any mail.
 *
 * Usage (from server/ directory):
 *   node --experimental-vm-modules scripts/test_plan_notification_scheduler.js
 * Or via package.json script if configured.
 */

import { executeQuery } from '../db/mssqlHelper.js';

const QUARTERS = [
    { key: 'q1', label: 'Jan – Mar', dateKey: 'q1Date', actualKey: 'q1DateActual', statusKey: 'q1Status', skillKey: 'q1Skill' },
    { key: 'q2', label: 'Apr – Jun', dateKey: 'q2Date', actualKey: 'q2DateActual', statusKey: 'q2Status', skillKey: 'q2Skill' },
    { key: 'q3', label: 'Jul – Sep', dateKey: 'q3Date', actualKey: 'q3DateActual', statusKey: 'q3Status', skillKey: 'q3Skill' },
    { key: 'q4', label: 'Oct – Dec', dateKey: 'q4Date', actualKey: 'q4DateActual', statusKey: 'q4Status', skillKey: 'q4Skill' },
];

function getISTDate() {
    const now = new Date();
    const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return {
        today: istNow.toISOString().split('T')[0],
        currentYear: istNow.getUTCFullYear(),
    };
}

async function scanPlan(table, formName, today, currentYear) {
    console.log(`\n--- Scanning ${formName} (${table}) for date: ${today}, year: ${currentYear} ---`);

    const [plans] = await executeQuery(
        `SELECT id, departmentId, sectionId, tableData FROM ${table} WHERE year = ?`,
        [currentYear]
    );

    if (!plans || plans.length === 0) {
        console.log(`  No plans found for year ${currentYear}.`);
        return;
    }

    console.log(`  Found ${plans.length} plan record(s).`);
    let totalDue = 0;

    for (const plan of plans) {
        let tableData = {};
        try {
            tableData = typeof plan.tableData === 'string' ? JSON.parse(plan.tableData) : (plan.tableData || {});
        } catch (e) {
            console.error(`  [!] Failed to parse tableData for plan id=${plan.id}: ${e.message}`);
            continue;
        }

        const dueRows = [];

        for (const [userId, row] of Object.entries(tableData)) {
            if (userId === '__removedUserIds') continue;
            if (!row || typeof row !== 'object') continue;
            if (!row.userName && !row.cardNo) continue;

            for (const q of QUARTERS) {
                const plannedDate = row[q.dateKey];
                const actualDate = row[q.actualKey];
                const status = (row[q.statusKey] || '').toLowerCase();

                if (!plannedDate || plannedDate !== today) continue;
                if (actualDate) continue;
                if (status === 'completed') continue;

                dueRows.push({
                    userId,
                    userName: row.userName || '—',
                    cardNo: row.cardNo || '—',
                    quarter: q.label,
                    targetSkill: row[q.skillKey] || '—',
                    plannedDate,
                });
            }
        }

        if (dueRows.length > 0) {
            console.log(`\n  Dept ${plan.departmentId} (${plan.departmentName || 'N/A'}) | Section ${plan.sectionId || 'all'} (${plan.sectionName || 'N/A'})`);
            console.table(dueRows);
            totalDue += dueRows.length;
        }
    }

    console.log(`  Total due rows for ${formName}: ${totalDue}`);
}

async function run() {
    const { today, currentYear } = getISTDate();
    console.log(`\n[Test] PlanNotificationScheduler dry run`);
    console.log(`[Test] Today (IST): ${today}  |  Year: ${currentYear}\n`);

    try {
        await scanPlan('multi_skilling_plans', 'Multi Skill Sheet', today, currentYear);
        await scanPlan('skill_upgradation_plans', 'Skill Upgradation Sheet', today, currentYear);
        console.log('\n[Test] Done. No emails were sent.');
    } catch (err) {
        console.error('[Test] Error:', err.message);
    } finally {
        process.exit(0);
    }
}

run();
