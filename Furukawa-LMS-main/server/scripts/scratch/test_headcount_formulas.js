// Standalone check of the formula-injection logic added to
// NotificationService._fillAssociatesHeadcountSheet, using synthetic data (no DB, no live
// server module import) so it doesn't touch the real production database.
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const daysInMonth = 3;
const activeClubs = [{ id: 1, name: 'Assembly' }];

const rows = [
    { label: 'Headcount required as per production plan', bold: true },
    { type: 'spacer' },
    { label: 'Hiring Plan' },
    { type: 'spacer' },
    { label: 'Headcount available', bold: true },
    { label: `${activeClubs[0].name} Headcount available`, bg: 'blue-50' },
    { type: 'spacer' },
    { label: 'Separated (Cumulative)' },
    { label: 'Actual Separations (Cumulative)' },
    { label: 'Expected Separations (Cumulative)' },
    { label: 'Gap' },
    { type: 'spacer' },
    { label: 'Absent' },
    { label: `${activeClubs[0].name} absent`, bg: 'blue-50' },
    { type: 'spacer' },
    { label: 'Net Available Headcount Total', bold: true },
    { type: 'spacer' },
    { label: 'Absenteeism %', bold: true },
    { label: `${activeClubs[0].name} Absenteeism %`, bg: 'blue-50' },
    { type: 'spacer' },
    { label: 'Left in nos (Daily)' },
    { type: 'spacer' },
    { label: 'Shift-wise Breakdown of Available Manpower', bold: true, dataKey: 'Available_Total' },
    { label: 'A-Shift', dataKey: 'Available_A-Shift' },
    { type: 'spacer' },
    { label: 'Shift-wise Breakdown of Assigned Manpower', bold: true, dataKey: 'Assigned_Total' },
    { label: 'A-Shift', dataKey: 'Assigned_A-Shift' },
    { type: 'spacer' },
    { label: 'Shift-wise Attendance', bold: true, dataKey: 'Attendance_Total' },
    { label: 'A-Shift', dataKey: 'Attendance_A-Shift' },
];

// Synthetic tableData: day1=2026-01-01 .. day3=2026-01-03
// Deliberately mirrors headcountData.service.js's actual types: "Headcount available",
// club rows, and Available_*/Assigned_* are stored as STRINGS (String(x)), which is the real
// bug reported against the deployed sheet — a "0" string sorts as greater than the number 0
// in spreadsheet comparisons, so an unguarded `>0` check wrongly takes the division branch.
// Day 2's "Headcount available" is the string "0" specifically to reproduce that case.
const tableData = {
    'Headcount required as per production plan_2026-01-01': 50,
    'Headcount required as per production plan_2026-01-02': 50,
    'Headcount required as per production plan_2026-01-03': 50,
    'Net Available Headcount Total_2026-01-01': 40,
    'Net Available Headcount Total_2026-01-02': 0,
    'Net Available Headcount Total_2026-01-03': 45,
    'Hiring Plan_2026-01-01': 10,
    'Hiring Plan_2026-01-02': 0,
    'Hiring Plan_2026-01-03': 5,
    'Headcount available_2026-01-01': '48',
    'Headcount available_2026-01-02': '0',
    'Headcount available_2026-01-03': '46',
    'Absent_2026-01-01': '3',
    'Absent_2026-01-02': '2',
    'Absent_2026-01-03': '1',
    'Left in nos (Daily)_2026-01-01': 1,
    'Left in nos (Daily)_2026-01-02': 0,
    'Left in nos (Daily)_2026-01-03': 2,
    'Separated (Cumulative)_2026-01-01': 1,
    'Separated (Cumulative)_2026-01-02': 1,
    'Separated (Cumulative)_2026-01-03': 3,
    'Actual Separations (Cumulative)_2026-01-01': 1,
    'Actual Separations (Cumulative)_2026-01-02': 1,
    'Actual Separations (Cumulative)_2026-01-03': 3,
    'Expected Separations (Cumulative)_2026-01-01': 1,
    'Expected Separations (Cumulative)_2026-01-02': 2,
    'Expected Separations (Cumulative)_2026-01-03': 3,
    'Gap_2026-01-01': 0,
    'Absenteeism %_2026-01-01': '6.25',
    'Available_A-Shift_2026-01-01': 20, 'Assigned_A-Shift_2026-01-01': 15,
    'Available_Total_2026-01-01': 20, 'Assigned_Total_2026-01-01': 15,
};

const toDateKey = (day) => `2026-01-${String(day).padStart(2, '0')}`;

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Test');
worksheet.columns = [
    { header: 'Particulars', key: 'particulars', width: 40 },
    { header: 'Prev', key: 'prev', width: 10 },
    ...Array.from({ length: daysInMonth }, (_, i) => ({ header: `D${i + 1}`, key: toDateKey(i + 1), width: 10 })),
];

// day-name row (mimics step 7) so data rows start at row 3, matching the real function
worksheet.insertRow(1, ['']);

// step 9 equivalent: fill rows, track rowIndexMap
const rowIndexMap = {};
rows.forEach(item => {
    if (item.type === 'spacer') {
        worksheet.addRow({});
        return;
    }
    const rowKey = item.dataKey || item.label;
    const rowData = { particulars: item.label, prev: 0 };
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = toDateKey(day);
        const cellVal = tableData[`${rowKey}_${dateKey}`];
        if (cellVal === undefined || cellVal === null || cellVal === '') {
            rowData[dateKey] = 0;
        } else {
            const numVal = Number(cellVal);
            rowData[dateKey] = Number.isNaN(numVal) ? cellVal : numVal;
        }
    }
    const row = worksheet.addRow(rowData);
    rowIndexMap[rowKey] = row.number;
});

// step 10 equivalent: title row insertion shifts everything down by 1
worksheet.insertRow(1, ['TITLE']);

// step 11: exact logic copied from notification.service.js
Object.keys(rowIndexMap).forEach(key => { rowIndexMap[key] += 1; });

const colLetter = (colNumber) => {
    let letters = '';
    let n = colNumber;
    while (n > 0) {
        const rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
};

const setFormula = (rowNumber, colNumber, formula) => {
    if (!rowNumber) return;
    const cell = worksheet.getRow(rowNumber).getCell(colNumber);
    cell.value = { formula, result: cell.value };
};

const prodReqRow = rowIndexMap["Headcount required as per production plan"];
const netAvailTotalRow = rowIndexMap["Net Available Headcount Total"];
const hiringPlanRow = rowIndexMap["Hiring Plan"];
const dailyLeftRow = rowIndexMap["Left in nos (Daily)"];
const separatedCumRow = rowIndexMap["Separated (Cumulative)"];
const actualSepRow = rowIndexMap["Actual Separations (Cumulative)"];
const expectedSepRow = rowIndexMap["Expected Separations (Cumulative)"];
const gapRow = rowIndexMap["Gap"];
const headcountAvailRow = rowIndexMap["Headcount available"];
const absentRow = rowIndexMap["Absent"];
const absenteeismRow = rowIndexMap["Absenteeism %"];

for (let day = 1; day <= daysInMonth; day++) {
    const colNumber = day + 2;
    const L = colLetter(colNumber);
    const prevL = colLetter(colNumber - 1);

    if (hiringPlanRow && prodReqRow && netAvailTotalRow) {
        setFormula(hiringPlanRow, colNumber, `IF(N(${L}${netAvailTotalRow})=0,0,MAX(0,${L}${prodReqRow}-${L}${netAvailTotalRow}))`);
    }
    if (separatedCumRow && dailyLeftRow) {
        const formula = day === 1 ? `${L}${dailyLeftRow}` : `${prevL}${separatedCumRow}+${L}${dailyLeftRow}`;
        setFormula(separatedCumRow, colNumber, formula);
    }
    if (actualSepRow && separatedCumRow) setFormula(actualSepRow, colNumber, `${L}${separatedCumRow}`);
    if (gapRow && actualSepRow && expectedSepRow) setFormula(gapRow, colNumber, `${L}${actualSepRow}-${L}${expectedSepRow}`);
    if (absenteeismRow && headcountAvailRow && absentRow) {
        setFormula(absenteeismRow, colNumber, `IF(${L}${headcountAvailRow}>0,(${L}${absentRow}/${L}${headcountAvailRow})*100,0)`);
    }
}

activeClubs.forEach(club => {
    const clubHeadcountAvailRow = rowIndexMap[`${club.name} Headcount available`];
    const clubAbsentRow = rowIndexMap[`${club.name} absent`];
    const clubAbsenteeismRow = rowIndexMap[`${club.name} Absenteeism %`];
    if (!clubHeadcountAvailRow || !clubAbsentRow || !clubAbsenteeismRow) return;
    for (let day = 1; day <= daysInMonth; day++) {
        const colNumber = day + 2;
        const L = colLetter(colNumber);
        setFormula(clubAbsenteeismRow, colNumber, `IF(${L}${clubHeadcountAvailRow}>0,(${L}${clubAbsentRow}/${L}${clubHeadcountAvailRow})*100,0)`);
    }
});

['Total', 'A-Shift'].forEach(shiftSuffix => {
    const availRow = rowIndexMap[`Available_${shiftSuffix}`];
    const assignedRow = rowIndexMap[`Assigned_${shiftSuffix}`];
    const attendanceRow = rowIndexMap[`Attendance_${shiftSuffix}`];
    if (!availRow || !assignedRow || !attendanceRow) return;
    for (let day = 1; day <= daysInMonth; day++) {
        const colNumber = day + 2;
        const L = colLetter(colNumber);
        setFormula(attendanceRow, colNumber, `IF(${L}${availRow}>0,(${L}${assignedRow}/${L}${availRow})*100,0)`);
    }
});

// --- Write to file and read back, like Excel would, to confirm formulas persist ---
const outPath = path.join(__dirname, 'test_headcount_formulas_out.xlsx');
await workbook.xlsx.writeFile(outPath);

const readBack = new ExcelJS.Workbook();
await readBack.xlsx.readFile(outPath);
const ws2 = readBack.getWorksheet('Test');

let failures = 0;
const check = (label, rowNumber, colNumber, expectedFormula, expectedResult) => {
    const cell = ws2.getRow(rowNumber).getCell(colNumber);
    const ok = cell.formula === expectedFormula && String(cell.result) === String(expectedResult);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: row=${rowNumber} col=${colNumber} formula="${cell.formula}" result=${cell.result}`);
    if (!ok) failures++;
};

// Day 1 = col 3, Day 2 = col 4 (the zero-Net-Available day), Day 3 = col 5
check('Hiring Plan day1 (normal)', hiringPlanRow, 3, 'IF(N(C' + netAvailTotalRow + ')=0,0,MAX(0,C' + prodReqRow + '-C' + netAvailTotalRow + '))', 10);
check('Hiring Plan day2 (zero-guard)', hiringPlanRow, 4, 'IF(N(D' + netAvailTotalRow + ')=0,0,MAX(0,D' + prodReqRow + '-D' + netAvailTotalRow + '))', 0);
check('Separated Cumulative day1', separatedCumRow, 3, 'C' + dailyLeftRow, 1);
check('Separated Cumulative day2', separatedCumRow, 4, 'C' + separatedCumRow + '+D' + dailyLeftRow, 1);
check('Actual Separations day1', actualSepRow, 3, 'C' + separatedCumRow, 1);
check('Gap day1', gapRow, 3, 'C' + actualSepRow + '-C' + expectedSepRow, 0);
check('Absenteeism % day1', absenteeismRow, 3, 'IF(C' + headcountAvailRow + '>0,(C' + absentRow + '/C' + headcountAvailRow + ')*100,0)', '6.25');

const clubAbsenteeismRow = rowIndexMap[`${activeClubs[0].name} Absenteeism %`];
const clubHeadcountAvailRow = rowIndexMap[`${activeClubs[0].name} Headcount available`];
const clubAbsentRow = rowIndexMap[`${activeClubs[0].name} absent`];
check('Club Absenteeism % day1', clubAbsenteeismRow, 3, 'IF(C' + clubHeadcountAvailRow + '>0,(C' + clubAbsentRow + '/C' + clubHeadcountAvailRow + ')*100,0)', 0);

const attendanceTotalRow = rowIndexMap['Attendance_Total'];
const availTotalRow = rowIndexMap['Available_Total'];
const assignedTotalRow = rowIndexMap['Assigned_Total'];
check('Shift Attendance Total day1', attendanceTotalRow, 3, 'IF(C' + availTotalRow + '>0,(C' + assignedTotalRow + '/C' + availTotalRow + ')*100,0)', 0);

// --- The actual reported bug: "Headcount available" was a STRING ("48", "0", "46") in the
// source data (matching headcountData.service.js's String(x) storage). Confirm the fix wrote
// it as a real ExcelJS number type (ValueType.Number = 2), not a string (ValueType.String = 3)
// — a string "0" sorts greater than the number 0 in spreadsheet comparisons, which is exactly
// what caused Absenteeism %'s `>0` guard to wrongly take the division branch and divide by it.
const headcountAvailCellDay1 = ws2.getRow(headcountAvailRow).getCell(3);
const headcountAvailCellDay2 = ws2.getRow(headcountAvailRow).getCell(4);
const isNumberType = (cell) => cell.type === ExcelJS.ValueType.Number;
console.log(`${isNumberType(headcountAvailCellDay1) ? 'PASS' : 'FAIL'} Headcount available day1 is a real number (type=${headcountAvailCellDay1.type}, value=${headcountAvailCellDay1.value})`);
console.log(`${isNumberType(headcountAvailCellDay2) ? 'PASS' : 'FAIL'} Headcount available day2 ("0" string in source) is a real number (type=${headcountAvailCellDay2.type}, value=${headcountAvailCellDay2.value})`);
if (!isNumberType(headcountAvailCellDay1)) failures++;
if (!isNumberType(headcountAvailCellDay2)) failures++;

// And with a real numeric 0, Absenteeism %'s guard now correctly skips the division on day 2.
check('Absenteeism % day2 (zero-denominator guard)', absenteeismRow, 4, 'IF(D' + headcountAvailRow + '>0,(D' + absentRow + '/D' + headcountAvailRow + ')*100,0)', 0);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
