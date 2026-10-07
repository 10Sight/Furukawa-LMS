// Synthetic fixtures used only by the explicitly enabled frontend demo mode.
import { demoSections, demoLines, demoStations, demoTrainer, portalFixture } from './demoPortalData.js';
export const demoToken = 'local-demo-ST080014';
export const demoUser = {
  id: 'demo-admin', _id: 'demo-admin', userName: 'ST080014', empId: 'ST080014',
  fullName: 'FME Demo Administrator', email: 'demo.admin@example.com',
  role: 'ADMIN', isAdmin: true, isEmployee: true, status: 'ACTIVE',
  unit: 'FME', departments: ['demo-production', 'demo-quality'], sections: demoSections.map(s => s.id), privileges: [],
};
export const demoDepartments = [
  { id: 'demo-production', _id: 'demo-production', name: 'Production (Demo)', uniCode: 'DEMO-PROD', capacity: 30, students: [], instructors: [], courses: [] },
  { id: 'demo-quality', _id: 'demo-quality', name: 'Quality (Demo)', uniCode: 'DEMO-QA', capacity: 20, students: [], instructors: [], courses: [] },
];
export const demoUsers = [demoUser, demoTrainer, ...['Aarav Sharma', 'Priya Verma', 'Rohan Singh', 'Neha Patel'].map((fullName, index) => ({
  id: `demo-operator-${index + 1}`, _id: `demo-operator-${index + 1}`,
  fullName, userName: `DEMO00${index + 1}`, empId: `DEMO00${index + 1}`,
  email: `operator${index + 1}@example.com`, role: 'STUDENT', status: 'ACTIVE',
  isEmployee: true, isAdmin: false, departments: [demoDepartments[index % 2].id],
  sections: [demoSections[index % 2].id], lines: [demoLines[index % 2].id], stations: [demoStations[index % 2].id],
  currentSkill: [{ stationId: demoStations[index % 2].id, level: index < 2 ? 'L1' : 'L2' }], gender: index % 2 ? 'Female' : 'Male',
  joiningDate: new Date(new Date().getFullYear(), new Date().getMonth(), Math.max(1, new Date().getDate() - 3)).toISOString().slice(0, 10), shift: 'A', unit: 'FME',
  contractorId: 'demo-contractor', education: 'ITI', state: 'Haryana', district: 'Rewari',
}))];
export const demoCourses = ['Workplace Safety', 'Quality Fundamentals', 'Machine Operation'].map((title, index) => ({
  id: `demo-course-${index + 1}`, _id: `demo-course-${index + 1}`, title,
  description: `${title} — sample training content for the local demo.`,
  status: 'PUBLISHED', isPublished: true, instructorId: demoTrainer.id, instructor: demoTrainer,
  modules: [{ id: `demo-module-${index + 1}`, title: 'Introduction (Demo)', lessons: [{ id: `demo-lesson-${index + 1}`, title: 'Training overview', content: 'Synthetic learning material for demo browsing.', type: 'TEXT' }] }],
  students: demoUsers.filter(u => u.role === 'STUDENT').map(u => u.id), enrollments: [],
  duration: 60, level: 'BEGINNER', createdAt: '2026-09-01T09:00:00.000Z',
}));

const envelope = data => ({ success: true, statusCode: 200, message: 'Local demo data', data });
const fail = (status, message) => ({ status, body: { success: false, statusCode: status, message } });
const success = data => ({ status: 200, body: envelope(data) });

export function demoModeEnabled(env = {}) {
  return env.DEV === true && env.VITE_DEMO_MODE === 'true';
}

export function demoResponse({ url, method = 'get', data, params = {}, token }) {
  const parsedUrl = new URL(url, 'http://demo.local');
  const pathname = parsedUrl.pathname.replace(/\/$/, '');
  params = { ...Object.fromEntries(parsedUrl.searchParams), ...params };
  const verb = method.toUpperCase();
  const input = typeof data === 'string' ? JSON.parse(data || '{}') : (data || {});
  if (pathname === '/api/v1/auth/login' && verb === 'POST') {
    if (String(input.userName || '').trim().toUpperCase() !== 'ST080014' || input.password !== 'ST080014@FME') {
      return fail(401, 'Invalid demo username or password.');
    }
    return success({ user: demoUser, accessToken: demoToken, redirectUrl: '/' });
  }
  if (token !== demoToken) return fail(401, 'Please log in to the local demo.');
  if (pathname === '/api/v1/auth/logout') return success(null);
  if (['/api/v1/auth/profile', '/api/users/profile'].includes(pathname)) return success(demoUser);
  // View telemetry is acknowledged locally; it is never sent to the server.
  if (pathname === '/api/audits/log' && verb === 'POST') return success({ id: 'demo-local-activity', demo: true });
  if (verb !== 'GET') return fail(405, 'This demo is read-only. Changes require the real backend.');
  if (pathname === '/api/users') {
    const users = demoUsers.filter(u => (!params.role || u.role === params.role) && (!params.search || `${u.fullName} ${u.empId}`.toLowerCase().includes(params.search.toLowerCase())));
    return success({ users, totalUsers: users.length, totalPages: 1, currentPage: 1 });
  }
  if (pathname.startsWith('/api/users/')) {
    const user = demoUsers.find(u => u.id === pathname.split('/').pop());
    if (user) return success(user);
  }
  if (pathname === '/api/departments') return success({ departments: demoDepartments.map(d => ({ ...d, instructors: [demoTrainer], students: demoUsers.filter(u => u.role === 'STUDENT' && u.departments.includes(d.id)), courses: demoCourses })), totalDepartments: 2, totalPages: 1 });
  if (pathname === '/api/courses') return success({ courses: demoCourses, totalCourses: 3, totalPages: 1 });
  if (pathname === '/api/privileges') return success([]);
  if (pathname === '/api/dashboard/stats') {
    const today = new Date();
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today); date.setDate(today.getDate() - 6 + index);
      return { fullDate: date.toISOString().slice(0, 10), day: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), total: 4, current: 4, masterTotal: 4, count: 4, required: 6, manpower: 4, present: 3, rawPresent: 3, totalPresent: 3, absent: 1, absenteeism: 25, joinedCount: 1, handoverCount: 1, pendingCount: 0, rejoiningCount: 1, attritionCount: 0 };
    });
    return success({ totalUsers: demoUsers.length, totalEmployees: 4, totalManpower: 4, totalCourses: 3, totalDepartments: 2,
      manpowerData: trend, rejoiningData: trend, handoverData: trend, attritionData: trend.map(d => ({ ...d, count: 0 })), absenteeismData: trend,
      filters: { snapshotTotal: 4, attendanceDateAvailable: true }, holidays: [],
      pieCharts: { gender: [{ name: 'Male', value: 2, masterValue: 2, attendanceValue: 2, totalEmployees: 4, denominatorTotal: 4, percentage: 50, masterPercentage: 50 }, { name: 'Female', value: 2, masterValue: 2, attendanceValue: 2, totalEmployees: 4, denominatorTotal: 4, percentage: 50, masterPercentage: 50 }], skillLevels: [{ name: 'L1', value: 2, attendanceValue: 2, masterValue: 2, totalEmployees: 4, denominatorTotal: 4, percentage: 50, masterPercentage: 50 }, { name: 'L2', value: 2, attendanceValue: 2, masterValue: 2, totalEmployees: 4, denominatorTotal: 4, percentage: 50, masterPercentage: 50 }], education: [{ name: 'ITI', value: 4 }], state: [{ name: 'Haryana', value: 4 }], district: [{ name: 'Rewari', value: 4 }], contractorPrefix: [{ name: 'Example Staffing (Demo)', value: 4 }], stateOptions: ['Haryana'], districtOptions: ['Rewari'] } });
  }
  if (pathname === '/api/dashboard/attendance') return success({ total: 4, present: 3, absent: 1, attendance: [] });
  if (pathname === '/api/analytics/dashboard') return success({ totalUsers: demoUsers.length, totalCourses: 3, totalDepartments: 2, totalEnrollments: 4 });
  if (pathname === '/api/attendance/filters') return { status: 200, body: { success: true, departments: demoDepartments, sections: demoSections, lines: demoLines } };
  const fixture = portalFixture(pathname, params, { users: demoUsers, departments: demoDepartments, courses: demoCourses });
  if (fixture !== undefined) return success(fixture);
  // Unknown routes never fall through to a production backend with demo credentials.
  return fail(501, 'This screen does not have local demo data yet.');
}

export function createDemoAdapter(getToken) {
  return async config => {
    const result = demoResponse({ ...config, token: getToken() });
    const response = { data: result.body, status: result.status, statusText: result.status === 200 ? 'OK' : 'Demo request failed', headers: {}, config };
    if (result.status !== 200) {
      const error = new Error(result.body.message);
      error.response = response; error.config = config;
      throw error;
    }
    return response;
  };
}
