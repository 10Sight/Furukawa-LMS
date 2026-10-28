import { executeQuery, isDbConnected, initLpaTables, readLpaStore, writeLpaStore } from "../../db/lpa/lpaDb.js";
import { getDefaultTemplate } from "../../db/lpa/lpaDefaultTemplates.js";
import { calculateSheetSummary, normalizeObservationSymbol } from "../../utils/lpa/lpaScoring.js";
import logger from "../../logger/winston.logger.js";
import crypto from "crypto";

function generateRecordId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `lpa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class LpaRecord {
  static async init() {
    await initLpaTables();
    await this.seedDefaultTemplates();
  }

  static async seedDefaultTemplates() {
    try {
      const store = readLpaStore();
      const sections = ["assembly", "cc"];
      let changed = false;
      for (const sec of sections) {
        const existing = store.templates.find(t => t.section === sec);
        if (!existing) {
          const tpl = getDefaultTemplate(sec);
          store.templates.push({
            id: store.templates.length + 1,
            ...tpl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          changed = true;
        }
      }
      if (changed) {
        writeLpaStore(store);
      }

      const dbActive = await isDbConnected();
      if (dbActive) {
        for (const sec of sections) {
          const [rows] = await executeQuery("SELECT id FROM lpa_templates WHERE section = ?", [sec]);
          if (!rows || rows.length === 0) {
            const tpl = getDefaultTemplate(sec);
            await executeQuery(`
              INSERT INTO lpa_templates (section, name, docNo, revNo, issueDate, columnCount, configJson, isActive)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `, [
              tpl.section,
              tpl.name,
              tpl.docNo || null,
              tpl.revNo || null,
              tpl.issueDate || null,
              tpl.sheets?.[0]?.columnCount || 7,
              JSON.stringify(tpl)
            ]);
          }
        }
      }
    } catch (err) {
      logger.warn("LpaRecord template seed note:", err.message);
    }
  }

  static async getTemplates() {
    const dbActive = await isDbConnected();
    if (dbActive) {
      try {
        const [rows] = await executeQuery("SELECT * FROM lpa_templates WHERE isActive = 1");
        if (rows && rows.length > 0) {
          return rows.map(r => ({
            ...r,
            config: r.configJson ? JSON.parse(r.configJson) : null
          }));
        }
      } catch (err) {
        logger.warn("Querying lpa_templates failed, using disk store:", err.message);
      }
    }
    const store = readLpaStore();
    return store.templates || [];
  }

  static async getTemplateBySection(section) {
    const sec = String(section || "assembly").toLowerCase();
    const dbActive = await isDbConnected();
    if (dbActive) {
      try {
        const [rows] = await executeQuery("SELECT * FROM lpa_templates WHERE section = ? AND isActive = 1", [sec]);
        if (rows && rows.length > 0) {
          const t = rows[0];
          return t.configJson ? JSON.parse(t.configJson) : t;
        }
      } catch (err) {
        logger.warn("Querying lpa_template by section failed:", err.message);
      }
    }
    const store = readLpaStore();
    const match = (store.templates || []).find(t => t.section === sec);
    return match || getDefaultTemplate(sec);
  }

  static async getRecords(filters = {}, pagination = {}, user = null) {
    const {
      section,
      unit,
      level,
      auditDate,
      shift,
      department,
      sectionName,
      line,
      status,
      search
    } = filters;

    const page = Math.max(1, parseInt(pagination.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pagination.limit) || 50));
    const offset = (page - 1) * limit;

    const dbActive = await isDbConnected();
    if (dbActive) {
      try {
        let whereClauses = ["1=1"];
        let params = [];

        if (section) {
          whereClauses.push("section = ?");
          params.push(section.toLowerCase());
        }
        if (unit) {
          whereClauses.push("unit = ?");
          params.push(unit);
        }
        if (level) {
          whereClauses.push("level = ?");
          params.push(level);
        }
        if (auditDate) {
          whereClauses.push("auditDate = ?");
          params.push(auditDate);
        }
        if (shift) {
          whereClauses.push("shift = ?");
          params.push(shift);
        }
        if (department) {
          whereClauses.push("department = ?");
          params.push(department);
        }
        if (status) {
          whereClauses.push("status = ?");
          params.push(status);
        }
        if (search) {
          whereClauses.push("(name LIKE ? OR department LIKE ? OR line LIKE ?)");
          const s = `%${search}%`;
          params.push(s, s, s);
        }

        const whereSql = whereClauses.join(" AND ");
        const countQuery = `SELECT COUNT(*) as total FROM lpa_records WHERE ${whereSql}`;
        const [countRows] = await executeQuery(countQuery, params);
        const total = countRows?.[0]?.total || 0;

        const selectQuery = `
          SELECT * FROM lpa_records 
          WHERE ${whereSql}
          ORDER BY auditDate DESC, createdAt DESC
          OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;
        const [rows] = await executeQuery(selectQuery, params);

        // Fetch auditors for these records
        const recordIds = rows.map(r => r.id);
        let auditorsMap = {};
        if (recordIds.length > 0) {
          const [auditorRows] = await executeQuery(
            `SELECT * FROM lpa_record_auditors WHERE recordId IN (${recordIds.map(() => '?').join(',')}) ORDER BY auditorIndex ASC`,
            recordIds
          );
          for (const a of auditorRows) {
            if (!auditorsMap[a.recordId]) auditorsMap[a.recordId] = [];
            auditorsMap[a.recordId].push(a.auditorName);
          }
        }

        const formatted = rows.map(r => {
          let parsedWorkbook = null;
          if (r.fullWorkbookJson) {
            try { parsedWorkbook = JSON.parse(r.fullWorkbookJson); } catch { }
          }
          const auditors = auditorsMap[r.id] || (parsedWorkbook?.sheets?.[0]?.auditors) || [r.createdBy || ''];
          return {
            id: r.recordId || String(r.id),
            dbId: r.id,
            section: r.section,
            name: r.name,
            unit: r.unit,
            level: r.level,
            levels: parsedWorkbook?.levels || (r.level ? [r.level] : ['L3']),
            shifts: parsedWorkbook?.shifts || (r.shift ? [r.shift] : ['A']),
            auditDate: r.auditDate ? new Date(r.auditDate).toISOString().slice(0, 10) : '',
            date: r.auditDate ? new Date(r.auditDate).toISOString().slice(0, 10) : '',
            shift: r.shift,
            department: r.department,
            sectionName: r.sectionName,
            line: r.line,
            status: r.status,
            totalMarks: r.totalMarks,
            totalScore: r.totalScore,
            percentage: r.percentage,
            scorePercentage: r.percentage,
            version: r.version,
            ownerId: r.ownerId,
            createdBy: r.createdBy,
            updatedBy: r.updatedBy,
            auditors,
            auditor: auditors.join(', '),
            sheets: parsedWorkbook?.sheets || [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          };
        });

        return {
          records: formatted,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        };
      } catch (err) {
        logger.warn("Querying lpa_records from DB failed, falling back to disk store:", err.message);
      }
    }

    // Disk fallback
    const store = readLpaStore();
    let items = (store.records || []).filter(r => {
      if (section && r.section !== section.toLowerCase()) return false;
      if (unit && r.unit !== unit) return false;
      if (level && r.level !== level) return false;
      if (auditDate && (r.auditDate || r.date) !== auditDate) return false;
      if (shift && r.shift !== shift) return false;
      if (department && r.department !== department) return false;
      if (status && r.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches = (r.name || '').toLowerCase().includes(q) ||
          (r.department || '').toLowerCase().includes(q) ||
          (r.line || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    // Sort by auditDate desc, createdAt desc
    items.sort((a, b) => (b.auditDate || b.date || '').localeCompare(a.auditDate || a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);

    return {
      records: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getRecordById(idOrRecordId, user = null, { authoritative = false } = {}) {
    const idStr = String(idOrRecordId);
    const dbActive = await isDbConnected();

    if (dbActive) {
      try {
        const [rows] = await executeQuery(
          "SELECT * FROM lpa_records WHERE recordId = ? OR id = ?",
          [idStr, isNaN(Number(idStr)) ? -1 : Number(idStr)]
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          const [auditors] = await executeQuery(
            "SELECT * FROM lpa_record_auditors WHERE recordId = ? ORDER BY auditorIndex ASC",
            [r.id]
          );
          const [observations] = await executeQuery(
            "SELECT * FROM lpa_record_observations WHERE recordId = ? ORDER BY sheetIndex ASC, rowIndex ASC",
            [r.id]
          );
          const [revisions] = await executeQuery(
            "SELECT * FROM lpa_record_revisions WHERE recordId = ? ORDER BY version DESC",
            [r.id]
          );

          let parsedWorkbook = null;
          if (r.fullWorkbookJson) {
            try { parsedWorkbook = JSON.parse(r.fullWorkbookJson); } catch { }
          }

          const auditorNames = auditors.map(a => a.auditorName);

          return {
            id: r.recordId,
            dbId: r.id,
            section: r.section,
            name: r.name,
            unit: r.unit,
            level: r.level,
            levels: parsedWorkbook?.levels || (r.level ? [r.level] : ['L3']),
            shifts: parsedWorkbook?.shifts || (r.shift ? [r.shift] : ['A']),
            auditDate: r.auditDate ? new Date(r.auditDate).toISOString().slice(0, 10) : '',
            date: r.auditDate ? new Date(r.auditDate).toISOString().slice(0, 10) : '',
            shift: r.shift,
            department: r.department,
            sectionName: r.sectionName,
            line: r.line,
            status: r.status,
            totalMarks: r.totalMarks,
            totalScore: r.totalScore,
            percentage: r.percentage,
            scorePercentage: r.percentage,
            version: r.version,
            ownerId: r.ownerId,
            createdBy: r.createdBy,
            updatedBy: r.updatedBy,
            auditors: auditorNames.length > 0 ? auditorNames : (parsedWorkbook?.sheets?.[0]?.auditors || []),
            auditor: auditorNames.join(', '),
            sheets: parsedWorkbook?.sheets || [],
            observations: observations || [],
            revisions: revisions || [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          };
        }
      } catch (err) {
        logger.warn("Querying lpa_record by ID failed, falling back to disk store:", err.message);
        if (err.message && err.message.includes("lpa_records")) {
          initLpaTables().catch(() => {});
        }
      }
    }

    const store = readLpaStore();
    const found = (store.records || []).find(r => String(r.id) === idStr || String(r.recordId) === idStr);
    return found || null;
  }

  /**
   * Retrieves authoritative same-day records and worksheets across levels and shifts
   * for Level 1 and Level 2 same-day data synchronization and read-only display.
   */
  static async getSameDaySourceData(filters = {}, user = null) {
    const { section, unit, auditDate, department, line } = filters;
    const targetDate = auditDate || filters.date || new Date().toISOString().slice(0, 10);
    const targetSection = String(section || 'assembly').toLowerCase();
    const targetUnit = unit || 'Bawal';

    // Retrieve all records for this date, section, and unit
    const result = await this.getRecords({
      section: targetSection,
      unit: targetUnit,
      auditDate: targetDate,
      limit: 100
    }, { page: 1, limit: 100 }, user);

    const allRecords = result.records || [];

    // Filter matching department / line if specified, but fall back gracefully
    let candidates = allRecords;
    if (department) {
      const deptFiltered = candidates.filter(r => !r.department || r.department.toLowerCase() === department.toLowerCase());
      if (deptFiltered.length > 0) candidates = deptFiltered;
    }
    if (line) {
      const lineFiltered = candidates.filter(r => !r.line || r.line === line);
      if (lineFiltered.length > 0) candidates = lineFiltered;
    }

    // Sort by updatedAt DESC, createdAt DESC
    candidates.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

    // Locate shift-wise Level 3 records
    const l3Records = candidates.filter(r => {
      const lvl = r.targetLevel || r.level;
      return lvl === 'L3' || (!lvl && (!r.levels || r.levels.includes('L3')));
    });

    const l3ShiftA = l3Records.find(r => (r.shift || r.sheets?.[0]?.shift || 'A').toUpperCase() === 'A') || null;
    const l3ShiftB = l3Records.find(r => (r.shift || r.sheets?.[0]?.shift || '').toUpperCase() === 'B') || null;
    const l3ShiftC = l3Records.find(r => (r.shift || r.sheets?.[0]?.shift || '').toUpperCase() === 'C') || null;

    // Locate Level 2 record
    const l2Record = candidates.find(r => {
      const lvl = r.targetLevel || r.level;
      return lvl === 'L2' || (r.levels && r.levels.includes('L2') && !r.levels.includes('L1'));
    }) || null;

    // Locate Level 1 record
    const l1Record = candidates.find(r => {
      const lvl = r.targetLevel || r.level;
      return lvl === 'L1' || (r.levels && r.levels.includes('L1'));
    }) || null;

    return {
      date: targetDate,
      section: targetSection,
      unit: targetUnit,
      department: department || '',
      line: line || '',
      records: {
        l3ShiftA,
        l3ShiftB,
        l3ShiftC,
        l2: l2Record,
        l1: l1Record
      },
      sourceSheets: {
        L3_A: l3ShiftA?.sheets?.[0] || null,
        L3_B: l3ShiftB?.sheets?.[0] || null,
        L3_C: l3ShiftC?.sheets?.[0] || null,
        L2: l2Record?.sheets?.[0] || null
      },
      availableShifts: {
        A: Boolean(l3ShiftA),
        B: Boolean(l3ShiftB),
        C: Boolean(l3ShiftC)
      },
      hasL2: Boolean(l2Record),
      hasL1: Boolean(l1Record)
    };
  }

  static async createRecord(payload, user = null) {
    const section = (payload.section || "assembly").toLowerCase();
    const unit = payload.unit || "Bawal";
    const level = payload.level || "L1";
    const auditDate = payload.auditDate || payload.date || new Date().toISOString().slice(0, 10);
    const shift = (payload.shift || payload.sheets?.[0]?.shift || "A").toUpperCase();
    const department = payload.department || payload.sheets?.[0]?.department || (section === "assembly" ? "Assembly" : "C&C");
    const sectionName = payload.sectionName || payload.sheets?.[0]?.sectionName || "";
    const line = payload.line || payload.sheets?.[0]?.line || "";
    const status = payload.status || "Draft";

    const userName = user?.fullName || user?.userName || payload.createdBy || "System User";
    const userId = user?.id ? String(user.id) : (payload.ownerId || payload.createdById || "current");
    const recordId = payload.id && !payload.id.startsWith("lpa_temp_") ? payload.id : generateRecordId();

    // Extract auditors
    let auditors = Array.isArray(payload.auditors)
      ? payload.auditors.filter(Boolean)
      : (payload.auditor ? [payload.auditor] : (payload.sheets?.[0]?.auditors || [userName]));
    if (auditors.length === 0) auditors = [userName];

    // Compute Authoritative Scores for sheets
    const sheetsInput = Array.isArray(payload.sheets) && payload.sheets.length > 0
      ? payload.sheets
      : (section === "assembly" ? getDefaultTemplate("assembly").sheets : getDefaultTemplate("cc").sheets);

    // Enforce backend protection: Level 1 and Level 2 records cannot tamper with or overwrite fetched columns
    const effectiveLevel = payload.targetLevel || level;
    if (effectiveLevel === 'L1' || effectiveLevel === 'L2') {
      try {
        const sameDaySources = await this.getSameDaySourceData({ section, unit, auditDate, department, line }, user);
        sheetsInput.forEach((sheet) => {
          if (!Array.isArray(sheet.rows)) return;
          const isCc = section === 'cc';
          const startRow = isCc ? 4 : 3;
          const endRow = isCc ? 34 : 36;
          const headerRow = sheet.rows[isCc ? 2 : 1] || [];
          const auditCols = [];
          const startCol = isCc ? 7 : 5;
          for (let c = startCol; c < (sheet.columnCount || headerRow.length); c += 2) {
            const hText = String(headerRow[c]?.value ?? headerRow[c]?.formatted ?? '').toUpperCase();
            if (hText.includes('SHIFT A') || hText.includes('L3_A')) auditCols.push({ id: 'L3_A', level: 'L3', shift: 'A', obsCol: c, scoreCol: c + 1 });
            else if (hText.includes('SHIFT B') || hText.includes('L3_B')) auditCols.push({ id: 'L3_B', level: 'L3', shift: 'B', obsCol: c, scoreCol: c + 1 });
            else if (hText.includes('LEVEL 2') || hText.includes('L2') || hText.includes('WEEKLY')) auditCols.push({ id: 'L2', level: 'L2', obsCol: c, scoreCol: c + 1 });
            else if (hText.includes('LEVEL 1') || hText.includes('L1') || hText.includes('MONTHLY')) auditCols.push({ id: 'L1', level: 'L1', obsCol: c, scoreCol: c + 1 });
          }

          sheet.rows.forEach((row, rIdx) => {
            if (rIdx < startRow || rIdx > endRow || !Array.isArray(row)) return;
            auditCols.forEach(col => {
              const isReadOnlyCol = (effectiveLevel === 'L1' && (col.level === 'L3' || col.level === 'L2')) ||
                                    (effectiveLevel === 'L2' && col.level === 'L3');
              if (!isReadOnlyCol) return;

              let srcSheet = null;
              if (col.id === 'L3_A') srcSheet = sameDaySources.sourceSheets?.L3_A;
              else if (col.id === 'L3_B') srcSheet = sameDaySources.sourceSheets?.L3_B;
              else if (col.id === 'L2') srcSheet = sameDaySources.sourceSheets?.L2;

              if (srcSheet && Array.isArray(srcSheet.rows?.[rIdx])) {
                const srcObsCol = isCc ? 7 : 5;
                const srcScoreCol = isCc ? 8 : 6;
                const srcObs = srcSheet.rows[rIdx][srcObsCol];
                const srcScore = srcSheet.rows[rIdx][srcScoreCol];
                row[col.obsCol] = srcObs ? { ...srcObs } : { value: '', formatted: '', type: 'z' };
                row[col.scoreCol] = srcScore ? { ...srcScore } : { value: '', formatted: '', type: 'z' };
              }
            });
          });
        });
      } catch (syncErr) {
        logger.warn("Backend same-day source sync note in createRecord:", syncErr.message);
      }
    }

    let authoritativeSheets = [];
    let grandTotalMarks = 0;
    let grandTotalScore = 0;
    let overallPercentage = "0.00%";
    let extractedObservations = [];

    sheetsInput.forEach((sheet, sheetIdx) => {
      const summary = calculateSheetSummary(sheet, section);
      authoritativeSheets.push({
        ...sheet,
        rows: summary.rows,
        totalMarks: summary.totalMarks,
        totalScore: summary.totalScore,
        scorePercentage: summary.percentage,
        date: auditDate,
        shift,
        department,
        sectionName,
        line,
        auditors
      });

      grandTotalMarks += summary.totalMarks;
      grandTotalScore += summary.totalScore;
      if (sheetIdx === 0) {
        overallPercentage = summary.percentage;
      }

      // Extract observation items for relational table
      const rows = summary.rows;
      const isCc = section === "cc";
      const startRow = isCc ? 4 : 3;
      const maxEndRow = isCc ? 35 : 37;
      const marksCol = isCc ? 5 : 4;
      const obsCol = isCc ? 7 : 5;
      const scoreCol = isCc ? 8 : 6;

      rows.forEach((row, rIdx) => {
        if (!Array.isArray(row) || rIdx < startRow || rIdx >= maxEndRow) return;
        const slNo = row[0]?.formatted ?? row[0]?.value ?? String(rIdx);
        const focus = row[1]?.formatted ?? row[1]?.value ?? "";
        const checkPoint = row[2]?.formatted ?? row[2]?.value ?? "";
        const area = (isCc ? row[3]?.formatted ?? row[3]?.value : row[3]?.formatted ?? row[3]?.value) ?? "";
        const marks = Number(row[marksCol]?.value ?? row[marksCol]?.formatted ?? 0);
        const obs = normalizeObservationSymbol(row[obsCol]?.value ?? row[obsCol]?.formatted ?? "");
        const score = row[scoreCol]?.value ?? row[scoreCol]?.formatted ?? "";
        const isApplicable = obs !== "NA";

        if (checkPoint || obs) {
          extractedObservations.push({
            sheetIndex: sheetIdx,
            rowIndex: rIdx,
            slNo: String(slNo),
            focus: String(focus),
            checkPoint: String(checkPoint),
            area: String(area),
            marks: Number.isFinite(marks) ? marks : 0,
            observation: obs,
            score: String(score),
            calculatedScore: isApplicable && Number.isFinite(Number(score)) ? Number(score) : null,
            isApplicable: isApplicable ? 1 : 0
          });
        }
      });
    });

    if (grandTotalMarks > 0) {
      overallPercentage = `${((grandTotalScore / grandTotalMarks) * 100).toFixed(2)}%`;
    }

    const defaultName = payload.name || `${section === 'assembly' ? 'Assembly LPA Check Sheet' : 'C&C LPA Check Sheet'} · ${auditDate}`;
    const timestamp = new Date().toISOString();

    const fullWorkbook = {
      id: recordId,
      section,
      name: defaultName,
      unit,
      level,
      levels: Array.isArray(payload.levels) ? payload.levels : [level],
      auditDate,
      date: auditDate,
      shift,
      department,
      sectionName,
      line,
      status,
      totalMarks: grandTotalMarks,
      totalScore: grandTotalScore,
      percentage: overallPercentage,
      scorePercentage: overallPercentage,
      version: 1,
      ownerId: userId,
      createdBy: userName,
      createdById: userId,
      updatedBy: userName,
      updatedById: userId,
      auditors,
      auditor: auditors.join(', '),
      sheets: authoritativeSheets,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Save to MSSQL if connected
    const dbActive = await isDbConnected();
    if (dbActive) {
      try {
        const insertRecordQuery = `
          INSERT INTO lpa_records (
            recordId, section, name, unit, level, auditDate, shift, department, sectionName, line,
            status, totalMarks, totalScore, percentage, scorePercentage, version, ownerId,
            createdBy, createdById, updatedBy, updatedById, fullWorkbookJson, createdAt, updatedAt
          )
          OUTPUT INSERTED.id
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
        `;
        const numScorePct = parseFloat(overallPercentage) || 0;
        const [insertResult] = await executeQuery(insertRecordQuery, [
          recordId, section, defaultName, unit, level, auditDate, shift, department, sectionName, line,
          status, grandTotalMarks, grandTotalScore, overallPercentage, numScorePct, userId,
          userName, userId, userName, userId, JSON.stringify(fullWorkbook)
        ]);
        const dbId = insertResult?.[0]?.id;

        if (dbId) {
          fullWorkbook.dbId = dbId;

          // Save auditors
          for (let i = 0; i < auditors.length; i++) {
            await executeQuery(`
              INSERT INTO lpa_record_auditors (recordId, auditorIndex, auditorName)
              VALUES (?, ?, ?)
            `, [dbId, i, auditors[i]]);
          }

          // Save observations
          for (const item of extractedObservations) {
            await executeQuery(`
              INSERT INTO lpa_record_observations (
                recordId, sheetIndex, rowIndex, slNo, focus, checkPoint, area, marks,
                observation, score, calculatedScore, isApplicable
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              dbId, item.sheetIndex, item.rowIndex, item.slNo, item.focus, item.checkPoint,
              item.area, item.marks, item.observation, item.score, item.calculatedScore, item.isApplicable
            ]);
          }

          // Log revision
          await executeQuery(`
            INSERT INTO lpa_record_revisions (recordId, version, changeType, changedBy, changedById, summary, snapshotJson)
            VALUES (?, 1, 'CREATE', ?, ?, 'Record created', ?)
          `, [dbId, userName, userId, JSON.stringify(fullWorkbook)]);
        }
      } catch (err) {
        logger.error("Failed saving lpa_record to DB, saving to persistent store:", err.message);
      }
    }

    // Always mirror to persistent disk store
    const store = readLpaStore();
    store.records = [fullWorkbook, ...(store.records || []).filter(r => r.id !== recordId)];
    writeLpaStore(store);

    return fullWorkbook;
  }

  static async updateRecord(idOrRecordId, payload, user = null) {
    const existing = await this.getRecordById(idOrRecordId, user);
    if (!existing) {
      throw new Error(`LPA Record '${idOrRecordId}' not found.`);
    }

    const section = (payload.section || existing.section || "assembly").toLowerCase();
    const unit = payload.unit || existing.unit || "Bawal";
    const level = payload.level || existing.level || "L1";
    const auditDate = payload.auditDate || payload.date || existing.auditDate || existing.date || new Date().toISOString().slice(0, 10);
    const shift = (payload.shift || existing.shift || "A").toUpperCase();
    const department = payload.department || existing.department || (section === "assembly" ? "Assembly" : "C&C");
    const sectionName = payload.sectionName !== undefined ? payload.sectionName : existing.sectionName;
    const line = payload.line !== undefined ? payload.line : existing.line;
    const status = payload.status || existing.status || "Draft";

    const userName = user?.fullName || user?.userName || payload.updatedBy || existing.updatedBy || "System User";
    const userId = user?.id ? String(user.id) : (payload.updatedById || existing.updatedById || "current");
    const nextVersion = (existing.version || 1) + 1;

    let auditors = Array.isArray(payload.auditors) && payload.auditors.length > 0
      ? payload.auditors.filter(Boolean)
      : (payload.auditor ? [payload.auditor] : (existing.auditors || [userName]));
    if (auditors.length === 0) auditors = [userName];

    const sheetsInput = Array.isArray(payload.sheets) && payload.sheets.length > 0
      ? payload.sheets
      : existing.sheets;

    // Enforce backend protection: Level 1 and Level 2 records cannot tamper with or overwrite fetched columns
    const effectiveLevel = payload.targetLevel || level || existing.targetLevel || existing.level;
    if (effectiveLevel === 'L1' || effectiveLevel === 'L2') {
      try {
        const sameDaySources = await this.getSameDaySourceData({ section, unit, auditDate, department, line }, user);
        sheetsInput.forEach((sheet) => {
          if (!Array.isArray(sheet.rows)) return;
          const isCc = section === 'cc';
          const startRow = isCc ? 4 : 3;
          const endRow = isCc ? 34 : 36;
          const headerRow = sheet.rows[isCc ? 2 : 1] || [];
          const auditCols = [];
          const startCol = isCc ? 7 : 5;
          for (let c = startCol; c < (sheet.columnCount || headerRow.length); c += 2) {
            const hText = String(headerRow[c]?.value ?? headerRow[c]?.formatted ?? '').toUpperCase();
            if (hText.includes('SHIFT A') || hText.includes('L3_A')) auditCols.push({ id: 'L3_A', level: 'L3', shift: 'A', obsCol: c, scoreCol: c + 1 });
            else if (hText.includes('SHIFT B') || hText.includes('L3_B')) auditCols.push({ id: 'L3_B', level: 'L3', shift: 'B', obsCol: c, scoreCol: c + 1 });
            else if (hText.includes('LEVEL 2') || hText.includes('L2') || hText.includes('WEEKLY')) auditCols.push({ id: 'L2', level: 'L2', obsCol: c, scoreCol: c + 1 });
            else if (hText.includes('LEVEL 1') || hText.includes('L1') || hText.includes('MONTHLY')) auditCols.push({ id: 'L1', level: 'L1', obsCol: c, scoreCol: c + 1 });
          }

          sheet.rows.forEach((row, rIdx) => {
            if (rIdx < startRow || rIdx > endRow || !Array.isArray(row)) return;
            auditCols.forEach(col => {
              const isReadOnlyCol = (effectiveLevel === 'L1' && (col.level === 'L3' || col.level === 'L2')) ||
                                    (effectiveLevel === 'L2' && col.level === 'L3');
              if (!isReadOnlyCol) return;

              let srcSheet = null;
              if (col.id === 'L3_A') srcSheet = sameDaySources.sourceSheets?.L3_A;
              else if (col.id === 'L3_B') srcSheet = sameDaySources.sourceSheets?.L3_B;
              else if (col.id === 'L2') srcSheet = sameDaySources.sourceSheets?.L2;

              if (srcSheet && Array.isArray(srcSheet.rows?.[rIdx])) {
                const srcObsCol = isCc ? 7 : 5;
                const srcScoreCol = isCc ? 8 : 6;
                const srcObs = srcSheet.rows[rIdx][srcObsCol];
                const srcScore = srcSheet.rows[rIdx][srcScoreCol];
                row[col.obsCol] = srcObs ? { ...srcObs } : { value: '', formatted: '', type: 'z' };
                row[col.scoreCol] = srcScore ? { ...srcScore } : { value: '', formatted: '', type: 'z' };
              }
            });
          });
        });
      } catch (syncErr) {
        logger.warn("Backend same-day source sync note in updateRecord:", syncErr.message);
      }
    }

    let authoritativeSheets = [];
    let grandTotalMarks = 0;
    let grandTotalScore = 0;
    let overallPercentage = "0.00%";
    let extractedObservations = [];

    sheetsInput.forEach((sheet, sheetIdx) => {
      const summary = calculateSheetSummary(sheet, section);
      authoritativeSheets.push({
        ...sheet,
        rows: summary.rows,
        totalMarks: summary.totalMarks,
        totalScore: summary.totalScore,
        scorePercentage: summary.percentage,
        date: auditDate,
        shift,
        department,
        sectionName,
        line,
        auditors
      });

      grandTotalMarks += summary.totalMarks;
      grandTotalScore += summary.totalScore;
      if (sheetIdx === 0) {
        overallPercentage = summary.percentage;
      }

      const rows = summary.rows;
      const isCc = section === "cc";
      const startRow = isCc ? 4 : 3;
      const maxEndRow = isCc ? 35 : 37;
      const marksCol = isCc ? 5 : 4;
      const obsCol = isCc ? 7 : 5;
      const scoreCol = isCc ? 8 : 6;

      rows.forEach((row, rIdx) => {
        if (!Array.isArray(row) || rIdx < startRow || rIdx >= maxEndRow) return;
        const slNo = row[0]?.formatted ?? row[0]?.value ?? String(rIdx);
        const focus = row[1]?.formatted ?? row[1]?.value ?? "";
        const checkPoint = row[2]?.formatted ?? row[2]?.value ?? "";
        const area = row[3]?.formatted ?? row[3]?.value ?? "";
        const marks = Number(row[marksCol]?.value ?? row[marksCol]?.formatted ?? 0);
        const obs = normalizeObservationSymbol(row[obsCol]?.value ?? row[obsCol]?.formatted ?? "");
        const score = row[scoreCol]?.value ?? row[scoreCol]?.formatted ?? "";
        const isApplicable = obs !== "NA";

        if (checkPoint || obs) {
          extractedObservations.push({
            sheetIndex: sheetIdx,
            rowIndex: rIdx,
            slNo: String(slNo),
            focus: String(focus),
            checkPoint: String(checkPoint),
            area: String(area),
            marks: Number.isFinite(marks) ? marks : 0,
            observation: obs,
            score: String(score),
            calculatedScore: isApplicable && Number.isFinite(Number(score)) ? Number(score) : null,
            isApplicable: isApplicable ? 1 : 0
          });
        }
      });
    });

    if (grandTotalMarks > 0) {
      overallPercentage = `${((grandTotalScore / grandTotalMarks) * 100).toFixed(2)}%`;
    }

    const defaultName = payload.name || existing.name;
    const timestamp = new Date().toISOString();

    const updatedWorkbook = {
      ...existing,
      id: existing.id || idOrRecordId,
      section,
      name: defaultName,
      unit,
      level,
      levels: Array.isArray(payload.levels) ? payload.levels : (existing.levels || [level]),
      shifts: Array.isArray(payload.shifts) && payload.shifts.length > 0 ? payload.shifts : (existing.shifts || (existing.shift ? [existing.shift] : [shift])),
      auditDate,
      date: auditDate,
      shift,
      department,
      sectionName,
      line,
      status,
      totalMarks: grandTotalMarks,
      totalScore: grandTotalScore,
      percentage: overallPercentage,
      scorePercentage: overallPercentage,
      version: nextVersion,
      updatedBy: userName,
      updatedById: userId,
      auditors,
      auditor: auditors.join(', '),
      sheets: authoritativeSheets,
      updatedAt: timestamp
    };

    const dbActive = await isDbConnected();
    if (dbActive && existing.dbId) {
      try {
        const numScorePct = parseFloat(overallPercentage) || 0;
        await executeQuery(`
          UPDATE lpa_records SET
            name = ?, unit = ?, level = ?, auditDate = ?, shift = ?, department = ?, sectionName = ?, line = ?,
            status = ?, totalMarks = ?, totalScore = ?, percentage = ?, scorePercentage = ?, version = ?,
            updatedBy = ?, updatedById = ?, fullWorkbookJson = ?, updatedAt = GETDATE()
          WHERE id = ?
        `, [
          defaultName, unit, level, auditDate, shift, department, sectionName, line,
          status, grandTotalMarks, grandTotalScore, overallPercentage, numScorePct, nextVersion,
          userName, userId, JSON.stringify(updatedWorkbook), existing.dbId
        ]);

        // Refresh auditors
        await executeQuery("DELETE FROM lpa_record_auditors WHERE recordId = ?", [existing.dbId]);
        for (let i = 0; i < auditors.length; i++) {
          await executeQuery(`
            INSERT INTO lpa_record_auditors (recordId, auditorIndex, auditorName)
            VALUES (?, ?, ?)
          `, [existing.dbId, i, auditors[i]]);
        }

        // Refresh observations
        await executeQuery("DELETE FROM lpa_record_observations WHERE recordId = ?", [existing.dbId]);
        for (const item of extractedObservations) {
          await executeQuery(`
            INSERT INTO lpa_record_observations (
              recordId, sheetIndex, rowIndex, slNo, focus, checkPoint, area, marks,
              observation, score, calculatedScore, isApplicable
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            existing.dbId, item.sheetIndex, item.rowIndex, item.slNo, item.focus, item.checkPoint,
            item.area, item.marks, item.observation, item.score, item.calculatedScore, item.isApplicable
          ]);
        }

        // Revision log
        const changeType = status === 'Submitted' ? 'SUBMIT' : 'UPDATE';
        await executeQuery(`
          INSERT INTO lpa_record_revisions (recordId, version, changeType, changedBy, changedById, summary, snapshotJson)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [existing.dbId, nextVersion, changeType, userName, userId, `Version ${nextVersion} saved`, JSON.stringify(updatedWorkbook)]);
      } catch (err) {
        logger.error("Failed updating lpa_record in DB:", err.message);
      }
    }

    // Update persistent disk store
    const store = readLpaStore();
    store.records = (store.records || []).map(r => r.id === updatedWorkbook.id ? updatedWorkbook : r);
    if (!store.records.some(r => r.id === updatedWorkbook.id)) {
      store.records.unshift(updatedWorkbook);
    }
    writeLpaStore(store);

    return updatedWorkbook;
  }

  static async deleteRecord(idOrRecordId, user = null) {
    const idStr = String(idOrRecordId);
    const dbActive = await isDbConnected();

    if (dbActive) {
      try {
        const [rows] = await executeQuery(
          "SELECT id FROM lpa_records WHERE recordId = ? OR id = ?",
          [idStr, isNaN(Number(idStr)) ? -1 : Number(idStr)]
        );
        const dbId = rows?.[0]?.id;
        if (dbId) {
          try { await executeQuery("DELETE FROM lpa_record_auditors WHERE recordId = ?", [dbId]); } catch (e) {
            logger.warn("Deleting lpa_record_auditors failed:", e.message);
          }
          try { await executeQuery("DELETE FROM lpa_record_observations WHERE recordId = ?", [dbId]); } catch (e) {
            logger.warn("Deleting lpa_record_observations failed:", e.message);
          }
          try { await executeQuery("DELETE FROM lpa_record_revisions WHERE recordId = ?", [dbId]); } catch (e) {
            logger.warn("Deleting lpa_record_revisions failed:", e.message);
          }
        }
        await executeQuery("DELETE FROM lpa_records WHERE recordId = ? OR id = ?", [
          idStr,
          isNaN(Number(idStr)) ? -1 : Number(idStr)
        ]);
      } catch (err) {
        logger.error("Failed deleting lpa_record from DB, proceeding with disk store removal:", err.message);
      }
    }

    const store = readLpaStore();
    store.records = (store.records || []).filter(r =>
      String(r.id) !== idStr &&
      String(r.recordId || '') !== idStr &&
      String(r._id || '') !== idStr &&
      String(r.dbId || '') !== idStr
    );
    writeLpaStore(store);

    return true;
  }

  static async getDropdowns() {
    const dbActive = await isDbConnected();
    let departments = [];
    let sections = [];
    let lines = [];
    let auditors = [];

    if (dbActive) {
      try {
        const [dRows] = await executeQuery("SELECT id, name FROM departments ORDER BY name ASC");
        departments = dRows || [];
      } catch { }
      try {
        const [sRows] = await executeQuery("SELECT id, name, departmentId FROM sections ORDER BY name ASC");
        sections = sRows || [];
      } catch { }
      try {
        const [lRows] = await executeQuery("SELECT id, name, lineName, sectionId FROM lines ORDER BY name ASC");
        lines = lRows || [];
      } catch { }
      try {
        const [uRows] = await executeQuery("SELECT id, fullName, userName, email, role FROM users WHERE status = 'PRESENT' OR status IS NULL ORDER BY fullName ASC");
        auditors = (uRows || []).map(u => ({
          id: u.id,
          name: u.fullName || u.userName,
          code: u.userName,
          email: u.email
        }));
      } catch { }
    }

    if (departments.length === 0) {
      departments = [
        { id: 1, name: 'Assembly' },
        { id: 2, name: 'C&C' },
        { id: 3, name: 'Maintenance' },
        { id: 4, name: 'Quality' },
        { id: 5, name: 'Production' },
        { id: 6, name: 'Store' },
        { id: 7, name: 'Safety' },
        { id: 8, name: 'Dispatch' },
        { id: 9, name: 'Training' },
        { id: 10, name: 'HR' },
        { id: 11, name: 'Finance' },
        { id: 12, name: 'Purchase' },
        { id: 13, name: 'IT' }
      ];
    }

    return {
      departments,
      sections,
      lines,
      shifts: ['A', 'B', 'C', 'G'],
      units: ['Bawal', 'Gujrat'],
      levels: ['L1', 'L2', 'L3'],
      observationOptions: ['Ο', 'Δ', 'Χ', 'NA'],
      auditors
    };
  }
}

export default LpaRecord;
