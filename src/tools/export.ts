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
        "The script reads the API key from sessionStorage, set during pl_setup.",
        "If the browser tab was closed since setup, run pl_setup again first.",
      ].join("\n"),
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const script = `(() => { const k = sessionStorage.getItem('__plKey'); if (!k) throw new Error('API key not set. Run pl_setup first.'); return window.projectionlabPluginAPI.exportData({ key: k }); })()`;

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
