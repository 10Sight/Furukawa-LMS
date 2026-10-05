// Shared normalizers for lesson slide/element payloads.
// Centralized so every field added to the slide/element shape only needs to change in one place.

export const normalizeElement = (el, idx) => ({
  id: String(el.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
  type: el.type,
  xPct: Number(el.xPct ?? 10),
  yPct: Number(el.yPct ?? 10),
  wPct: Number(el.wPct ?? 20),
  hPct: Number(el.hPct ?? 10),
  rotation: Number(el.rotation ?? 0),
  zIndex: Number.isFinite(el.zIndex) ? Number(el.zIndex) : idx,
  groupId: el.groupId ? String(el.groupId) : null,
  locked: Boolean(el.locked),
  text: el.text,
  fill: el.fill,
  stroke: el.stroke,
  url: el.url,
  alt: el.alt,
  aspectRatio: typeof el.aspectRatio === 'number' ? el.aspectRatio : undefined,
});

export const normalizeSlide = (s, idx) => ({
  id: s.id || s._id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  _id: s._id || s.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  order: typeof s.order === 'number' ? s.order : idx + 1,
  contentHtml: String(s.contentHtml || ''),
  bgColor: s.bgColor || '#ffffff',
  images: Array.isArray(s.images) ? s.images.map(img => ({
    url: img.url,
    public_id: img.public_id,
    alt: img.alt || ''
  })) : [],
  elements: Array.isArray(s.elements) ? s.elements.map(normalizeElement) : [],
});
