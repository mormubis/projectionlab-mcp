import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readApiKey } from "../config.js";
import { evaluate, sequence } from "../lib/actions.js";
import {
  exportDataScript,
  restoreCurrentFinancesScript,
  restorePlansScript,
} from "../lib/plugin-api.js";
import {
  listSnapshots,
  loadSnapshot,
  saveSnapshot,
} from "../lib/snapshots.js";
import {
  completeOperation,
  createOperation,
  getOperation,
} from "../lib/state.js";
import type { CompleteAccountDataExport } from "../types/projectionlab.js";

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

export function registerSnapshotTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // pl_snapshot
  // -------------------------------------------------------------------------
  server.registerTool(
    "pl_snapshot",
    {
      title: "Save Snapshot",
      description:
        "Export the current ProjectionLab data and save it as a local snapshot file. Multi-turn: step 1 exports data; step 2 saves the snapshot and returns the file path.",
      inputSchema: z.object({
        label: z.string().optional().describe("Optional label appended to the snapshot filename"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async (args) => {
      const { label, requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
        const opId = createOperation("pl_snapshot", { label });
        const seq = sequence("pl_snapshot", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);
      completeOperation(requestId);

      const { label: snapshotLabel } = op.data as { label?: string };
      const snapshotPath = await saveSnapshot(result, snapshotLabel);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ snapshotPath, done: true }, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // pl_list_snapshots
  // -------------------------------------------------------------------------
  server.registerTool(
    "pl_list_snapshots",
    {
      title: "List Snapshots",
      description:
        "List all saved local snapshots, sorted newest first. Returns filename, path, creation time, and size.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const snapshots = await listSnapshots();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(snapshots, null, 2) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // pl_restore
  // -------------------------------------------------------------------------
  server.registerTool(
    "pl_restore",
    {
      title: "Restore Snapshot",
      description:
        "Restore ProjectionLab data from a local snapshot file. A backup of the current state is saved before restoring. Multi-turn: step 1 loads the snapshot and exports current data for backup; step 2 saves the backup and emits restore actions.",
      inputSchema: z.object({
        snapshotPath: z.string().describe("Absolute path to the snapshot file to restore"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async (args) => {
      const { snapshotPath, requestId, result } = args;

      if (!requestId) {
        // Load and validate the target snapshot first
        let snapshotData: unknown;
        try {
          snapshotData = await loadSnapshot(snapshotPath);
        } catch (err) {
          return errorResult(
            `Cannot load snapshot from ${snapshotPath}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_restore", {
          snapshotPath,
          snapshotData,
        });

        // Export current data so step 2 can back it up before restoring
        const seq = sequence("pl_restore", [exportStep(key)], { requestId: opId });
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      // Step 2 — backup current data, restore from snapshot
      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);

      // Save current state as backup before overwriting
      const backupPath = await saveSnapshot(result, "pre-restore-backup");

      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        completeOperation(requestId);
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      const { snapshotPath: storedPath, snapshotData } = op.data as {
        snapshotPath: string;
        snapshotData: CompleteAccountDataExport;
      };

      completeOperation(requestId);

      const restoreSteps = [];

      if (snapshotData.plans !== undefined) {
        restoreSteps.push(
          evaluate(
            restorePlansScript(key, snapshotData.plans),
            "Restore plans from snapshot",
            "Plans restored successfully",
          ),
        );
      }

      if (snapshotData.startingConditions !== undefined) {
        restoreSteps.push(
          evaluate(
            restoreCurrentFinancesScript(key, snapshotData.startingConditions),
            "Restore starting conditions (accounts) from snapshot",
            "Starting conditions restored successfully",
          ),
        );
      }

      if (restoreSteps.length === 0) {
        return errorResult("Snapshot contains no restorable data (no plans or startingConditions)");
      }

      const verifyStep = evaluate(
        exportDataScript(key),
        "Verify restore was applied",
        "Exported data matches restored snapshot",
      );

      const seq = sequence("pl_restore", restoreSteps, {
        verify: verifyStep,
        done: true,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { backupPath, restoredFrom: storedPath, ...seq },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
