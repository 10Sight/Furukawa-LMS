// Skilled / unskilled classification of operators against the default course level config
// (course_level_configs, isDefault = 1). The first level (order 0, normally L1) and
// unevaluated operators are unskilled; every higher level is skilled. Used by the
// Manpower Efficiency charts so the split is decided in one place, server-side.

// "l-2 " and "L2" compare equal.
export const normalizeLevel = (name) => String(name ?? "").replace(/[\s-]/g, "").toUpperCase();

const parseSkill = (raw) => {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch { return null; }
};

// Level resolution: the operator's level on their assigned sub-section (currentSkill map),
// then their global currentLevel. `levels` is the config's levels array ({ name, order }).
// Returns { levelName, levelOrder, isSkilled, unclassified }; `unclassified` marks a level
// name that neither matches the config nor reads as "L<n>" — counted unskilled.
export const classifyOperatorLevel = ({ currentSkill, currentLevel, subSectionId }, levels = []) => {
    const skill = parseSkill(currentSkill);
    const levelName = (subSectionId != null && skill?.[String(subSectionId)]) || currentLevel || null;
    if (!levelName) return { levelName: null, levelOrder: 0, isSkilled: false, unclassified: false };

    const key = normalizeLevel(levelName);
    const match = levels.find(l => normalizeLevel(l.name) === key);
    if (match) {
        const order = Number(match.order) || 0;
        return { levelName, levelOrder: order, isSkilled: order > 0, unclassified: false };
    }

    // A level the config doesn't list (e.g. L4 on an L1–L3 config): L<n> → order n-1
    const m = key.match(/^L(\d+)$/);
    if (m) {
        const order = Math.max(Number(m[1]) - 1, 0);
        return { levelName, levelOrder: order, isSkilled: order > 0, unclassified: false };
    }
    return { levelName, levelOrder: 0, isSkilled: false, unclassified: true };
};
