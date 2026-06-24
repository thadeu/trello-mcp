import { describe, expect, it, vi } from 'vitest';
import { TrelloClient } from '../src/trello-client.js';
import { TrelloApiError } from '../src/errors.js';

const config = {
  apiKey: 'test-key',
  token: 'test-token',
  allowedBoardIds: ['board-1'],
  onboardingRequired: false,
  configPath: '/tmp/trello-mcp/config.json',
};

describe('TrelloClient', () => {
  it('lists all boards without allowlist filtering', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'board-1', name: 'Allowed', url: 'https://trello.com/b/1', closed: false },
        { id: 'board-2', name: 'Other', url: 'https://trello.com/b/2', closed: false },
      ],
    });

    const client = new TrelloClient(config, fetchImpl);
    const boards = await client.listAllBoards();

    expect(boards).toHaveLength(2);
  });

  it('lists only allowed boards', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'board-1', name: 'Allowed', url: 'https://trello.com/b/1', closed: false },
        { id: 'board-2', name: 'Blocked', url: 'https://trello.com/b/2', closed: false },
      ],
    });

    const client = new TrelloClient(config, fetchImpl);
    const boards = await client.listBoards();

    expect(boards).toHaveLength(1);
    expect(boards[0]?.id).toBe('board-1');
    expect(fetchImpl).toHaveBeenCalledOnce();

    const url = new URL(fetchImpl.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/1/members/me/boards');
    expect(url.searchParams.get('key')).toBe('test-key');
    expect(url.searchParams.get('token')).toBe('test-token');
  });

  it('creates a card with POST body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'card-1',
        name: 'New card',
        desc: 'Details',
        url: 'https://trello.com/c/1',
        closed: false,
        idBoard: 'board-1',
        idList: 'list-1',
        due: null,
        dueComplete: false,
        labels: [],
      }),
    });

    const client = new TrelloClient(config, fetchImpl);

    await client.createCard({
      idList: 'list-1',
      name: 'New card',
      desc: 'Details',
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');

    const url = new URL(fetchImpl.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/1/cards');
    expect(url.searchParams.get('idList')).toBe('list-1');
    expect(url.searchParams.get('name')).toBe('New card');
    expect(url.searchParams.get('desc')).toBe('Details');
  });

  it('raises TrelloApiError on failed responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'invalid token' }),
    });

    const client = new TrelloClient(config, fetchImpl);

    await expect(client.getCard('card-1')).rejects.toBeInstanceOf(TrelloApiError);
  });

  it('archives a card with closed=true', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'card-1',
        name: 'Archived',
        desc: '',
        url: 'https://trello.com/c/1',
        closed: true,
        idBoard: 'board-1',
        idList: 'list-1',
        due: null,
        dueComplete: false,
        labels: [],
      }),
    });

    const client = new TrelloClient(config, fetchImpl);
    const card = await client.archiveCard('card-1');

    expect(card.closed).toBe(true);

    const url = new URL(fetchImpl.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/1/cards/card-1');
    expect(url.searchParams.get('closed')).toBe('true');
  });

  it('lists attachments on a card', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'attachment-1',
            name: 'https://github.com/org/repo/pull/1',
            url: 'https://github.com/org/repo/pull/1',
            mimeType: null,
            bytes: null,
            date: '2026-01-01T00:00:00.000Z',
            isUpload: false,
          },
        ],
      });

    const client = new TrelloClient(config, fetchImpl);
    const attachments = await client.listAttachments('card-1');

    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.url).toBe('https://github.com/org/repo/pull/1');

    const url = new URL(fetchImpl.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/1/cards/card-1/attachments');
  });

  it('adds a URL attachment', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'attachment-1',
        name: 'Spec',
        url: 'https://trello.com/attachments/1',
        mimeType: null,
        bytes: null,
        date: '2026-01-01T00:00:00.000Z',
        isUpload: false,
      }),
    });

    const client = new TrelloClient(config, fetchImpl);

    await client.addAttachment({
      cardId: 'card-1',
      url: 'https://example.com/spec.pdf',
      name: 'Spec',
    });

    const url = new URL(fetchImpl.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/1/cards/card-1/attachments');
    expect(url.searchParams.get('url')).toBe('https://example.com/spec.pdf');
    expect(url.searchParams.get('name')).toBe('Spec');
  });
});
