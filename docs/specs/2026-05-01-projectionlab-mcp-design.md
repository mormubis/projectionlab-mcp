# ProjectionLab MCP Server — Design Spec

## Problem

ProjectionLab is a financial planning tool with a browser-only Plugin API (`window.projectionlabPluginAPI`). There's no server-side REST API. To automate plan management — updating balances, creating plans, comparing scenarios — you need to drive the browser.

An existing open-source MCP (`pvulgaris/projectionlab-mcp`) solves this by bundling its own headless Playwright browser, but it limits writes to balance/costBasis updates and is unvetted (0 stars, no community trust). This project handles sensitive financial data, so we want full control over the code.

## Solution

An MCP server that **orchestrates** browser actions without owning a browser. It returns structured action sequences that Claude (or any MCP host) executes against a separate Playwright MCP. The server handles logic, validation, snapshots, and state; the Playwright MCP handles browser interaction.

## Architecture

```
Claude (or any MCP host)
  |
  |-- calls --> Playwright MCP (browser control)
  |               \-- ProjectionLab tab (app.projectionlab.com)
  |
  \-- calls --> finance MCP (this project, stdio)
                  |-- orchestration tools (return action sequences)
                  |-- local state (snapshots, config, API key)
                  \-- schema validation (Plan, Account, etc.)
```

The MCP runs as a **stdio process**. No daemon, no HTTP server, no background process. It never touches the browser directly.

### Action sequences

Each tool returns a JSON object describing a sequence of Playwright actions for Claude to execute:

```typescript
interface ActionStep {
  action: "navigate" | "evaluate" | "snapshot" | "click" | "wait";
  // action-specific fields
  url?: string;           // for navigate
  script?: string;        // for evaluate
  selector?: string;      // for click/wait
  expected?: string;      // description of expected outcome
}

interface ActionSequence {
  tool: string;
  steps: ActionStep[];
  verify?: ActionStep;    // optional verification step after all steps complete
}
```

### Multi-turn data flow

Tools that need browser data back (most of them) are multi-turn:

1. Claude calls an MCP tool (e.g., `pl_update_account`)
2. MCP returns step 1: `exportData` (to get current state + snapshot)
3. Claude executes via Playwright MCP, returns result
4. Claude calls the MCP tool again with the result
5. MCP processes the data, returns step 2: the actual mutation
6. Claude executes via Playwright MCP
7. MCP returns verification step
8. Claude executes, confirms success

The MCP holds conversation state per operation using a request ID. The first call to a tool returns a `requestId` along with the first step. Subsequent calls include the `requestId` and the `result` from the previous step. The MCP uses the request ID to look up in-progress operation state (e.g., the snapshot it took, the current plans array it's modifying). State is ephemeral — cleaned up after the operation completes or errors.

## Plugin API surface

The ProjectionLab Plugin API exposes these methods (all require API key):

| Method | Input | Purpose |
|--------|-------|---------|
| `validateApiKey` | `PluginKeyParam` | Auth check |
| `exportData` | `PluginKeyParam` | Full data export (`CompleteAccountDataExport`) |
| `updateAccount` | `accountId, data, UpdateAccountOptions` | Update one account's fields |
| `restoreCurrentFinances` | `StartingConditions` | Replace all current finances |
| `restorePlans` | `Plan[]` | Replace all plans |
| `restoreProgress` | `ProgressState` | Replace progress state |
| `restoreSettings` | `SettingsState` | Replace settings |

The nested types (`Plan`, `StartingConditions`, `ProgressState`, `SettingsState`, `CompleteAccountDataExport`) are not publicly documented. Their shapes must be derived from real `exportData` dumps.

## Tools

### Session

| Tool | Purpose |
|------|---------|
| `pl_status` | Check if ProjectionLab is open, signed in, Plugin API ready |
| `pl_open` | Navigate to ProjectionLab and validate the session |

### Read

| Tool | Purpose |
|------|---------|
| `pl_export` | Full plan export — returns the complete data structure |
| `pl_get_accounts` | List all accounts with balances |
| `pl_get_plans` | List all plans with their structure |
| `pl_get_milestones` | Plan milestones |
| `pl_get_income_expenses` | Income and expense events |

### Write

| Tool | Purpose |
|------|---------|
| `pl_update_account` | Update balance/costBasis on one account |
| `pl_update_accounts` | Batch update — multiple accounts in one call |
| `pl_create_plan` | Build a new plan and push via `restorePlans` (append) |
| `pl_update_plan` | Modify an existing plan's properties |

### Snapshots

| Tool | Purpose |
|------|---------|
| `pl_snapshot` | Export full state to a local JSON file |
| `pl_list_snapshots` | List available snapshots |
| `pl_restore` | Preview + apply a rollback from a snapshot |

### Bootstrap

| Tool | Purpose |
|------|---------|
| `pl_bootstrap` | Call `exportData`, save raw JSON, log schema shapes for type derivation |

## Types and validation

Types are derived from real `exportData` dumps. The project maintains TypeScript interfaces that grow as we learn more about the schema:

```
src/types/projectionlab.ts   # Plan, Account, StartingConditions, etc.
src/types/actions.ts          # ActionStep, ActionSequence
```

**Validation layer:** before any `restorePlans` or `restoreCurrentFinances` call, the MCP validates the payload against known types. If validation fails, the tool returns an error — no action sequence is emitted. This is the primary safety net since the Plugin API docs say "it is your responsibility to ensure the data you pass is well-formed."

**Schema evolution:** ProjectionLab can change their data model at any time. Re-running `pl_bootstrap` refreshes the raw schema. Breaking changes require manual type updates.

## Error handling and safety

### Pre-write snapshots

Every write tool (`pl_update_account`, `pl_update_accounts`, `pl_create_plan`, `pl_update_plan`) calls `exportData` first and saves a snapshot before returning the write action. Non-negotiable.

### Validation before write

Payloads are validated against known types before emitting `restore*` actions. Fail early, fail locally.

### Multi-turn failure handling

Each action step includes an `expected` field describing what should happen. If Claude reports an unexpected result mid-sequence, the MCP aborts remaining steps and returns an error with the snapshot path for recovery.

### No implicit destructive operations

`restorePlans` replaces ALL plans. The MCP always uses export-modify-restore: read current plans, append/modify, write back. It never drops existing plans unless explicitly requested.

### API key handling

- Read from `~/.config/projectionlab/key` (mode 0600) on every call
- Never logged
- Never included in snapshot files (redacted before write)
- Never returned in tool outputs

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROJECTIONLAB_KEY_PATH` | `~/.config/projectionlab/key` | Plugin API key file |
| `PROJECTIONLAB_SNAPSHOTS_DIR` | `~/.config/projectionlab/snapshots` | Snapshot storage |
| `PROJECTIONLAB_BASE_URL` | `https://app.projectionlab.com/` | ProjectionLab app URL |

## Project structure

```
finance/
  package.json
  tsconfig.json
  src/
    index.ts              # MCP server entry point (stdio transport)
    config.ts             # API key reading, paths, env vars
    types/
      projectionlab.ts    # Plan, Account, StartingConditions, etc.
      actions.ts          # Action sequence types
    tools/
      session.ts          # pl_status, pl_open
      read.ts             # pl_export, pl_get_accounts, pl_get_plans, etc.
      write.ts            # pl_update_account, pl_update_accounts, pl_create_plan, pl_update_plan
      snapshots.ts        # pl_snapshot, pl_list_snapshots, pl_restore
      bootstrap.ts        # pl_bootstrap
    lib/
      actions.ts          # Action sequence builder helpers
      snapshots.ts        # Snapshot read/write/list logic
      validation.ts       # Validate payloads against known types
```

## Stack

- **TypeScript** — type safety for financial data manipulation
- **`@modelcontextprotocol/sdk`** — MCP server framework
- **No Playwright dependency** — delegates browser ops to the Playwright MCP

## Non-goals

- Running its own browser instance
- Executing trades or moving money
- Replacing ProjectionLab's projection engine
- Supporting non-ProjectionLab financial tools (for now)
- UI scraping for projection results (deferred to later)
