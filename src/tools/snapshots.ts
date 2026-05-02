import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  saveSnapshot,
  listSnapshots,
  loadSnapshot,
} from "../lib/snapshots.js";
import type { CompleteAccountDataExport } from "../types/projectionlab.js";

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export function registerSnapshotTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // pl_snapshot — save exported data to a local file
  // ---------------------------------------------------------------------------
  server.registerTool(
    "pl_snapshot",
    {
      title: "Save Snapshot",
      description:
        "Save ProjectionLab export data as a local snapshot file. Pass the data you got from running the pl_export script in the browser. API keys are redacted before writing.",
      inputSchema: z.object({
        data: z.unknown().describe("The export data from ProjectionLab (result of running the pl_export script)"),
        label: z.string().optional().describe("Optional label appended to the snapshot filename"),
      }),
    },
    async ({ data, label }) => {
      if (!data || typeof data !== "object") {
        return errorResult("data is required — pass the result of running the pl_export script in the browser");
      }

      const path = await saveSnapshot(data, label);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ path }, null, 2),
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // pl_list_snapshots
  // ---------------------------------------------------------------------------
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
        content: [
          { type: "text" as const, text: JSON.stringify(snapshots, null, 2) },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // pl_restore — read a snapshot and return JS scripts to restore it
  // ---------------------------------------------------------------------------
  server.registerTool(
    "pl_restore",
    {
      title: "Restore from Snapshot",
      description: [
        "Read a local snapshot file and return JavaScript strings to restore the data via the Plugin API.",
        "Execute each script in the browser using the Playwright or chrome devtools MCP.",
        "",
        "The scripts use window.__plKey which is set during pl_setup.",
        "If the page was reloaded since setup, run pl_setup again first.",
        "",
        "Important: take a snapshot of the current state BEFORE restoring (run pl_export in the browser, then call pl_snapshot with the result).",
      ].join("\n"),
      inputSchema: z.object({
        snapshotPath: z.string().describe("Absolute path to the snapshot file to restore"),
      }),
    },
    async ({ snapshotPath }) => {
      let snapshotData: CompleteAccountDataExport;
      try {
        snapshotData = (await loadSnapshot(snapshotPath)) as CompleteAccountDataExport;
      } catch (err) {
        return errorResult(
          `Cannot load snapshot from ${snapshotPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const scripts: string[] = [];

      if (snapshotData.plans !== undefined) {
        scripts.push(
          `if (!window.__plKey) throw new Error("API key not set. Run pl_setup first."); await window.projectionlabPluginAPI.restorePlans(${JSON.stringify(snapshotData.plans)}, { key: window.__plKey })`,
        );
      }

      if (snapshotData.today !== undefined) {
        scripts.push(
          `if (!window.__plKey) throw new Error("API key not set. Run pl_setup first."); await window.projectionlabPluginAPI.restoreCurrentFinances(${JSON.stringify(snapshotData.today)}, { key: window.__plKey })`,
        );
      }

      if (scripts.length === 0) {
        return errorResult("Snapshot contains no restorable data (no plans or today)");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                scripts,
                instructions: "Execute each script in the browser, in order.",
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
