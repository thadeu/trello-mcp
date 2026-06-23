import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import { saveAllowedBoardIds } from '../board-store.js';
import type { AppConfig } from '../config.js';
import type { TrelloClient } from '../trello-client.js';
import type { TrelloBoard } from '../trello-client.js';

function printBoards(boards: TrelloBoard[]): void {
  console.error('Available boards:\n');

  boards.forEach((board, index) => {
    console.error(`  ${index + 1}. ${board.name}`);
    console.error(`     id:  ${board.id}`);
    console.error(`     url: ${board.url}\n`);
  });
}

function parseSelection(answer: string, boards: TrelloBoard[]): TrelloBoard[] {
  const indexes = answer
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10) - 1)
    .filter((value) => Number.isInteger(value) && value >= 0 && value < boards.length);

  return [...new Set(indexes)].map((index) => boards[index]!);
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
  const answer = await rl.question('Select board numbers (comma-separated): ');
  rl.close();

  const selected = parseSelection(answer, boards);

  if (selected.length === 0) {
    console.error('No valid board selection.');
    process.exit(1);
  }

  const boardIds = selected.map((board) => board.id);

  await saveAllowedBoardIds(config.configPath, boardIds);

  console.error(`\nSaved ${boardIds.length} board(s) to ${config.configPath}`);
  console.error('\nOptional MCP env override:');
  console.error(`TRELLO_ALLOWED_BOARD_IDS=${boardIds.join(',')}`);
}
