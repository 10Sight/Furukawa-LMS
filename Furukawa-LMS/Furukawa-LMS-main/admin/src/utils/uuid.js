/**
 * Generates an RFC4122 v4 UUID safely across all browser contexts,
 * including insecure HTTP contexts (such as local IP access like http://192.168.x.x:5174),
 * where window.crypto.randomUUID is undefined.
 */
export function safeRandomUUID() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') {
    try {
      return randomUUID.call(globalThis.crypto);
    } catch {}
  }

  // Fallback for non-secure contexts (e.g. HTTP on local network IP)
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    try {
      globalThis.crypto.getRandomValues(bytes);
    } catch {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC4122
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default safeRandomUUID;
