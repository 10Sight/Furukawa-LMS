import db from '../db/database.js';

export function getSuggestions(req, res) {
  try {
    const rows = db.prepare('SELECT value FROM apqp_suggestions ORDER BY id ASC').all();
    return res.json({ success: true, data: rows.map((r) => r.value) });
  } catch (error) {
    console.error('Error fetching APQP suggestions:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch suggestions' });
  }
}

export function addSuggestion(req, res) {
  try {
    const { value } = req.body;
    if (!value || !value.trim()) {
      return res.status(400).json({ success: false, message: 'Value is required' });
    }
    const trimmed = value.trim();
    db.prepare('INSERT OR IGNORE INTO apqp_suggestions (value) VALUES (?)').run(trimmed);
    return res.json({ success: true, message: 'Suggestion added', data: trimmed });
  } catch (error) {
    console.error('Error adding suggestion:', error);
    return res.status(500).json({ success: false, message: 'Failed to add suggestion' });
  }
}

