// Shared 16-Day Monitoring layout config helpers — used by both the sheet
// component (SixteenDayMonitoringSheet.jsx) and the dedicated layout editor
// (SixteenDayMonitoringLayoutEditor.jsx) so the two never drift apart on what
// a "config" shape looks like.

export const DEFAULT_MONITORING_CONFIG_16 = [
    {
        id: "cat1",
        category: "10 Cycle Check :\n1st time - 4 Part\n2nd time- 3 Part\n3rd time- 3 Part",
        rows: [
            { id: "row1_1", label: "Follow the work sequence according to the Work Instructions & Check the all check point as per WI\n(including finish condition confirmation)", weight: 2, type: "cycle" },
            { id: "row1_2", label: "Inspector should complete the Job in given cycle time", weight: 2, type: "cycle_detailed" },
            { id: "row1_3", label: "Adherence of 4'S (Sort, arrangement, clean, adherence)", weight: 2, type: "cycle" }
        ],
        totalMark: 6,
        target: "100%"
    },
    {
        id: "cat2",
        category: "Quality / System",
        rows: [
            { id: "row2_1", label: "Does he/she know the purpose of his/her work & impact at customer end", weight: 2 },
            { id: "row2_2", label: "Check an awareness of Inspector about defect in product & past defect in product", weight: 2 },
            { id: "row2_3", label: "Does he/she know OK & NG part judgment", weight: 2 },
            { id: "row2_4", label: "Does he/she know about NG part handling & adhere the rule STOP > CALL > WAIT", weight: 2 },
            { id: "row2_5", label: "Is there any mistake in using Andon?", weight: 2 }
        ],
        totalMark: 10,
        target: "100%"
    },
    {
        id: "cat3",
        category: "Defects captured (Defect must be captured 100% during the 16 day monitoring performance)",
        rows: [
            { id: "row3_1", label: "Actual defects", weight: "-" },
            { id: "row3_2", label: "Defects captured", weight: "-" }
        ],
        target: "100%",
        hasTargetInGrid: true
    },
    {
        id: "cat4",
        category: "Discipline",
        rows: [
            { id: "row4_1", label: "Attends the daily meeting with good level of listening and understanding .", weight: 2 },
            { id: "row4_2", label: "Inspector should aware about daily machine check point and do 5S on their station on daily basis before production start.", weight: 2 },
            { id: "row4_3", label: "Whenever if any defect or work related problem is their , he immediately contacts with line leader or his senior person with doing any delay or sitting idle.", weight: 2 },
            { id: "row4_4", label: "During any break operator clear the WIP Assy. Part from his / her station and move to next process, leave work station after completing the job.\nIs he/she adhare working hours and break timings?", weight: 2 }
        ],
        totalMark: 8,
        target: "(EXCELLENT - 100 %)"
    },
    {
        id: "cat5",
        category: "Safety",
        rows: [
            { id: "row5_1", label: "Does he/she adhere rules of 5 Principle of Safety and Gen. Safety", weight: 2 },
            { id: "row5_2", label: "Does he/she wear required PPEs as per PPE matrix", weight: 2 }
        ],
        totalMark: 4,
        target: "100%",
        actualLabel: "Actual % age followed"
    }
];

export const DEFAULT_SCORE_RANGES = [
    { id: 'score1', catId: 'cat1', label: '10 Cycle Check', weight: 0.4, poor: '70-80', avg: '81-90', good: '91-95', excel: '96-100' },
    { id: 'score2', catId: 'cat2', label: 'Quality / System', weight: 0.2, poor: '70-80', avg: '81-90', good: '91-95', excel: '96-100' },
    { id: 'score3', catId: 'cat3', label: 'Defect Captured', weight: 0.1, poor: '40-50', avg: '51-65', good: '66-80', excel: '100' },
    { id: 'score4', catId: 'cat4', label: 'Discipline', weight: 0.1, poor: '0-70', avg: '71-80', good: '81-90', excel: '91-100' },
    { id: 'score5', catId: 'cat5', label: 'Safety', weight: 0.1, poor: '30-35', avg: '36-47', good: '48-55', excel: '100' },
    { id: 'score6', catId: null, label: 'Attendance', weight: 0.1, poor: '50-75', avg: '76-85', good: '86-95', excel: '96-100' },
];

export const DEFAULT_EVALUATION_LEGENDS = {
    cycleTime: [
        { score: 0, label: 'Is > 20% of standard time' },
        { score: 1, label: '11% - 20% of standard time' },
        { score: 2, label: 'Fit & above of standard time' }
    ],
    otherCriteria: [
        { score: 0, label: 'Not known / Not adhere the rule' },
        { score: 1, label: 'Partially known / Partially adhere the rule' },
        { score: 2, label: 'Known / completely adhere the rule' }
    ]
};

// The scoring types a check-item row can have — drives how the printed sheet
// renders its Day 1-16 cells (10-reading + average vs. a single cell per day).
export const ROW_SCORING_TYPES = [
    { id: '', label: 'Standard (single score per day)' },
    { id: 'cycle', label: 'Cycle Check (10 readings + average per day)' },
    { id: 'cycle_detailed', label: 'Cycle Detailed (Target/Actual/Achievement/Score per day)' },
];

// Normalizes the full { categories, scoreRanges, evaluationLegends } config blob.
// Also upgrades older saved rows that stored just a bare categories array.
// Always returns fresh objects/arrays (never a shared reference to a default),
// so callers can safely hand the result to state without one scope's edits
// mutating another scope's in-memory config.
export const normalizeConfig = (raw) => {
    if (Array.isArray(raw)) {
        return {
            categories: raw.map(c => ({ ...c, rows: (c.rows || []).map(r => ({ ...r })) })),
            scoreRanges: DEFAULT_SCORE_RANGES.map(r => ({ ...r })),
            evaluationLegends: {
                cycleTime: DEFAULT_EVALUATION_LEGENDS.cycleTime.map(x => ({ ...x })),
                otherCriteria: DEFAULT_EVALUATION_LEGENDS.otherCriteria.map(x => ({ ...x })),
            },
        };
    }
    if (raw && typeof raw === 'object') {
        const categories = Array.isArray(raw.categories) && raw.categories.length > 0 ? raw.categories : DEFAULT_MONITORING_CONFIG_16;
        const scoreRanges = Array.isArray(raw.scoreRanges) && raw.scoreRanges.length > 0 ? raw.scoreRanges : DEFAULT_SCORE_RANGES;
        const cycleTime = Array.isArray(raw.evaluationLegends?.cycleTime) && raw.evaluationLegends.cycleTime.length > 0 ? raw.evaluationLegends.cycleTime : DEFAULT_EVALUATION_LEGENDS.cycleTime;
        const otherCriteria = Array.isArray(raw.evaluationLegends?.otherCriteria) && raw.evaluationLegends.otherCriteria.length > 0 ? raw.evaluationLegends.otherCriteria : DEFAULT_EVALUATION_LEGENDS.otherCriteria;
        return {
            categories: categories.map(c => ({ ...c, rows: (c.rows || []).map(r => ({ ...r })) })),
            scoreRanges: scoreRanges.map(r => ({ ...r })),
            evaluationLegends: {
                cycleTime: cycleTime.map(x => ({ ...x })),
                otherCriteria: otherCriteria.map(x => ({ ...x })),
            },
        };
    }
    return {
        categories: DEFAULT_MONITORING_CONFIG_16.map(c => ({ ...c, rows: c.rows.map(r => ({ ...r })) })),
        scoreRanges: DEFAULT_SCORE_RANGES.map(r => ({ ...r })),
        evaluationLegends: {
            cycleTime: DEFAULT_EVALUATION_LEGENDS.cycleTime.map(x => ({ ...x })),
            otherCriteria: DEFAULT_EVALUATION_LEGENDS.otherCriteria.map(x => ({ ...x })),
        },
    };
};

// Fresh default blob — always new object/array references.
export const buildDefaultConfig = () => normalizeConfig(DEFAULT_MONITORING_CONFIG_16);

export const computeTotalWeightage = (scoreRanges) =>
    scoreRanges.reduce((sum, row) => sum + (parseFloat(row.weight) || 0), 0);
