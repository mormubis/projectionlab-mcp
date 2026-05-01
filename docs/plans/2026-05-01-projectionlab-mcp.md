# ProjectionLab MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server (stdio) that orchestrates ProjectionLab browser actions by returning structured action sequences, delegating actual browser interaction to a separate Playwright MCP.

**Architecture:** The server registers tools via `@modelcontextprotocol/sdk`, each returning JSON action sequences (navigate, evaluate, snapshot, click, wait). Multi-turn tools use ephemeral request-scoped state to hold in-progress operation data between calls. All writes are preceded by automatic snapshots.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod` (input validation), Node.js (>=20)

---

## File Structure

```
finance/
  package.json              # name: finance, type: module, bin entry, build/dev scripts
  tsconfig.json             # strict, ESM, target ES2022
  src/
    index.ts                # MCP server entry point (stdio transport)
    config.ts               # API key reading, paths, env vars
    types/
      projectionlab.ts      # Plan, Account, StartingConditions, etc.
      actions.ts            # ActionStep, ActionSequence, ActionResult
    lib/
      actions.ts            # Action sequence builder helpers
      snapshots.ts          # Snapshot read/write/list logic
      validation.ts         # Validate payloads against known types
      state.ts              # Ephemeral request-scoped state management
      plugin-api.ts         # Plugin API script generators (JS strings for evaluate actions)
    tools/
      session.ts            # pl_status, pl_open
      read.ts               # pl_export, pl_get_accounts, pl_get_plans, etc.
      write.ts              # pl_update_account, pl_update_accounts, pl_create_plan, pl_update_plan
      snapshots.ts          # pl_snapshot, pl_list_snapshots, pl_restore
      bootstrap.ts          # pl_bootstrap
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "finance",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "bin": {
    "finance": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.25.23"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules` created, `package-lock.json` generated.

- [ ] **Step 4: Create directory structure**

```bash
mkdir -p src/types src/lib src/tools
```

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json package-lock.json
git commit -m "scaffold project with typescript and mcp sdk"
```

---

### Task 2: Action sequence types

**Files:**
- Create: `src/types/actions.ts`

- [ ] **Step 1: Create `src/types/actions.ts`**

```typescript
export type ActionType = "navigate" | "evaluate" | "snapshot" | "click" | "wait";

export interface ActionStep {
  action: ActionType;
  description: string;
  url?: string;
  script?: string;
  selector?: string;
  expected?: string;
  timeout?: number;
}

export interface ActionSequence {
  tool: string;
  steps: ActionStep[];
  verify?: ActionStep;
  requestId?: string;
  done?: boolean;
}

export interface ContinueInput {
  requestId: string;
  result: unknown;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/actions.ts
git commit -m "add action sequence types"
```

---

### Task 3: ProjectionLab types

**Files:**
- Create: `src/types/projectionlab.ts`

These types are intentionally minimal — derived shapes will grow as `pl_bootstrap` captures real data. We define only what we need for the tools.

- [ ] **Step 1: Create `src/types/projectionlab.ts`**

```typescript
export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  costBasis?: number;
  [key: string]: unknown;
}

export interface Milestone {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface IncomeEvent {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ExpenseEvent {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Plan {
  id: string;
  name: string;
  accounts?: Account[];
  milestones?: Milestone[];
  incomeEvents?: IncomeEvent[];
  expenseEvents?: ExpenseEvent[];
  [key: string]: unknown;
}

export interface StartingConditions {
  accounts?: Account[];
  [key: string]: unknown;
}

export interface ProgressState {
  [key: string]: unknown;
}

export interface SettingsState {
  [key: string]: unknown;
}

export interface CompleteAccountDataExport {
  plans?: Plan[];
  startingConditions?: StartingConditions;
  progress?: ProgressState;
  settings?: SettingsState;
  [key: string]: unknown;
}

export interface PluginKeyParam {
  key: string;
}

export interface UpdateAccountOptions {
  balance?: number;
  costBasis?: number;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/projectionlab.ts
git commit -m "add projectionlab domain types"
```

---

### Task 4: Configuration module

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Create `src/config.ts`**

```typescript
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const config = {
  keyPath:
    process.env.PROJECTIONLAB_KEY_PATH ??
    join(homedir(), ".config", "projectionlab", "key"),

  snapshotsDir:
    process.env.PROJECTIONLAB_SNAPSHOTS_DIR ??
    join(homedir(), ".config", "projectionlab", "snapshots"),

  baseUrl:
    process.env.PROJECTIONLAB_BASE_URL ?? "https://app.projectionlab.com/",
} as const;

export async function readApiKey(): Promise<string> {
  try {
    const raw = await readFile(config.keyPath, "utf-8");
    const key = raw.trim();
    if (!key) throw new Error("API key file is empty");
    return key;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to read API key";
    throw new Error(
      `Cannot read ProjectionLab API key from ${config.keyPath}: ${message}`,
    );
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "add configuration module"
```

---

### Task 5: Plugin API script generators

**Files:**
- Create: `src/lib/plugin-api.ts`

These are JavaScript string templates that get sent as `evaluate` actions. They run in the browser context against `window.projectionlabPluginAPI`.

- [ ] **Step 1: Create `src/lib/plugin-api.ts`**

```typescript
/**
 * Generates JavaScript strings that execute against the ProjectionLab
 * Plugin API in the browser. These are used as `script` values in
 * evaluate ActionSteps.
 */

export function validateApiKeyScript(key: string): string {
  return `await window.projectionlabPluginAPI.validateApiKey({ key: ${JSON.stringify(key)} })`;
}

export function exportDataScript(key: string): string {
  return `await window.projectionlabPluginAPI.exportData({ key: ${JSON.stringify(key)} })`;
}

export function updateAccountScript(
  key: string,
  accountId: string,
  data: Record<string, unknown>,
): string {
  return `await window.projectionlabPluginAPI.updateAccount(${JSON.stringify(accountId)}, ${JSON.stringify(data)}, { key: ${JSON.stringify(key)} })`;
}

export function restorePlansScript(key: string, plans: unknown[]): string {
  return `await window.projectionlabPluginAPI.restorePlans(${JSON.stringify(plans)}, { key: ${JSON.stringify(key)} })`;
}

export function restoreCurrentFinancesScript(
  key: string,
  startingConditions: unknown,
): string {
  return `await window.projectionlabPluginAPI.restoreCurrentFinances(${JSON.stringify(startingConditions)}, { key: ${JSON.stringify(key)} })`;
}

export function checkPluginApiScript(): string {
  return `typeof window.projectionlabPluginAPI !== 'undefined'`;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/plugin-api.ts
git commit -m "add plugin api script generators"
```

---

### Task 6: Action sequence builder

**Files:**
- Create: `src/lib/actions.ts`

- [ ] **Step 1: Create `src/lib/actions.ts`**

```typescript
import type { ActionStep, ActionSequence } from "../types/actions.js";

export function navigate(url: string, description: string): ActionStep {
  return { action: "navigate", url, description };
}

export function evaluate(
  script: string,
  description: string,
  expected?: string,
): ActionStep {
  return { action: "evaluate", script, description, expected };
}

export function snapshot(description: string): ActionStep {
  return { action: "snapshot", description };
}

export function click(
  selector: string,
  description: string,
  expected?: string,
): ActionStep {
  return { action: "click", selector, description, expected };
}

export function wait(
  selector: string,
  description: string,
  timeout?: number,
): ActionStep {
  return { action: "wait", selector, description, timeout };
}

export function sequence(
  tool: string,
  steps: ActionStep[],
  options?: { verify?: ActionStep; requestId?: string; done?: boolean },
): ActionSequence {
  return {
    tool,
    steps,
    verify: options?.verify,
    requestId: options?.requestId,
    done: options?.done,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions.ts
git commit -m "add action sequence builder helpers"
```

---

### Task 7: Ephemeral state management

**Files:**
- Create: `src/lib/state.ts`

- [ ] **Step 1: Create `src/lib/state.ts`**

```typescript
import { randomUUID } from "node:crypto";

export interface OperationState {
  tool: string;
  step: number;
  data: Record<string, unknown>;
  createdAt: number;
}

const operations = new Map<string, OperationState>();

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function createOperation(
  tool: string,
  data?: Record<string, unknown>,
): string {
  cleanup();
  const id = randomUUID();
  operations.set(id, {
    tool,
    step: 0,
    data: data ?? {},
    createdAt: Date.now(),
  });
  return id;
}

export function getOperation(requestId: string): OperationState | undefined {
  cleanup();
  return operations.get(requestId);
}

export function advanceOperation(
  requestId: string,
  data?: Record<string, unknown>,
): void {
  const op = operations.get(requestId);
  if (!op) throw new Error(`Unknown operation: ${requestId}`);
  op.step += 1;
  if (data) Object.assign(op.data, data);
}

export function completeOperation(requestId: string): void {
  operations.delete(requestId);
}

function cleanup(): void {
  const now = Date.now();
  for (const [id, op] of operations) {
    if (now - op.createdAt > TTL_MS) {
      operations.delete(id);
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/state.ts
git commit -m "add ephemeral request-scoped state management"
```

---

### Task 8: Snapshot library

**Files:**
- Create: `src/lib/snapshots.ts`

- [ ] **Step 1: Create `src/lib/snapshots.ts`**

```typescript
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";

export interface SnapshotMeta {
  filename: string;
  path: string;
  createdAt: string;
  sizeMB: number;
}

function redactApiKey(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;
  if (Array.isArray(data)) return data.map(redactApiKey);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (k === "key" || k === "apiKey" || k === "pluginKey") {
      result[k] = "[REDACTED]";
    } else {
      result[k] = redactApiKey(v);
    }
  }
  return result;
}

export async function saveSnapshot(
  data: unknown,
  label?: string,
): Promise<string> {
  await mkdir(config.snapshotsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = label ? `-${label}` : "";
  const filename = `snapshot-${timestamp}${suffix}.json`;
  const filepath = join(config.snapshotsDir, filename);

  const redacted = redactApiKey(data);
  await writeFile(filepath, JSON.stringify(redacted, null, 2), "utf-8");

  return filepath;
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  await mkdir(config.snapshotsDir, { recursive: true });

  const files = await readdir(config.snapshotsDir);
  const snapshots: SnapshotMeta[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const filepath = join(config.snapshotsDir, file);
    const content = await readFile(filepath, "utf-8");
    const sizeBytes = Buffer.byteLength(content, "utf-8");

    // Extract timestamp from filename: snapshot-YYYY-MM-DDTHH-MM-SS-sssZ-label.json
    const match = file.match(
      /^snapshot-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/,
    );
    const createdAt = match
      ? match[1].replace(/(\d{2})-(\d{2})-(\d{3})Z/, "$1:$2:$3Z").replace("T", "T")
      : "unknown";

    snapshots.push({
      filename: file,
      path: filepath,
      createdAt,
      sizeMB: Math.round((sizeBytes / 1024 / 1024) * 100) / 100,
    });
  }

  return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadSnapshot(
  filepath: string,
): Promise<unknown> {
  const content = await readFile(filepath, "utf-8");
  return JSON.parse(content);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/snapshots.ts
git commit -m "add snapshot read/write/list library"
```

---

### Task 9: Validation library

**Files:**
- Create: `src/lib/validation.ts`

- [ ] **Step 1: Create `src/lib/validation.ts`**

```typescript
import type {
  Account,
  Plan,
  CompleteAccountDataExport,
} from "../types/projectionlab.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAccount(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Account must be an object"] };
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) {
    errors.push("Account must have a non-empty string 'id'");
  }
  if (typeof obj.name !== "string") {
    errors.push("Account must have a string 'name'");
  }
  if (typeof obj.balance !== "number") {
    errors.push("Account must have a numeric 'balance'");
  }

  return { valid: errors.length === 0, errors };
}

export function validatePlan(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Plan must be an object"] };
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) {
    errors.push("Plan must have a non-empty string 'id'");
  }
  if (typeof obj.name !== "string") {
    errors.push("Plan must have a string 'name'");
  }

  return { valid: errors.length === 0, errors };
}

export function validateExport(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Export data must be an object"] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.plans !== undefined) {
    if (!Array.isArray(obj.plans)) {
      errors.push("'plans' must be an array if present");
    } else {
      for (let i = 0; i < obj.plans.length; i++) {
        const planResult = validatePlan(obj.plans[i]);
        for (const err of planResult.errors) {
          errors.push(`plans[${i}]: ${err}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateAccountUpdate(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Update data must be an object"] };
  }

  const obj = data as Record<string, unknown>;
  if (obj.balance !== undefined && typeof obj.balance !== "number") {
    errors.push("'balance' must be a number if provided");
  }
  if (obj.costBasis !== undefined && typeof obj.costBasis !== "number") {
    errors.push("'costBasis' must be a number if provided");
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validation.ts
git commit -m "add payload validation library"
```

---

### Task 10: Session tools (pl_status, pl_open)

**Files:**
- Create: `src/tools/session.ts`

- [ ] **Step 1: Create `src/tools/session.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config, readApiKey } from "../config.js";
import {
  evaluate,
  navigate,
  sequence,
  wait,
} from "../lib/actions.js";
import { checkPluginApiScript, validateApiKeyScript } from "../lib/plugin-api.js";

export function registerSessionTools(server: McpServer): void {
  server.registerTool(
    "pl_status",
    {
      title: "ProjectionLab Status",
      description:
        "Check if ProjectionLab is open in the browser, the user is signed in, and the Plugin API is available. Returns an action sequence that evaluates the Plugin API presence.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const result = sequence("pl_status", [
        evaluate(
          checkPluginApiScript(),
          "Check if ProjectionLab Plugin API is available in the current tab",
          "true — the Plugin API object exists on window",
        ),
      ]);

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "pl_open",
    {
      title: "Open ProjectionLab",
      description:
        "Navigate to ProjectionLab and validate the session by checking the Plugin API and API key. Returns an action sequence to navigate, wait for load, and validate.",
      inputSchema: z.object({}),
    },
    async () => {
      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }

      const result = sequence("pl_open", [
        navigate(config.baseUrl, "Navigate to ProjectionLab"),
        wait(
          "[data-projectionlab]",
          "Wait for ProjectionLab app to load",
          10_000,
        ),
        evaluate(
          checkPluginApiScript(),
          "Check if Plugin API is available",
          "true",
        ),
        evaluate(
          validateApiKeyScript(key),
          "Validate the API key",
          "API key is valid",
        ),
      ]);

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/session.ts
git commit -m "add session tools (pl_status, pl_open)"
```

---

### Task 11: Read tools (pl_export, pl_get_accounts, pl_get_plans, pl_get_milestones, pl_get_income_expenses)

**Files:**
- Create: `src/tools/read.ts`

- [ ] **Step 1: Create `src/tools/read.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readApiKey } from "../config.js";
import { evaluate, sequence } from "../lib/actions.js";
import {
  createOperation,
  getOperation,
  advanceOperation,
  completeOperation,
} from "../lib/state.js";
import { exportDataScript } from "../lib/plugin-api.js";
import type {
  CompleteAccountDataExport,
  Account,
  Plan,
  Milestone,
  IncomeEvent,
  ExpenseEvent,
} from "../types/projectionlab.js";

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export function registerReadTools(server: McpServer): void {
  // pl_export — full data export
  server.registerTool(
    "pl_export",
    {
      title: "Export ProjectionLab Data",
      description:
        "Full data export from ProjectionLab. Multi-turn: first call returns an action to run exportData. Second call with requestId and result returns the parsed data.",
      inputSchema: z.object({
        requestId: z.string().optional().describe("Request ID from a previous call to continue the operation"),
        result: z.unknown().optional().describe("Result from executing the previous action step"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ requestId, result }) => {
      // Step 1: initiate export
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_export");
        const actions = sequence(
          "pl_export",
          [
            evaluate(
              exportDataScript(key),
              "Export all data from ProjectionLab",
              "Returns a CompleteAccountDataExport JSON object",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      // Step 2: return the exported data
      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      completeOperation(requestId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { tool: "pl_export", data: result, done: true },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // pl_get_accounts — list accounts with balances
  server.registerTool(
    "pl_get_accounts",
    {
      title: "Get ProjectionLab Accounts",
      description:
        "List all accounts with balances. Multi-turn: first call triggers exportData, second call extracts and returns accounts.",
      inputSchema: z.object({
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_get_accounts");
        const actions = sequence(
          "pl_get_accounts",
          [
            evaluate(
              exportDataScript(key),
              "Export data to extract accounts",
              "Returns a CompleteAccountDataExport JSON object",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      completeOperation(requestId);

      const exportData = result as CompleteAccountDataExport | undefined;
      const accounts = exportData?.startingConditions?.accounts ?? [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { tool: "pl_get_accounts", accounts, done: true },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // pl_get_plans — list plans
  server.registerTool(
    "pl_get_plans",
    {
      title: "Get ProjectionLab Plans",
      description:
        "List all plans with their structure. Multi-turn: first call triggers exportData, second call extracts and returns plans.",
      inputSchema: z.object({
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_get_plans");
        const actions = sequence(
          "pl_get_plans",
          [
            evaluate(
              exportDataScript(key),
              "Export data to extract plans",
              "Returns a CompleteAccountDataExport JSON object",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      completeOperation(requestId);

      const exportData = result as CompleteAccountDataExport | undefined;
      const plans = exportData?.plans ?? [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { tool: "pl_get_plans", plans, done: true },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // pl_get_milestones — plan milestones
  server.registerTool(
    "pl_get_milestones",
    {
      title: "Get Plan Milestones",
      description:
        "Get milestones from all plans. Multi-turn: first call triggers exportData, second call extracts milestones.",
      inputSchema: z.object({
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_get_milestones");
        const actions = sequence(
          "pl_get_milestones",
          [
            evaluate(
              exportDataScript(key),
              "Export data to extract milestones",
              "Returns a CompleteAccountDataExport JSON object",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      completeOperation(requestId);

      const exportData = result as CompleteAccountDataExport | undefined;
      const plans = exportData?.plans ?? [];
      const milestones = plans.flatMap((p) =>
        (p.milestones ?? []).map((m) => ({ ...m, planId: p.id, planName: p.name })),
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { tool: "pl_get_milestones", milestones, done: true },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // pl_get_income_expenses — income and expense events
  server.registerTool(
    "pl_get_income_expenses",
    {
      title: "Get Income & Expenses",
      description:
        "Get income and expense events from all plans. Multi-turn: first call triggers exportData, second call extracts events.",
      inputSchema: z.object({
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_get_income_expenses");
        const actions = sequence(
          "pl_get_income_expenses",
          [
            evaluate(
              exportDataScript(key),
              "Export data to extract income and expense events",
              "Returns a CompleteAccountDataExport JSON object",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      completeOperation(requestId);

      const exportData = result as CompleteAccountDataExport | undefined;
      const plans = exportData?.plans ?? [];
      const income = plans.flatMap((p) =>
        (p.incomeEvents ?? []).map((e) => ({ ...e, planId: p.id, planName: p.name })),
      );
      const expenses = plans.flatMap((p) =>
        (p.expenseEvents ?? []).map((e) => ({ ...e, planId: p.id, planName: p.name })),
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { tool: "pl_get_income_expenses", income, expenses, done: true },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/read.ts
git commit -m "add read tools (pl_export, pl_get_accounts, pl_get_plans, pl_get_milestones, pl_get_income_expenses)"
```

---

### Task 12: Write tools (pl_update_account, pl_update_accounts, pl_create_plan, pl_update_plan)

**Files:**
- Create: `src/tools/write.ts`

- [ ] **Step 1: Create `src/tools/write.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readApiKey } from "../config.js";
import { evaluate, sequence } from "../lib/actions.js";
import {
  createOperation,
  getOperation,
  advanceOperation,
  completeOperation,
} from "../lib/state.js";
import { saveSnapshot } from "../lib/snapshots.js";
import {
  exportDataScript,
  updateAccountScript,
  restorePlansScript,
} from "../lib/plugin-api.js";
import {
  validateAccountUpdate,
  validatePlan,
} from "../lib/validation.js";
import type { CompleteAccountDataExport, Plan } from "../types/projectionlab.js";
import { randomUUID } from "node:crypto";

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export function registerWriteTools(server: McpServer): void {
  // pl_update_account — update balance/costBasis on one account
  server.registerTool(
    "pl_update_account",
    {
      title: "Update Account",
      description:
        "Update balance and/or costBasis on a single account. Multi-turn: step 1 exports data for snapshot, step 2 applies the update via updateAccount API.",
      inputSchema: z.object({
        accountId: z.string().describe("The account ID to update"),
        balance: z.number().optional().describe("New balance value"),
        costBasis: z.number().optional().describe("New cost basis value"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async ({ accountId, balance, costBasis, requestId, result }) => {
      const updateData: Record<string, unknown> = {};
      if (balance !== undefined) updateData.balance = balance;
      if (costBasis !== undefined) updateData.costBasis = costBasis;

      const validation = validateAccountUpdate(updateData);
      if (!validation.valid) {
        return errorResult(`Validation failed: ${validation.errors.join(", ")}`);
      }

      if (Object.keys(updateData).length === 0) {
        return errorResult("No update fields provided. Specify balance and/or costBasis.");
      }

      // Step 1: export for snapshot
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_update_account", {
          accountId,
          updateData,
        });

        const actions = sequence(
          "pl_update_account",
          [
            evaluate(
              exportDataScript(key),
              "Export current data for pre-write snapshot",
              "Returns current state for backup",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      // Step 2: save snapshot, return the actual update action
      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      // Save pre-write snapshot
      const snapshotPath = await saveSnapshot(result, "pre-update-account");

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      completeOperation(requestId);

      const actions = sequence(
        "pl_update_account",
        [
          evaluate(
            updateAccountScript(key, op.data.accountId as string, op.data.updateData as Record<string, unknown>),
            `Update account ${op.data.accountId}: ${JSON.stringify(op.data.updateData)}`,
            "Account updated successfully",
          ),
        ],
        {
          done: true,
          verify: evaluate(
            exportDataScript(key),
            "Verify the account was updated by re-exporting",
            "Updated values should be reflected",
          ),
        },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ...actions, snapshotPath },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // pl_update_accounts — batch update multiple accounts
  server.registerTool(
    "pl_update_accounts",
    {
      title: "Batch Update Accounts",
      description:
        "Update balance/costBasis on multiple accounts in one call. Multi-turn: step 1 exports for snapshot, step 2 applies all updates.",
      inputSchema: z.object({
        updates: z
          .array(
            z.object({
              accountId: z.string(),
              balance: z.number().optional(),
              costBasis: z.number().optional(),
            }),
          )
          .describe("Array of account updates"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async ({ updates, requestId, result }) => {
      // Validate all updates
      for (const u of updates) {
        const data: Record<string, unknown> = {};
        if (u.balance !== undefined) data.balance = u.balance;
        if (u.costBasis !== undefined) data.costBasis = u.costBasis;
        const validation = validateAccountUpdate(data);
        if (!validation.valid) {
          return errorResult(
            `Validation failed for account ${u.accountId}: ${validation.errors.join(", ")}`,
          );
        }
      }

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_update_accounts", { updates });

        const actions = sequence(
          "pl_update_accounts",
          [
            evaluate(
              exportDataScript(key),
              "Export current data for pre-write snapshot",
              "Returns current state for backup",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      const snapshotPath = await saveSnapshot(result, "pre-update-accounts");

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      completeOperation(requestId);

      const storedUpdates = op.data.updates as Array<{
        accountId: string;
        balance?: number;
        costBasis?: number;
      }>;

      const steps = storedUpdates.map((u) => {
        const data: Record<string, unknown> = {};
        if (u.balance !== undefined) data.balance = u.balance;
        if (u.costBasis !== undefined) data.costBasis = u.costBasis;
        return evaluate(
          updateAccountScript(key, u.accountId, data),
          `Update account ${u.accountId}: ${JSON.stringify(data)}`,
          "Account updated",
        );
      });

      const actions = sequence("pl_update_accounts", steps, {
        done: true,
        verify: evaluate(
          exportDataScript(key),
          "Verify all accounts were updated",
          "Updated values should be reflected",
        ),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ...actions, snapshotPath }, null, 2),
          },
        ],
      };
    },
  );

  // pl_create_plan — create a new plan
  server.registerTool(
    "pl_create_plan",
    {
      title: "Create Plan",
      description:
        "Create a new plan. Multi-turn: step 1 exports current plans, step 2 appends the new plan via restorePlans.",
      inputSchema: z.object({
        name: z.string().describe("Name for the new plan"),
        planData: z
          .record(z.unknown())
          .optional()
          .describe("Additional plan properties"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async ({ name, planData, requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_create_plan", { name, planData });

        const actions = sequence(
          "pl_create_plan",
          [
            evaluate(
              exportDataScript(key),
              "Export current data to get existing plans",
              "Returns current plans for append operation",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      const snapshotPath = await saveSnapshot(result, "pre-create-plan");

      const exportData = result as CompleteAccountDataExport | undefined;
      const existingPlans = exportData?.plans ?? [];

      const newPlan: Plan = {
        id: randomUUID(),
        name: op.data.name as string,
        ...(op.data.planData as Record<string, unknown> | undefined),
      };

      const validation = validatePlan(newPlan);
      if (!validation.valid) {
        completeOperation(requestId);
        return errorResult(`Plan validation failed: ${validation.errors.join(", ")}`);
      }

      const allPlans = [...existingPlans, newPlan];

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        completeOperation(requestId);
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      completeOperation(requestId);

      const actions = sequence(
        "pl_create_plan",
        [
          evaluate(
            restorePlansScript(key, allPlans),
            `Restore plans with new plan "${newPlan.name}" appended (${allPlans.length} total)`,
            "Plans restored successfully",
          ),
        ],
        {
          done: true,
          verify: evaluate(
            exportDataScript(key),
            "Verify the new plan exists",
            `Plan "${newPlan.name}" should appear in the plans list`,
          ),
        },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ...actions, newPlanId: newPlan.id, snapshotPath },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // pl_update_plan — modify an existing plan
  server.registerTool(
    "pl_update_plan",
    {
      title: "Update Plan",
      description:
        "Modify an existing plan's properties. Multi-turn: step 1 exports current plans, step 2 applies modifications via restorePlans.",
      inputSchema: z.object({
        planId: z.string().describe("The plan ID to update"),
        updates: z.record(z.unknown()).describe("Properties to update on the plan"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async ({ planId, updates, requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_update_plan", { planId, updates });

        const actions = sequence(
          "pl_update_plan",
          [
            evaluate(
              exportDataScript(key),
              "Export current plans for modification",
              "Returns current plans",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      const snapshotPath = await saveSnapshot(result, "pre-update-plan");

      const exportData = result as CompleteAccountDataExport | undefined;
      const existingPlans = exportData?.plans ?? [];
      const targetPlanId = op.data.planId as string;

      const planIndex = existingPlans.findIndex((p) => p.id === targetPlanId);
      if (planIndex === -1) {
        completeOperation(requestId);
        return errorResult(
          `Plan "${targetPlanId}" not found. Available plans: ${existingPlans.map((p) => `${p.name} (${p.id})`).join(", ")}`,
        );
      }

      const updatedPlan = {
        ...existingPlans[planIndex],
        ...(op.data.updates as Record<string, unknown>),
      };

      const validation = validatePlan(updatedPlan);
      if (!validation.valid) {
        completeOperation(requestId);
        return errorResult(`Plan validation failed: ${validation.errors.join(", ")}`);
      }

      const allPlans = [...existingPlans];
      allPlans[planIndex] = updatedPlan;

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        completeOperation(requestId);
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      completeOperation(requestId);

      const actions = sequence(
        "pl_update_plan",
        [
          evaluate(
            restorePlansScript(key, allPlans),
            `Restore plans with updated plan "${updatedPlan.name}"`,
            "Plans restored successfully",
          ),
        ],
        {
          done: true,
          verify: evaluate(
            exportDataScript(key),
            "Verify plan was updated",
            `Plan "${updatedPlan.name}" should reflect the changes`,
          ),
        },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ...actions, snapshotPath }, null, 2),
          },
        ],
      };
    },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/write.ts
git commit -m "add write tools (pl_update_account, pl_update_accounts, pl_create_plan, pl_update_plan)"
```

---

### Task 13: Snapshot tools (pl_snapshot, pl_list_snapshots, pl_restore)

**Files:**
- Create: `src/tools/snapshots.ts`

- [ ] **Step 1: Create `src/tools/snapshots.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readApiKey } from "../config.js";
import { evaluate, sequence } from "../lib/actions.js";
import {
  saveSnapshot,
  listSnapshots,
  loadSnapshot,
} from "../lib/snapshots.js";
import {
  createOperation,
  getOperation,
  completeOperation,
} from "../lib/state.js";
import {
  exportDataScript,
  restorePlansScript,
  restoreCurrentFinancesScript,
} from "../lib/plugin-api.js";
import type { CompleteAccountDataExport } from "../types/projectionlab.js";

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export function registerSnapshotTools(server: McpServer): void {
  // pl_snapshot — export and save to local file
  server.registerTool(
    "pl_snapshot",
    {
      title: "Take Snapshot",
      description:
        "Export full ProjectionLab state and save to a local JSON file. Multi-turn: step 1 exports data, step 2 saves it.",
      inputSchema: z.object({
        label: z.string().optional().describe("Optional label for the snapshot file"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async ({ label, requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_snapshot", { label });

        const actions = sequence(
          "pl_snapshot",
          [
            evaluate(
              exportDataScript(key),
              "Export all data for snapshot",
              "Returns full data export",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      const snapshotLabel = op.data.label as string | undefined;
      const filepath = await saveSnapshot(result, snapshotLabel);

      completeOperation(requestId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { tool: "pl_snapshot", path: filepath, done: true },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // pl_list_snapshots — list available snapshots
  server.registerTool(
    "pl_list_snapshots",
    {
      title: "List Snapshots",
      description: "List all available local snapshots with metadata.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const snapshots = await listSnapshots();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { tool: "pl_list_snapshots", snapshots, count: snapshots.length },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // pl_restore — restore from a snapshot
  server.registerTool(
    "pl_restore",
    {
      title: "Restore from Snapshot",
      description:
        "Restore ProjectionLab state from a local snapshot. Multi-turn: step 1 exports current state for backup, step 2 applies the snapshot via restore APIs.",
      inputSchema: z.object({
        snapshotPath: z.string().describe("Path to the snapshot file to restore"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async ({ snapshotPath, requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        // Load the snapshot to validate it before doing anything
        let snapshotData: unknown;
        try {
          snapshotData = await loadSnapshot(snapshotPath);
        } catch (err) {
          return errorResult(
            `Cannot load snapshot: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        const opId = createOperation("pl_restore", {
          snapshotPath,
          snapshotData,
        });

        const actions = sequence(
          "pl_restore",
          [
            evaluate(
              exportDataScript(key),
              "Export current state as backup before restore",
              "Returns current state for pre-restore backup",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      // Save pre-restore backup
      const backupPath = await saveSnapshot(result, "pre-restore-backup");

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        completeOperation(requestId);
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      const snapshotData = op.data.snapshotData as CompleteAccountDataExport;

      completeOperation(requestId);

      const steps = [];

      if (snapshotData.plans) {
        steps.push(
          evaluate(
            restorePlansScript(key, snapshotData.plans),
            "Restore plans from snapshot",
            "Plans restored",
          ),
        );
      }

      if (snapshotData.startingConditions) {
        steps.push(
          evaluate(
            restoreCurrentFinancesScript(key, snapshotData.startingConditions),
            "Restore current finances from snapshot",
            "Current finances restored",
          ),
        );
      }

      if (steps.length === 0) {
        return errorResult("Snapshot contains no restorable data (no plans or startingConditions)");
      }

      const actions = sequence("pl_restore", steps, {
        done: true,
        verify: evaluate(
          exportDataScript(key),
          "Verify restore completed",
          "Data should match the snapshot",
        ),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ...actions, backupPath },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/snapshots.ts
git commit -m "add snapshot tools (pl_snapshot, pl_list_snapshots, pl_restore)"
```

---

### Task 14: Bootstrap tool (pl_bootstrap)

**Files:**
- Create: `src/tools/bootstrap.ts`

- [ ] **Step 1: Create `src/tools/bootstrap.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { readApiKey } from "../config.js";
import { evaluate, sequence } from "../lib/actions.js";
import { saveSnapshot } from "../lib/snapshots.js";
import {
  createOperation,
  getOperation,
  completeOperation,
} from "../lib/state.js";
import { exportDataScript } from "../lib/plugin-api.js";

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

function describeShape(value: unknown, depth = 0, maxDepth = 3): string {
  if (depth >= maxDepth) return typeof value;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `Array<${describeShape(value[0], depth + 1, maxDepth)}> (${value.length} items)`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const fields = entries
      .map(([k, v]) => `  ${"  ".repeat(depth)}${k}: ${describeShape(v, depth + 1, maxDepth)}`)
      .join("\n");
    return `{\n${fields}\n${"  ".repeat(depth)}}`;
  }
  return typeof value;
}

export function registerBootstrapTools(server: McpServer): void {
  server.registerTool(
    "pl_bootstrap",
    {
      title: "Bootstrap Schema",
      description:
        "Export full data, save raw JSON, and log schema shapes for type derivation. Multi-turn: step 1 exports data, step 2 saves and analyzes.",
      inputSchema: z.object({
        outputPath: z
          .string()
          .optional()
          .describe("Path to save the raw export JSON. Defaults to snapshots dir."),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async ({ outputPath, requestId, result }) => {
      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_bootstrap", { outputPath });

        const actions = sequence(
          "pl_bootstrap",
          [
            evaluate(
              exportDataScript(key),
              "Export all data for schema analysis",
              "Returns the full CompleteAccountDataExport",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown request: ${requestId}`);

      // Save raw export
      const snapshotPath = await saveSnapshot(result, "bootstrap");

      // Also save to custom output path if specified
      const customPath = op.data.outputPath as string | undefined;
      if (customPath) {
        await mkdir(dirname(customPath), { recursive: true });
        await writeFile(customPath, JSON.stringify(result, null, 2), "utf-8");
      }

      // Analyze schema shape
      const shape = describeShape(result);

      // Analyze top-level keys
      const topLevelKeys =
        result && typeof result === "object"
          ? Object.keys(result as Record<string, unknown>)
          : [];

      completeOperation(requestId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                tool: "pl_bootstrap",
                snapshotPath,
                customOutputPath: customPath ?? null,
                topLevelKeys,
                schema: shape,
                done: true,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/bootstrap.ts
git commit -m "add bootstrap tool (pl_bootstrap)"
```

---

### Task 15: MCP server entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSessionTools } from "./tools/session.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";
import { registerSnapshotTools } from "./tools/snapshots.js";
import { registerBootstrapTools } from "./tools/bootstrap.js";

const server = new McpServer(
  {
    name: "finance",
    version: "0.1.0",
  },
  {
    instructions: [
      "This MCP server orchestrates ProjectionLab browser actions.",
      "It does NOT control the browser directly — it returns action sequences",
      "that you execute via a separate Playwright MCP server.",
      "",
      "Workflow for most tools:",
      "1. Call the tool (returns an action sequence with a requestId)",
      "2. Execute each step via the Playwright MCP",
      "3. Call the tool again with the requestId and the result",
      "4. Repeat until the response includes done: true",
      "",
      "Before using any tools, ensure ProjectionLab is open by calling pl_status",
      "or pl_open. The Plugin API must be available in the browser.",
      "",
      "All write operations automatically create snapshots before modifying data.",
      "Use pl_list_snapshots and pl_restore to manage backups.",
    ].join("\n"),
  },
);

registerSessionTools(server);
registerReadTools(server);
registerWriteTools(server);
registerSnapshotTools(server);
registerBootstrapTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("finance MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Build the project**

Run: `npm run build`
Expected: `dist/` directory created with compiled JS files.

- [ ] **Step 4: Verify the binary runs**

Run: `echo '{}' | timeout 2 node dist/index.js 2>&1 || true`
Expected: "finance MCP server running on stdio" on stderr.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "add mcp server entry point"
```

---

### Task 16: Final build verification and gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
*.tgz
```

- [ ] **Step 2: Full build and verify**

Run: `npm run build`
Expected: Clean build, `dist/` directory contains all compiled files.

- [ ] **Step 3: Verify all tool registrations**

Run: `node -e "import('./dist/index.js')" 2>&1 | head -1`
Expected: Server starts without import errors.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "add gitignore and verify build"
```
