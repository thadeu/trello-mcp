import { loadPersistedBoardIds, resolveConfigPath } from './board-store.js';
import { missingCredentialMessage } from './credentials.js';
import { BoardAccessError, ConfigError } from './errors.js';

export type AppConfig = {
  apiKey: string;
  token: string;
  allowedBoardIds: string[];
  onboardingRequired: boolean;
  configPath: string;
};

export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<AppConfig> {
  const apiKey = env.TRELLO_API_KEY?.trim();
  const token = env.TRELLO_TOKEN?.trim();
  const configPath = resolveConfigPath(env);
  const envBoardIds = parseBoardIds(env.TRELLO_ALLOWED_BOARD_IDS);
  const fileBoardIds = envBoardIds.length > 0 ? [] : await loadPersistedBoardIds(configPath);
  const allowedBoardIds = envBoardIds.length > 0 ? envBoardIds : fileBoardIds;

  if (!apiKey) {
    throw new ConfigError(missingCredentialMessage());
  }

  if (!token) {
    throw new ConfigError(missingCredentialMessage());
  }

  return {
    apiKey,
    token,
    allowedBoardIds,
    onboardingRequired: allowedBoardIds.length === 0,
    configPath,
  };
}

export function parseBoardIds(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))];
}

export function assertBoardAllowed(boardId: string, config: AppConfig): void {
  if (config.onboardingRequired) {
    throw new BoardAccessError(
      boardId,
      'Board setup is incomplete. Use list_available_boards and select_allowed_boards first.'
    );
  }

  if (!config.allowedBoardIds.includes(boardId)) {
    throw new BoardAccessError(boardId);
  }
}
