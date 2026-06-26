import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');
const increments = ['patch', 'minor', 'major'] as const;

type Increment = (typeof increments)[number];

function usage(): never {
  console.error('usage: bun run release <patch|minor|major> [--no-push]');
  process.exit(1);
}

function bumpVersion(current: string, increment: Increment): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) {
    throw new Error(`invalid semver: ${current}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  switch (increment) {
    case 'patch':
      patch++;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

function bumpPackageVersion(increment: Increment): string {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  pkg.version = bumpVersion(pkg.version, increment);
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return pkg.version;
}

async function run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });

  if ((await proc.exited) !== 0) {
    throw new Error(`command failed: ${cmd.join(' ')}`);
  }
}

async function assertCleanTree(): Promise<void> {
  const proc = Bun.spawn(['git', 'status', '--porcelain'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'inherit',
  });

  if ((await proc.exited) !== 0) {
    throw new Error('git status failed');
  }

  const dirty = (await new Response(proc.stdout).text()).trim();
  if (dirty) {
    console.error('error: working tree is not clean');
    console.error(dirty);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const increment = args.find((arg) => !arg.startsWith('--'));
  const push = !args.includes('--no-push');

  if (!increment || !increments.includes(increment as Increment)) {
    usage();
  }

  await assertCleanTree();

  console.error(`release: bump ${increment}`);
  const version = bumpPackageVersion(increment);
  console.error(`release: ${version}`);

  console.error('release: sync optionalDependencies');
  await run(['bun', 'run', 'scripts/build-binaries.ts', '--sync-only']);

  console.error('release: sync lockfile');
  await run(['bun', 'install']);

  const tag = `v${version}`;

  console.error(`release: commit ${tag}`);
  await run(['git', 'add', 'package.json', 'bun.lock']);
  await run(['git', 'commit', '-m', `chore(release): ${tag}`]);
  await run(['git', 'tag', tag]);

  if (push) {
    console.error(`release: push ${tag}`);
    await run(['git', 'push', 'origin', 'main', '--tags']);
    console.error(`release ${tag} published`);
    return;
  }

  console.error(`release ${tag} ready — push with: git push origin main --tags`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
