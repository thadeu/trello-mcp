import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadDotenvFiles,
  loadMcpCredentials,
  loadMergedEnv,
  parseDotenv,
} from '../src/credentials.js';

describe('parseDotenv', () => {
  it('parses key=value pairs and ignores comments', () => {
    expect(
      parseDotenv(`
        # comment
        TRELLO_API_KEY=abc
        TRELLO_TOKEN="quoted"
      `)
    ).toEqual({
      TRELLO_API_KEY: 'abc',
      TRELLO_TOKEN: 'quoted',
    });
  });

  it('parses shell-style export lines', () => {
    expect(
      parseDotenv(`
        export TRELLO_API_KEY=abc
        export TRELLO_TOKEN=def
      `)
    ).toEqual({
      TRELLO_API_KEY: 'abc',
      TRELLO_TOKEN: 'def',
    });
  });
});

describe('loadMcpCredentials', () => {
  it('reads trello server env from mcp.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trello-mcp-'));
    const path = join(dir, 'mcp.json');

    await writeFile(
      path,
      JSON.stringify({
        mcpServers: {
          trello: {
            env: {
              TRELLO_API_KEY: 'key-from-mcp',
              TRELLO_TOKEN: 'token-from-mcp',
            },
          },
        },
      })
    );

    expect(await loadMcpCredentials([path])).toEqual({
      apiKey: 'key-from-mcp',
      token: 'token-from-mcp',
    });
  });
});

describe('loadMergedEnv', () => {
  it('prefers existing env vars over files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trello-mcp-'));
    const mcpPath = join(dir, 'mcp.json');

    await writeFile(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          trello: {
            env: {
              TRELLO_API_KEY: 'from-mcp',
              TRELLO_TOKEN: 'from-mcp',
            },
          },
        },
      })
    );

    const env = await loadMergedEnv(
      {
        TRELLO_API_KEY: 'from-env',
        TRELLO_TOKEN: 'from-env',
      },
      { mcpPaths: [mcpPath] }
    );

    expect(env.TRELLO_API_KEY).toBe('from-env');
    expect(env.TRELLO_TOKEN).toBe('from-env');
  });

  it('merges dotenv and mcp config when env is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trello-mcp-'));
    const dotenvPath = join(dir, '.env');
    const mcpPath = join(dir, 'mcp.json');

    await writeFile(dotenvPath, 'TRELLO_API_KEY=from-dotenv\n');
    await writeFile(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          trello: {
            env: {
              TRELLO_TOKEN: 'from-mcp',
            },
          },
        },
      })
    );

    const env = await loadMergedEnv({}, { dotenvPaths: [dotenvPath], mcpPaths: [mcpPath] });

    expect(env.TRELLO_API_KEY).toBe('from-dotenv');
    expect(env.TRELLO_TOKEN).toBe('from-mcp');
  });
});

describe('loadDotenvFiles', () => {
  it('loads values from .env file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trello-mcp-'));
    const path = join(dir, '.env');

    await writeFile(path, 'TRELLO_API_KEY=abc\nTRELLO_TOKEN=def\n');

    expect(await loadDotenvFiles([path])).toEqual({
      TRELLO_API_KEY: 'abc',
      TRELLO_TOKEN: 'def',
    });
  });
});
