import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const root = path.dirname(fileURLToPath(import.meta.url));
const admin = path.resolve(root, '..');
const require = createRequire(path.join(admin, 'package.json'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fme-lpa-tests-'));
const output = path.join(temp, 'lpa.test.cjs');
try {
  require('esbuild').buildSync({ entryPoints: [path.join(admin, 'src/pages/lpa/lpaStore.test.js')], outfile: output, bundle: true, platform: 'node', format: 'cjs', nodePaths: [path.join(admin, 'node_modules')], logLevel: 'warning' });
  const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  fs.unlinkSync(output);
  fs.rmdirSync(temp);
}
