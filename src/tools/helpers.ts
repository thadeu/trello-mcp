import type { TrelloClient } from '../trello-client.js';
import { assertBoardAllowed } from '../config.js';
import { BoardAccessError } from '../errors.js';

export function ensureBoardAccess(client: TrelloClient, boardId: string): void {
  assertBoardAllowed(boardId, client.config);
}

export async function ensureCardBoardAccess(client: TrelloClient, cardId: string): Promise<string> {
  const card = await client.getCard(cardId);

  if (!client.config.allowedBoardIds.includes(card.idBoard)) {
    throw new BoardAccessError(card.idBoard);
  }

  return card.idBoard;
}

export function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function textResult(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
  };
}
