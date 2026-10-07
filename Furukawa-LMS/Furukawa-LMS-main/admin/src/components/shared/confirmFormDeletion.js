export function confirmFormDeletion(label) {
  return window.confirm(`Delete “${label}”? This action cannot be undone.`);
}
