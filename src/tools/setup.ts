import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config, writeApiKey } from "../config.js";

export function registerSetupTools(server: McpServer): void {
  server.registerTool(
    "pl_setup",
    {
      title: "Setup ProjectionLab",
      description: [
        "Guided setup for the ProjectionLab Plugin API key.",
        "",
        "Three-step flow:",
        "1. Call with no args — returns instructions to navigate to the ProjectionLab settings page, enable plugins, and copy the API key.",
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
                  instructions: [
                    "1. Navigate to the settings URL above in the browser.",
                    "2. Enable the 'Enable Plugins' toggle if not already enabled.",
                    "3. Click the eye icon to reveal the Plugin API Key.",
                    "4. Copy the key and call pl_setup again with the apiKey parameter.",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Step 2: apiKey provided — store and return validation script
      if (apiKey && validationResult === undefined) {
        try {
          await writeApiKey(apiKey);
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `Error storing API key: ${err instanceof Error ? err.message : String(err)}`,
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
                  keyStored: true,
                  keyPath: config.keyPath,
                  validateScript: `await window.projectionlabPluginAPI.validateApiKey({ key: ${JSON.stringify(apiKey)} })`,
                  instructions:
                    "Execute the validateScript in the browser. If it returns without error, call pl_setup again with validationResult: true. If it throws, call with validationResult: false.",
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
                  keyPath: config.keyPath,
                  message: "API key validated and stored. ProjectionLab is ready to use.",
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
            text: "Error: invalid arguments. Call pl_setup with no args to start, with apiKey to store, or with validationResult to confirm.",
          },
        ],
        isError: true,
      };
    },
  );
}
