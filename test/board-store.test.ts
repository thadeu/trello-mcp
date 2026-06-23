import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPersistedBoardIds, resolveConfigPath, saveAllowedBoardIds } from '../src/board-store.js';

describe('resolveConfigPath', () => {
  it('uses TRELLO_CONFIG_PATH when set', () => {
    expect(resolveConfigPath({ TRELLO_CONFIG_PATH: '/tmp/custom.json' })).toBe('/tmp/custom.json');
  });
});

describe('board store', () => {
  it('persists and loads allowed board ids', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trello-mcp-'));
    const configPath = join(dir, 'config.json');

    await saveAllowedBoardIds(configPath, ['board-1', 'board-2', 'board-1']);

    expect(await loadPersistedBoardIds(configPath)).toEqual(['board-1', 'board-2']);

    const raw = await readFile(configPath, 'utf8');
    expect(JSON.parse(raw)).toMatchObject({
      allowedBoardIds: ['board-1', 'board-2'],
    });
  });

  it('returns empty list when config file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trello-mcp-'));

    expect(await loadPersistedBoardIds(join(dir, 'missing.json'))).toEqual([]);
  });
});
