import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pkg from '../package.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliDir = join(root, 'cli');
const outRoot = join(root, 'npm');

type Target = {
  os: 'darwin' | 'linux';
  cpu: 'x64' | 'arm64';
  goos: string;
  goarch: string;
};

const TARGETS: Target[] = [
  { os: 'darwin', cpu: 'arm64', goos: 'darwin', goarch: 'arm64' },
  { os: 'darwin', cpu: 'x64', goos: 'darwin', goarch: 'amd64' },
  { os: 'linux', cpu: 'x64', goos: 'linux', goarch: 'amd64' },
  { os: 'linux', cpu: 'arm64', goos: 'linux', goarch: 'arm64' },
];

const version = pkg.version;

// Guard against optionalDependencies version drift: every platform package
// must be pinned to the root version, or npx installs a mismatched binary.
const optionalDeps = (pkg as { optionalDependencies?: Record<string, string> }).optionalDependencies ?? {};
const drifted = Object.entries(optionalDeps).filter(([, v]) => v !== version);

if (drifted.length > 0) {
  console.error(`optionalDependencies out of sync with version ${version}:`);

  for (const [name, v] of drifted) {
    console.error(`  ${name}: ${v}`);
  }

  process.exit(1);
}

// Optionally build a single target: `bun run scripts/build-binaries.ts darwin-arm64`
const only = process.argv[2];
const targets = only ? TARGETS.filter((t) => `${t.os}-${t.cpu}` === only) : TARGETS;

if (targets.length === 0) {
  console.error(`No target matches "${only}".`);
  process.exit(1);
}

if (!only) {
  rmSync(outRoot, { recursive: true, force: true });
}

for (const target of targets) {
  const pkgName = `@thadeu/trello-mcp-${target.os}-${target.cpu}`;
  const dir = join(outRoot, `${target.os}-${target.cpu}`);
  const binDir = join(dir, 'bin');
  const binName = 'trello-mcp';

  mkdirSync(binDir, { recursive: true });

  const build = Bun.spawnSync(
    [
      'go',
      'build',
      '-trimpath',
      '-ldflags',
      `-s -w -X main.version=${version}`,
      '-o',
      join(binDir, binName),
      '.',
    ],
    {
      cwd: cliDir,
      env: {
        ...process.env,
        GOOS: target.goos,
        GOARCH: target.goarch,
        CGO_ENABLED: '0',
      },
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );

  if (build.exitCode !== 0) {
    console.error(`go build failed for ${pkgName}`);
    process.exit(build.exitCode ?? 1);
  }

  chmodSync(join(binDir, binName), 0o755);

  const platformPkg = {
    name: pkgName,
    version,
    description: `${pkg.description} (${target.os}-${target.cpu} prebuilt binary)`,
    repository: pkg.repository,
    license: pkg.license,
    os: [target.os],
    cpu: [target.cpu],
    files: ['bin'],
  };

  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(platformPkg, null, 2)}\n`);

  console.error(`built ${pkgName} -> bin/${binName}`);
}

console.error(`\ndone: ${targets.length} platform package(s) in ${outRoot}`);
