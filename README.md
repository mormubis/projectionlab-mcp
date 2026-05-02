# ProjectionLab MCP Server

MCP server for [ProjectionLab](https://projectionlab.com) — export, snapshot, and restore your financial plans. Includes a built-in FIRE advisor knowledge base for analyzing Financial Independence scenarios.

## Features

- **Guided API key setup** — securely extracts and validates the key entirely in the browser; the key never enters the conversation
- **Full data export** — returns a script that exports all plans, accounts, income, expenses, and settings
- **Local snapshots** — save exports as timestamped JSON files with automatic API key redaction
- **Snapshot restore** — generate scripts to restore plans and current finances from any snapshot
- **FIRE knowledge base** — curated resource with links to FIRE concepts, withdrawal strategies, and ProjectionLab help docs

## Prerequisites

This server does not talk to ProjectionLab directly. It generates JavaScript that must be executed in a browser where ProjectionLab is open. You need a browser automation MCP alongside this one:

- [Chrome DevTools MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/chrome-devtools) or [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright)
- A [ProjectionLab Premium](https://projectionlab.com) account with Plugins enabled

## API

### Tools

- **pl_setup**
  - Guided two-step API key configuration
  - Step 1 (no args): returns the settings URL, a browser extraction script, and setup instructions
  - Step 2 (`validationResult`): confirms the key is valid and ready
  - The extraction script reads the key from the DOM, stores it in `sessionStorage`, and validates it — all client-side

- **pl_export**
  - Returns a JavaScript string that exports all ProjectionLab data
  - Execute the script in the browser; pass the result to `pl_snapshot` to save it
  - Annotations: `readOnlyHint: true`

- **pl_snapshot**
  - Saves export data as a local JSON file
  - Input: `data` (required) — the export result from running the `pl_export` script in the browser
  - Input: `label` (optional) — appended to the snapshot filename
  - API keys are automatically redacted before writing

- **pl_list_snapshots**
  - Lists all saved snapshots, sorted newest first
  - Returns filename, path, creation time, and size
  - Annotations: `readOnlyHint: true`

- **pl_restore**
  - Reads a snapshot file and returns JavaScript strings to restore the data
  - Input: `snapshotPath` (required) — absolute path to the snapshot file
  - Returns one script per data section (plans, current finances); execute each in order
  - Always take a snapshot of the current state before restoring

### Resources

- **projectionlab://knowledge**
  - Curated index of ProjectionLab documentation URLs organized by topic
  - Covers FIRE concepts, withdrawal strategies, and ProjectionLab features

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

### NPX

```json
{
  "mcpServers": {
    "projectionlab": {
      "command": "npx",
      "args": ["-y", "@mormubis/projectionlab-mcp"]
    }
  }
}
```

### Local (from source)

```json
{
  "mcpServers": {
    "projectionlab": {
      "command": "node",
      "args": ["/path/to/projectionlab-mcp/dist/index.js"]
    }
  }
}
```

## Usage with VS Code

Add this to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "projectionlab": {
      "command": "npx",
      "args": ["-y", "@mormubis/projectionlab-mcp"]
    }
  }
}
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PROJECTIONLAB_SNAPSHOTS_DIR` | Directory for snapshot files | `~/.config/projectionlab/snapshots` |
| `PROJECTIONLAB_BASE_URL` | ProjectionLab base URL | `https://app.projectionlab.com/` |

## Security

The API key **never leaves the browser**. During setup, a script runs inside the browser tab to read the key from the DOM, store it in `sessionStorage`, and validate it against the Plugin API. The only value that returns to the conversation is a boolean.

All other scripts (export, restore) read the key from `sessionStorage` at runtime. Snapshots are redacted before writing — any field named `key`, `apiKey`, or `pluginKey` is replaced with `[REDACTED]`.

## Build

```bash
npm install
npm run build
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
