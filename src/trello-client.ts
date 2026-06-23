import { TrelloApiError, TrelloMcpError } from './errors.js';
import type { AppConfig } from './config.js';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const TRELLO_API_BASE = 'https://api.trello.com/1';

export type TrelloBoard = {
  id: string;
  name: string;
  url: string;
  closed: boolean;
};

export type TrelloList = {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
};

export type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  url: string;
  closed: boolean;
  idBoard: string;
  idList: string;
  due: string | null;
  dueComplete: boolean;
  labels: Array<{ id: string; name: string; color: string | null }>;
};

export type CreateCardInput = {
  idList: string;
  name: string;
  desc?: string;
  due?: string;
  idLabels?: string[];
};

export type UpdateCardInput = {
  name?: string;
  desc?: string;
  due?: string | null;
  dueComplete?: boolean;
  closed?: boolean;
  idLabels?: string[];
};

export type TrelloAttachment = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  bytes: number | null;
  date: string;
  isUpload: boolean;
};

export type AddAttachmentInput = {
  cardId: string;
  url?: string;
  filePath?: string;
  name?: string;
  mimeType?: string;
  setCover?: boolean;
};

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class TrelloClient {
  readonly config: AppConfig;

  constructor(
    config: AppConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {
    this.config = config;
  }

  async listBoards(): Promise<TrelloBoard[]> {
    const boards = await this.request<TrelloBoard[]>('/members/me/boards', {
      fields: 'id,name,url,closed',
    });

    return boards.filter((board) => this.config.allowedBoardIds.includes(board.id));
  }

  async getBoard(boardId: string): Promise<TrelloBoard> {
    return this.request<TrelloBoard>(`/boards/${boardId}`, {
      fields: 'id,name,url,closed',
    });
  }

  async listLists(boardId: string): Promise<TrelloList[]> {
    return this.request<TrelloList[]>(`/boards/${boardId}/lists`, {
      fields: 'id,name,closed,idBoard',
    });
  }

  async listCards(boardId: string, listId?: string): Promise<TrelloCard[]> {
    const path = listId ? `/lists/${listId}/cards` : `/boards/${boardId}/cards`;

    return this.request<TrelloCard[]>(path, {
      fields: 'id,name,desc,url,closed,idBoard,idList,due,dueComplete,labels',
    });
  }

  async getCard(cardId: string): Promise<TrelloCard> {
    return this.request<TrelloCard>(`/cards/${cardId}`, {
      fields: 'id,name,desc,url,closed,idBoard,idList,due,dueComplete,labels',
    });
  }

  async createCard(input: CreateCardInput): Promise<TrelloCard> {
    return this.request<TrelloCard>('/cards', {
      idList: input.idList,
      name: input.name,
      desc: input.desc,
      due: input.due,
      idLabels: input.idLabels?.join(','),
    }, { method: 'POST' });
  }

  async updateCard(cardId: string, input: UpdateCardInput): Promise<TrelloCard> {
    return this.request<TrelloCard>(`/cards/${cardId}`, {
      name: input.name,
      desc: input.desc,
      due: input.due === null ? '' : input.due,
      dueComplete: input.dueComplete?.toString(),
      closed: input.closed?.toString(),
      idLabels: input.idLabels?.join(','),
    }, { method: 'PUT' });
  }

  async moveCard(cardId: string, idList: string): Promise<TrelloCard> {
    return this.request<TrelloCard>(`/cards/${cardId}`, { idList }, { method: 'PUT' });
  }

  async addComment(cardId: string, text: string): Promise<{ id: string; text: string }> {
    return this.request<{ id: string; text: string }>(
      `/cards/${cardId}/actions/comments`,
      { text },
      { method: 'POST' }
    );
  }

  async archiveCard(cardId: string): Promise<TrelloCard> {
    return this.updateCard(cardId, { closed: true });
  }

  async addAttachment(input: AddAttachmentInput): Promise<TrelloAttachment> {
    if (input.url) {
      return this.request<TrelloAttachment>(`/cards/${input.cardId}/attachments`, {
        url: input.url,
        name: input.name,
        setCover: input.setCover?.toString(),
      }, { method: 'POST' });
    }

    if (input.filePath) {
      return this.uploadAttachmentFile(input);
    }

    throw new TrelloMcpError('Either url or file_path is required');
  }

  private async uploadAttachmentFile(input: AddAttachmentInput): Promise<TrelloAttachment> {
    const filePath = input.filePath!;
    const fileName = input.name ?? basename(filePath);
    const fileBuffer = await readFile(filePath);
    const mimeType = input.mimeType ?? 'application/octet-stream';

    const url = new URL(`${TRELLO_API_BASE}/cards/${input.cardId}/attachments`);
    url.searchParams.set('key', this.config.apiKey);
    url.searchParams.set('token', this.config.token);

    if (input.name) {
      url.searchParams.set('name', input.name);
    }

    if (input.setCover !== undefined) {
      url.searchParams.set('setCover', String(input.setCover));
    }

    const form = new FormData();
    form.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);

    const response = await this.fetchImpl(url, { method: 'POST', body: form });

    if (!response.ok) {
      const message = await safeErrorMessage(response);
      throw new TrelloApiError(response.status, message);
    }

    return response.json() as Promise<TrelloAttachment>;
  }

  private async request<T>(
    path: string,
    query: Record<string, string | undefined>,
    options: { method?: string } = {}
  ): Promise<T> {
    const url = new URL(`${TRELLO_API_BASE}${path}`);

    url.searchParams.set('key', this.config.apiKey);
    url.searchParams.set('token', this.config.token);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    const method = options.method ?? 'GET';
    const response = await this.fetchImpl(url, { method });

    if (!response.ok) {
      const message = await safeErrorMessage(response);
      throw new TrelloApiError(response.status, message);
    }

    return response.json() as Promise<T>;
  }
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
