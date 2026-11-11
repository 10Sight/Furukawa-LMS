import db from '../db/database.js';
import { isUserAdmin } from '../utils/authCheck.js';

export function getSheet(req, res) {
  try {
    const { key } = req.params;
    const row = db.prepare('SELECT header_info, rows_data FROM ptm_sheets WHERE sheet_key = ?').get(key);

    if (!row) {
      return res.json({ success: true, data: null });
    }

    return res.json({
      success: true,
      data: {
        headerInfo: row.header_info ? JSON.parse(row.header_info) : null,
        rows: row.rows_data ? JSON.parse(row.rows_data) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sheet data' });
  }
}

export function saveSheet(req, res) {
  try {
    const { key } = req.params;
    const { headerInfo, rows } = req.body;

    // Check if rows are being deleted from an existing sheet
    if (Array.isArray(rows)) {
      const existingRow = db.prepare('SELECT rows_data FROM ptm_sheets WHERE sheet_key = ?').get(key);
      if (existingRow && existingRow.rows_data) {
        try {
          const existingRows = JSON.parse(existingRow.rows_data);
          if (Array.isArray(existingRows) && existingRows.length > 0) {
            const newRowIds = new Set(rows.map((r) => r && r.id).filter(Boolean));
            const hasDeletedRow = existingRows.some((r) => r && r.id && !newRowIds.has(r.id)) || rows.length < existingRows.length;
            if (hasDeletedRow && !isUserAdmin(req)) {
              return res.status(403).json({
                success: false,
                message: 'Forbidden: Only administrators have permission to delete rows from the sheet.'
              });
            }
          }
        } catch (err) {
          console.warn('Error checking row permissions:', err);
        }
      }
    }

    const headerStr = headerInfo ? JSON.stringify(headerInfo) : null;
    const rowsStr = rows ? JSON.stringify(rows) : null;

    db.prepare(`
      INSERT INTO ptm_sheets (sheet_key, header_info, rows_data, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(sheet_key) DO UPDATE SET
        header_info = excluded.header_info,
        rows_data = excluded.rows_data,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, headerStr, rowsStr);

    return res.json({ success: true, message: 'Sheet data saved successfully' });
  } catch (error) {
    console.error('Error saving sheet data:', error);
    return res.status(500).json({ success: false, message: 'Failed to save sheet data' });
  }
}

