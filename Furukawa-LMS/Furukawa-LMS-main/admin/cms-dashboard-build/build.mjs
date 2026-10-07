import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { cpSync } from 'node:fs';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(buildRoot, '..');
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
    { find: '@components', replacement: path.join(adminRoot, 'src/components') },
    { find: '@pages', replacement: path.join(adminRoot, 'src/pages') },
  ] },
  css: { postcss: { plugins: [tailwindcss({
    ...tailwindConfig,
    content: [
      path.join(buildRoot, 'index.html'),
      ...['lpa', 'pdca', 'ptm', 'process-audit'].map(module => path.join(adminRoot, `src/pages/${module}/**/*.{js,jsx}`)),
      ...['lpa', 'pdca', 'ptm', 'process-audit', 'shared'].map(module => path.join(adminRoot, `src/components/${module}/**/*.{js,jsx}`)),
      path.join(adminRoot, 'src/pages/integrationMain.jsx'),
    ],
  }), autoprefixer()] } },
  build: { outDir, emptyOutDir: false, rollupOptions: { input: path.join(buildRoot, 'index.html') } },
});
// Both CMS hosts serve the same canonical integration bundle.
cpSync(outDir, path.join(portalPublicRoot, 'cms-dashboard'), { recursive: true });
