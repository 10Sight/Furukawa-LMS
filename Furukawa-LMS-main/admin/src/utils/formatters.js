/**
 * Returns a display-ready subtitle that always ends with "for <level>".
 * Maps "L0 (Dojo User)" → "L0" so headers stay clean.
 */
export const formatPaperSubTitle = (paperSubTitle, level, isDojo, defaultBase = "New Manpower") => {
  const displayLevel = level === "L0 (Dojo User)" || isDojo ? "L0" : (level || "L-2");
  const base = paperSubTitle || defaultBase;
  const suffix = `for ${displayLevel}`;
  if (base.toLowerCase().endsWith(suffix.toLowerCase())) return base;
  return `${base} for ${displayLevel}`;
};
