import { executeQuery } from "../db/mssqlHelper.js";
import User from "../models/auth.model.js";
import SkillUpgradationPlan from "../models/skillUpgradationPlan.model.js";

export const DEFAULT_SKILL_CONFIG = {
    headerDefaults: {
        processInCharge: '',
        resultPerson: ''
    },
    docDefaults: {
        docNo: 'FRM-HR-007',
        revNo: '02',
        revDate: '06/10/17',
        dateOfIssue: '04-02-2018'
    },
    levels: {
        0: {
            title: "OK in education training of operation contents but speed is no more than 74%",
            items: [
                { id: 1, text: "Learnt the basic knowledge of process or not", method: "Confirm the education record" },
                { id: 2, text: "The understanding test result is satisfying the standard or not", method: "Look in the understandard test result of education record" },
                { id: 3, text: "Whether his operation in charge is no more than 74%", method: "Measure the operation time", isSpeedCell: true },
                { id: 4, text: "The operation method is correct with the standard or not", method: "Observe his operation by each product (type)" },
                { id: 5, text: "Whether the operation is as operation-steps", method: "Observe his operation by each product" },
                { id: 6, text: "Whether he knows the inspection method, name of part, equipment, system", method: "Check the method of inspection at begin of operation" },
                { id: 7, text: "Whether he knows the evaluation standard in opoeration (OK or NG product)", method: "Make question and hear his answer" }
            ]
        },
        1: {
            title: "OK in education training of operation contents but speed is just 75-99%",
            items: [
                { id: 1, text: "Whether he confirms the quality correctly?", method: "Observe the operation" },
                { id: 2, text: "Whether his operation in charge is at least 75%?", method: "Measure the operation time", isSpeedCell: true },
                { id: 3, text: "Whether he can report the abnormality (Andon) correctly?", method: "Judge by operation observance and question" },
                { id: 4, text: "Whether he changes the steps of operation or operation method by himself?", method: "Observe the operation" }
            ]
        },
        2: {
            title: "Able to operation by himself (Speed & operation as the standard is OK)",
            items: [
                { id: 1, text: "Whether he can operate in the standard time?", method: "Measure the operation time", isSpeedCell: true },
                { id: 2, text: "Whether he understand the judgement method & the treatment of the abnormality?", method: "Make question and fill the answer" },
                { id: 3, text: "Whether he understand the operation standard and obey as it. Can he give the an idea of improvement?", method: "Observe the operation in over 2 cycles and make question to him about the improvement (Standard operation table)" },
                { id: 4, text: "Measure the ok% produce during shift production", method: "Check complete shift result and ok % 100" }
            ]
        },
        3: {
            title: "Able to teach other operators",
            items: [
                { id: 1, text: "Whether the result in understanding test was over the standard", method: "Look in the understanding test result of education record" },
                { id: 2, text: "Whether he understands the method of teaching", method: "Make questions about the teaching method and confirmation when teaching" },
                { id: 3, text: "Whether he is good at confirmation about the understanding after teaching or in teaching", method: "Confirm the teaching method" },
                { id: 4, text: "Can he change the teaching method belonging the level of operator (Understanding ability)?", method: "Confirm the teaching method" },
                { id: 5, text: "Whether he understand the operation standard and obey as it.", method: "Confirm the teaching method and operation content (basing on the standard-operation-table)" },
                { id: 6, text: "Whether he can operate in the standard time?", method: "Measure the operation time", isSpeedCell: true }
            ]
        }
    }
};

export const calculateUserEfficiency = (evalData) => {
    if (!evalData) return 0;
    let parsed = evalData;
    if (typeof evalData === 'string') {
        try {
            parsed = JSON.parse(evalData);
        } catch (e) {
            return 0;
        }
    }

    // L4: Whether he can operate in the standard time? (sIdx=3, iIdx=5 -> '3-5')
    // L3: Whether he can operate in the standard time? (sIdx=2, iIdx=0 -> '2-0')
    // L2: Whether his operation in charge is at least 75%? (sIdx=1, iIdx=1 -> '1-1')
    // L1: Speed is no more than 74% (sIdx=0, iIdx=2 -> '0-2')
    for (const key of ['3-5', '2-0', '1-1', '0-2']) {
        const d = parsed[key];
        if (d?.standard === 'OK') {
            const val = parseFloat(d.okVal);
            if (!isNaN(val)) return val;
        }
    }

    return 0;
};

export const computeEarnedLevel = (evalData, _skillCertConfig, activeConfigLevels) => {
    if (!evalData || !activeConfigLevels?.length) return null;

    // Efficiency key per level index (sIdx): the item where efficiency is entered.
    // Scan from highest to lowest — return the first level whose efficiency key is OK with a numeric value.
    const efficiencyKeys = { 3: '3-5', 2: '2-0', 1: '1-1', 0: '0-2' };

    for (let sIdx = activeConfigLevels.length - 1; sIdx >= 0; sIdx--) {
        const key = efficiencyKeys[sIdx];
        if (!key) continue;
        const d = evalData[key];
        if (d?.standard === 'OK' && !isNaN(parseFloat(d.okVal))) {
            return activeConfigLevels[sIdx]?.name || null;
        }
    }

    return null;
};

// Checks whether every item in a given level index has been evaluated as 'OK'.
// Used to gate level-up decisions to "the whole level was passed", not just one speed item.
export const isLevelFullyOK = (evalData, skillCertConfig, levelIdx) => {
    if (!evalData || levelIdx === null || levelIdx === undefined) return false;
    const items = skillCertConfig?.levels?.[levelIdx]?.items;
    if (!items || items.length === 0) return false;
    return items.every((_, iIdx) => evalData[`${levelIdx}-${iIdx}`]?.standard === 'OK');
};

// Mirrors admin/src/components/departments/SkillUpgradationPlan.jsx's addThreeMonths/calculateFutureDate
// so auto-synced plan dates land on the same day a manual admin edit would produce.
const addThreeMonths = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1 + 3, d);
    if (date.getDate() !== d) date.setDate(0);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const calculateFutureDate = (dateStr, dayCount) => {
    const count = parseInt(dayCount, 10);
    if (!Number.isFinite(count) || count <= 0) return addThreeMonths(dateStr);
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1, d + count);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const EMPTY_UPGRADATION_ROW = {
    userName: "", cardNo: "", shift: "", modelLine: "", station: "",
    q1Skill: "", q1Date: "", q1DateActual: "", q1Status: "",
    q2Skill: "", q2Date: "", q2DateActual: "", q2Status: "",
    q3Skill: "", q3Date: "", q3DateActual: "", q3Status: "",
    q4Skill: "", q4Date: "", q4DateActual: "", q4Status: "",
};

/**
 * Syncs a passed Skill Matrix Certificate evaluation into the student's Skill Upgradation
 * Plan row for the evaluation's department/section/year. The target quarter is derived from
 * the evaluation sheet's own `period` (e.g. "2026-Q2"), not by scanning for "the next open
 * quarter" — that keeps repeat saves of the same sheet idempotent (they overwrite the same
 * quarter slot) instead of cascading extra quarters forward on every save.
 */
export const syncToSkillUpgradationPlan = async ({ studentId, earnedLevelName, dateOfEvaluation, period, activeConfig }) => {
    if (!earnedLevelName || earnedLevelName === 'L0' || !activeConfig?.levels?.length) return;

    const evalDate = dateOfEvaluation && !isNaN(new Date(dateOfEvaluation).getTime())
        ? dateOfEvaluation
        : new Date().toISOString().slice(0, 10);
    const year = new Date(evalDate).getFullYear();

    const periodMatch = /^(\d{4})-Q([1-4])$/.exec(period || "");
    const quarter = periodMatch
        ? parseInt(periodMatch[2], 10)
        : Math.floor(new Date(evalDate).getMonth() / 3) + 1;

    const [uRows] = await executeQuery(
        "SELECT fullName, empId, departmentId, sectionId, subSectionId, lineId, shift FROM users WHERE id = ?",
        [studentId]
    );
    const user = uRows[0];
    if (!user || !user.departmentId) return;

    const [sRows] = await executeQuery(
        "SELECT skillUpgradationDayCount, skillUpgradationDayCounts FROM [sections] WHERE id = ?",
        [user.sectionId]
    );
    const sectionRow = sRows[0] || {};
    let perLevelDayCounts = {};
    if (sectionRow.skillUpgradationDayCounts) {
        try { perLevelDayCounts = JSON.parse(sectionRow.skillUpgradationDayCounts); } catch (e) { perLevelDayCounts = {}; }
    }

    const existingPlan = await SkillUpgradationPlan.findByHierarchy(user.departmentId, user.sectionId, year);
    const tableData = existingPlan ? { ...existingPlan.tableData } : {};

    const userKey = String(studentId);
    let row = tableData[userKey];
    if (!row) {
        let modelLine = "";
        let station = "";
        if (user.lineId) {
            const [lRows] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [user.lineId]);
            modelLine = lRows[0]?.name || "";
        }
        if (user.subSectionId) {
            const [ssRows] = await executeQuery("SELECT name FROM sub_sections WHERE id = ?", [user.subSectionId]);
            station = ssRows[0]?.name || "";
        }
        row = { ...EMPTY_UPGRADATION_ROW, userName: user.fullName || "", cardNo: user.empId || "", shift: user.shift || "", modelLine, station };
    }

    row[`q${quarter}DateActual`] = evalDate;
    row[`q${quarter}Skill`] = earnedLevelName;
    row[`q${quarter}Status`] = 'Completed';

    if (quarter < 4) {
        const earnedObj = activeConfig.levels.find(l => l.name.toUpperCase() === earnedLevelName.toUpperCase());
        const nextObj = earnedObj ? activeConfig.levels.find(l => l.order === earnedObj.order + 1) : null;

        if (nextObj) {
            const nextQ = quarter + 1;
            const nextAlreadyCompleted = row[`q${nextQ}Status`] === 'Completed';
            const existingNextObj = row[`q${nextQ}Skill`]
                ? activeConfig.levels.find(l => l.name.toUpperCase() === String(row[`q${nextQ}Skill`]).toUpperCase())
                : null;
            const wouldRegressPlan = existingNextObj && nextObj.order < existingNextObj.order;

            if (!nextAlreadyCompleted && !wouldRegressPlan) {
                const dayCount = perLevelDayCounts[earnedLevelName] ?? sectionRow.skillUpgradationDayCount ?? null;
                row[`q${nextQ}Skill`] = nextObj.name;
                row[`q${nextQ}Date`] = calculateFutureDate(evalDate, dayCount);
                row[`q${nextQ}Status`] = 'Planned';
            }
        }
    }

    tableData[userKey] = row;

    await SkillUpgradationPlan.upsert({
        departmentId: user.departmentId,
        sectionId: user.sectionId,
        year,
        selectedLines: existingPlan?.selectedLines || [],
        tableData,
        userName: "auto-sync",
    });
};

export const getPeriodFromDate = (date = new Date()) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
};

// Locates the "speed cell" item within a level's items — the one item whose okVal/ngVal
// carries the operator's measured efficiency. Mirrors admin/src/components/admin/SkillMatrixCertificate.jsx's
// getIsSpeedCell: prefer an explicit `isSpeedCell` flag on the item, else fall back to the
// legacy hardcoded (levelIdx -> item id) pairs baked into every default config.
const LEGACY_SPEED_CELL_ITEM_ID_BY_LEVEL = { 0: 3, 1: 2, 2: 1, 3: 6 };

export const getSpeedCellItemIndex = (levelIdx, items) => {
    if (!items || items.length === 0) return null;

    const explicitIdx = items.findIndex(it => it?.isSpeedCell === true);
    if (explicitIdx !== -1) return explicitIdx;

    const legacyId = LEGACY_SPEED_CELL_ITEM_ID_BY_LEVEL[levelIdx];
    if (legacyId === undefined) return null;
    const idx = items.findIndex(it => it?.id === legacyId);
    return idx !== -1 ? idx : null;
};

/**
 * Applies a computed efficiency + earned level to a student's record: updates
 * currentEffeciency/skillEffeciency, upgrades currentLevel/currentSkill when the earned
 * level outranks what's on file, mirrors the change into legacy skill_matrices entries, and
 * fires the handover/max-level notification hooks. Shared by the manual Skill Matrix
 * Certificate save flow and bulk imports so both paths apply identical business rules.
 */
export const syncStudentSkillProgress = async ({ studentId, subSectionId, calculatedEfficiency, earnedLevelName, activeConfig }) => {
    const student = await User.findById(studentId);
    if (!student) return { levelUpgraded: false };

    student.currentEffeciency = calculatedEfficiency;
    const targetSubSectionId = subSectionId || student.subSectionId || student.targetSubSectionId;

    if (targetSubSectionId) {
        const subSecKey = String(targetSubSectionId);
        let skillEffMap = student.skillEffeciency || {};
        if (typeof skillEffMap === 'string') {
            try { skillEffMap = JSON.parse(skillEffMap); } catch (e) { skillEffMap = {}; }
        }
        skillEffMap[subSecKey] = calculatedEfficiency;
        student.skillEffeciency = skillEffMap;
    }

    await student.save();

    let levelUpgraded = false;
    let newLevel = null;

    if (!earnedLevelName || !activeConfig?.levels?.length) {
        return { levelUpgraded, newLevel };
    }

    const currentGlobal = student.currentLevel || 'L0';
    let skillMap = student.currentSkill || {};
    if (typeof skillMap === 'string') {
        try { skillMap = JSON.parse(skillMap); } catch (e) { skillMap = {}; }
    }

    const currentLevelObj = activeConfig.levels.find(l => l.name.toUpperCase() === currentGlobal.toUpperCase());
    const currentLevelOrder = currentLevelObj ? currentLevelObj.order : -1;

    const earnedLevelObj = activeConfig.levels.find(l => l.name.toUpperCase() === earnedLevelName.toUpperCase());
    const earnedLevelOrder = earnedLevelObj ? earnedLevelObj.order : -1;

    let skillMapChanged = false;

    if (targetSubSectionId) {
        const subSecKey = String(targetSubSectionId);
        const currentSubSecSkill = skillMap[subSecKey] || 'L0';
        const currentSubSecSkillObj = activeConfig.levels.find(l => l.name.toUpperCase() === currentSubSecSkill.toUpperCase());
        const currentSubSecSkillOrder = currentSubSecSkillObj ? currentSubSecSkillObj.order : -1;

        if (earnedLevelOrder > currentSubSecSkillOrder) {
            skillMap[subSecKey] = earnedLevelName;
            skillMapChanged = true;
        }
    }

    const newGlobalOrder = Math.max(currentLevelOrder, earnedLevelOrder);
    const newGlobalLevelObj = activeConfig.levels.find(l => l.order === newGlobalOrder);
    const newGlobalLevelName = newGlobalLevelObj ? newGlobalLevelObj.name : earnedLevelName;

    if (newGlobalOrder > currentLevelOrder) {
        levelUpgraded = true;
        newLevel = newGlobalLevelName;
    }

    if (levelUpgraded || skillMapChanged) {
        await executeQuery(
            "UPDATE users SET currentLevel = ?, currentSkill = ?, updatedAt = GETDATE() WHERE id = ?",
            [newGlobalLevelName, JSON.stringify(skillMap), studentId]
        );

        if (levelUpgraded) {
            const { checkAndProcessHandover, checkAndProcessMaxLevelNotification } = await import("./handover.util.js");
            await checkAndProcessHandover(studentId, newGlobalLevelName);
            await checkAndProcessMaxLevelNotification(studentId, newGlobalLevelName);
        }
    }

    if (skillMapChanged && targetSubSectionId) {
        try {
            const matrixLevelName = earnedLevelName.includes('-') ? earnedLevelName : earnedLevelName.replace('L', 'L-');

            const [machinesInSubSec] = await executeQuery(
                "SELECT id FROM machines WHERE subSectionId = ?",
                [targetSubSectionId]
            );
            const machineIds = machinesInSubSec.map(m => String(m.id));

            if (machineIds.length > 0) {
                const studentIdStr = String(studentId);
                const [matchingMatrices] = await executeQuery(
                    `SELECT DISTINCT sm.id, sm.entries
                     FROM (SELECT id, entries FROM skill_matrices WHERE ISJSON(entries) = 1) sm
                     CROSS APPLY OPENJSON(sm.entries) WITH (userId NVARCHAR(50) '$.userId') je
                     WHERE je.userId = ?`,
                    [studentIdStr]
                );

                for (const matrix of matchingMatrices) {
                    let entriesList = matrix.entries;
                    try {
                        entriesList = typeof entriesList === 'string' ? JSON.parse(entriesList) : (entriesList || []);
                    } catch (e) {
                        entriesList = [];
                    }
                    if (!Array.isArray(entriesList)) continue;

                    let matrixChanged = false;
                    for (const entry of entriesList) {
                        const entryUserId = String(entry.userId || entry._id || "");
                        if (entryUserId === studentIdStr && entry.stations && Array.isArray(entry.stations)) {
                            for (const s of entry.stations) {
                                const stationIdStr = String(s.machineId || s._id || "");
                                if (machineIds.includes(stationIdStr) && s.curr !== matrixLevelName) {
                                    s.curr = matrixLevelName;
                                    matrixChanged = true;
                                }
                            }
                        }
                    }

                    if (matrixChanged) {
                        await executeQuery(
                            "UPDATE skill_matrices SET entries = ?, updatedAt = GETDATE() WHERE id = ?",
                            [JSON.stringify(entriesList), matrix.id]
                        );
                    }
                }
            }
        } catch (syncErr) {
            console.error("[syncStudentSkillProgress] Failed to auto-sync legacy skill matrices:", syncErr);
        }
    }

    return { levelUpgraded, newLevel, skillMap };
};
