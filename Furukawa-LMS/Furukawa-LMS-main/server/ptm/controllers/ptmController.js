import db from '../db/database.js';
import { isUserAdmin } from '../utils/authCheck.js';

export function getAllPTM(req, res) {
  try {
    const rows = db.prepare('SELECT * FROM ptm_items ORDER BY created_at DESC').all();
    const items = rows.map((r) => ({
      id: r.id,
      topic: r.topic,
      description: r.description,
      plant: r.plant,
      scope: r.scope,
      department: r.department,
      date: r.date,
      time: r.time,
      createdBy: {
        name: r.owner_name,
        code: r.owner_code,
        avatarBg: r.avatar_bg || 'bg-blue-100 text-blue-700',
        initials: r.initials || 'NA',
      },
      isBlankPTM: Boolean(r.is_blank_ptm),
      isSelf: Boolean(r.is_self),
    }));
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching PTM items:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch PTM items' });
  }
}

export function createPTM(req, res) {
  try {
    const {
      id,
      topic,
      description = '',
      plant = 'Bawal',
      scope = 'Company',
      department = '',
      date = '',
      time = '',
      createdBy = {},
      isBlankPTM = true,
      isSelf = false,
    } = req.body;

    const itemId = id || `PTM-${plant === 'Gujrat' ? 'GJ' : 'BW'}-${Math.floor(100 + Math.random() * 900)}`;
    const ownerName = createdBy.name || '';
    const ownerCode = createdBy.code || '';
    const avatarBg = createdBy.avatarBg || 'bg-blue-100 text-blue-700';
    const initials = createdBy.initials || 'NA';

    const insert = db.prepare(`
      INSERT INTO ptm_items (id, topic, description, plant, scope, department, date, time, owner_name, owner_code, avatar_bg, initials, is_blank_ptm, is_self)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      itemId,
      topic,
      description,
      plant,
      scope,
      department,
      date,
      time,
      ownerName,
      ownerCode,
      avatarBg,
      initials,
      isBlankPTM ? 1 : 0,
      isSelf ? 1 : 0
    );

    const createdItem = {
      id: itemId,
      topic,
      description,
      plant,
      scope,
      department,
      date,
      time,
      createdBy: {
        name: ownerName,
        code: ownerCode,
        avatarBg,
        initials,
      },
      isBlankPTM,
      isSelf,
    };

    return res.status(201).json({ success: true, data: createdItem });
  } catch (error) {
    console.error('Error creating PTM item:', error);
    return res.status(500).json({ success: false, message: 'Failed to create PTM item' });
  }
}

export function updatePTM(req, res) {
  try {
    const { id } = req.params;
    const {
      topic,
      description = '',
      plant = 'Bawal',
      scope = 'Company',
      department = '',
      date = '',
      time = '',
      createdBy = {},
      isSelf = false,
    } = req.body;

    const ownerName = createdBy.name || '';
    const ownerCode = createdBy.code || '';
    const avatarBg = createdBy.avatarBg || 'bg-blue-100 text-blue-700';
    const initials = createdBy.initials || 'NA';

    const update = db.prepare(`
      UPDATE ptm_items
      SET topic = ?, description = ?, plant = ?, scope = ?, department = ?, date = ?, time = ?,
          owner_name = ?, owner_code = ?, avatar_bg = ?, initials = ?, is_self = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    update.run(
      topic,
      description,
      plant,
      scope,
      department,
      date,
      time,
      ownerName,
      ownerCode,
      avatarBg,
      initials,
      isSelf ? 1 : 0,
      id
    );

    return res.json({
      success: true,
      data: {
        id,
        topic,
        description,
        plant,
        scope,
        department,
        date,
        time,
        createdBy: {
          name: ownerName,
          code: ownerCode,
          avatarBg,
          initials,
        },
        isSelf,
      },
    });
  } catch (error) {
    console.error('Error updating PTM item:', error);
    return res.status(500).json({ success: false, message: 'Failed to update PTM item' });
  }
}

export function deletePTM(req, res) {
  try {
    if (!isUserAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only administrators have permission to delete PTM sheets.'
      });
    }
    const { id } = req.params;
    db.prepare('DELETE FROM ptm_items WHERE id = ?').run(id);
    db.prepare('DELETE FROM ptm_sheets WHERE sheet_key = ?').run(`item_${id}`);
    return res.json({ success: true, message: 'PTM item deleted' });
  } catch (error) {
    console.error('Error deleting PTM item:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete PTM item' });
  }
}

