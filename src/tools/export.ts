import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readApiKey } from "../config.js";

export function registerExportTools(server: McpServer): void {
  server.registerTool(
    "pl_export",
    {
      title: "Export ProjectionLab Data",
      description:
        "Returns a JavaScript string that exports all ProjectionLab data via the Plugin API. Execute this script in the browser using the Playwright or chrome devtools MCP to get the full data export.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      let key: string;
      try {
        key = await readApiKey();
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }

      const script = `await window.projectionlabPluginAPI.exportData({ key: ${JSON.stringify(key)} })`;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ script }, null, 2),
          },
        ],
      };
    },
  );
}
