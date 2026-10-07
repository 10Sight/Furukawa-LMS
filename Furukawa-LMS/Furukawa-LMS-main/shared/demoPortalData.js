// Synthetic portal fixtures. IDs share one hierarchy so cross-portal filters agree.
export const demoSections = [
  { id: 'demo-assembly', _id: 'demo-assembly', name: 'Assembly (Demo)', departmentId: 'demo-production', departmentName: 'Production (Demo)' },
  { id: 'demo-inspection', _id: 'demo-inspection', name: 'Inspection (Demo)', departmentId: 'demo-quality', departmentName: 'Quality (Demo)' },
];
export const demoLines = demoSections.map((section, i) => ({
  id: `demo-line-${i + 1}`, _id: `demo-line-${i + 1}`, name: `Line ${i + 1} (Demo)`,
  sectionId: section.id, sectionName: section.name, departmentId: section.departmentId,
}));
export const demoStations = demoLines.map((line, i) => ({
  id: `demo-station-${i + 1}`, _id: `demo-station-${i + 1}`, name: i ? 'Final inspection' : 'Harness assembly',
  lineId: line.id, sectionId: line.sectionId, departmentId: line.departmentId,
}));
export const demoContractors = [{ id: 'demo-contractor', name: 'Example Staffing (Demo)', code: 'DEMO', contactPerson: 'Demo Coordinator', email: 'staffing@example.com', phoneNumber: '0000000000' }];
export const demoTrainer = { id: 'demo-trainer', _id: 'demo-trainer', userName: 'DEMO-TRAINER', empId: 'DEMO-TRAINER', fullName: 'Kavita Rao (Demo)', email: 'trainer@example.com', role: 'INSTRUCTOR', isTrainer: true, isEmployee: false, status: 'ACTIVE', departments: ['demo-production', 'demo-quality'], unit: 'FME' };

const iso = date => date.toISOString().slice(0, 10);
export function demoPeriods(params = {}, now = new Date()) {
  const groupBy = params.groupBy || 'daily';
  const end = /^\d{4}-\d{2}-\d{2}$/.test(params.endDate || '') ? new Date(`${params.endDate}T12:00:00Z`) : new Date(now);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(params.startDate || '') ? new Date(`${params.startDate}T12:00:00Z`) : new Date(end);
  if (!params.startDate) { if (groupBy === 'monthly') start.setMonth(start.getMonth() - 5); else if (groupBy === 'yearly') start.setFullYear(start.getFullYear() - 2); else start.setDate(start.getDate() - 6); }
  if (groupBy === 'monthly') start.setDate(1);
  if (groupBy === 'yearly') start.setMonth(0, 1);
  const dates = [];
  for (let d = new Date(start); d <= end && dates.length < 366; ) {
    dates.push(new Date(d));
    if (groupBy === 'monthly') d.setMonth(d.getMonth() + 1); else if (groupBy === 'yearly') d.setFullYear(d.getFullYear() + 1); else d.setDate(d.getDate() + 1);
  }
  return { groupBy, start: iso(start), end: iso(end), dates, periods: dates.map(d => groupBy === 'monthly' ? iso(d).slice(0, 7) : groupBy === 'yearly' ? String(d.getFullYear()) : iso(d)) };
}

export function demoWorkbook() {
  const values = [['Daily standup (Demo)', 'Plan', 'Actual'], ['Production quantity', 120, 112], ['Quality checks', 20, 19], ['Attendance', 4, 3], ['Safety incidents', 0, 0]];
  const cells = {};
  values.forEach((row, r) => row.forEach((value, c) => { cells[`${String.fromCharCode(65 + c)}${r + 1}`] = { value, ...(r === 0 ? { bold: true, backgroundColor: '#dbeafe' } : {}) }; }));
  return { activeSheet: 'Daily Review', sheets: { 'Daily Review': { cells, rowCount: 30, columnCount: 12, conditionalRules: [], merges: [], columnWidths: { A: 240, B: 100, C: 100 }, rowHeights: {}, tables: [], media: [], charts: [] } }, version: 1 };
}

export function demoMeetings(now = new Date()) {
  return demoSections.map((section, i) => ({
    id: `demo-meeting-${i + 1}`, sectionId: section.id, departmentId: section.departmentId,
    agenda: i ? 'Quality and defect review (Demo)' : 'Daily production standup (Demo)',
    description: 'Review attendance, output, quality and improvement actions. Synthetic demo record.',
    meetingDate: iso(now), meetingTime: '09:00', createdByName: 'FME Demo Administrator', createdBy: 'demo-admin',
    ...demoWorkbook(),
  }));
}

export function demoMonthlyReport(folderId = 'demo-monthly-demo-assembly') {
  const now = new Date();
  const slide = (title, subtitle, metrics) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#f8fafc"/><rect width="1280" height="150" fill="#1e3a8a"/><text x="64" y="78" font-family="Arial" font-size="40" fill="white">${title}</text><text x="64" y="120" font-family="Arial" font-size="22" fill="#bfdbfe">${subtitle}</text>${metrics.map((m, i) => `<rect x="${64 + i * 390}" y="245" width="350" height="220" rx="18" fill="#dbeafe"/><text x="${88 + i * 390}" y="320" font-family="Arial" font-size="24" fill="#1e3a8a">${m[0]}</text><text x="${88 + i * 390}" y="405" font-family="Arial" font-size="52" fill="#0f172a">${m[1]}</text>`).join('')}<text x="64" y="655" font-family="Arial" font-size="20" fill="#64748b">Synthetic demo presentation — no production records</text></svg>`)}`;
  return { id: `demo-monthly-record-${folderId}`, folderId, title: 'Production and quality review (Demo)', name: 'Production and quality review (Demo)', month: now.toLocaleString('en-US', { month: 'long' }), year: String(now.getFullYear()), createdAt: now.toISOString(), conversionStatus: 'DONE', slideCount: 2,
    slides: [{ slideIndex: 0, url: slide('Monthly Production Review', 'Sample output, attendance and efficiency', [['Output', '112 / 120'], ['Attendance', '75%'], ['Efficiency', '93.3%']]) }, { slideIndex: 1, url: slide('Quality and Improvement Review', 'Sample checks and follow-up actions', [['Quality checks', '19 / 20'], ['Open actions', '2'], ['Safety incidents', '0']]) }] };
}

const owner = { name: 'FME DEMO ADMIN', code: 'ST080014', email: 'demo.admin@example.com', initials: 'DA', avatarBg: 'bg-indigo-500' };
export const demoPTMItems = ['Bawal', 'Gujrat'].flatMap((plant, index) => [
  { id: `DEMO-PTM-${index + 1}`, topic: `${plant} harness launch (Demo)`, description: 'Track APQP milestones, trial readiness and quality sign-off.', plant, scope: 'Company PTM', department: 'Production', date: '06-10-2026', time: '09:00', createdBy: owner, isSelf: false },
  { id: `DEMO-PTM-${index + 3}`, topic: `${plant} line improvement (Demo)`, description: 'Reduce setup time and improve daily output.', plant, scope: 'Self PTM', department: 'Quality', date: '06-10-2026', time: '10:30', createdBy: owner, isSelf: true },
]);
export const demoPDCAItems = ['Bawal', 'Gujrat'].flatMap((plant, index) => [
  { id: `DEMO-PDCA-${index + 1}`, topic: 'Reduce connector defects (Demo)', description: 'Plan: improve checks. Do: pilot training. Check: inspect results. Act: standardize.', plant, scope: 'Company PDCA', department: 'Quality', date: '06-10-2026', time: '11:00', createdBy: owner, assignedMembers: [], isSelf: false },
  { id: `DEMO-PDCA-${index + 3}`, topic: 'Improve changeover time (Demo)', description: 'Cross-functional improvement project targeting setup losses.', plant, scope: 'CFT PDCA', department: 'Production', date: '06-10-2026', time: '12:00', createdBy: owner, assignedMembers: [], isSelf: false },
]);
export const demoAuditDocuments = ['Bawal', 'Gujrat'].flatMap(unit => [
  { id: `demo-audit-procedure-${unit}`, folderId: 'procedure', formKey: 'Procedure', title: 'Process audit procedure (Demo)', unit, createdAt: '2026-10-06T09:00:00Z', isDefault: false },
  { id: `demo-audit-check-${unit}`, folderId: 'check-sheet', formKey: 'Process Audit Check Sheet', title: 'Assembly audit check sheet (Demo)', unit, createdAt: '2026-10-06T09:00:00Z', isDefault: false },
  { id: `demo-audit-auditors-${unit}`, folderId: 'auditer-list', formKey: 'Auditer List', title: 'Qualified auditors (Demo)', unit, createdAt: '2026-10-06T09:00:00Z', isDefault: false },
]);

// Returns undefined only when a request has no matching fixture.
export function portalFixture(pathname, params, { users, departments, courses }) {
  const matches = row => (!params.departmentId || ['all', 'ALL'].includes(params.departmentId) || params.departmentId.split(',').includes(row.departmentId)) && (!params.sectionId || ['all', 'ALL'].includes(params.sectionId) || params.sectionId === row.sectionId);
  const tail = pathname.split('/').pop();
  if (pathname === '/api/sections') return demoSections.filter(matches);
  if (pathname.startsWith('/api/sections/department/')) return demoSections.filter(s => tail.split(',').includes(s.departmentId));
  if (pathname === '/api/lines') return demoLines.filter(matches);
  if (pathname.startsWith('/api/lines/section/')) return demoLines.filter(l => l.sectionId === tail);
  if (pathname.startsWith('/api/lines/department/')) return demoLines.filter(l => l.departmentId === tail);
  if (pathname === '/api/stations' || pathname === '/api/machines') return demoStations.filter(matches);
  if (pathname === '/api/contractors') return demoContractors;
  if (pathname === '/api/quizzes') return { quizzes: [{ id: 'demo-quiz', _id: 'demo-quiz', title: 'Workplace Safety Test (Demo)', isDojo: true, isTheoretical: true, questions: [], passingScore: 70 }], totalPages: 1 };
  if (pathname === '/api/instructors') return { users: [demoTrainer], totalUsers: 1, totalPages: 1 };
  if (pathname === '/api/designations') return [{ id: 'demo-designation', name: 'Operator (Demo)' }];
  if (pathname === '/api/roles' || pathname === '/api/roles-permissions') return { roles: [{ id: 'demo-role', name: 'Demo Observer', targetLayout: 'admin', generateManagementPage: false, permissions: [], allowedPages: [] }] };
  if (pathname.startsWith('/api/departments/') && departments.some(d => d.id === tail)) return departments.find(d => d.id === tail);
  if (pathname.startsWith('/api/courses/') && courses.some(c => c.id === tail)) return courses.find(c => c.id === tail);
  if (pathname.startsWith('/api/daily-meeting-configs/')) return { departmentId: tail, shutter: false, sections: demoSections.filter(s => s.departmentId === tail).map(s => s.id) };
  if (pathname.startsWith('/api/daily-morning-meetings/section/')) return demoMeetings().filter(m => m.sectionId === tail);
  if (pathname.startsWith('/api/daily-morning-meetings/')) return demoMeetings().find(m => m.id === tail);
  if (pathname.startsWith('/api/daily-meeting-sheets/')) return demoWorkbook();
  if (pathname.startsWith('/api/monthly-report-folders/section/')) return [{ id: `demo-monthly-${tail}`, sectionId: tail, name: 'Monthly review (Demo)', title: 'Monthly review (Demo)', color: 'indigo', createdAt: new Date().toISOString() }];
  if (pathname.startsWith('/api/monthly-report-records/folder/')) return [demoMonthlyReport(tail)];
  if (pathname.startsWith('/api/monthly-report-records/')) return demoMonthlyReport(tail.replace('demo-monthly-record-', ''));
  if (pathname === '/api/dashboard/holidays') return [];
  if (pathname === '/api/dashboard/tenure-stats') return { manpower: { '0-16d': 2, '17-30d': 1, '31-60d': 1 }, attendance: { '0-16d': 1, '17-30d': 1, '31-60d': 1 }, absenteeism: { '0-16d': 1, '17-30d': 0, '31-60d': 0 }, attrition: { '0-16d': 1, '17-30d': 0, '31-60d': 0 }, masterTenure: { '0-16d': 2, '17-30d': 1, '31-60d': 1 } };
  const operators = users.filter(u => u.role === 'STUDENT');
  const attendance = operators.map((u, i) => ({ id: `demo-attendance-${i}`, userId: u.id, name: u.fullName, empId: u.empId, payCode: u.empId, date: params.date || iso(new Date()), departmentId: u.departments[0], sectionId: demoSections[i % 2].id, department: departments[i % 2].name, section: demoSections[i % 2].name, lineId: demoLines[i % 2].id, line: demoLines[i % 2].name, status: i === 3 ? 'Absent' : 'Present', attendanceStatus: i === 3 ? 'A' : 'P', inTime: i === 3 ? '' : '08:00', outTime: i === 3 ? '' : '16:30', shift: 'A', hrsWorked: i === 3 ? 0 : 8, otHrs: 0 }));
  if (pathname === '/api/attendance') return attendance.filter(matches);
  if (pathname === '/api/attendance/summary') return { total: 4, totalEmployees: 4, present: 3, absent: 1, unmapped: 0 };
  if (pathname === '/api/requirements/filters') return { departments, sections: demoSections, lines: demoLines };
  if (pathname === '/api/requirements') return { data: demoLines.filter(matches).map(l => ({ id: `demo-requirement-${l.id}`, departmentId: l.departmentId, departmentName: departments.find(d => d.id === l.departmentId)?.name, sectionId: l.sectionId, sectionName: l.sectionName, lineId: l.id, lineName: l.name, required: 3, requiredManpower: 3, actual: 2, present: 2, gap: 1, shift: 'A', date: params.date || iso(new Date()) })), pagination: { totalPages: 1, currentPage: 1, totalCount: 2 } };
  if (pathname === '/api/requirements/system-approval-time') return { approvalTime: '09:30' };
  if (pathname === '/api/section-heads/global-cc') return [];
  if (pathname === '/api/section-heads') return demoSections.map(s => ({ id: `head-${s.id}`, sectionId: s.id, name: owner.name, email: owner.email }));
  if (pathname === '/api/skill-matrix/evaluations/efficiency') return operators.map((u, i) => ({ userId: u.id, empId: u.empId, fullName: u.fullName, efficiency: 80 + i * 4, departmentId: u.departments[0], sectionId: demoSections[i % 2].id, lineId: demoLines[i % 2].id, lineName: demoLines[i % 2].name }));
  if (pathname === '/api/skill-matrix/evaluations/summary') return operators.map((u, i) => ({ userId: u.id, empId: u.empId, fullName: u.fullName, evaluated: 1, count: 1, allEfficiency: 80 + i * 4, presEfficiency: 80 + i * 4, absEfficiency: 0, lineId: demoLines[i % 2].id, sectionId: demoSections[i % 2].id }));
  if (pathname === '/api/daily-production-report/list') return [{ id: 'demo-dpr', departmentId: departments[0].id, departmentName: departments[0].name, date: iso(new Date()), productionQty: 112, planQty: 120, efficiency: 93.3, defectQty: 1 }];
  if (pathname.startsWith('/api/daily-production-report/history/')) return [{ id: 'demo-dpr', date: iso(new Date()), productionQty: 112, planQty: 120 }];
  if (pathname === '/api/daily-production-report/manual-stats') return { trend: demoPeriods(params).dates.map(d => ({ date: iso(d), srcEffPlan: 120, srcEffActual: 112, srcEffTarget: 95, srcDefAuto: 1, srcDefManual: 0, srcDefJoint: 0, srcDefProduction: 112, srcDefTarget: 1, qaDefAuto: 0, qaDefManual: 1, qaDefJoint: 0, qaDefProduction: 112, qaDefTarget: 1, qaEffPlan: 120, qaEffActual: 115, qaEffTarget: 95 })) };
  if (pathname.startsWith('/api/admin-home/')) {
    const allowed = new Set(['dojo-stats', 'handover-stats', 'test-paper-stats', 'user-status-stats', 'dojo-hiring-trend', 'dojo-handover-comparison', 'sixteen-day-monitoring-status', 'three-day-monitoring-status', 'cycle10-monitoring-status', 'skill-matrix-status', 'operator-observance-status', 'on-job-training-status', 'contractor-wise-operator-stats', 'skill-upgradation-status', 'multi-skilling-status', 'left-users-reason-trend', 'joining-handover-cohort-trend', 'dojo-temporary-metrics-trend', 'dojo-temporary-stage-snapshot']);
    if (!allowed.has(tail)) return undefined;
    const { groupBy, start, end, periods } = demoPeriods(params);
    const trend = periods.map((period, i) => ({ period, total: 4, maleCount: 2, femaleCount: 2, otherCount: 0, joinedCount: 4, handoverCount: 3, leftCount: 1, actual: 3, expected: 4, passedTheoretical: 3, failedTheoretical: 1, 'demo-production': 2, 'demo-quality': 1, reasons: { 'Personal reasons (Demo)': 1 } }));
    return { groupBy, start, end, trend, trendByResult: trend, stats: demoSections.map(s => ({ departmentId: s.departmentId, departmentName: s.departmentName, sectionId: s.id, passedCount: 3, failedCount: 1, period: periods.at(-1) })),
      seriesKeys: departments.filter(d => !params.departmentId || params.departmentId.split(',').includes(d.id)).map(d => ({ key: d.id, name: d.name, departmentId: d.id })),
      deptBreakdown: demoSections.map(s => ({ deptId: s.departmentId, deptName: s.departmentName, sectionId: s.id, sectionName: s.name, actual: 3, expected: 4 })),
      reasonsList: ['Personal reasons (Demo)'], summary: { total: 4, joinedCount: 4, handoverCount: 3, leftCount: 1, maleCount: 2, femaleCount: 2, expected: 4, actual: 3 }, distribution: [{ name: 'Active', value: 4 }], users: operators };
  }
  if (pathname === '/api/analytics/users') return { totalUsers: users.length, activeUsers: users.length, trend: demoPeriods(params).periods.map(period => ({ period, count: 4 })) };
  if (pathname === '/api/analytics/courses') return { totalCourses: courses.length, courses };
  return undefined;
}
