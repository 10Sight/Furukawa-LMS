import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { cpSync, existsSync } from 'node:fs';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(buildRoot, '..');
if (!existsSync(path.join(buildRoot, 'node_modules', 'tailwindcss'))) {
  throw new Error('cms-dashboard-build requires its local dependencies (Tailwind 3). Please run "npm install" inside "admin/cms-dashboard-build" first.');
}
// A toolchain argument permits using the original project's installed versions.
const require = createRequire(path.join(process.argv[2] || buildRoot, 'package.json'));
const load = name => import(pathToFileURL(require.resolve(name)).href);
const { build } = await load('vite');
const { default: react } = await load('@vitejs/plugin-react');
const { default: tailwindcss } = await load('tailwindcss');
const { default: autoprefixer } = await load('autoprefixer');
const { default: tailwindConfig } = await import(pathToFileURL(path.join(buildRoot, 'tailwind.config.js')).href);
// Primary output: the admin app's public folder (dev server serves from here)
const adminPublicRoot = path.join(adminRoot, 'public');
const portalPublicRoot = path.resolve(adminRoot, '../portal/public');
const outDir = path.resolve(adminPublicRoot, 'cms-dashboard');
if (path.relative(adminPublicRoot, outDir) !== 'cms-dashboard') throw new Error('Unexpected dashboard build directory');
await build({
  root: buildRoot,
  publicDir: path.join(buildRoot, 'public'),
  configFile: false,
  base: '/cms-dashboard/',
  plugins: [react()],
  resolve: { alias: [
    ...['react-dom/client', 'react-dom', 'react/jsx-runtime', 'react', 'react-router-dom', 'lucide-react'].map(name => ({ find: name, replacement: require.resolve(name) })),
    { find: 'exceljs', replacement: path.resolve(adminRoot, 'node_modules/exceljs/dist/exceljs.min.js') },
    { find: '@', replacement: path.join(adminRoot, 'src') },
    { find: '@components', replacement: path.join(adminRoot, 'src/components') },
    { find: '@hooks', replacement: path.join(adminRoot, 'src/hooks') },
    { find: '@pages', replacement: path.join(adminRoot, 'src/pages') },
  ] },
  css: { postcss: { plugins: [tailwindcss({
    ...tailwindConfig,
    content: [
      path.join(buildRoot, 'index.html'),
      ...['lpa', 'pdca', 'ptm', 'process-audit', 'suggestion-checksheet'].map(module => path.join(adminRoot, `src/pages/${module}/**/*.{js,jsx}`)),
      ...['lpa', 'pdca', 'ptm', 'process-audit', 'shared', 'suggestion-checksheet'].map(module => path.join(adminRoot, `src/components/${module}/**/*.{js,jsx}`)),
      path.join(adminRoot, 'src/pages/integrationMain.jsx'),
    ],
  }), autoprefixer()] } },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(buildRoot, 'index.html'),
      output: {
        entryFileNames: 'assets/cms-dashboard-entry.js',
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.facadeModuleId) {
            const norm = chunkInfo.facadeModuleId.replace(/\\/g, '/');
            if (norm.includes('/pages/ptm/App')) return 'assets/ptm-module.js';
            if (norm.includes('/pages/pdca/App')) return 'assets/pdca-module.js';
            if (norm.includes('/pages/process-audit/ProcessAudit')) return 'assets/process-audit-module.js';
            if (norm.includes('/pdcaExcelExport')) return 'assets/pdca-excel-export.js';
            if (norm.includes('exceljs')) return 'assets/exceljs-vendor.js';
          }
          if (chunkInfo.name === 'rolldown-runtime') return 'assets/runtime-shared.js';
          if (chunkInfo.name === 'AddStaffEmployeeModal') return 'assets/shared-components.js';
          return 'assets/cms-shared-[name].js';
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || (assetInfo.names && assetInfo.names[0]) || 'asset';
          const ext = path.extname(name);
          const base = path.basename(name, ext);
          if (base === 'index' && ext === '.css') return 'assets/cms-dashboard.css';
          if (base === 'ProcessAudit' && ext === '.css') return 'assets/process-audit-module.css';
          if (base === 'AddStaffEmployeeModal' && ext === '.css') return 'assets/shared-components.css';
          return `assets/${base}${ext}`;
        }
      }
    }
  },
});
// Both CMS hosts serve the same canonical integration bundle if portal exists.
if (existsSync(path.dirname(portalPublicRoot))) {
  cpSync(outDir, path.join(portalPublicRoot, 'cms-dashboard'), { recursive: true });
}
