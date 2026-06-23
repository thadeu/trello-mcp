import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, parseBoardIds } from '../src/config.js';
import { saveAllowedBoardIds } from '../src/board-store.js';

describe('parseBoardIds', () => {
  it('parses comma-separated ids and removes duplicates', () => {
    expect(parseBoardIds(' abc , def , abc ')).toEqual(['abc', 'def']);
  });

  it('returns empty array for blank input', () => {
    expect(parseBoardIds('')).toEqual([]);
    expect(parseBoardIds(undefined)).toEqual([]);
  });
});

describe('loadConfig', () => {
  it('loads required env vars from TRELLO_ALLOWED_BOARD_IDS', async () => {
    const config = await loadConfig({
      TRELLO_API_KEY: 'key',
      TRELLO_TOKEN: 'token',
      TRELLO_ALLOWED_BOARD_IDS: 'board-1,board-2',
    });

    expect(config).toMatchObject({
      apiKey: 'key',
      token: 'token',
      allowedBoardIds: ['board-1', 'board-2'],
      onboardingRequired: false,
    });
  });

  it('loads boards from config file when env allowlist is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trello-mcp-'));
    const configPath = join(dir, 'config.json');

    await saveAllowedBoardIds(configPath, ['board-file']);

    const config = await loadConfig({
      TRELLO_API_KEY: 'key',
      TRELLO_TOKEN: 'token',
      TRELLO_CONFIG_PATH: configPath,
    });

    expect(config.allowedBoardIds).toEqual(['board-file']);
    expect(config.onboardingRequired).toBe(false);
    expect(config.configPath).toBe(configPath);
  });

  it('enters onboarding mode when no boards are configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trello-mcp-'));

    const config = await loadConfig({
      TRELLO_API_KEY: 'key',
      TRELLO_TOKEN: 'token',
      TRELLO_CONFIG_PATH: join(dir, 'config.json'),
    });

    expect(config.allowedBoardIds).toEqual([]);
    expect(config.onboardingRequired).toBe(true);
  });

  it('throws when credentials are missing', async () => {
    await expect(loadConfig({})).rejects.toThrow('TRELLO_API_KEY is required');
    await expect(
      loadConfig({ TRELLO_API_KEY: 'key' })
    ).rejects.toThrow('TRELLO_TOKEN is required');
  });
});
