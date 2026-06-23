import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

export async function promptCredentials(): Promise<{
  TRELLO_API_KEY: string;
  TRELLO_TOKEN: string;
}> {
  console.error('Trello credentials not found in env or MCP config.\n');
  console.error('Get them at https://trello.com/power-ups/admin\n');

  const rl = readline.createInterface({ input, output });

  try {
    const apiKey = (await rl.question('Trello API key: ')).trim();
    const token = (await rl.question('Trello token: ')).trim();

    if (!apiKey || !token) {
      throw new Error('API key and token are required');
    }

    return {
      TRELLO_API_KEY: apiKey,
      TRELLO_TOKEN: token,
    };
  } finally {
    rl.close();
  }
}
