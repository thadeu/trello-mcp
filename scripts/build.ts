import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'dist/index.js');

mkdirSync(dirname(outfile), { recursive: true });

const result = await Bun.build({
  entrypoints: [join(root, 'src/index.ts')],
  outdir: join(root, 'dist'),
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
  banner: '#!/usr/bin/env node',
});

if (!result.success) {
  console.error('build failed');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

chmodSync(outfile, 0o755);
console.error(`build ok: ${outfile}`);
