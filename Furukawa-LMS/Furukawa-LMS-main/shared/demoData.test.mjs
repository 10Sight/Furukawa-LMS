import test from 'node:test';
import assert from 'node:assert/strict';
import { demoResponse, demoToken, demoModeEnabled, createDemoAdapter } from './demoData.js';

test('demo credentials accept normalized ID and enforce the exact password', () => {
  const request = { url: '/api/v1/auth/login', method: 'post', data: { userName: ' st080014 ', password: 'ST080014@FME' } };
  assert.equal(demoResponse(request).body.data.user.role, 'ADMIN');
  assert.equal(demoResponse({ ...request, data: { ...request.data, password: 'wrong' } }).status, 401);
  assert.equal(demoResponse({ ...request, data: { ...request.data, userName: 'other' } }).status, 401);
});
test('demo is opt-in and cannot enable production authentication', () => {
  assert.equal(demoModeEnabled({ DEV: true, VITE_DEMO_MODE: 'true' }), true);
  assert.equal(demoModeEnabled({ DEV: false, VITE_DEMO_MODE: 'true' }), false);
  assert.equal(demoModeEnabled({ DEV: true }), false);
});
test('protected fixtures require the demo session token', () => {
  assert.equal(demoResponse({ url: '/api/users' }).status, 401);
  const users = demoResponse({ url: '/api/users', token: demoToken, params: { role: 'STUDENT' } });
  assert.equal(users.body.data.users.length, 4);
  assert.equal(demoResponse({ url: '/api/v1/auth/profile', token: demoToken }).body.data.userName, 'ST080014');
});
test('writes and unsupported endpoints never report fake success', () => {
  assert.equal(demoResponse({ url: '/api/courses', method: 'post', token: demoToken }).status, 405);
  assert.equal(demoResponse({ url: '/api/unknown', token: demoToken }).status, 501);
});
test('adapter parses Axios JSON and rejects failed credentials', async () => {
  const adapter = createDemoAdapter(() => demoToken);
  const response = await adapter({ url: '/api/v1/auth/login', method: 'post', data: JSON.stringify({ userName: 'ST080014', password: 'ST080014@FME' }) });
  assert.equal(response.data.data.accessToken, demoToken);
  await assert.rejects(adapter({ url: '/api/v1/auth/login', method: 'post', data: '{}' }), error => error.response.status === 401);
});
