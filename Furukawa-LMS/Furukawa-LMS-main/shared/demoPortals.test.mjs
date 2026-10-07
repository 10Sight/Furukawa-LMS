import test from 'node:test';
import assert from 'node:assert/strict';
import { demoResponse, demoToken } from './demoData.js';
import { demoSections, demoLines, demoPTMItems, demoPDCAItems, demoAuditDocuments } from './demoPortalData.js';

const get = url => {
  const response = demoResponse({ url, token: demoToken });
  assert.equal(response.status, 200, url);
  return response.body.data;
};
test('MPS has metrics, attendance, hierarchy and tenure data', () => {
  assert.ok(get('/api/dashboard/stats').manpowerData.every(r => r.current > 0 && r.required > 0));
  assert.equal(get('/api/attendance').length, 4);
  assert.equal(get('/api/attendance?departmentId=demo-quality').length, 2);
  assert.equal(get('/api/dashboard/tenure-stats').absenteeism['0-16d'], 1);
  const filters = demoResponse({ url: '/api/attendance/filters', token: demoToken }).body;
  assert.equal(filters.sections.length, 2);
  assert.equal(get('/api/roles-permissions').roles.length, 1);
});
test('SDP has populated chart series, courses, trainer and sample operators', () => {
  for (const endpoint of ['dojo-hiring-trend', 'joining-handover-cohort-trend', 'sixteen-day-monitoring-status', 'three-day-monitoring-status', 'cycle10-monitoring-status', 'skill-matrix-status', 'operator-observance-status', 'on-job-training-status', 'skill-upgradation-status', 'multi-skilling-status', 'test-paper-stats']) {
    const data = get(`/api/admin-home/${endpoint}?groupBy=monthly&startDate=2026-01-01&endDate=2026-06-30`);
    assert.equal(data.trend.length, 6);
    assert.ok(data.trend.every(r => r.total > 0));
    assert.ok(data.seriesKeys.every(key => Number.isFinite(data.trend[0][key.key])));
  }
  assert.equal(get('/api/users?role=INSTRUCTOR').users.length, 1);
  assert.ok(get('/api/courses').courses.every(c => c.modules[0].lessons.length > 0));
  assert.equal(get('/api/skill-matrix/evaluations/efficiency').length, 4);
});
test('MIS meetings are scoped to the same sections and include valid workbooks', () => {
  for (const section of demoSections) {
    const meetings = get(`/api/daily-morning-meetings/section/${section.id}`);
    assert.equal(meetings.length, 1);
    const meeting = get(`/api/daily-morning-meetings/${meetings[0].id}`);
    assert.equal(meeting.departmentId, section.departmentId);
    assert.equal(meeting.sheets[meeting.activeSheet].cells.A1.value, 'Daily standup (Demo)');
    assert.equal(get(`/api/daily-meeting-configs/${section.departmentId}`).sections[0], section.id);
    assert.equal(get(`/api/lines/section/${section.id}`)[0].id, demoLines.find(l => l.sectionId === section.id).id);
  }
});
test('CMS has projects and audit records for both units', () => {
  for (const unit of ['Bawal', 'Gujrat']) {
    assert.ok(demoPTMItems.some(item => item.plant === unit));
    assert.ok(demoPDCAItems.some(item => item.plant === unit));
    assert.ok(demoAuditDocuments.some(item => item.unit === unit));
  }
});
test('CMS seeding preserves normal saved records and uses separate demo storage', async () => {
  const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }; };
  const previous = { window: globalThis.window, sessionStorage: globalThis.sessionStorage, localStorage: globalThis.localStorage };
  try {
    globalThis.sessionStorage = storage(); globalThis.localStorage = storage();
    localStorage.setItem('ptm_dashboard_items', '[{"id":"existing-real-project"}]');
    globalThis.window = { location: { search: '?page=ptm&demo=1' } };
    const demo = await import('../admin/src/integrations/fme-dashboard/src/demoData.js?test-demo');
    demo.initializeCmsDemo();
    assert.equal(JSON.parse(demo.cmsStorage.getItem('ptm_dashboard_items')).length, 4);
    assert.equal(JSON.parse(localStorage.getItem('ptm_dashboard_items'))[0].id, 'existing-real-project');
    demo.cmsStorage.setItem('ptm_dashboard_items', '[]');
    demo.initializeCmsDemo();
    assert.equal(demo.cmsStorage.getItem('ptm_dashboard_items'), '[]');
    globalThis.window = { location: { search: '?page=ptm' } };
    const normal = await import('../admin/src/integrations/fme-dashboard/src/demoData.js?test-normal');
    assert.equal(normal.cmsPTMItems.length, 0);
    assert.equal(JSON.parse(normal.cmsStorage.getItem('ptm_dashboard_items'))[0].id, 'existing-real-project');
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
