import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerExportTools(server: McpServer): void {
  server.registerTool(
    "pl_export",
    {
      title: "Export ProjectionLab Data",
      description: [
        "Returns a JavaScript string that exports all ProjectionLab data via the Plugin API.",
        "Execute this script in the browser using the Playwright or chrome devtools MCP.",
        "",
        "The script uses window.__plKey which is set during pl_setup.",
        "If the page was reloaded since setup, run pl_setup again first.",
      ].join("\n"),
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const script = `if (!window.__plKey) throw new Error("API key not set. Run pl_setup first."); await window.projectionlabPluginAPI.exportData({ key: window.__plKey })`;

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
