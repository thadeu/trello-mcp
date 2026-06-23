# trello-mcp

Universal [Model Context Protocol](https://modelcontextprotocol.io) server for Trello. Works with any MCP-compatible client: Cursor, Claude Desktop, Gemini CLI, Codex, OpenCode, and others.

Read and update Kanban cards on **allowlisted boards only**. Credentials stay in environment variables; nothing is logged.

## Quick start

### First time (recommended)

1. Install the package
2. Configure only `TRELLO_API_KEY` and `TRELLO_TOKEN` in your MCP client
3. Start the MCP server and ask your agent to set up Trello
4. The agent lists your boards, you pick one, and the selection is saved locally

No need to hunt for board ids on first install.

### Already know your board id?

Set `TRELLO_ALLOWED_BOARD_IDS` in the MCP env and skip onboarding.

## Features

- stdio transport (MCP standard for local tools)
- Interactive **onboarding** when no boards are configured
- Board allowlist via env var or saved config file
- Tools: list boards/lists/cards, get/create/update/move cards, add comments, attachments
- Publishable to [npm](https://www.npmjs.com/package/@thadeu/trello-mcp), GitHub Packages, and GitHub release tarballs

## Requirements

- **Development:** [Bun](https://bun.sh) 1.2+
- **Runtime (published package):** Node.js 20+ (bundled `dist/main.js`, launched via `dist/index.js`)

Global installs run `#!/usr/bin/env node`. If `node -v` shows an old version, switch with fnm/nvm before running `trello-mcp`.
- Trello API key and token ([Power-Up admin](https://trello.com/power-ups/admin))
- Recommended: dedicated Trello service account, not a personal user token

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TRELLO_API_KEY` | yes | API key from Trello Power-Up admin |
| `TRELLO_TOKEN` | yes | User token with `read,write` scope |
| `TRELLO_ALLOWED_BOARD_IDS` | no | Comma-separated board ids. Optional — see [Onboarding](#onboarding) |
| `TRELLO_CONFIG_PATH` | no | Override config file path (default: `~/.config/trello-mcp/config.json`) |

Copy `.env.example` when developing locally. MCP clients pass these via `env` in server config.

## Install

### Option 1 — npm (recommended)

```bash
npm install -g @thadeu/trello-mcp@latest
```

Or run without a global install:

```bash
npx @thadeu/trello-mcp
```

### Option 2 — GitHub repo (public)

```bash
npm install -g github:thadeu/trello-mcp
```

Pin a version with `#v0.1.4` if needed.

### Option 3 — GitHub Packages

```bash
npm install -g @thadeu/trello-mcp --registry=https://npm.pkg.github.com
```

Requires a GitHub token with `read:packages`. See `.npmrc.example`.

### Option 4 — GitHub release URL

Each release publishes an npm tarball (`.tgz`) built from `dist/` in CI.

```bash
npm install -g https://github.com/thadeu/trello-mcp/releases/download/v0.1.4/thadeu-trello-mcp-0.1.4.tgz
```

Replace the version in the URL with the tag you need.

### Option 5 — From source

```bash
git clone https://github.com/thadeu/trello-mcp.git
cd trello-mcp
bun install
bun run build
node dist/index.js
```

## Onboarding

When `TRELLO_ALLOWED_BOARD_IDS` is **not** set and no config file exists yet, the server starts in **onboarding mode**:

- Setup tools work immediately
- Card/list tools are blocked until a board is selected
- After selection, all tools unlock **without restarting** the MCP server

### What gets saved

```json
// ~/.config/trello-mcp/config.json
{
  "allowedBoardIds": ["56c215abc7af5016b9bceadb"],
  "updatedAt": "2026-06-23T23:00:00.000Z"
}
```

### Config priority (on server start)

1. `TRELLO_ALLOWED_BOARD_IDS` env var — always wins
2. Saved config file (`~/.config/trello-mcp/config.json`)
3. Onboarding mode when neither is set

If the env var is set, the config file is ignored. Use the env var when you want explicit, portable MCP config. Use onboarding or the config file when you prefer zero board-id setup.

### MCP flow (Cursor, Claude, etc.)

Typical first-run conversation:

```
You:  Set up Trello for me
Agent: calls get_setup_status        → onboarding_required: true
Agent: calls list_available_boards   → [{ id, name, url }, ...]
Agent: asks which board(s) to use
You:  AS DEV
Agent: calls select_allowed_boards     → saves config, tools unlocked
You:  List cards in QA
Agent: calls list_cards                → works
```

Steps:

1. Connect with only `TRELLO_API_KEY` and `TRELLO_TOKEN`
2. `get_setup_status` — check if onboarding is needed
3. `list_available_boards` — list boards from your Trello account
4. User picks one or more boards by **name**
5. `select_allowed_boards` — pass the chosen **board ids**
6. Done — selection persisted, other tools enabled

### CLI flow (terminal)

```bash
export TRELLO_API_KEY=your_key
export TRELLO_TOKEN=your_token
trello-mcp onboard
```

Interactive prompt lists boards by number. Re-run with `--force` to change the saved boards.

### Board id vs URL short code

Trello URLs look like `https://trello.com/b/Nh2gYTTn/as-dev`.

| Value | Example | Works in config? |
|-------|---------|------------------|
| Board id | `56c215abc7af5016b9bceadb` | yes |
| URL short code | `Nh2gYTTn` | no |

Onboarding returns the correct **board id** for each board. You do not need to copy it manually unless setting `TRELLO_ALLOWED_BOARD_IDS` by hand.

## MCP client configuration

All clients use the same pattern: spawn `trello-mcp` (or `npx`) over **stdio** and inject env vars.

### Minimal config (onboarding)

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

Use `"command": "trello-mcp"` if installed globally.

### Full config (skip onboarding)

```json
{
  "mcpServers": {
    "trello": {
      "command": "npx",
      "args": ["-y", "@thadeu/trello-mcp"],
      "env": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token",
        "TRELLO_ALLOWED_BOARD_IDS": "56c215abc7af5016b9bceadb"
      }
    }
  }
}
```

Multiple boards: `"board_id_1,board_id_2"`.

### Cursor

`~/.cursor/mcp.json` or project `.cursor/mcp.json` — use either config above.

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
        "TRELLO_TOKEN": "your_token"
      }
    }
  }
}
```

### Gemini CLI

```json
{
  "mcpServers": {
    "trello": {
      "command": "trello-mcp",
      "env": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token"
      }
    }
  }
}
```

Consult [Gemini CLI MCP docs](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) for the exact config file path on your platform.

### OpenCode / Codex

```json
{
  "mcp": {
    "trello": {
      "type": "stdio",
      "command": ["npx", "-y", "@thadeu/trello-mcp"],
      "environment": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token"
      }
    }
  }
}
```

Adjust keys to match your client schema; the server binary and env vars stay the same.

## Tools

### Setup (always available)

| Tool | Description |
|------|-------------|
| `get_setup_status` | Check whether board onboarding is required |
| `list_available_boards` | All accessible boards (used during onboarding) |
| `select_allowed_boards` | Save user-selected boards and unlock other tools |

### Kanban (requires completed setup)

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
- Restrict boards with onboarding or `TRELLO_ALLOWED_BOARD_IDS`.
- Use a service account token with access only to work boards.
- No delete-card tool in v1 to reduce accidental data loss.
- Server logs errors to **stderr** only; stdout is reserved for MCP protocol.

## Troubleshooting

### `SyntaxError: Unexpected token '??='`

Your shell is running an old Node.js binary from `PATH` (often system Node 14 while fnm/nvm has Node 20+ elsewhere).

```bash
node -v          # must be 20+
which node       # check which binary runs
fnm use 20       # or: nvm use 20
trello-mcp onboard
```

Since v0.1.6 the launcher prints a clear error when Node is too old instead of failing on syntax.

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
git tag v0.1.4
git push origin v0.1.4
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
