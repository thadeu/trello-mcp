# trello-mcp

Universal [Model Context Protocol](https://modelcontextprotocol.io) server for Trello. Works with any MCP-compatible client: Cursor, Claude Desktop, Gemini CLI, Codex, OpenCode, and others.

Read and update Kanban cards on **allowlisted boards only**. Credentials stay in environment variables; nothing is logged.

## Features

- stdio transport (MCP standard for local tools)
- Board allowlist via `TRELLO_ALLOWED_BOARD_IDS` or interactive onboarding
- Onboarding flow when no boards are configured yet
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
| `TRELLO_ALLOWED_BOARD_IDS` | no | Comma-separated board ids. Optional on first run — see [Onboarding](#onboarding) |
| `TRELLO_CONFIG_PATH` | no | Override config file path (default: `~/.config/trello-mcp/config.json`) |

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

On first install you only need `TRELLO_API_KEY` and `TRELLO_TOKEN`. Board selection happens via onboarding.

## Onboarding

If `TRELLO_ALLOWED_BOARD_IDS` is not set, the MCP server starts in onboarding mode and exposes setup tools before enabling card operations.

### MCP flow (Cursor, Claude, etc.)

1. Connect with only `TRELLO_API_KEY` and `TRELLO_TOKEN`
2. Call `get_setup_status` — returns `onboarding_required: true`
3. Call `list_available_boards` — lists boards from your Trello account
4. Ask the user which board(s) to use
5. Call `select_allowed_boards` with the chosen board ids
6. Selection is saved to `~/.config/trello-mcp/config.json` and other tools unlock immediately

Example minimal MCP config:

```json
{
  "mcpServers": {
    "trello": {
      "command": "npx",
      "args": ["-y", "@thadeu/trello-mcp"],
      "env": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token"
      }
    }
  }
}
```

Use the board **id** (24-char hash), not the short code from the URL (`trello.com/b/Nh2gYTTn/...`).

### CLI flow

```bash
export TRELLO_API_KEY=your_key
export TRELLO_TOKEN=your_token
trello-mcp onboard
```

Re-run with `--force` to change the saved boards.

### Config priority

1. `TRELLO_ALLOWED_BOARD_IDS` env var (wins on restart)
2. Saved config file (`~/.config/trello-mcp/config.json`)
3. Onboarding mode when neither is set


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
| `get_setup_status` | Check whether board onboarding is required |
| `list_available_boards` | All accessible boards (onboarding) |
| `select_allowed_boards` | Save user-selected boards and unlock tools |
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
