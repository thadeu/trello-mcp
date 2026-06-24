import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadMergedEnv } from './credentials.js';
import { loadConfig } from './config.js';
import { runOnboardingCli } from './onboarding/cli.js';
import { promptCredentials } from './onboarding/prompt-credentials.js';
import { TrelloClient } from './trello-client.js';
import { registerTools } from './tools/index.js';

const SERVER_NAME = 'trello-mcp';
const SERVER_VERSION =
  process.env.npm_package_version ?? process.env.TRELLO_MCP_VERSION ?? '0.0.0';

async function resolveEnvForCommand(command: string | undefined): Promise<NodeJS.ProcessEnv> {
  let env = await loadMergedEnv(process.env);

  if (command !== 'onboard') {
    return env;
  }

  if (env.TRELLO_API_KEY?.trim() && env.TRELLO_TOKEN?.trim()) {
    return env;
  }

  return {
    ...env,
    ...(await promptCredentials()),
  };
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const env = await resolveEnvForCommand(command);
  const config = await loadConfig(env);
  const client = new TrelloClient(config);

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
