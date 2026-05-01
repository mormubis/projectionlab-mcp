import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config, readApiKey } from "../config.js";
import { evaluate, navigate, sequence, wait } from "../lib/actions.js";
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
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
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
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
      const result = sequence("pl_open", [
        navigate(config.baseUrl, "Navigate to ProjectionLab"),
        wait("[data-projectionlab]", "Wait for ProjectionLab app to load", 10_000),
        evaluate(checkPluginApiScript(), "Check if Plugin API is available", "true"),
        evaluate(validateApiKeyScript(key), "Validate the API key", "API key is valid"),
      ]);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
