import { writeFile } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readApiKey } from "../config.js";
import { evaluate, sequence } from "../lib/actions.js";
import { exportDataScript } from "../lib/plugin-api.js";
import { saveSnapshot } from "../lib/snapshots.js";
import { completeOperation, createOperation, getOperation } from "../lib/state.js";

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Recursively describes the shape of a JSON value.
 * Arrays show the element type of the first item plus the total count.
 * Objects show each field name with its value's type/shape.
 */
function describeShape(value: unknown, depth = 0, maxDepth = 3): unknown {
  if (depth > maxDepth) return typeof value;

  if (value === null) return "null";
  if (Array.isArray(value)) {
    const count = value.length;
    if (count === 0) return "array(0)";
    return {
      _type: "array",
      _count: count,
      _element: describeShape(value[0], depth + 1, maxDepth),
    };
  }
  if (typeof value === "object") {
    const shape: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      shape[k] = describeShape(v, depth + 1, maxDepth);
    }
    return shape;
  }
  return typeof value;
}

export function registerBootstrapTools(server: McpServer): void {
  server.registerTool(
    "pl_bootstrap",
    {
      title: "Bootstrap ProjectionLab",
      description:
        "Export all ProjectionLab data, save a local snapshot, optionally write to a custom path, and return a structural shape analysis of the export. Useful for initial setup and understanding the data schema. Multi-turn: step 1 exports data; step 2 saves snapshot and returns shape analysis.",
      inputSchema: z.object({
        outputPath: z
          .string()
          .optional()
          .describe(
            "Optional absolute file path to also write the exported data (e.g. for inspection)",
          ),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async (args) => {
      const { outputPath, requestId, result } = args;

      if (!requestId) {
        let key: string;
        try {
          key = await readApiKey();
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }

        const opId = createOperation("pl_bootstrap", { outputPath });
        const seq = sequence(
          "pl_bootstrap",
          [
            evaluate(
              exportDataScript(key),
              "Export all ProjectionLab data via Plugin API",
              "Object with plans, startingConditions, progress, settings",
            ),
          ],
          { requestId: opId },
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(seq, null, 2) }] };
      }

      // Step 2 — save snapshot, optionally write to custom path, return shape
      const op = getOperation(requestId);
      if (!op) return errorResult(`Unknown or expired requestId: ${requestId}`);
      completeOperation(requestId);

      const { outputPath: storedOutputPath } = op.data as { outputPath?: string };

      const snapshotPath = await saveSnapshot(result, "bootstrap");

      if (storedOutputPath) {
        try {
          await writeFile(storedOutputPath, JSON.stringify(result, null, 2), "utf-8");
        } catch (err) {
          return errorResult(
            `Failed to write to ${storedOutputPath}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const shape = describeShape(result);

      const response: Record<string, unknown> = {
        done: true,
        snapshotPath,
        shape,
      };
      if (storedOutputPath) {
        response.outputPath = storedOutputPath;
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
      };
    },
  );
}
