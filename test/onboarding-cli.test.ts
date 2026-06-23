import { describe, expect, it } from 'vitest';
import { parseBoardSelection } from '../src/onboarding/cli.js';
import type { TrelloBoard } from '../src/trello-client.js';

const boards: TrelloBoard[] = [
  {
    id: '56c215abc7af5016b9bceadb',
    name: 'AS DEV',
    url: 'https://trello.com/b/Nh2gYTTn/as-dev',
    closed: false,
  },
  {
    id: '65203e75f286e37f59d3c23d',
    name: 'P:corporativo-projetos',
    url: 'https://trello.com/b/2rW8bKHI/pcorporativo-projetos',
    closed: false,
  },
];

describe('parseBoardSelection', () => {
  it('accepts list numbers', () => {
    expect(parseBoardSelection('1', boards).map((board) => board.id)).toEqual([
      '56c215abc7af5016b9bceadb',
    ]);
  });

  it('accepts board ids', () => {
    expect(parseBoardSelection('56c215abc7af5016b9bceadb', boards).map((board) => board.id)).toEqual([
      '56c215abc7af5016b9bceadb',
    ]);
  });

  it('accepts board names', () => {
    expect(parseBoardSelection('AS DEV', boards).map((board) => board.id)).toEqual([
      '56c215abc7af5016b9bceadb',
    ]);
  });

  it('accepts mixed comma-separated values without duplicates', () => {
    expect(parseBoardSelection('1, AS DEV, 65203e75f286e37f59d3c23d', boards).map((board) => board.id)).toEqual([
      '56c215abc7af5016b9bceadb',
      '65203e75f286e37f59d3c23d',
    ]);
  });

  it('returns empty array for invalid input', () => {
    expect(parseBoardSelection('invalid', boards)).toEqual([]);
  });
});
