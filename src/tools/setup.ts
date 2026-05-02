import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../config.js";

export function registerSetupTools(server: McpServer): void {
  server.registerTool(
    "pl_setup",
    {
      title: "Setup ProjectionLab",
      description: [
        "Guided setup for the ProjectionLab Plugin API key.",
        "",
        "Two-step flow:",
        "1. Call with no args — returns instructions and a browser script that extracts, stores, and validates the key entirely in the browser.",
        "2. Call with validationResult — confirms the key is valid and setup is complete.",
        "",
        "The API key NEVER leaves the browser. The extractScript reads it from the DOM,",
        "stores it in sessionStorage, and validates it — all client-side. The only value",
        "that comes back to the conversation is a success/failure boolean.",
        "",
        "The extractScript should be executed in the browser via the Playwright or chrome devtools MCP.",
      ].join("\n"),
      inputSchema: z.object({
        validationResult: z
          .unknown()
          .optional()
          .describe("Result from executing the extractScript in the browser"),
      }),
    },
    async ({ validationResult }) => {
      // Step 1: no args — return setup instructions
      if (validationResult === undefined) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  settingsUrl: config.baseUrl + "settings/plugins",
                  extractScript: [
                    "(async () => {",
                    "  const input = document.querySelector('input[readonly]');",
                    "  if (!input) throw new Error('Plugin API Key input not found. Make sure you are on the Plugins settings page.');",
                    "  const value = input.value;",
                    "  if (!value) throw new Error('Plugin API Key is empty.');",
                    "  sessionStorage.setItem('__plKey', value);",
                    "  await window.projectionlabPluginAPI.validateApiKey({ key: value });",
                    "  return true;",
                    "})()",
                  ].join("\n"),
                  instructions: [
                    "1. Navigate to the settings URL above in the browser.",
                    "2. Wait a few seconds for ProjectionLab to fully load (it's a SPA — use wait_for with text 'Plugin API Key' or similar).",
                    "3. Enable the 'Enable Plugins' toggle if not already enabled.",
                    "4. Run the extractScript in the browser — it reads the key from the DOM, stores it in sessionStorage, and validates it. It returns true on success.",
                    "5. Call pl_setup again with validationResult set to the script's return value (true or the error message).",
                    "",
                    "IMPORTANT: Do NOT extract the key yourself. Do NOT pass the key through the conversation.",
                    "The extractScript handles everything inside the browser.",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Step 2: validation result — confirm success
      const failed =
        validationResult === false ||
        validationResult === null ||
        (typeof validationResult === "object" &&
          validationResult !== null &&
          "error" in validationResult);

      if (failed) {
        return {
          content: [
            {
              type: "text",
              text: "API key validation failed. Check that plugins are enabled and the key is correct, then try pl_setup again.",
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message:
                  "API key validated and stored in browser sessionStorage. Ready to use.",
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
