#!/usr/bin/env node
'use strict';

// Thin launcher: resolves the prebuilt Go binary for the current platform
// (shipped as an optionalDependency) and execs it, passing stdio through.
// This file is intentionally plain CommonJS so it parses on any Node version.

const { spawnSync } = require('child_process');

function resolveBinary() {
  const pkg = '@thadeu/trello-mcp-' + process.platform + '-' + process.arch;

  try {
    return require.resolve(pkg + '/bin/trello-mcp');
  } catch (err) {
    return null;
  }
}

const binary = resolveBinary();

if (!binary) {
  process.stderr.write(
    '[trello-mcp] no prebuilt binary for ' + process.platform + '-' + process.arch + '.\n' +
      '[trello-mcp] Supported: darwin and linux on x64 and arm64.\n' +
      '[trello-mcp] If you installed with --no-optional or --omit=optional, reinstall without it.\n'
  );
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });

if (result.error) {
  process.stderr.write('[trello-mcp] failed to start binary: ' + result.error.message + '\n');
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
