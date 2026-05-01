import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readApiKey } from "../config.js";
import { evaluate, sequence } from "../lib/actions.js";
import { exportDataScript } from "../lib/plugin-api.js";
import {
  completeOperation,
  createOperation,
  getOperation,
} from "../lib/state.js";
import type { CompleteAccountDataExport, Plan } from "../types/projectionlab.js";

const inputSchema = z.object({
  requestId: z.string().optional(),
  result: z.unknown().optional(),
});

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

function exportStep(key: string): ReturnType<typeof evaluate> {
  return evaluate(
    exportDataScript(key),
    "Export all ProjectionLab data via Plugin API",
    "Object with plans, startingConditions, progress, settings",
  );
}

export function registerReadTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // pl_export
  // ---------------------------------------------------------------------------
  server.registerTool(
    "pl_export",
    {
      title: "Export ProjectionLab Data",
      description:
        "Export the complete ProjectionLab dataset (plans, accounts, milestones, income & expense events, settings). Multi-turn: first call returns an action sequence; second call (with requestId + result) returns the data.",
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const { requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
        const opId = createOperation("pl_export");
        const seq = sequence("pl_export", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);
      completeOperation(requestId);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result ?? null, null, 2) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // pl_get_accounts
  // ---------------------------------------------------------------------------
  server.registerTool(
    "pl_get_accounts",
    {
      title: "Get Accounts",
      description:
        "Return the list of accounts from ProjectionLab's starting conditions. Multi-turn: first call returns an action sequence; second call (with requestId + result) extracts and returns the accounts array.",
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const { requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
        const opId = createOperation("pl_get_accounts");
        const seq = sequence("pl_get_accounts", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);
      completeOperation(requestId);

      const data = result as CompleteAccountDataExport | null;
      const accounts = [
        ...(data?.today?.savingsAccounts ?? []),
        ...(data?.today?.investmentAccounts ?? []),
      ];
      return {
        content: [{ type: "text" as const, text: JSON.stringify(accounts, null, 2) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // pl_get_plans
  // ---------------------------------------------------------------------------
  server.registerTool(
    "pl_get_plans",
    {
      title: "Get Plans",
      description:
        "Return the list of plans from ProjectionLab. Multi-turn: first call returns an action sequence; second call (with requestId + result) extracts and returns the plans array.",
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const { requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
        const opId = createOperation("pl_get_plans");
        const seq = sequence("pl_get_plans", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);
      completeOperation(requestId);

      const data = result as CompleteAccountDataExport | null;
      const plans = data?.plans ?? [];
      return {
        content: [{ type: "text" as const, text: JSON.stringify(plans, null, 2) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // pl_get_milestones
  // ---------------------------------------------------------------------------
  server.registerTool(
    "pl_get_milestones",
    {
      title: "Get Milestones",
      description:
        "Return all milestones across all plans. Each milestone entry is annotated with planId and planName. Multi-turn: first call returns an action sequence; second call (with requestId + result) extracts and returns the milestones.",
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const { requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
        const opId = createOperation("pl_get_milestones");
        const seq = sequence("pl_get_milestones", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);
      completeOperation(requestId);

      const data = result as CompleteAccountDataExport | null;
      const plans: Plan[] = data?.plans ?? [];
      const milestones = plans.flatMap((plan) =>
        (plan.milestones ?? []).map((m) => ({
          ...m,
          planId: plan.id,
          planName: plan.name,
        })),
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(milestones, null, 2) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // pl_get_income_expenses
  // ---------------------------------------------------------------------------
  server.registerTool(
    "pl_get_income_expenses",
    {
      title: "Get Income & Expenses",
      description:
        "Return all income and expense events across all plans. Each entry is annotated with planId, planName, and eventType ('income' or 'expense'). Multi-turn: first call returns an action sequence; second call (with requestId + result) extracts and returns the events.",
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const { requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
        const opId = createOperation("pl_get_income_expenses");
        const seq = sequence("pl_get_income_expenses", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);
      completeOperation(requestId);

      const data = result as CompleteAccountDataExport | null;
      const plans: Plan[] = data?.plans ?? [];

      const incomeEvents = plans.flatMap((plan) =>
        (plan.income?.events ?? []).map((e) => ({
          ...e,
          planId: plan.id,
          planName: plan.name,
          eventType: "income" as const,
        })),
      );
      const expenseEvents = plans.flatMap((plan) =>
        (plan.expenses?.events ?? []).map((e) => ({
          ...e,
          planId: plan.id,
          planName: plan.name,
          eventType: "expense" as const,
        })),
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify([...incomeEvents, ...expenseEvents], null, 2),
          },
        ],
      };
    },
  );
}
