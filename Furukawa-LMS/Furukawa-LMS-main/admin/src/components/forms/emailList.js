export const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/** Parse a stored recipient string ("a@x.com, b@x.com; c@x.com") into a list. */
export const parseEmails = (value) =>
    String(value || "")
        .split(/[,;]/)
        .map((e) => e.trim())
        .filter(Boolean);

/** Normalise a stored recipient string to the canonical "a@x.com, b@x.com" form. */
export const normalizeEmails = (value) => parseEmails(value).join(", ");

/**
 * Split free-form typed/pasted text into candidate addresses. Handles
 * comma/semicolon/newline lists, whitespace-separated lists and Outlook-style
 * "Name <user@x.com>" entries.
 */
export const splitInput = (text) =>
    String(text || "")
        .split(/[,;\n\r]+/)
        .flatMap((part) => {
            const bracketed = part.match(/<([^>]+)>/);
            if (bracketed) return [bracketed[1].trim()];
            return part.trim().split(/\s+/);
        })
        .filter(Boolean);
