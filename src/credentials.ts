import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type TrelloCredentials = {
  apiKey?: string;
  token?: string;
};

type McpConfig = {
  mcpServers?: Record<string, { env?: Record<string, string> }>;
};

const ENV_KEYS = ['TRELLO_API_KEY', 'TRELLO_TOKEN', 'TRELLO_ALLOWED_BOARD_IDS'] as const;

export function mcpConfigPaths(cwd: string = process.cwd()): string[] {
  return [
    join(homedir(), '.cursor', 'mcp.json'),
    join(cwd, '.cursor', 'mcp.json'),
  ];
}

export function dotenvPaths(cwd: string = process.cwd()): string[] {
  return [
    join(cwd, '.env'),
    join(homedir(), '.config', 'trello-mcp', '.env'),
  ];
}

export async function loadMcpCredentials(paths: string[]): Promise<TrelloCredentials> {
  const merged: TrelloCredentials = {};

  for (const path of paths) {
    const credentials = await readMcpCredentialsFile(path);

    if (!merged.apiKey && credentials.apiKey) {
      merged.apiKey = credentials.apiKey;
    }

    if (!merged.token && credentials.token) {
      merged.token = credentials.token;
    }

    if (merged.apiKey && merged.token) {
      break;
    }
  }

  return merged;
}

async function readMcpCredentialsFile(path: string): Promise<TrelloCredentials> {
  try {
    const raw = await readFile(path, 'utf8');
    const config = JSON.parse(raw) as McpConfig;
    const servers = config.mcpServers ?? {};

    const trelloServer = servers.trello ?? findServerWithTrelloEnv(servers);

    if (!trelloServer?.env) {
      return {};
    }

    return {
      apiKey: trelloServer.env.TRELLO_API_KEY?.trim(),
      token: trelloServer.env.TRELLO_TOKEN?.trim(),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

function findServerWithTrelloEnv(
  servers: Record<string, { env?: Record<string, string> }>
): { env?: Record<string, string> } | undefined {
  return Object.values(servers).find(
    (server) => server.env?.TRELLO_API_KEY && server.env?.TRELLO_TOKEN
  );
}

export async function loadDotenvFiles(paths: string[]): Promise<Record<string, string>> {
  const values: Record<string, string> = {};

  for (const path of paths) {
    const fileValues = await readDotenvFile(path);
    Object.assign(values, fileValues);
  }

  return values;
}

async function readDotenvFile(path: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(path, 'utf8');
    return parseDotenv(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

export function parseDotenv(raw: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    let trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('export ')) {
      trimmed = trimmed.slice('export '.length).trim();
    }

    const separator = trimmed.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export type CredentialLoadOptions = {
  mcpPaths?: string[];
  dotenvPaths?: string[];
};

export async function loadMergedEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  options: CredentialLoadOptions = {}
): Promise<NodeJS.ProcessEnv> {
  const merged: NodeJS.ProcessEnv = { ...baseEnv };
  const dotenvFilePaths = options.dotenvPaths ?? dotenvPaths();
  const mcpFilePaths = options.mcpPaths ?? mcpConfigPaths();

  if (!merged.TRELLO_API_KEY?.trim() || !merged.TRELLO_TOKEN?.trim()) {
    const fromDotenv = await loadDotenvFiles(dotenvFilePaths);

    for (const key of ENV_KEYS) {
      if (!merged[key]?.trim() && fromDotenv[key]?.trim()) {
        merged[key] = fromDotenv[key]!.trim();
      }
    }
  }

  if (!merged.TRELLO_API_KEY?.trim() || !merged.TRELLO_TOKEN?.trim()) {
    const fromMcp = await loadMcpCredentials(mcpFilePaths);

    if (!merged.TRELLO_API_KEY?.trim() && fromMcp.apiKey) {
      merged.TRELLO_API_KEY = fromMcp.apiKey;
    }

    if (!merged.TRELLO_TOKEN?.trim() && fromMcp.token) {
      merged.TRELLO_TOKEN = fromMcp.token;
    }
  }

  return merged;
}

export function missingCredentialMessage(): string {
  return [
    'Trello credentials are required.',
    'Provide them via one of:',
    '  1. Environment: TRELLO_API_KEY and TRELLO_TOKEN',
    '  2. ~/.cursor/mcp.json (mcpServers.trello.env)',
    '  3. .env or ~/.config/trello-mcp/.env',
    '  4. Interactive: trello-mcp onboard (prompts when missing)',
  ].join('\n');
}
