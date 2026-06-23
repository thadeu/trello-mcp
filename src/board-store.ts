import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type BoardStoreConfig = {
  allowedBoardIds: string[];
  updatedAt?: string;
};

export function resolveConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const custom = env.TRELLO_CONFIG_PATH?.trim();

  if (custom) {
    return custom;
  }

  return join(homedir(), '.config', 'trello-mcp', 'config.json');
}

export async function loadPersistedBoardIds(configPath: string): Promise<string[]> {
  try {
    const raw = await readFile(configPath, 'utf8');
    const data = JSON.parse(raw) as BoardStoreConfig;

    return [...new Set((data.allowedBoardIds ?? []).map((id) => id.trim()).filter(Boolean))];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

export async function saveAllowedBoardIds(configPath: string, boardIds: string[]): Promise<void> {
  const unique = [...new Set(boardIds.map((id) => id.trim()).filter(Boolean))];

  if (unique.length === 0) {
    throw new Error('At least one board id is required');
  }

  await mkdir(dirname(configPath), { recursive: true });

  const payload: BoardStoreConfig = {
    allowedBoardIds: unique,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(configPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
