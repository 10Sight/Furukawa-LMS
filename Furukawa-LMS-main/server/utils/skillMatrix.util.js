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
        3: { title: "Able to teach other operators", items: [{ id: 1, text: "Whether the result in understanding test was over the standard", method: "Look in the understanding test result of education record" }, { id: 2, text: "Whether he understands the method of teaching", method: "Make questions about the teaching method and confirmation when teaching" }, { id: 3, text: "Whether he is good at confirmation about the understanding after teaching or in teaching", method: "Confirm the teaching method" }, { id: 4, text: "Can he change the teaching method belonging the level of operator (Understanding ability)?", method: "Confirm the teaching method" }, { id: 5, text: "Whether he understand the operation standard and obey as it.", method: "Confirm the teaching method and operation content (basing on the standard-operation-table)" }] }
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
    
    // Rule L4: Able to teach other operators (sIdx = 3)
    // All 5 questions ('3-0', '3-1', '3-2', '3-3', '3-4') must be OK
    const l4Keys = ['3-0', '3-1', '3-2', '3-3', '3-4'];
    const isL4Ok = l4Keys.every(k => parsed[k]?.standard === 'OK');
    if (isL4Ok) {
        return 100;
    }

    // Rule L3: Whether he can operate in the standard time? (sIdx = 2, iIdx = 0 -> '2-0')
    const l3Data = parsed['2-0'];
    if (l3Data?.standard === 'OK') {
        const val = parseFloat(l3Data.okVal);
        if (!isNaN(val)) return val;
    }

    // Rule L2: Whether his operation in charge is at least 75%? (sIdx = 1, iIdx = 1 -> '1-1')
    const l2Data = parsed['1-1'];
    if (l2Data?.standard === 'OK') {
        const val = parseFloat(l2Data.okVal);
        if (!isNaN(val)) return val;
    }

    // Rule L1: The operation method is correct with the standard or not (sIdx = 0, iIdx = 2 -> '0-2')
    const l1Data = parsed['0-2'];
    if (l1Data?.standard === 'OK') {
        const val = parseFloat(l1Data.okVal);
        if (!isNaN(val)) return val;
    }

    return 0;
};

export const computeEarnedLevel = (evalData, skillCertConfig, activeConfigLevels) => {
    const levels = skillCertConfig?.levels || {};
    let consecutiveOk = 0;

    for (let sIdx = 0; sIdx < activeConfigLevels.length; sIdx++) {
        const levelDef = levels[sIdx];
        if (!levelDef) break; // no more sections defined

        const items = levelDef.items || [];
        if (items.length === 0) break;

        const allOk = items.every((_, iIdx) =>
            evalData?.[`${sIdx}-${iIdx}`]?.standard === 'OK'
        );
        if (!allOk) break;
        consecutiveOk++;
    }

    if (consecutiveOk === 0) return null;
    return activeConfigLevels[consecutiveOk - 1]?.name || null;
};

export const getPeriodFromDate = (date = new Date()) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
};
