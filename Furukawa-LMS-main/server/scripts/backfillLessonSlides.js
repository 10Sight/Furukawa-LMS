import { pool } from '../db/connectDB.js';
import Lesson from '../models/lesson.model.js';

(async () => {
  try {
    console.log('Starting backfill for lesson slides (SQL)...');

    // Find lessons where slides are missing or empty
    const [lessons] = await pool.query("SELECT * FROM lessons WHERE slides IS NULL OR JSON_LENGTH(slides) = 0");

    let updated = 0;
    for (const row of lessons) {
      const lesson = new Lesson(row);
      const contentHtml = (lesson.content && String(lesson.content).trim().length > 0) ? String(lesson.content) : '';

      const slides = contentHtml
        ? [{ order: 1, contentHtml, bgColor: '#ffffff', images: [] }]
        : [];

      lesson.slides = slides;
      await lesson.save();
      updated += 1;
    }

    console.log(`Backfill complete. Updated ${updated} lessons.`);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
})();