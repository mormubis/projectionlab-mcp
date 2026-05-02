# ProjectionLab MCP Server v2 — Design Spec

## Problem

v1 of this MCP was designed around multi-turn action sequences — each tool returned a JSON structure describing browser steps for Claude to execute via a Playwright MCP. In practice, Claude bypassed the MCP tools entirely and wrote JavaScript directly through the browser MCP (chrome devtools or Playwright). The multi-turn orchestration added friction without value, and the tool surface didn't match the operations users actually need.

## What we learned

From a real session managing ProjectionLab plans:

- **pl_setup worked well** — guided API key configuration through the browser
- **Every data mutation** (salary, expenses, milestones, withdrawal strategy, monte carlo settings, tax config) was done by injecting JavaScript via chrome devtools, not through MCP tools
- **The FIRE advisor instructions** added real value — Claude gave opinionated analysis using the knowledge base
- **Snapshots** were useful as a safety net before bulk changes
- **The MCP's typed data model** helped Claude write correct JavaScript against the Plugin API

The MCP's value is in knowledge, safety, and setup — not in wrapping every Plugin API call.

## Solution

A lean MCP server that provides:

1. **Setup** — guided API key configuration
2. **Data access** — returns JavaScript strings for the Plugin API, with the API key injected
3. **Safety** — local snapshots before destructive operations
4. **Knowledge** — FIRE advisor instructions + curated resource index
5. **Guidance** — instructions that teach Claude how to use the browser MCP for CRUD operations and simulations

All CRUD operations (update income, change milestones, toggle withdrawal strategy, etc.) are handled by Claude writing JavaScript and executing it through whatever browser MCP is available. The finance MCP never touches the browser.

## Architecture

```
Claude (or any MCP host)
  |
  |-- calls --> browser MCP (Playwright or chrome devtools)
  |               \-- evaluates JS against window.projectionlabPluginAPI
  |               \-- navigates ProjectionLab UI (e.g. Chance of Success)
  |
  \-- calls --> finance MCP (this project, stdio)
                  |-- tools: pl_setup, pl_export, pl_snapshot, pl_list_snapshots, pl_restore
                  |-- resource: projectionlab-knowledge (URL index)
                  \-- instructions: FIRE advisor + browser workflow guidance
```

The MCP runs as a stdio process. No daemon, no HTTP server, no browser dependency.

## Tools

### pl_setup

Guided API key configuration. Three-step flow:

1. Call with no args — returns instructions to navigate to ProjectionLab settings page and enable plugins
2. Call with `apiKey` — validates format, stores key to `~/.config/projectionlab/key` (mode 0600), returns JavaScript string to validate the key via `validateApiKey`
3. Call with `requestId` + validation result — confirms success or failure

This is the only multi-step tool. It's justified because setup is a one-time onboarding flow.

### pl_export

Returns a JavaScript string that calls `exportData` with the API key injected. Claude executes it in the browser and gets the raw data back.

Input: none (reads API key from disk)
Output: `{ script: string }` — the JS to evaluate

Example output:
```json
{
  "script": "await window.projectionlabPluginAPI.exportData({ key: \"...\" })"
}
```

No multi-turn. Claude executes the script, gets the data, reasons about it directly using the types and FIRE knowledge from the instructions.

### pl_snapshot

Saves exported data to a local JSON file. API keys are redacted before writing.

Input: `{ data: unknown, label?: string }`
Output: `{ path: string }`

Claude calls `pl_export`, runs the script in the browser, then passes the result to `pl_snapshot` for local storage.

### pl_list_snapshots

Lists saved snapshot files with metadata.

Input: none
Output: `{ snapshots: Array<{ filename, path, createdAt, sizeMB }> }`

### pl_restore

Reads a snapshot file and returns JavaScript strings to restore the data via the Plugin API. Claude should take a snapshot of the current state before restoring (call `pl_export` + `pl_snapshot` first).

Input: `{ snapshotPath: string }`
Output: `{ scripts: string[] }` — one script per restore call (restorePlans, restoreCurrentFinances)

Claude executes each script in the browser.

## Resources

### projectionlab-knowledge

A static MCP resource containing a curated index of ProjectionLab documentation URLs organized by topic. Claude can reference these when users ask for more detail.

```
FIRE Concepts:
- Financial Independence: https://projectionlab.com/financial-terms/financial-independence
- FIRE: https://projectionlab.com/financial-terms/financial-independence-retire-early-fire
- FI Number: https://projectionlab.com/financial-terms/fi-number
- Coast FIRE: https://projectionlab.com/financial-terms/coast-fire
- Lean FIRE: https://projectionlab.com/financial-terms/lean-fire
- Barista FIRE: https://projectionlab.com/financial-terms/barista-fire
- Fat FIRE: https://projectionlab.com/financial-terms/fat-fire
- Chubby FIRE: https://projectionlab.com/financial-terms/chubby-fire
- Mullet FIRE: https://projectionlab.com/financial-terms/mullet-fire
- Savings Rate: https://projectionlab.com/financial-terms/savings-rate

Withdrawal & Risk:
- Safe Withdrawal Rate: https://projectionlab.com/financial-terms/safe-withdrawal-rate
- 4% Rule: https://projectionlab.com/financial-terms/4-percent-rule
- Withdrawal Rate: https://projectionlab.com/financial-terms/withdrawal-rate
- Sequence of Returns Risk: https://projectionlab.com/financial-terms/sequence-of-returns-risk
- Bucket Strategy: https://projectionlab.com/financial-terms/bucket-strategy
- Monte Carlo Simulation: https://projectionlab.com/financial-terms/monte-carlo-simulation

ProjectionLab Help:
- Creating Plans: https://projectionlab.com/help/create-new-plan
- Cash Flow Priorities: https://projectionlab.com/help/cash-flow-priorities
- Withdrawal Strategy Mode: https://projectionlab.com/help/withdrawal-strategy-mode
- Plan vs Chance of Success: https://projectionlab.com/help/plan-vs-chance-of-success
- Monte Carlo Trials: https://projectionlab.com/help/increase-trials-in-chance-of-success
- Investment Growth: https://projectionlab.com/help/model-investment-growth
- Getting Started: https://projectionlab.com/blog/getting-started-with-projectionlab
- Financial Scenarios: https://projectionlab.com/blog/financial-planning-scenarios
- Milestones: https://projectionlab.com/blog/milestones

Plugin API:
- API Docs: https://app.projectionlab.com/docs/
- PluginAPI Type: https://app.projectionlab.com/docs/types/PluginAPI.html
```

## Server instructions

The instructions field contains three sections:

### 1. Tool workflow

How to use the 5 tools. Short, mechanical.

### 2. Browser workflow guidance

Explicit instructions on how Claude should use the browser MCP to interact with ProjectionLab:

**Data mutations:** Write JavaScript using `window.projectionlabPluginAPI` and execute via the browser MCP's evaluate function. Always take a snapshot (via `pl_snapshot`) before destructive operations. The Plugin API methods are:
- `exportData({ key })` — full data export
- `updateAccount(accountId, data, { key })` — update one account
- `restorePlans(plans, { key })` — replace all plans
- `restoreCurrentFinances(startingConditions, { key })` — replace current finances
- `validateApiKey({ key })` — check API key validity

**Running Monte Carlo simulations:** Navigate to the plan in ProjectionLab, open the Chance of Success tab, wait for the simulation to run, then read or screenshot the results. The simulation runs in the browser — it cannot be triggered via the Plugin API. Results include milestone distributions, success rates, and net worth charts.

**Viewing plan projections:** Navigate to a plan and read the Plan tab for the deterministic projection, or screenshot the charts.

**Navigating ProjectionLab:**
- Dashboard: `https://app.projectionlab.com/`
- Settings: `https://app.projectionlab.com/settings`
- Plugins: `https://app.projectionlab.com/settings/plugins`
- Plans: `https://app.projectionlab.com/plan/{planId}`

### 3. FIRE advisor knowledge base

The existing FIRE knowledge (formulas, variants table, opinionated analysis rules, withdrawal strategies, reading ProjectionLab data). Unchanged from v1.

## Types

Keep `src/types/projectionlab.ts` as derived in v1 — the full type definitions for the ProjectionLab data model. These inform Claude when writing JavaScript for mutations, and they're used in `pl_snapshot` for data validation and redaction.

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
    config.ts             # API key reading/writing, paths, env vars
    types/
      projectionlab.ts    # Full ProjectionLab data model types
    tools/
      setup.ts            # pl_setup
      export.ts           # pl_export
      snapshots.ts        # pl_snapshot, pl_list_snapshots, pl_restore
    lib/
      snapshots.ts        # Snapshot read/write/list/redact logic
    resources/
      knowledge.ts        # ProjectionLab knowledge base URL index
```

## What gets removed from v1

- `src/types/actions.ts` — action sequence types (no longer used)
- `src/lib/actions.ts` — action sequence builder helpers
- `src/lib/state.ts` — ephemeral request-scoped state management
- `src/lib/plugin-api.ts` — script generators (Claude writes JS directly now)
- `src/lib/validation.ts` — payload validation (Claude handles correctness)
- `src/tools/session.ts` — pl_status, pl_open (Claude checks directly via browser)
- `src/tools/read.ts` — all granular read tools (replaced by pl_export)
- `src/tools/write.ts` — all write tools (Claude writes JS directly)
- `src/tools/bootstrap.ts` — pl_bootstrap (type derivation is done)

## Error handling and safety

### Pre-write snapshots

The server instructions tell Claude to call `pl_snapshot` before any destructive operation. This is a convention enforced by instructions, not by tool mechanics. The snapshot tool handles redaction and local storage.

### API key handling

- Read from `~/.config/projectionlab/key` (mode 0600)
- Injected into the `pl_export` script output
- Redacted from snapshot files
- `pl_setup` writes the key with proper permissions

### Snapshot redaction

Before writing snapshot files, the following field names are recursively redacted: `key`, `apiKey`, `pluginKey`. Values are replaced with `[REDACTED]`.

## Non-goals

- Running its own browser instance
- Wrapping every Plugin API call as a tool
- Multi-turn orchestration
- Running Monte Carlo simulations (browser handles this)
- Executing trades or moving money
