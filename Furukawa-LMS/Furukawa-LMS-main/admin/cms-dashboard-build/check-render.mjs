import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
globalThis.localStorage = { getItem: () => null };
globalThis.window = { innerWidth: 1200, location: { hash: '#/', href: 'http://localhost/#/', origin: 'http://localhost' }, history: { state: {idx:0}, replaceState() {} }, addEventListener() {}, removeEventListener() {} };
globalThis.document = { defaultView: window, querySelector: () => null };
const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(buildRoot, '..');
const require = createRequire(path.join(buildRoot, 'package.json'));
const server = await createServer({
  root: adminRoot,
  configFile: false,
  resolve: { alias: [
    { find: 'react-dom/server', replacement: require.resolve('react-dom/server') },
    { find: 'react', replacement: require.resolve('react') },
    { find: '@components', replacement: path.join(adminRoot, 'src/components') },
    { find: '@pages', replacement: path.join(adminRoot, 'src/pages') },
  ] },
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: true },
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const { default: App } = await server.ssrLoadModule('/src/pages/pdca/App.jsx');
  const html = renderToString(React.createElement(App));
  if (!html.includes('Add PDCA') || !html.includes('Company')) throw new Error('PDCA startup did not render');
  console.log('PDCA startup render passed');
} finally { await server.close(); }

