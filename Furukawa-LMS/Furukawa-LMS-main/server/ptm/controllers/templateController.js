import db from '../db/database.js';
import { isUserAdmin } from '../utils/authCheck.js';

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

    const { templateName, templateDate, rows } = req.body || {};
    const nextName = templateName !== undefined ? String(templateName).trim() : existing.template_name;
    const nextDate = templateDate !== undefined ? String(templateDate).trim() : existing.template_date;
    const nextRowsStr = rows !== undefined ? JSON.stringify(Array.isArray(rows) ? rows : []) : existing.rows_data;

    db.prepare(`
      UPDATE ptm_templates
      SET template_name = ?, template_date = ?, rows_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextName, nextDate, nextRowsStr, id);

    return res.json({
      success: true,
      data: {
        id,
        phaseKey: existing.phase_key,
        phaseLabel: existing.phase_label,
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
    db.prepare('DELETE FROM ptm_templates WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting PTM template:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete PTM template' });
  }
}
