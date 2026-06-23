import { chmodSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const bundleOut = join(distDir, 'index.js');
const mainOut = join(distDir, 'main.js');
const launcherOut = join(distDir, 'index.js');

const MIN_NODE_MAJOR = 20;

const launcher = `#!/usr/bin/env node

const major = Number(process.versions.node.split('.')[0]);

if (major < ${MIN_NODE_MAJOR}) {
  console.error(
    '[trello-mcp] Node.js ${MIN_NODE_MAJOR}+ required (current: ' + process.version + ').',
    '\\n[trello-mcp] Global installs use "node" from your PATH — it may differ from fnm/nvm.',
    '\\n[trello-mcp] Try: fnm use 20  OR  nvm use 20  OR  node -v'
  );
  process.exit(1);
}

import('./main.js').catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[trello-mcp] fatal: ' + message);
  process.exit(1);
});
`;

mkdirSync(distDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(root, 'src/index.ts')],
  outdir: distDir,
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
});

if (!result.success) {
  console.error('build failed');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

renameSync(bundleOut, mainOut);
writeFileSync(launcherOut, launcher, 'utf8');
chmodSync(launcherOut, 0o755);
chmodSync(mainOut, 0o755);

console.error(`build ok: ${launcherOut} -> main.js`);
