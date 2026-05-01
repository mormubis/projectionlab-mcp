import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readApiKey } from "../config.js";
import { evaluate, sequence } from "../lib/actions.js";
import {
  exportDataScript,
  restorePlansScript,
  updateAccountScript,
} from "../lib/plugin-api.js";
import { saveSnapshot } from "../lib/snapshots.js";
import {
  completeOperation,
  createOperation,
  getOperation,
} from "../lib/state.js";
import { validateAccountUpdate, validatePlan } from "../lib/validation.js";
import type { CompleteAccountDataExport, Plan } from "../types/projectionlab.js";

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

function exportStep(key: string): ReturnType<typeof evaluate> {
  return evaluate(
    exportDataScript(key),
    "Export current ProjectionLab data (pre-write backup)",
    "Object with plans, startingConditions, progress, settings",
  );
}

// ---------------------------------------------------------------------------
// pl_update_account
// ---------------------------------------------------------------------------
const updateAccountSchema = z.object({
  accountId: z.string().describe("The unique account ID to update"),
  balance: z.number().optional().describe("New balance value"),
  costBasis: z.number().optional().describe("New cost basis value"),
  requestId: z.string().optional(),
  result: z.unknown().optional(),
});

// ---------------------------------------------------------------------------
// pl_update_accounts
// ---------------------------------------------------------------------------
const updateAccountsSchema = z.object({
  updates: z
    .array(
      z.object({
        accountId: z.string(),
        balance: z.number().optional(),
        costBasis: z.number().optional(),
      }),
    )
    .describe("List of account updates to apply"),
  requestId: z.string().optional(),
  result: z.unknown().optional(),
});

// ---------------------------------------------------------------------------
// pl_create_plan
// ---------------------------------------------------------------------------
const createPlanSchema = z.object({
  name: z.string().describe("Name for the new plan"),
  planData: z.record(z.unknown()).optional().describe("Additional plan properties"),
  requestId: z.string().optional(),
  result: z.unknown().optional(),
});

// ---------------------------------------------------------------------------
// pl_update_plan
// ---------------------------------------------------------------------------
const updatePlanSchema = z.object({
  planId: z.string().describe("The unique plan ID to update"),
  updates: z.record(z.unknown()).describe("Properties to update on the plan"),
  requestId: z.string().optional(),
  result: z.unknown().optional(),
});

export function registerWriteTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // pl_update_account
  // -------------------------------------------------------------------------
  server.registerTool(
    "pl_update_account",
    {
      title: "Update Account",
      description:
        "Update an account's balance and/or cost basis. Multi-turn: step 1 exports data for backup; step 2 applies the update.",
      inputSchema: updateAccountSchema,
    },
    async (args) => {
      const { accountId, balance, costBasis, requestId, result } = args;

      if (!requestId) {
        // Step 1 — validate inputs, create operation, return export action
        const updateData: Record<string, unknown> = {};
        if (balance !== undefined) updateData.balance = balance;
        if (costBasis !== undefined) updateData.costBasis = costBasis;

        const validation = validateAccountUpdate(updateData);
        if (!validation.valid) {
          return errorResult(`Invalid update data: ${validation.errors.join("; ")}`);
        }

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
        const seq = sequence("pl_update_account", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      // Step 2 — save snapshot, apply update
      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);

      const snapshotPath = await saveSnapshot(result, "pre-update-account");

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        completeOperation(requestId);
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      const { accountId: storedAccountId, updateData } = op.data as {
        accountId: string;
        updateData: Record<string, unknown>;
      };

      completeOperation(requestId);

      const verifyStep = evaluate(
        exportDataScript(key),
        "Verify account update was applied",
        "Updated account appears in exported data",
      );

      const seq = sequence(
        "pl_update_account",
        [
          evaluate(
            updateAccountScript(key, storedAccountId, updateData),
            `Update account ${storedAccountId}`,
            "Account updated successfully",
          ),
        ],
        { verify: verifyStep, done: true },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ snapshotPath, ...seq }, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // pl_update_accounts
  // -------------------------------------------------------------------------
  server.registerTool(
    "pl_update_accounts",
    {
      title: "Update Accounts (Batch)",
      description:
        "Update multiple accounts' balances and/or cost bases in a single operation. Multi-turn: step 1 validates all updates and exports data for backup; step 2 applies all updates.",
      inputSchema: updateAccountsSchema,
    },
    async (args) => {
      const { updates, requestId, result } = args;

      if (!requestId) {
        // Step 1 — validate all updates, create operation, return export action
        for (let i = 0; i < updates.length; i++) {
          const { balance, costBasis } = updates[i];
          const data: Record<string, unknown> = {};
          if (balance !== undefined) data.balance = balance;
          if (costBasis !== undefined) data.costBasis = costBasis;
          const validation = validateAccountUpdate(data);
          if (!validation.valid) {
            return errorResult(
              `updates[${i}] invalid: ${validation.errors.join("; ")}`,
            );
          }
        }

        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_update_accounts", { updates });
        const seq = sequence("pl_update_accounts", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      // Step 2 — save snapshot, apply all updates
      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);

      const snapshotPath = await saveSnapshot(result, "pre-update-accounts");

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        completeOperation(requestId);
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      const { updates: storedUpdates } = op.data as {
        updates: Array<{ accountId: string; balance?: number; costBasis?: number }>;
      };

      completeOperation(requestId);

      const updateSteps = storedUpdates.map(({ accountId, balance, costBasis }) => {
        const data: Record<string, unknown> = {};
        if (balance !== undefined) data.balance = balance;
        if (costBasis !== undefined) data.costBasis = costBasis;
        return evaluate(
          updateAccountScript(key, accountId, data),
          `Update account ${accountId}`,
          "Account updated successfully",
        );
      });

      const verifyStep = evaluate(
        exportDataScript(key),
        "Verify all account updates were applied",
        "All updated accounts appear in exported data",
      );

      const seq = sequence("pl_update_accounts", updateSteps, {
        verify: verifyStep,
        done: true,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ snapshotPath, ...seq }, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // pl_create_plan
  // -------------------------------------------------------------------------
  server.registerTool(
    "pl_create_plan",
    {
      title: "Create Plan",
      description:
        "Create a new plan in ProjectionLab. Multi-turn: step 1 exports current data for backup; step 2 appends the new plan and restores the full plans list.",
      inputSchema: createPlanSchema,
    },
    async (args) => {
      const { name, planData, requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_create_plan", { name, planData });
        const seq = sequence("pl_create_plan", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      // Step 2 — save snapshot, build new plan, restore
      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);

      const snapshotPath = await saveSnapshot(result, "pre-create-plan");

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        completeOperation(requestId);
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      const { name: planName, planData: storedPlanData } = op.data as {
        name: string;
        planData?: Record<string, unknown>;
      };

      const data = result as CompleteAccountDataExport | null;
      const existingPlans: Plan[] = data?.plans ?? [];

      const newPlan: Plan = {
        id: randomUUID(),
        name: planName,
        ...storedPlanData,
      };

      const validation = validatePlan(newPlan);
      if (!validation.valid) {
        completeOperation(requestId);
        return errorResult(`Invalid plan data: ${validation.errors.join("; ")}`);
      }

      const updatedPlans = [...existingPlans, newPlan];

      completeOperation(requestId);

      const verifyStep = evaluate(
        exportDataScript(key),
        "Verify new plan was created",
        `Plans list includes new plan: ${planName}`,
      );

      const seq = sequence(
        "pl_create_plan",
        [
          evaluate(
            restorePlansScript(key, updatedPlans),
            `Create plan "${planName}" (id: ${newPlan.id})`,
            "Plans restored with new plan appended",
          ),
        ],
        { verify: verifyStep, done: true },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ snapshotPath, newPlanId: newPlan.id, ...seq }, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // pl_update_plan
  // -------------------------------------------------------------------------
  server.registerTool(
    "pl_update_plan",
    {
      title: "Update Plan",
      description:
        "Update an existing plan's properties (e.g. name). Multi-turn: step 1 exports current data for backup; step 2 applies updates and restores the plans list.",
      inputSchema: updatePlanSchema,
    },
    async (args) => {
      const { planId, updates, requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_update_plan", { planId, updates });
        const seq = sequence("pl_update_plan", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      // Step 2 — save snapshot, find & update plan, restore
      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);

      const snapshotPath = await saveSnapshot(result, "pre-update-plan");

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        completeOperation(requestId);
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      const { planId: storedPlanId, updates: storedUpdates } = op.data as {
        planId: string;
        updates: Record<string, unknown>;
      };

      const data = result as CompleteAccountDataExport | null;
      const existingPlans: Plan[] = data?.plans ?? [];

      const planIndex = existingPlans.findIndex((p) => p.id === storedPlanId);
      if (planIndex === -1) {
        completeOperation(requestId);
        return errorResult(`Plan not found: ${storedPlanId}`);
      }

      const updatedPlan: Plan = {
        ...existingPlans[planIndex],
        ...storedUpdates,
      };

      const validation = validatePlan(updatedPlan);
      if (!validation.valid) {
        completeOperation(requestId);
        return errorResult(`Invalid plan data: ${validation.errors.join("; ")}`);
      }

      const updatedPlans = [
        ...existingPlans.slice(0, planIndex),
        updatedPlan,
        ...existingPlans.slice(planIndex + 1),
      ];

      completeOperation(requestId);

      const verifyStep = evaluate(
        exportDataScript(key),
        "Verify plan update was applied",
        `Plan ${storedPlanId} appears with updated data`,
      );

      const seq = sequence(
        "pl_update_plan",
        [
          evaluate(
            restorePlansScript(key, updatedPlans),
            `Update plan ${storedPlanId}`,
            "Plans restored with updated plan",
          ),
        ],
        { verify: verifyStep, done: true },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ snapshotPath, ...seq }, null, 2),
          },
        ],
      };
    },
  );
}
