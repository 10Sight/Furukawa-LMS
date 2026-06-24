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
        0: { title: "OK in education training of operation contents but speed is no more than 74%", items: [{ id: 1, text: "Learnt the basic knowledge of process or not", method: "Confirm the education record" }, { id: 2, text: "The understanding test result is satisfying the standard or not", method: "Look in the understand test result of education record" }, { id: 3, text: "The operation method is correct with the standard or not", method: "Observe his operation by each product (type)" }, { id: 4, text: "Whether the operation is as operation-steps.", method: "Observe his operation by each product." }, { id: 5, text: "Whether he knows the inspection method, name of part, equipment, system", method: "Check the method of inspection at begin of operation" }, { id: 6, text: "Whether he knows the evaluation standard in operation (OK or NG product)", method: "Make question and hear his answer" }] },
        1: { title: "OK in education training of operation contents but speed is just 75-99%", items: [{ id: 1, text: "Whether he confirms the quality correctly?", method: "Observe the operation" }, { id: 2, text: "Whether his operation in charge is at least 75%?", method: "Measure the operation time" }, { id: 3, text: "Whether he can report the abnormality (Andon) correctly?", method: "Judge by operation observance and question" }, { id: 4, text: "Whether he changes the steps of operation or operation method by himself?", method: "Observe the operation" }] },
        2: { title: "Able to operation by himself (Speed & operation as the standard is OK)", items: [{ id: 1, text: "Whether he can operate in the standard time?", method: "Measure the operation time" }, { id: 2, text: "Whether he understand the judgement method & the treatment of the abnormality?", method: "Make question and fill the answer" }, { id: 3, text: "Whether he understand the operation standard and obey as it. Can he give the an idea of improvement?", method: "Observe the operation in over 2 cycles and make question to him about the improvement (Standard operation table)" }] },
        3: { title: "Able to teach other operators", items: [{ id: 1, text: "Whether the result in understanding test was over the standard", method: "Look in the understanding test result of education record" }, { id: 2, text: "Whether he understands the method of teaching", method: "Make questions about the teaching method and confirmation when teaching" }, { id: 3, text: "Whether he is good at confirmation about the understanding after teaching or in teaching", method: "Confirm the teaching method" }, { id: 4, text: "Can he change the teaching method belonging the level of operator (Understanding ability)?", method: "Confirm the teaching method" }, { id: 5, text: "Whether he understand the operation standard and obey as it.", method: "Confirm the teaching method and operation content (basing on the standard-operation-table)" }, { id: 6, text: "Whether he can operate in the standard time?", method: "Measure the operation time" }] }
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
    // L2: Whether he can report the abnormality (Andon) correctly? (sIdx=1, iIdx=2 -> '1-2')
    // L1: Speed is no more than 74% (sIdx=0, iIdx=2 -> '0-2')
    for (const key of ['3-5', '2-0', '1-2', '0-2']) {
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
    const efficiencyKeys = { 3: '3-5', 2: '2-0', 1: '1-2', 0: '0-2' };

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

export const getPeriodFromDate = (date = new Date()) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
};
