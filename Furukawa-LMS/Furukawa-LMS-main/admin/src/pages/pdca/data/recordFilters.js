export const PDCA_PLANTS = ['Bawal', 'Gujrat'];
export function matchesPlant(item, plant) {
  if (!PDCA_PLANTS.includes(plant)) return false;
  const savedPlant = (item.plant || '').toLowerCase();
  // Previously created forms used All Plants; retain access without moving them.
  return savedPlant === plant.toLowerCase() || savedPlant === 'all plants';
}
export function filterPDCARecords(data, plant, scope, search = '') {
  const query = search.toLowerCase().trim();
  return data.filter(item => matchesPlant(item, plant) &&
    (scope === 'Self PDCA' ? item.isSelf || item.scope === scope : item.scope === scope) &&
    (!query || [item.topic, item.description, item.id, item.createdBy?.name, item.createdBy?.code]
      .some(value => String(value || '').toLowerCase().includes(query))));
}
