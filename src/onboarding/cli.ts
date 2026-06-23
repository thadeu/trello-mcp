import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import { saveAllowedBoardIds } from '../board-store.js';
import type { AppConfig } from '../config.js';
import type { TrelloBoard } from '../trello-client.js';
import type { TrelloClient } from '../trello-client.js';

function printBoards(boards: TrelloBoard[]): void {
  console.error('Available boards:\n');

  boards.forEach((board, index) => {
    console.error(`  ${index + 1}. ${board.name}`);
    console.error(`     id:  ${board.id}`);
    console.error(`     url: ${board.url}\n`);
  });
}

export function parseBoardSelection(answer: string, boards: TrelloBoard[]): TrelloBoard[] {
  const selected: TrelloBoard[] = [];
  const seen = new Set<string>();

  for (const token of answer.split(',').map((value) => value.trim()).filter(Boolean)) {
    const board = matchBoard(token, boards);

    if (board && !seen.has(board.id)) {
      seen.add(board.id);
      selected.push(board);
    }
  }

  return selected;
}

function matchBoard(token: string, boards: TrelloBoard[]): TrelloBoard | undefined {
  const asNumber = Number.parseInt(token, 10);

  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= boards.length) {
    return boards[asNumber - 1];
  }

  const byId = boards.find((board) => board.id === token);

  if (byId) {
    return byId;
  }

  const lower = token.toLowerCase();
  const byExactName = boards.find((board) => board.name.toLowerCase() === lower);

  if (byExactName) {
    return byExactName;
  }

  return boards.find((board) => board.name.toLowerCase().includes(lower));
}

export async function runOnboardingCli(
  config: AppConfig,
  client: TrelloClient,
  options: { force?: boolean } = {}
): Promise<void> {
  if (!options.force && !config.onboardingRequired) {
    console.error('Boards already configured.');
    console.error(`Allowed board ids: ${config.allowedBoardIds.join(', ')}`);
    console.error(`Config file: ${config.configPath}`);
    console.error('Use --force to choose boards again.');
    return;
  }

  const boards = (await client.listAllBoards()).filter((board) => !board.closed);

  if (boards.length === 0) {
    console.error('No open boards found for this Trello account.');
    process.exit(1);
  }

  printBoards(boards);

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(
    'Select boards by number, id, or name (comma-separated): '
  );
  rl.close();

  const selected = parseBoardSelection(answer, boards);

  if (selected.length === 0) {
    console.error('No valid board selection.');
    console.error('Use list numbers (1, 2), board ids, or board names.');
    process.exit(1);
  }

  const boardIds = selected.map((board) => board.id);

  await saveAllowedBoardIds(config.configPath, boardIds);

  console.error(`\nSaved ${boardIds.length} board(s) to ${config.configPath}`);
  selected.forEach((board) => {
    console.error(`  - ${board.name} (${board.id})`);
  });
  console.error('\nOptional MCP env override:');
  console.error(`TRELLO_ALLOWED_BOARD_IDS=${boardIds.join(',')}`);
}
