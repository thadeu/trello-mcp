import { BoardAccessError, ConfigError } from './errors.js';

export type AppConfig = {
  apiKey: string;
  token: string;
  allowedBoardIds: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiKey = env.TRELLO_API_KEY?.trim();
  const token = env.TRELLO_TOKEN?.trim();
  const allowedBoardIds = parseBoardIds(env.TRELLO_ALLOWED_BOARD_IDS);

  if (!apiKey) {
    throw new ConfigError('TRELLO_API_KEY is required');
  }

  if (!token) {
    throw new ConfigError('TRELLO_TOKEN is required');
  }

  if (allowedBoardIds.length === 0) {
    throw new ConfigError('TRELLO_ALLOWED_BOARD_IDS must include at least one board id');
  }

  return { apiKey, token, allowedBoardIds };
}

export function parseBoardIds(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))];
}

export function assertBoardAllowed(boardId: string, config: AppConfig): void {
  if (!config.allowedBoardIds.includes(boardId)) {
    throw new BoardAccessError(boardId);
  }
}
