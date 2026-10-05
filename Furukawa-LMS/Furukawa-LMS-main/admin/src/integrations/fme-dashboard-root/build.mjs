import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
// A toolchain argument permits using the original project's installed versions.
const require = createRequire(path.join(process.argv[2] || root, 'package.json'));
const load = name => import(pathToFileURL(require.resolve(name)).href);
const { build } = await load('vite');
const { default: react } = await load('@vitejs/plugin-react');
const { default: tailwindcss } = await load('tailwindcss');
const { default: autoprefixer } = await load('autoprefixer');
const { default: tailwindConfig } = await import('./tailwind.config.js');
// Primary output: the admin app's public folder (dev server serves from here)
const adminPublicRoot = path.resolve(root, '../../../public');
const outDir = path.resolve(adminPublicRoot, 'cms-dashboard');
if (path.relative(adminPublicRoot, outDir) !== 'cms-dashboard') throw new Error('Unexpected dashboard build directory');
await build({
  root,
  configFile: false,
  base: '/cms-dashboard/',
  plugins: [react()],
  resolve: { alias: ['react-dom/client', 'react-dom', 'react/jsx-runtime', 'react', 'react-router-dom', 'lucide-react'].map(name => ({ find: name, replacement: require.resolve(name) })) },
  css: { postcss: { plugins: [tailwindcss({ ...tailwindConfig, content: [path.join(root, 'index.html'), path.join(root, 'src/**/*.{js,jsx}')] }), autoprefixer()] } },
  build: { outDir, emptyOutDir: true },
});
