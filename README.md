# trello-mcp

Universal [Model Context Protocol](https://modelcontextprotocol.io) server for Trello. Works with any MCP-compatible client: Cursor, Claude Desktop, Gemini CLI, Codex, OpenCode, and others.

Read and update Kanban cards on **allowlisted boards only**. Credentials stay in environment variables; nothing is logged.

## Features

- stdio transport (MCP standard for local tools)
- Board allowlist via `TRELLO_ALLOWED_BOARD_IDS`
- Tools: list boards/lists/cards, get/create/update/move cards, add comments
- Publishable to [npm](https://www.npmjs.com/package/@thadeu/trello-mcp), GitHub Packages, and GitHub release tarballs

## Requirements

- **Development:** [Bun](https://bun.sh) 1.2+
- **Runtime (published package):** Node.js 20+ (bundled `dist/index.js`)
- Trello API key and token ([Power-Up admin](https://trello.com/power-ups/admin))
- Recommended: dedicated Trello service account, not a personal user token

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TRELLO_API_KEY` | yes | API key from Trello Power-Up admin |
| `TRELLO_TOKEN` | yes | User token with `read,write` scope |
| `TRELLO_ALLOWED_BOARD_IDS` | yes | Comma-separated board ids the server may access |

Copy `.env.example` when developing locally. MCP clients pass these via `env` in server config.

## Install

### Option 1 — npm (recommended)

```bash
npm install -g @thadeu/trello-mcp
```

Or run without a global install:

```bash
npx @thadeu/trello-mcp
```

### Option 2 — GitHub Packages

Useful if you already mirror internal packages on GitHub.

```bash
npm install -g @thadeu/trello-mcp --registry=https://npm.pkg.github.com
```

Requires a GitHub token with `read:packages`. See `.npmrc.example`.

### Option 3 — GitHub release URL

Each release publishes an npm tarball (`.tgz`) built from `dist/` in CI.

```bash
npm install -g https://github.com/thadeu/trello-mcp/releases/download/v0.1.2/thadeu-trello-mcp-0.1.2.tgz
```

Replace the version in the URL with the tag you need.

### Option 4 — From source

```bash
git clone https://github.com/thadeu/trello-mcp.git
cd trello-mcp
bun install
bun run build
node dist/index.js
```

## MCP client configuration

All clients use the same pattern: spawn `trello-mcp` (or `npx`) over **stdio** and inject env vars.

### Cursor

`~/.cursor/mcp.json` or project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "trello": {
      "command": "npx",
      "args": ["-y", "@thadeu/trello-mcp"],
      "env": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token",
        "TRELLO_ALLOWED_BOARD_IDS": "board_id_1,board_id_2"
      }
    }
  }
}
```

Use `"command": "trello-mcp"` if installed globally.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "trello": {
      "command": "npx",
      "args": ["-y", "@thadeu/trello-mcp"],
      "env": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token",
        "TRELLO_ALLOWED_BOARD_IDS": "board_id_1"
      }
    }
  }
}
```

### Gemini CLI

Gemini supports MCP via project or user config. Point `command` at the same binary:

```json
{
  "mcpServers": {
    "trello": {
      "command": "trello-mcp",
      "env": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token",
        "TRELLO_ALLOWED_BOARD_IDS": "board_id_1"
      }
    }
  }
}
```

Consult [Gemini CLI MCP docs](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) for the exact config file path on your platform.

### OpenCode / Codex

Use the host’s MCP server block with stdio transport. Example for OpenCode-style config:

```json
{
  "mcp": {
    "trello": {
      "type": "stdio",
      "command": ["npx", "-y", "@thadeu/trello-mcp"],
      "environment": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token",
        "TRELLO_ALLOWED_BOARD_IDS": "board_id_1"
      }
    }
  }
}
```

Adjust keys to match your client schema; the server binary and env vars stay the same.

## Tools

| Tool | Description |
|------|-------------|
| `list_boards` | Boards filtered by allowlist |
| `list_lists` | Lists on a board |
| `list_cards` | Cards on a board or list |
| `get_card` | Single card details |
| `create_card` | New card in a list |
| `update_card` | Update name, description, due date, labels, archive |
| `move_card` | Move card to another list |
| `add_comment` | Add comment to a card |
| `archive_card` | Archive (close) a card |
| `add_attachment` | Attach a URL or local file to a card |

## Security

- Treat `TRELLO_TOKEN` like a password; never commit it.
- Restrict boards with `TRELLO_ALLOWED_BOARD_IDS`.
- Use a service account token with access only to work boards.
- No delete-card tool in v1 to reduce accidental data loss.
- Server logs errors to **stderr** only; stdout is reserved for MCP protocol.

## Development

Built with **Bun** (bundle) and **Vitest** (tests). TypeScript is used for types only — no `tsc` emit.

```bash
bun install
bun run test          # vitest (not `bun test`, which is Bun's native runner)
bun run typecheck     # tsc --noEmit
bun run build         # bun build → dist/index.js
bun run dev           # watch src/index.ts
bun run inspector     # MCP Inspector
```

## Release

Tag a version to build, test, publish, and attach assets:

```bash
git tag v0.1.2
git push origin v0.1.2
```

Workflow `.github/workflows/release.yml`:

1. Runs tests and builds `dist/`
2. Creates GitHub release with `npm pack` tarball
3. Publishes `@thadeu/trello-mcp` to **npm** and **GitHub Packages**

### npm publish setup (one-time)

1. Create an npm account and ensure you own the `@thadeu` scope
2. Create an npm **Automation** token
3. Add repository secret `NPM_TOKEN` in GitHub → Settings → Secrets → Actions

## License

MIT — Copyright (c) 2026 Thadeu Esteves. See [LICENSE](LICENSE).
