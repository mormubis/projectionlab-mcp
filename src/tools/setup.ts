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
        "Three-step flow:",
        "1. Call with no args — returns instructions to navigate to the ProjectionLab settings page and enable plugins.",
        "2. Call with apiKey — stores the key locally and returns a JavaScript string to validate it in the browser.",
        "3. Call with validationResult — confirms the key is valid and setup is complete.",
        "",
        "The validation script should be executed in the browser via the Playwright or chrome devtools MCP.",
      ].join("\n"),
      inputSchema: z.object({
        apiKey: z
          .string()
          .optional()
          .describe("The Plugin API key copied from ProjectionLab settings"),
        validationResult: z
          .unknown()
          .optional()
          .describe("Result from executing the validation script in the browser"),
      }),
    },
    async ({ apiKey, validationResult }) => {
      // Step 1: no args — return setup instructions
      if (!apiKey && validationResult === undefined) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  settingsUrl: config.baseUrl + "settings/plugins",
                  extractScript: [
                    "(() => {",
                    "  const input = document.querySelector('input[readonly]');",
                    "  if (!input) throw new Error('Plugin API Key input not found. Make sure you are on the Plugins settings page.');",
                    "  const value = input.value;",
                    "  if (!value || value.includes('\\u2022')) throw new Error('Key is masked. Click the eye icon to reveal it first.');",
                    "  window.__plKey = value;",
                    "  return window.projectionlabPluginAPI.validateApiKey({ key: window.__plKey });",
                    "})()",
                  ].join("\n"),
                  instructions: [
                    "1. Navigate to the settings URL above in the browser.",
                    "2. Enable the 'Enable Plugins' toggle if not already enabled.",
                    "3. Click the eye icon to reveal the Plugin API Key.",
                    "4. Run the extractScript in the browser — it reads the key from the page, stores it in window.__plKey, and validates it.",
                    "5. Call pl_setup again with validationResult: true if it succeeded, or false if it threw.",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Step 2: apiKey provided (legacy/manual flow) — store in browser
      if (apiKey && validationResult === undefined) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  setupScript: `window.__plKey = ${JSON.stringify(apiKey)}; await window.projectionlabPluginAPI.validateApiKey({ key: window.__plKey })`,
                  instructions:
                    "Execute the setupScript in the browser. If it returns without error, call pl_setup again with validationResult: true.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Step 3: validation result — confirm success
      if (validationResult !== undefined) {
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
                  message: "API key extracted from ProjectionLab, validated, and stored in browser. Ready to use.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Error: invalid arguments. Call pl_setup with no args to start, or with validationResult to confirm.",
          },
        ],
        isError: true,
      };
    },
  );
}
