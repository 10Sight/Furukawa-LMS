import db from '../db/database.js';
import { isUserAdmin } from '../utils/authCheck.js';

const resolveActorName = (req, fallback = 'Admin') =>
  String(
    req.body?.performedBy ||
    req.body?.updatedBy ||
    req.body?.createdBy ||
    req.query?.performedBy ||
    req.user?.name ||
    req.user?.username ||
    fallback
  ).trim() || fallback;

export function logTemplateHistory({ actionType, entityType, entityName = '', details = '', performedBy = 'Admin' }) {
  try {
    db.prepare(`
      INSERT INTO ptm_template_history (action_type, entity_type, entity_name, details, performed_by, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(actionType, entityType, entityName, details, performedBy || 'Admin');
  } catch (err) {
    console.warn('Failed to log PTM template history:', err?.message || err);
  }
}

export function getTemplates(req, res) {
  try {
    const { phase } = req.query;
    let rows;
    if (phase) {
      rows = db
        .prepare(
          `SELECT id, phase_key, phase_label, template_name, template_date, rows_data, created_by, created_at, updated_at
           FROM ptm_templates
           WHERE phase_key = ? OR phase_label = ?
           ORDER BY updated_at DESC, created_at DESC`
        )
        .all(phase, phase);
    } else {
      rows = db
        .prepare(
          `SELECT id, phase_key, phase_label, template_name, template_date, rows_data, created_by, created_at, updated_at
           FROM ptm_templates
           ORDER BY updated_at DESC, created_at DESC`
        )
        .all();
    }

    const data = rows.map((row) => ({
      id: row.id,
      phaseKey: row.phase_key,
      phaseLabel: row.phase_label,
      templateName: row.template_name,
      templateDate: row.template_date,
      rows: row.rows_data ? JSON.parse(row.rows_data) : [],
      createdBy: row.created_by || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching PTM templates:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch PTM templates' });
  }
}

export function getTemplateById(req, res) {
  try {
    const { id } = req.params;
    const row = db
      .prepare(
        `SELECT id, phase_key, phase_label, template_name, template_date, rows_data, created_by, created_at, updated_at
         FROM ptm_templates
         WHERE id = ?`
      )
      .get(id);

    if (!row) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.json({
      success: true,
      data: {
        id: row.id,
        phaseKey: row.phase_key,
        phaseLabel: row.phase_label,
        templateName: row.template_name,
        templateDate: row.template_date,
        rows: row.rows_data ? JSON.parse(row.rows_data) : [],
        createdBy: row.created_by || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching PTM template:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch PTM template' });
  }
}

export function createTemplate(req, res) {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can create templates.' });
    }

    const { id, phaseKey, phaseLabel, templateName, templateDate, rows, createdBy } = req.body || {};
    if (!phaseKey || !phaseLabel || !String(templateName || '').trim() || !String(templateDate || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'phaseKey, phaseLabel, templateName, and templateDate are required.',
      });
    }

    const templateId = id || `TPL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const rowsStr = JSON.stringify(Array.isArray(rows) ? rows : []);

    db.prepare(`
      INSERT INTO ptm_templates (id, phase_key, phase_label, template_name, template_date, rows_data, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(templateId, phaseKey, phaseLabel, String(templateName).trim(), String(templateDate).trim(), rowsStr, createdBy || '');

    const actor = resolveActorName(req, createdBy || 'Admin');
    logTemplateHistory({
      actionType: 'TEMPLATE_CREATED',
      entityType: 'template',
      entityName: String(templateName).trim(),
      details: `${actor} created template "${String(templateName).trim()}" in phase "${phaseLabel}"`,
      performedBy: actor,
    });

    return res.json({
      success: true,
      data: {
        id: templateId,
        phaseKey,
        phaseLabel,
        templateName: String(templateName).trim(),
        templateDate: String(templateDate).trim(),
        rows: Array.isArray(rows) ? rows : [],
        createdBy: createdBy || '',
      },
    });
  } catch (error) {
    console.error('Error creating PTM template:', error);
    return res.status(500).json({ success: false, message: 'Failed to create PTM template' });
  }
}

export function updateTemplate(req, res) {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can update templates.' });
    }

    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM ptm_templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const { templateName, templateDate, rows, phaseKey, phaseLabel } = req.body || {};
    const nextName = templateName !== undefined ? String(templateName).trim() : existing.template_name;
    const nextDate = templateDate !== undefined ? String(templateDate).trim() : existing.template_date;
    const nextPhaseKey = phaseKey !== undefined ? String(phaseKey).trim() : existing.phase_key;
    const nextPhaseLabel = phaseLabel !== undefined ? String(phaseLabel).trim() : existing.phase_label;
    const nextRowsStr = rows !== undefined ? JSON.stringify(Array.isArray(rows) ? rows : []) : existing.rows_data;

    db.prepare(`
      UPDATE ptm_templates
      SET phase_key = ?, phase_label = ?, template_name = ?, template_date = ?, rows_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextPhaseKey, nextPhaseLabel, nextName, nextDate, nextRowsStr, id);

    const actor = resolveActorName(req);
    const changes = [];
    if (nextName !== existing.template_name) changes.push(`name "${existing.template_name}" → "${nextName}"`);
    if (nextPhaseLabel !== existing.phase_label) changes.push(`phase "${existing.phase_label}" → "${nextPhaseLabel}"`);
    if (rows !== undefined) changes.push('sheet rows');
    logTemplateHistory({
      actionType: 'TEMPLATE_UPDATED',
      entityType: 'template',
      entityName: nextName,
      details: `${actor} updated template "${nextName}"${changes.length ? ` (${changes.join(', ')})` : ''}`,
      performedBy: actor,
    });

    return res.json({
      success: true,
      data: {
        id,
        phaseKey: nextPhaseKey,
        phaseLabel: nextPhaseLabel,
        templateName: nextName,
        templateDate: nextDate,
        rows: nextRowsStr ? JSON.parse(nextRowsStr) : [],
        createdBy: existing.created_by || '',
      },
    });
  } catch (error) {
    console.error('Error updating PTM template:', error);
    return res.status(500).json({ success: false, message: 'Failed to update PTM template' });
  }
}

export function deleteTemplate(req, res) {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can delete templates.' });
    }

    const { id } = req.params;
    const existing = db.prepare('SELECT template_name, phase_label FROM ptm_templates WHERE id = ?').get(id);
    db.prepare('DELETE FROM ptm_templates WHERE id = ?').run(id);
    const actor = resolveActorName(req);
    logTemplateHistory({
      actionType: 'TEMPLATE_DELETED',
      entityType: 'template',
      entityName: existing?.template_name || id,
      details: `${actor} deleted template "${existing?.template_name || id}"${existing?.phase_label ? ` from phase "${existing.phase_label}"` : ''}`,
      performedBy: actor,
    });
    return res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting PTM template:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete PTM template' });
  }
}

const formatPhaseRow = (row) => ({
  key: row.key,
  pageName: row.page_name,
  phaseNo: row.phase_no,
  label: row.label,
  sortOrder: row.sort_order,
  createdBy: row.created_by || '',
  createdDate: row.created_date || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function getPhases(req, res) {
  try {
    const rows = db
      .prepare(
        `SELECT key, page_name, phase_no, label, sort_order, created_by, created_date, created_at, updated_at
         FROM ptm_phases
         ORDER BY sort_order ASC, created_at ASC`
      )
      .all();

    return res.json({ success: true, data: rows.map(formatPhaseRow) });
  } catch (error) {
    console.error('Error fetching PTM phases:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch PTM phases' });
  }
}

export function createPhase(req, res) {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can create phases.' });
    }

    const { pageName, label, phaseNo, createdBy, createdDate } = req.body || {};
    const trimmedLabel = String(label || pageName || '').trim();
    const trimmedPageName = String(pageName || trimmedLabel).trim();
    if (!trimmedLabel) {
      return res.status(400).json({
        success: false,
        message: 'Phase Title / Label is required.',
      });
    }

    const stats = db.prepare('SELECT COUNT(*) AS count, COALESCE(MAX(sort_order), 0) AS maxOrder FROM ptm_phases').get();
    const nextOrder = (stats?.maxOrder || 0) + 1;
    const labelNumMatch = trimmedLabel.match(/^(\d+)\s*:/);
    const nextPhaseNo = String(phaseNo || '').trim() || (labelNumMatch ? labelNumMatch[1] : String((stats?.count || 0) + 1));
    const key = `Phase-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const trimmedCreatedBy = String(createdBy || '').trim();
    const trimmedCreatedDate = String(createdDate || '').trim() || new Date().toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO ptm_phases (key, page_name, phase_no, label, sort_order, created_by, created_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(key, trimmedPageName, nextPhaseNo, trimmedLabel, nextOrder, trimmedCreatedBy, trimmedCreatedDate);

    const created = db
      .prepare('SELECT key, page_name, phase_no, label, sort_order, created_by, created_date, created_at, updated_at FROM ptm_phases WHERE key = ?')
      .get(key);

    const actor = resolveActorName(req, trimmedCreatedBy || 'Admin');
    logTemplateHistory({
      actionType: 'PHASE_CREATED',
      entityType: 'phase',
      entityName: trimmedLabel,
      details: `${actor} created phase "${trimmedLabel}"`,
      performedBy: actor,
    });

    return res.json({ success: true, data: formatPhaseRow(created) });
  } catch (error) {
    console.error('Error creating PTM phase:', error);
    return res.status(500).json({ success: false, message: 'Failed to create PTM phase' });
  }
}

export function updatePhase(req, res) {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can update phases.' });
    }

    const { key } = req.params;
    const existing = db.prepare('SELECT * FROM ptm_phases WHERE key = ?').get(key);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Phase not found' });
    }

    const { pageName, label, phaseNo, createdDate } = req.body || {};
    const nextLabel = label !== undefined ? String(label).trim() : existing.label;
    const nextPageName = pageName !== undefined ? String(pageName).trim() : nextLabel;
    const labelNumMatch = nextLabel.match(/^(\d+)\s*:/);
    const nextPhaseNo = phaseNo !== undefined
      ? String(phaseNo).trim()
      : (labelNumMatch ? labelNumMatch[1] : existing.phase_no);
    const nextCreatedDate = createdDate !== undefined ? String(createdDate).trim() : (existing.created_date || '');

    if (!nextLabel) {
      return res.status(400).json({
        success: false,
        message: 'Phase Title / Label cannot be empty.',
      });
    }

    db.prepare(`
      UPDATE ptm_phases
      SET page_name = ?, phase_no = ?, label = ?, created_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE key = ?
    `).run(nextPageName, nextPhaseNo, nextLabel, nextCreatedDate, key);

    // Keep existing templates' phase_label in sync when phase label changes
    if (nextLabel !== existing.label) {
      db.prepare(`
        UPDATE ptm_templates
        SET phase_label = ?, updated_at = CURRENT_TIMESTAMP
        WHERE phase_key = ?
      `).run(nextLabel, key);
    }

    const updated = db
      .prepare('SELECT key, page_name, phase_no, label, sort_order, created_by, created_date, created_at, updated_at FROM ptm_phases WHERE key = ?')
      .get(key);

    const actor = resolveActorName(req);
    logTemplateHistory({
      actionType: 'PHASE_UPDATED',
      entityType: 'phase',
      entityName: nextLabel,
      details: `${actor} updated phase "${existing.label}"${nextLabel !== existing.label ? ` → "${nextLabel}"` : ''}`,
      performedBy: actor,
    });

    return res.json({ success: true, data: formatPhaseRow(updated) });
  } catch (error) {
    console.error('Error updating PTM phase:', error);
    return res.status(500).json({ success: false, message: 'Failed to update PTM phase' });
  }
}

export function deletePhase(req, res) {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can delete phases.' });
    }

    const { key } = req.params;
    const existing = db.prepare('SELECT * FROM ptm_phases WHERE key = ?').get(key);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Phase not found' });
    }

    db.prepare('DELETE FROM ptm_templates WHERE phase_key = ?').run(key);
    db.prepare('DELETE FROM ptm_phases WHERE key = ?').run(key);

    const actor = resolveActorName(req);
    logTemplateHistory({
      actionType: 'PHASE_DELETED',
      entityType: 'phase',
      entityName: existing.label,
      details: `${actor} deleted phase "${existing.label}"`,
      performedBy: actor,
    });

    return res.json({ success: true, message: 'Phase deleted successfully' });
  } catch (error) {
    console.error('Error deleting PTM phase:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete PTM phase' });
  }
}

export function getTemplateHistory(req, res) {
  try {
    const rows = db
      .prepare(
        `SELECT id, action_type, entity_type, entity_name, details, performed_by, created_at
         FROM ptm_template_history
         ORDER BY id DESC
         LIMIT 500`
      )
      .all();

    const data = rows.map((r) => ({
      id: r.id,
      actionType: r.action_type,
      entityType: r.entity_type,
      entityName: r.entity_name || '',
      details: r.details || '',
      performedBy: r.performed_by || 'Admin',
      createdAt: r.created_at,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching PTM template history:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch template history' });
  }
}

export function recordTemplateHistory(req, res) {
  try {
    const { actionType, entityType, entityName, details, performedBy } = req.body || {};
    if (!actionType || !entityType || !details) {
      return res.status(400).json({ success: false, message: 'actionType, entityType, and details are required.' });
    }
    const actor = resolveActorName(req, performedBy || 'Admin');
    logTemplateHistory({
      actionType: String(actionType).trim(),
      entityType: String(entityType).trim(),
      entityName: String(entityName || '').trim(),
      details: String(details).trim(),
      performedBy: actor,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error recording PTM template history:', error);
    return res.status(500).json({ success: false, message: 'Failed to record template history' });
  }
}
