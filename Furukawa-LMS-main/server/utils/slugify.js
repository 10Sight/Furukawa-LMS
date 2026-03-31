import { executeQuery } from "../db/mssqlHelper.js";

/**
 * Convert text to a URL-friendly slug
 */
export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "") // remove quotes
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics to hyphen
    .replace(/-{2,}/g, "-") // collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // trim hyphens
}

/**
 * Ensures a slug is unique within a table, appending a suffix if necessary.
 * 
 * @param {string} tableName - The SQL table name
 * @param {string} baseSlug - The preferred slug
 * @param {Object} scopeFilter - Optional additional filters (e.g. { courseId: 1 })
 * @param {string|number} selfId - Optional ID to exclude from the check
 * @returns {Promise<string>} - A unique slug
 */
export async function ensureUniqueSlug(tableName, baseSlug, scopeFilter = {}, selfId = null) {
  let slug = baseSlug;
  let suffix = 1;

  // If empty, fallback to random
  if (!slug) slug = Math.random().toString(36).slice(2, 8);

  const checkExists = async (candidate) => {
    let sql = `SELECT id FROM ${tableName} WHERE slug = ?`;
    let params = [candidate];

    for (const [key, val] of Object.entries(scopeFilter)) {
      sql += ` AND ${key} = ?`;
      params.push(val);
    }

    if (selfId) {
      sql += ` AND id != ?`;
      params.push(selfId);
    }

    const [rows] = await executeQuery(sql, params);
    return rows.length > 0;
  };

  let exists = await checkExists(slug);
  while (exists) {
    suffix += 1;
    const candidate = `${baseSlug}-${suffix}`;
    exists = await checkExists(candidate);
    if (!exists) {
      return candidate;
    }
  }
  return slug;
}
