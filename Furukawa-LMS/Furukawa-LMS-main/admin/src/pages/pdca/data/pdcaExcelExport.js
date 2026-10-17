import { PDCA_DEPARTMENTS } from './pdcaConstants.js';

async function getExcelJS() {
  const mod = await import('exceljs');
  return mod.Workbook ? mod : (mod.default || mod);
}

/**
 * Fetch image as arrayBuffer for embedding in ExcelJS
 */
async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    // If it's a base64 data URL
    if (url.startsWith('data:image/')) {
      const parts = url.split(',');
      if (parts.length < 2) return null;
      const mimeMatch = url.match(/data:image\/([a-zA-Z0-9]+);/);
      const ext = mimeMatch ? (mimeMatch[1].toLowerCase() === 'jpg' ? 'jpeg' : mimeMatch[1].toLowerCase()) : 'png';
      const base64Data = parts[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return { buffer: bytes.buffer, extension: ext === 'webp' ? 'png' : ext };
    }

    // Relative URL: resolve to full URL if needed
    const fullUrl = url.startsWith('http') ? url : (window.location.origin + (url.startsWith('/') ? '' : '/') + url);
    const res = await fetch(fullUrl, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    let ext = blob.type.split('/')[1]?.toLowerCase() || 'png';
    if (ext === 'jpg') ext = 'jpeg';
    if (ext === 'webp') ext = 'png';
    return { buffer: arrayBuffer, extension: ext };
  } catch (err) {
    console.warn('Could not fetch image for Excel embedding:', url, err);
    return null;
  }
}

/**
 * Export a single PDCA Sheet with complete data, styling, Excel dropdowns, and embedded images.
 */
export async function exportPDCASheetToExcel({ topic, sheet, rows: directRows, headerInfo: directHeaderInfo }) {
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Furukawa LMS';
  workbook.lastModifiedBy = 'Furukawa LMS';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetData = sheet || topic?.sheet || {};
  const headerInfo = directHeaderInfo || sheetData.headerInfo || {};
  const rows = directRows || sheetData.rows || [];

  const topicTitle = headerInfo.topicName || topic?.topic || 'PDCA Sheet';
  const preparedBy = headerInfo.preparedBy || topic?.createdBy?.name || '';
  const attendees = headerInfo.attendees || '';
  const auditNo = headerInfo.auditNo || '';
  const plant = topic?.plant || '';
  const id = topic?.id || '';

  const worksheet = workbook.addWorksheet('PDCA Audit Sheet', {
    views: [{ state: 'frozen', ySplit: 6 }] // Freeze header rows so they stay fixed while scrolling in Excel!
  });

  // Set up column definitions
  worksheet.columns = [
    { key: 'date', width: 14 },            // A
    { key: 'shift', width: 10 },           // B
    { key: 'sno', width: 8 },              // C
    { key: 'status', width: 15 },          // D
    { key: 'unit', width: 12 },            // E (Unit - Section P)
    { key: 'department', width: 16 },      // F
    { key: 'section', width: 18 },         // G
    { key: 'lineArea', width: 18 },        // H
    { key: 'observation', width: 35 },     // I
    { key: 'imageBefore', width: 22 },     // J
    { key: 'rootCause', width: 25 },       // K
    { key: 'counterMeasure', width: 28 },   // L
    { key: 'imageAfter', width: 22 },      // M
    { key: 'stdDurationMin', width: 18 },   // N (Std. Duration in min)
    { key: 'responseDate', width: 14 },    // O
    { key: 'noOfTimeRevised', width: 18 }, // P (No. of time Revised)
    { key: 'respUnit', width: 12 },        // Q (Unit - Section C)
    { key: 'respDept', width: 14 },        // R
    { key: 'respStaff', width: 24 },       // S
    { key: 'cft', width: 16 },             // T
    { key: 'remarks', width: 30 },         // U
  ];

  // Helper for applying cell border & font
  const applyCellStyle = (cell, { bg = 'FFFFFF', bold = false, size = 10, align = 'center', color = '000000', wrap = true } = {}) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bg.replace('#', '') }
    };
    cell.font = {
      name: 'Segoe UI',
      bold,
      size,
      color: { argb: color }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: align,
      wrapText: wrap
    };
    cell.border = {
      top: { style: 'thin', color: { argb: '94A3B8' } },
      left: { style: 'thin', color: { argb: '94A3B8' } },
      bottom: { style: 'thin', color: { argb: '94A3B8' } },
      right: { style: 'thin', color: { argb: '94A3B8' } }
    };
  };

  // Row 1: Main Title
  worksheet.mergeCells('A1:U1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `${topicTitle.toUpperCase()} ${id ? `[${id}]` : ''} ${plant ? `· Plant: ${plant}` : ''}`.trim();
  applyCellStyle(titleCell, { bg: 'FFFFFF', bold: true, size: 16, align: 'center', color: '1E293B' });
  worksheet.getRow(1).height = 36;

  // Row 2: 会議名 (Meeting Name) & 作成者 : (Prepared By)
  worksheet.mergeCells('A2:B2');
  const r2Label1 = worksheet.getCell('A2');
  r2Label1.value = '会議名 (Meeting)';
  applyCellStyle(r2Label1, { bg: 'FFFF99', bold: true, size: 10, align: 'center' });

  worksheet.mergeCells('C2:M2');
  const r2Val1 = worksheet.getCell('C2');
  r2Val1.value = topicTitle;
  applyCellStyle(r2Val1, { bg: 'FFFFFF', bold: true, size: 10, align: 'left' });

  worksheet.mergeCells('N2:O2');
  const r2Label2 = worksheet.getCell('N2');
  r2Label2.value = '作成者 (Prepared By)';
  applyCellStyle(r2Label2, { bg: 'FFFF99', bold: true, size: 10, align: 'center' });

  worksheet.mergeCells('P2:U2');
  const r2Val2 = worksheet.getCell('P2');
  r2Val2.value = preparedBy;
  applyCellStyle(r2Val2, { bg: 'FFFFFF', bold: false, size: 10, align: 'left' });
  worksheet.getRow(2).height = 24;

  // Row 3: 出席者 (Attendees) & 議事録No (Minutes / Audit No)
  worksheet.mergeCells('A3:B3');
  const r3Label1 = worksheet.getCell('A3');
  r3Label1.value = '出席者 (Attendees)';
  applyCellStyle(r3Label1, { bg: 'FFFF99', bold: true, size: 10, align: 'center' });

  worksheet.mergeCells('C3:M3');
  const r3Val1 = worksheet.getCell('C3');
  r3Val1.value = attendees;
  applyCellStyle(r3Val1, { bg: 'FFFFFF', bold: false, size: 10, align: 'left' });

  worksheet.mergeCells('N3:O3');
  const r3Label2 = worksheet.getCell('N3');
  r3Label2.value = '議事録No (Audit No)';
  applyCellStyle(r3Label2, { bg: 'FFFF99', bold: true, size: 10, align: 'center' });

  worksheet.mergeCells('P3:U3');
  const r3Val2 = worksheet.getCell('P3');
  r3Val2.value = auditNo;
  applyCellStyle(r3Val2, { bg: 'FFFFFF', bold: false, size: 10, align: 'left' });
  worksheet.getRow(3).height = 24;

  // Row 4: P D C A Phase Labels
  worksheet.mergeCells('A4:C4');
  applyCellStyle(worksheet.getCell('A4'), { bg: 'F1F5F9', bold: true });

  worksheet.mergeCells('D4:K4');
  const pCell = worksheet.getCell('D4');
  pCell.value = 'P (PLAN)';
  applyCellStyle(pCell, { bg: 'E2E8F0', bold: true, size: 12, align: 'center', color: '1E3A8A' });

  worksheet.mergeCells('L4:P4');
  const dCell = worksheet.getCell('L4');
  dCell.value = 'D (DO)';
  applyCellStyle(dCell, { bg: 'E2E8F0', bold: true, size: 12, align: 'center', color: '1E3A8A' });

  worksheet.mergeCells('Q4:T4');
  const cCell = worksheet.getCell('Q4');
  cCell.value = 'C (CHECK)';
  applyCellStyle(cCell, { bg: 'E2E8F0', bold: true, size: 12, align: 'center', color: '1E3A8A' });

  const aCell = worksheet.getCell('U4');
  aCell.value = 'A (ACT)';
  applyCellStyle(aCell, { bg: 'E2E8F0', bold: true, size: 12, align: 'center', color: '1E3A8A' });
  worksheet.getRow(4).height = 24;

  // Row 5: Primary Column Headers
  const colHeadersRow5 = [
    'Date *',
    'Shift *',
    'S.No',
    'Status *',
    'Unit',
    'Department',
    'Section',
    'Line / Area',
    'Observation *',
    'Image Before',
    'Root Cause',
    'Counter Measure',
    'Image After',
    'Std. Duration in min',
    'Response Date',
    'No. of time Revised',
    'Responsible Person Confirmation', '', '', '', // Q, R, S, T merged across 4 subcolumns
    '(Responsible person instructions, etc.)'
  ];

  const r5 = worksheet.getRow(5);
  r5.height = 24;
  colHeadersRow5.forEach((hdr, idx) => {
    const cell = r5.getCell(idx + 1);
    cell.value = hdr;
    applyCellStyle(cell, { bg: 'ECEFF1', bold: true, size: 10, align: 'center', color: '1E293B' });
  });
  worksheet.mergeCells('Q5:T5');

  // Row 6: Subheaders for Responsible Person (Unit / Dept / Staff / CFT)
  const r6 = worksheet.getRow(6);
  r6.height = 20;
  for (let c = 1; c <= 21; c++) {
    const cell = r6.getCell(c);
    applyCellStyle(cell, { bg: 'ECEFF1', bold: true, size: 9, align: 'center', color: '334155' });
  }
  // Set subheader labels
  r6.getCell(17).value = 'Unit';
  r6.getCell(18).value = 'Dept';
  r6.getCell(19).value = 'Staff Name';
  r6.getCell(20).value = 'CFT';

  // Merge rows 5 and 6 for non-subdivided columns
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'U'].forEach(col => {
    worksheet.mergeCells(`${col}5:${col}6`);
  });

  // Prepare Data Validation Dropdowns
  const deptListStr = `"${PDCA_DEPARTMENTS.join(',')}"`;
  const unitListStr = '"Bawal,Gujrat"';
  const statusListStr = '"Open,In - Progress,Closed,Delay"';
  const shiftListStr = '"A,B,C,General"';

  // Data Rows (Starting at row 7)
  let currentRowIdx = 7;
  const displayRows = (rows && rows.length > 0) ? rows : Array.from({ length: 10 }, () => ({}));

  for (let idx = 0; idx < displayRows.length; idx++) {
    const r = displayRows[idx] || {};
    const rowNum = currentRowIdx;
    const rowObj = worksheet.getRow(rowNum);
    rowObj.height = 75; // Ample height to cleanly display embedded images & multiple lines of text

    // A: Date
    const cellDate = rowObj.getCell(1);
    cellDate.value = r.date || '';
    applyCellStyle(cellDate, { align: 'center', size: 9 });

    // B: Shift
    const cellShift = rowObj.getCell(2);
    cellShift.value = r.shift || '';
    applyCellStyle(cellShift, { align: 'center', size: 9 });
    cellShift.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [shiftListStr]
    };

    // C: S.No
    const cellSno = rowObj.getCell(3);
    cellSno.value = idx + 1;
    applyCellStyle(cellSno, { align: 'center', size: 9, bold: true });

    // D: Status
    const cellStatus = rowObj.getCell(4);
    cellStatus.value = r.status || 'Open';
    applyCellStyle(cellStatus, {
      align: 'center',
      size: 9,
      bold: true,
      color: r.status === 'Closed' ? '15803D' : ((r.status === 'In Progress' || r.status === 'In - Progress') ? '2563EB' : 'D97706')
    });
    cellStatus.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [statusListStr]
    };

    // E: Unit (Section P)
    const cellUnitP = rowObj.getCell(5);
    cellUnitP.value = r.unit || '';
    applyCellStyle(cellUnitP, { align: 'center', size: 9 });
    cellUnitP.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [unitListStr]
    };

    // F: Department
    const cellDept = rowObj.getCell(6);
    cellDept.value = r.department || '';
    applyCellStyle(cellDept, { align: 'center', size: 9 });
    cellDept.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [deptListStr]
    };

    // G: Section
    const cellSec = rowObj.getCell(7);
    cellSec.value = r.section || '';
    applyCellStyle(cellSec, { align: 'center', size: 9 });

    // H: Line / Area
    const cellLine = rowObj.getCell(8);
    cellLine.value = r.lineArea || '';
    applyCellStyle(cellLine, { align: 'center', size: 9 });

    // I: Observation
    const cellObs = rowObj.getCell(9);
    cellObs.value = r.observation || '';
    applyCellStyle(cellObs, { align: 'left', size: 9 });

    // J: Image Before (placeholder text or image embedded below)
    const cellImgBefore = rowObj.getCell(10);
    cellImgBefore.value = '';
    applyCellStyle(cellImgBefore, { align: 'center', size: 8, color: '64748B' });

    // K: Root Cause
    const cellRoot = rowObj.getCell(11);
    cellRoot.value = r.rootCause || '';
    applyCellStyle(cellRoot, { align: 'left', size: 9 });

    // L: Counter Measure
    const cellCounter = rowObj.getCell(12);
    cellCounter.value = r.counterMeasure || '';
    applyCellStyle(cellCounter, { align: 'left', size: 9 });

    // M: Image After (placeholder text or image embedded below)
    const cellImgAfter = rowObj.getCell(13);
    cellImgAfter.value = '';
    applyCellStyle(cellImgAfter, { align: 'center', size: 8, color: '64748B' });

    // N: Std. Duration in min
    const cellDuration = rowObj.getCell(14);
    cellDuration.value = r.stdDurationMin !== undefined && r.stdDurationMin !== null && r.stdDurationMin !== ''
      ? Number(r.stdDurationMin)
      : (r.stdDuration ? Number(r.stdDuration) : '');
    applyCellStyle(cellDuration, { align: 'center', size: 9 });

    // O: Response Date
    const cellRespDate = rowObj.getCell(15);
    cellRespDate.value = r.responseDate || '';
    applyCellStyle(cellRespDate, { align: 'center', size: 9 });

    // P: No. of time Revised
    const cellRevised = rowObj.getCell(16);
    cellRevised.value = r.noOfTimeRevised !== undefined && r.noOfTimeRevised !== null && r.noOfTimeRevised !== ''
      ? Number(r.noOfTimeRevised)
      : (r.noOfTimesRevised !== undefined ? Number(r.noOfTimesRevised) : 0);
    applyCellStyle(cellRevised, { align: 'center', size: 9 });

    // Q: Unit (Section C / Responsible Person Confirmation)
    const cellUnitC = rowObj.getCell(17);
    cellUnitC.value = r.respUnit || r.responsiblePersonUnit || '';
    applyCellStyle(cellUnitC, { align: 'center', size: 9 });
    cellUnitC.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [unitListStr]
    };

    // R: Responsible Person Dept
    const cellRespDept = rowObj.getCell(18);
    cellRespDept.value = r.responsiblePersonDept || r.department || '';
    applyCellStyle(cellRespDept, { align: 'center', size: 9 });

    // S: Staff Employee
    const cellStaff = rowObj.getCell(19);
    cellStaff.value = r.staffEmployee || r.responsiblePersonConfirmation || '';
    applyCellStyle(cellStaff, { align: 'left', size: 9 });

    // T: CFT
    const cellCft = rowObj.getCell(20);
    cellCft.value = r.cftTopic || r.cftSelectedName || '';
    applyCellStyle(cellCft, { align: 'center', size: 9 });

    // U: Responsible Person Instruction / Confirmation
    const cellRemarks = rowObj.getCell(21);
    const confVal = r.confirmation || (r.responsiblePersonConfirmation === 'Confirmed' || r.responsiblePersonConfirmation === 'Not - Confirmed' ? r.responsiblePersonConfirmation : '');
    const otherRemarks = r.responsiblePersonConfirmation && r.responsiblePersonConfirmation !== 'Confirmed' && r.responsiblePersonConfirmation !== 'Not - Confirmed' ? r.responsiblePersonConfirmation : (r.remarks || '');
    cellRemarks.value = confVal ? (otherRemarks ? `${confVal} - ${otherRemarks}` : confVal) : (otherRemarks || '');
    applyCellStyle(cellRemarks, { align: 'center', size: 9 });

    // Embed Before Image if available (Column J is index 10, so 0-based col is 9.1)
    const beforeUrl = r.imageBefore || (Array.isArray(r.imagesBefore) && r.imagesBefore[0]?.url);
    if (beforeUrl) {
      try {
        const imgData = await fetchImageBuffer(beforeUrl);
        if (imgData) {
          const imageId = workbook.addImage({
            buffer: imgData.buffer,
            extension: imgData.extension
          });
          worksheet.addImage(imageId, {
            tl: { col: 9.1, row: rowNum - 1 + 0.1 },
            ext: { width: 110, height: 75 },
            editAs: 'oneCell'
          });
        } else {
          cellImgBefore.value = r.imageBeforeName || 'Before Photo Attached';
        }
      } catch (err) {
        cellImgBefore.value = r.imageBeforeName || 'Photo Attached';
      }
    } else {
      cellImgBefore.value = '-';
    }

    // Embed After Image if available (Column M is index 13, so 0-based col is 12.1)
    const afterUrl = r.imageAfter || (Array.isArray(r.imagesAfter) && r.imagesAfter[0]?.url);
    if (afterUrl) {
      try {
        const imgData = await fetchImageBuffer(afterUrl);
        if (imgData) {
          const imageId = workbook.addImage({
            buffer: imgData.buffer,
            extension: imgData.extension
          });
          worksheet.addImage(imageId, {
            tl: { col: 12.1, row: rowNum - 1 + 0.1 },
            ext: { width: 110, height: 75 },
            editAs: 'oneCell'
          });
        } else {
          cellImgAfter.value = r.imageAfterName || 'After Photo Attached';
        }
      } catch (err) {
        cellImgAfter.value = r.imageAfterName || 'Photo Attached';
      }
    } else {
      cellImgAfter.value = '-';
    }

    currentRowIdx++;
  }

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  const sanitizedTopic = (topicTitle || 'PDCA_Sheet').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `PDCA_Audit_Sheet_${id || 'Export'}_${sanitizedTopic}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Export summary table of multiple PDCA records matching current active filters (with Date filter, Unit filter, etc.)
 */
export async function exportPDCARecordsListToExcel({ records, activeTab, selectedPlant, selectedDate }) {
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Furukawa LMS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('PDCA Records', {
    views: [{ state: 'frozen', ySplit: 3 }]
  });

  worksheet.columns = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'PDCA ID', key: 'id', width: 22 },
    { header: 'Topic', key: 'topic', width: 34 },
    { header: 'Description', key: 'description', width: 38 },
    { header: 'Unit / Plant', key: 'plant', width: 14 },
    { header: 'Scope', key: 'scope', width: 14 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Section', key: 'section', width: 18 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Time', key: 'time', width: 12 },
    { header: 'Created By', key: 'createdBy', width: 24 },
    { header: 'Assigned Employees', key: 'assigned', width: 30 }
  ];

  // Title Row
  worksheet.spliceRows(1, 0, []);
  worksheet.spliceRows(1, 0, []);
  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `FME Portal — PDCA Records Export (${activeTab || 'Company'}) · Unit: ${selectedPlant || 'All Unit'}${selectedDate ? ` · Date: ${selectedDate}` : ''}`;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
  worksheet.getRow(1).height = 30;

  // Header styling
  const headerRow = worksheet.getRow(3);
  headerRow.height = 24;
  for (let c = 1; c <= 12; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { name: 'Segoe UI', bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // Populate rows
  (records || []).forEach((r, idx) => {
    const rowNum = idx + 4;
    const assignedStr = (r.assignedMembers || []).map(m => `${m.name} (${m.code})`).join(', ');
    const rowObj = worksheet.getRow(rowNum);
    rowObj.height = 22;

    const rowData = [
      idx + 1,
      r.id || '',
      r.topic || '',
      r.description || '',
      r.plant || '',
      r.scope || '',
      r.department || '',
      r.section || '',
      r.date || '',
      r.time || '',
      r.createdBy?.name ? `${r.createdBy.name} (${r.createdBy.code || ''})` : (r.createdByName || ''),
      assignedStr
    ];

    rowData.forEach((val, colIdx) => {
      const cell = rowObj.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Segoe UI', size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colIdx === 0 || colIdx === 4 || colIdx === 8 || colIdx === 9 ? 'center' : 'left'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  const dateSuffix = selectedDate ? `_${selectedDate}` : '';
  link.download = `PDCA_Records_${(activeTab || 'All')}_${(selectedPlant || 'All_Unit').replace(/\s+/g, '_')}${dateSuffix}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
