import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { runOnboardingCli } from './onboarding/cli.js';
import { TrelloClient } from './trello-client.js';
import { registerTools } from './tools/index.js';

const SERVER_NAME = 'trello-mcp';
const SERVER_VERSION = process.env.npm_package_version ?? '0.0.0';

async function main(): Promise<void> {
  const config = await loadConfig();
  const client = new TrelloClient(config);
  const command = process.argv[2];

  if (command === 'onboard') {
    await runOnboardingCli(config, client, { force: process.argv.includes('--force') });
    return;
  }

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${SERVER_NAME}] fatal: ${message}`);
  process.exit(1);
});
