/**
 * Returns a display-ready subtitle that always ends with "for <level>".
 * Maps "L0 (Dojo User)" → "L0" so headers stay clean.
 */
export const formatPaperSubTitle = (paperSubTitle, level, isDojo, defaultBase = "") => {
  if (!paperSubTitle) return "";
  const displayLevel = level === "L0 (Dojo User)" || isDojo ? "L0" : (level || "L-2");
  const base = paperSubTitle;
  const suffix = `for ${displayLevel}`;
  if (base.toLowerCase().endsWith(suffix.toLowerCase())) return base;
  return `${base} for ${displayLevel}`;
};

/**
 * Formats a test attempt duration stored in SECONDS (TakeQuiz submits
 * Math.floor(ms / 1000)) as "2m 15s", "45s" or "3m". Missing/zero → fallback.
 */
export const formatTimeTaken = (seconds, fallback = "—") => {
  const total = Math.floor(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) return fallback;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};
