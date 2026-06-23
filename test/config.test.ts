import { describe, expect, it } from 'vitest';
import { loadConfig, parseBoardIds } from '../src/config.js';

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
  it('loads required env vars', () => {
    const config = loadConfig({
      TRELLO_API_KEY: 'key',
      TRELLO_TOKEN: 'token',
      TRELLO_ALLOWED_BOARD_IDS: 'board-1,board-2',
    });

    expect(config).toEqual({
      apiKey: 'key',
      token: 'token',
      allowedBoardIds: ['board-1', 'board-2'],
    });
  });

  it('throws when credentials are missing', () => {
    expect(() => loadConfig({})).toThrow('TRELLO_API_KEY is required');
    expect(() =>
      loadConfig({ TRELLO_API_KEY: 'key', TRELLO_ALLOWED_BOARD_IDS: 'board-1' })
    ).toThrow('TRELLO_TOKEN is required');
    expect(() =>
      loadConfig({ TRELLO_API_KEY: 'key', TRELLO_TOKEN: 'token' })
    ).toThrow('TRELLO_ALLOWED_BOARD_IDS must include at least one board id');
  });
});
