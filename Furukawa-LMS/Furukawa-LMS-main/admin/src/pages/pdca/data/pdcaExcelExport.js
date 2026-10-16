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
    { key: 'department', width: 16 },      // E
    { key: 'section', width: 18 },         // F
    { key: 'lineArea', width: 18 },        // G
    { key: 'observation', width: 35 },     // H
    { key: 'imageBefore', width: 22 },     // I
    { key: 'rootCause', width: 25 },       // J
    { key: 'counterMeasure', width: 28 },   // K
    { key: 'imageAfter', width: 22 },      // L
    { key: 'responseDate', width: 14 },    // M
    { key: 'respDept', width: 14 },        // N
    { key: 'respStaff', width: 24 },       // O
    { key: 'cft', width: 16 },             // P
    { key: 'remarks', width: 30 },         // Q
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
  worksheet.mergeCells('A1:Q1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `${topicTitle.toUpperCase()} ${id ? `[${id}]` : ''} ${plant ? `· Plant: ${plant}` : ''}`.trim();
  applyCellStyle(titleCell, { bg: 'FFFFFF', bold: true, size: 16, align: 'center', color: '1E293B' });
  worksheet.getRow(1).height = 36;

  // Row 2: 会議名 (Meeting Name) & 作成者 : (Prepared By)
  worksheet.mergeCells('A2:B2');
  const r2Label1 = worksheet.getCell('A2');
  r2Label1.value = '会議名 (Meeting)';
  applyCellStyle(r2Label1, { bg: 'FFFF99', bold: true, size: 10, align: 'center' });

  worksheet.mergeCells('C2:K2');
  const r2Val1 = worksheet.getCell('C2');
  r2Val1.value = topicTitle;
  applyCellStyle(r2Val1, { bg: 'FFFFFF', bold: true, size: 10, align: 'left' });

  worksheet.mergeCells('L2:M2');
  const r2Label2 = worksheet.getCell('L2');
  r2Label2.value = '作成者 (Prepared By)';
  applyCellStyle(r2Label2, { bg: 'FFFF99', bold: true, size: 10, align: 'center' });

  worksheet.mergeCells('N2:Q2');
  const r2Val2 = worksheet.getCell('N2');
  r2Val2.value = preparedBy;
  applyCellStyle(r2Val2, { bg: 'FFFFFF', bold: false, size: 10, align: 'left' });
  worksheet.getRow(2).height = 24;

  // Row 3: 出席者 (Attendees) & 議事録No (Minutes / Audit No)
  worksheet.mergeCells('A3:B3');
  const r3Label1 = worksheet.getCell('A3');
  r3Label1.value = '出席者 (Attendees)';
  applyCellStyle(r3Label1, { bg: 'FFFF99', bold: true, size: 10, align: 'center' });

  worksheet.mergeCells('C3:K3');
  const r3Val1 = worksheet.getCell('C3');
  r3Val1.value = attendees;
  applyCellStyle(r3Val1, { bg: 'FFFFFF', bold: false, size: 10, align: 'left' });

  worksheet.mergeCells('L3:M3');
  const r3Label2 = worksheet.getCell('L3');
  r3Label2.value = '議事録No (Audit No)';
  applyCellStyle(r3Label2, { bg: 'FFFF99', bold: true, size: 10, align: 'center' });

  worksheet.mergeCells('N3:Q3');
  const r3Val2 = worksheet.getCell('N3');
  r3Val2.value = auditNo;
  applyCellStyle(r3Val2, { bg: 'FFFFFF', bold: false, size: 10, align: 'left' });
  worksheet.getRow(3).height = 24;

  // Row 4: P D C A Phase Labels
  worksheet.mergeCells('A4:C4');
  applyCellStyle(worksheet.getCell('A4'), { bg: 'F1F5F9', bold: true });

  worksheet.mergeCells('D4:J4');
  const pCell = worksheet.getCell('D4');
  pCell.value = 'P (PLAN)';
  applyCellStyle(pCell, { bg: 'E2E8F0', bold: true, size: 12, align: 'center', color: '1E3A8A' });

  worksheet.mergeCells('K4:M4');
  const dCell = worksheet.getCell('K4');
  dCell.value = 'D (DO)';
  applyCellStyle(dCell, { bg: 'E2E8F0', bold: true, size: 12, align: 'center', color: '1E3A8A' });

  worksheet.mergeCells('N4:P4');
  const cCell = worksheet.getCell('N4');
  cCell.value = 'C (CHECK)';
  applyCellStyle(cCell, { bg: 'E2E8F0', bold: true, size: 12, align: 'center', color: '1E3A8A' });

  const aCell = worksheet.getCell('Q4');
  aCell.value = 'A (ACT)';
  applyCellStyle(aCell, { bg: 'E2E8F0', bold: true, size: 12, align: 'center', color: '1E3A8A' });
  worksheet.getRow(4).height = 24;

  // Row 5: Primary Column Headers
  const colHeadersRow5 = [
    'Date *',
    'Shift *',
    'S.No',
    'Status *',
    'Department',
    'Section',
    'Line / Area',
    'Observation *',
    'Image Before',
    'Root Cause',
    'Counter Measure',
    'Image After',
    'Response Date',
    'Responsible Person Confirmation', '', '', // N, O, P merged across 3 subcolumns
    '(Responsible person instructions, etc.)'
  ];

  const r5 = worksheet.getRow(5);
  r5.height = 24;
  colHeadersRow5.forEach((hdr, idx) => {
    const cell = r5.getCell(idx + 1);
    cell.value = hdr;
    applyCellStyle(cell, { bg: 'ECEFF1', bold: true, size: 10, align: 'center', color: '1E293B' });
  });
  worksheet.mergeCells('N5:P5');

  // Row 6: Subheaders for Responsible Person (Dept / Staff / CFT)
  const r6 = worksheet.getRow(6);
  r6.height = 20;
  for (let c = 1; c <= 17; c++) {
    const cell = r6.getCell(c);
    applyCellStyle(cell, { bg: 'ECEFF1', bold: true, size: 9, align: 'center', color: '334155' });
  }
  // Set subheader labels
  r6.getCell(14).value = 'Dept';
  r6.getCell(15).value = 'Staff Name';
  r6.getCell(16).value = 'CFT';

  // Merge rows 5 and 6 for non-subdivided columns
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'Q'].forEach(col => {
    worksheet.mergeCells(`${col}5:${col}6`);
  });

  // Prepare Data Validation Dropdowns
  const deptListStr = `"${PDCA_DEPARTMENTS.join(',')}"`;
  const statusListStr = '"Open,In Progress,Closed,Pending"';
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
      color: r.status === 'Closed' ? '15803D' : (r.status === 'In Progress' ? '2563EB' : 'D97706')
    });
    cellStatus.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [statusListStr]
    };

    // E: Department & Unit
    const cellDept = rowObj.getCell(5);
    cellDept.value = r.unit ? (r.department ? `${r.department} (${r.unit})` : r.unit) : (r.department || '');
    applyCellStyle(cellDept, { align: 'center', size: 9 });
    cellDept.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [deptListStr]
    };

    // F: Section
    const cellSec = rowObj.getCell(6);
    cellSec.value = r.section || '';
    applyCellStyle(cellSec, { align: 'center', size: 9 });

    // G: Line / Area
    const cellLine = rowObj.getCell(7);
    cellLine.value = r.lineArea || '';
    applyCellStyle(cellLine, { align: 'center', size: 9 });

    // H: Observation
    const cellObs = rowObj.getCell(8);
    cellObs.value = r.observation || '';
    applyCellStyle(cellObs, { align: 'left', size: 9 });

    // I: Image Before (placeholder text or image embedded below)
    const cellImgBefore = rowObj.getCell(9);
    cellImgBefore.value = '';
    applyCellStyle(cellImgBefore, { align: 'center', size: 8, color: '64748B' });

    // J: Root Cause
    const cellRoot = rowObj.getCell(10);
    cellRoot.value = r.rootCause || '';
    applyCellStyle(cellRoot, { align: 'left', size: 9 });

    // K: Counter Measure
    const cellCounter = rowObj.getCell(11);
    cellCounter.value = r.counterMeasure || '';
    applyCellStyle(cellCounter, { align: 'left', size: 9 });

    // L: Image After (placeholder text or image embedded below)
    const cellImgAfter = rowObj.getCell(12);
    cellImgAfter.value = '';
    applyCellStyle(cellImgAfter, { align: 'center', size: 8, color: '64748B' });

    // M: Response Date
    const cellRespDate = rowObj.getCell(13);
    cellRespDate.value = r.responseDate || '';
    applyCellStyle(cellRespDate, { align: 'center', size: 9 });

    // N: Responsible Person Dept
    const cellRespDept = rowObj.getCell(14);
    cellRespDept.value = r.responsiblePersonDept || r.department || '';
    applyCellStyle(cellRespDept, { align: 'center', size: 9 });

    // O: Staff Employee
    const cellStaff = rowObj.getCell(15);
    cellStaff.value = r.staffEmployee || r.responsiblePersonConfirmation || '';
    applyCellStyle(cellStaff, { align: 'left', size: 9 });

    // P: CFT
    const cellCft = rowObj.getCell(16);
    cellCft.value = r.cftTopic || r.cftSelectedName || '';
    applyCellStyle(cellCft, { align: 'center', size: 9 });

    // Q: Responsible Person Instruction / Confirmation
    const cellRemarks = rowObj.getCell(17);
    const confVal = r.confirmation || (r.responsiblePersonConfirmation === 'Confirmed' || r.responsiblePersonConfirmation === 'Not - Confirmed' ? r.responsiblePersonConfirmation : '');
    const otherRemarks = r.responsiblePersonConfirmation && r.responsiblePersonConfirmation !== 'Confirmed' && r.responsiblePersonConfirmation !== 'Not - Confirmed' ? r.responsiblePersonConfirmation : (r.remarks || '');
    cellRemarks.value = confVal ? (otherRemarks ? `${confVal} - ${otherRemarks}` : confVal) : (otherRemarks || '');
    applyCellStyle(cellRemarks, { align: 'center', size: 9 });

    // Embed Before Image if available
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
            tl: { col: 8.1, row: rowNum - 1 + 0.1 },
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

    // Embed After Image if available
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
            tl: { col: 11.1, row: rowNum - 1 + 0.1 },
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
