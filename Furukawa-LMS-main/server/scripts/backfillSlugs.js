import { pool } from '../db/connectDB.js';
import { slugify, ensureUniqueSlug } from '../utils/slugify.js';

async function backfill() {
  const updated = { course: 0, module: 0, lesson: 0, quiz: 0, department: 0, user: 0 };

  // Helper to fetch and update
  const processEntity = async (tableName, titleField, scopeFilter = {}) => {
    const [rows] = await pool.query(`SELECT * FROM ${tableName} WHERE slug IS NULL OR slug = ''`);
    let count = 0;
    for (const row of rows) {
      const base = slugify(row[titleField]);
      const newSlug = await ensureUniqueSlug(tableName, base, scopeFilter, row.id);
      await pool.query(`UPDATE ${tableName} SET slug = ? WHERE id = ?`, [newSlug, row.id]);
      count++;
    }
    return count;
  };

  updated.course = await processEntity('courses', 'title');

  // Modules (scoped by course)
  const [modules] = await pool.query("SELECT * FROM modules WHERE slug IS NULL OR slug = ''");
  for (const m of modules) {
    const base = slugify(m.title);
    const newSlug = await ensureUniqueSlug('modules', base, { course: m.course }, m.id);
    await pool.query("UPDATE modules SET slug = ? WHERE id = ?", [newSlug, m.id]);
    updated.module++;
  }

  // Lessons (scoped by module)
  const [lessons] = await pool.query("SELECT * FROM lessons WHERE slug IS NULL OR slug = ''");
  for (const l of lessons) {
    const base = slugify(l.title);
    const newSlug = await ensureUniqueSlug('lessons', base, { module: l.module }, l.id);
    await pool.query("UPDATE lessons SET slug = ? WHERE id = ?", [newSlug, l.id]);
    updated.lesson++;
  }

  updated.quiz = await processEntity('quizzes', 'title');
  updated.department = await processEntity('departments', 'name');
  updated.user = await processEntity('users', 'userName');

  return updated;
}

(async () => {
  try {
    const res = await backfill();
    console.log("Backfill complete:", res);
    process.exit(0);
  } catch (e) {
    console.error("Backfill failed:", e);
    process.exit(1);
  }
})();
