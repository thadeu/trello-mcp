import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { saveAllowedBoardIds } from '../board-store.js';
import type { TrelloClient } from '../trello-client.js';
import { jsonResult, textResult } from './helpers.js';

export function registerOnboardingTools(server: McpServer, client: TrelloClient): void {
  server.tool(
    'get_setup_status',
    'Check whether Trello board onboarding is required before using other tools',
    {},
    async () => {
      if (client.config.onboardingRequired) {
        return jsonResult({
          onboarding_required: true,
          message:
            'No boards configured. Call list_available_boards, ask the user which boards to use, then call select_allowed_boards with the chosen board ids.',
          config_path: client.config.configPath,
        });
      }

      return jsonResult({
        onboarding_required: false,
        allowed_board_ids: client.config.allowedBoardIds,
        config_path: client.config.configPath,
      });
    }
  );

  server.tool(
    'list_available_boards',
    'List all Trello boards accessible to the authenticated user (used during onboarding)',
    {
      include_closed: z
        .boolean()
        .optional()
        .describe('Include archived boards (default: false)'),
    },
    async ({ include_closed }) => {
      let boards = await client.listAllBoards();

      if (!include_closed) {
        boards = boards.filter((board) => !board.closed);
      }

      return jsonResult(
        boards.map((board) => ({
          id: board.id,
          name: board.name,
          url: board.url,
          closed: board.closed,
        }))
      );
    }
  );

  server.tool(
    'select_allowed_boards',
    'Save the boards the user chose during onboarding and enable the other Trello tools',
    {
      board_ids: z
        .array(z.string())
        .min(1)
        .describe('One or more Trello board ids selected by the user'),
    },
    async ({ board_ids }) => {
      const unique = [...new Set(board_ids.map((id) => id.trim()).filter(Boolean))];

      if (unique.length === 0) {
        throw new Error('board_ids must include at least one board id');
      }

      const available = await client.listAllBoards();
      const availableIds = new Set(available.map((board) => board.id));
      const invalid = unique.filter((id) => !availableIds.has(id));

      if (invalid.length > 0) {
        throw new Error(`Board(s) not found or not accessible: ${invalid.join(', ')}`);
      }

      await saveAllowedBoardIds(client.config.configPath, unique);

      client.config.allowedBoardIds = unique;
      client.config.onboardingRequired = false;

      const selected = available.filter((board) => unique.includes(board.id));

      return jsonResult({
        message: 'Setup complete. Trello tools are now enabled for the selected boards.',
        allowed_board_ids: unique,
        boards: selected.map((board) => ({
          id: board.id,
          name: board.name,
          url: board.url,
        })),
        persisted_to: client.config.configPath,
        env_override: `TRELLO_ALLOWED_BOARD_IDS=${unique.join(',')}`,
      });
    }
  );
}

export function onboardingRequiredMessage(): string {
  return [
    'Trello board onboarding is required.',
    '1. Call list_available_boards',
    '2. Ask the user which board(s) to use',
    '3. Call select_allowed_boards with the chosen board ids',
  ].join('\n');
}

export function ensureOnboardingComplete(client: TrelloClient): void {
  if (client.config.onboardingRequired) {
    throw new Error(onboardingRequiredMessage());
  }
}

export function listBoardsResult(client: TrelloClient) {
  if (client.config.onboardingRequired) {
    return textResult(onboardingRequiredMessage());
  }

  return null;
}
