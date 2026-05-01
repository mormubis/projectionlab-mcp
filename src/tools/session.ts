import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config, readApiKey, writeApiKey } from "../config.js";
import { evaluate, navigate, sequence, wait } from "../lib/actions.js";
import {
  checkPluginApiScript,
  validateApiKeyScript,
} from "../lib/plugin-api.js";
import {
  createOperation,
  getOperation,
  completeOperation,
} from "../lib/state.js";

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

  // -------------------------------------------------------------------------
  // pl_setup — guided API key setup
  // -------------------------------------------------------------------------
  server.registerTool(
    "pl_setup",
    {
      title: "Setup ProjectionLab",
      description: [
        "Guided setup for the ProjectionLab Plugin API key.",
        "",
        "Three-step flow:",
        "1. Call with no args — opens the ProjectionLab settings page where the user can enable plugins and copy the API key.",
        "2. Call with apiKey — stores the key locally and returns an action to validate it against ProjectionLab.",
        "3. Call with requestId + result — confirms the key is valid and setup is complete.",
        "",
        "If the key is already configured, call pl_status instead.",
      ].join("\n"),
      inputSchema: z.object({
        apiKey: z
          .string()
          .optional()
          .describe("The Plugin API key copied from ProjectionLab settings"),
        requestId: z.string().optional(),
        result: z.unknown().optional(),
      }),
    },
    async ({ apiKey, requestId, result }) => {
      // Step 1: no args — open settings page
      if (!apiKey && !requestId) {
        const settingsUrl = config.baseUrl + "app/settings";
        const actions = sequence("pl_setup", [
          navigate(settingsUrl, "Open ProjectionLab Account Settings"),
          wait(
            "body",
            "Wait for settings page to load",
            10_000,
          ),
        ]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ...actions,
                  instructions: [
                    "Navigate to the Plugins section in Account Settings.",
                    "Enable the 'Enable Plugins' toggle if not already enabled.",
                    "Copy the Plugin API Key shown on the page.",
                    "Then call pl_setup again with the apiKey parameter.",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Step 2: apiKey provided — store it and return validation action
      if (apiKey && !requestId) {
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

        const opId = createOperation("pl_setup");

        const actions = sequence(
          "pl_setup",
          [
            evaluate(
              checkPluginApiScript(),
              "Check if Plugin API is available on the current page",
              "true",
            ),
            evaluate(
              validateApiKeyScript(apiKey),
              "Validate the API key against ProjectionLab",
              "Key is valid",
            ),
          ],
          { requestId: opId },
        );

        return {
          content: [
            { type: "text", text: JSON.stringify(actions, null, 2) },
          ],
        };
      }

      // Step 3: validation result — confirm success
      if (requestId) {
        const op = getOperation(requestId);
        if (!op) {
          return {
            content: [
              { type: "text", text: "Error: unknown or expired requestId" },
            ],
            isError: true,
          };
        }

        completeOperation(requestId);

        // Check if validation failed
        const failed =
          result === false ||
          result === null ||
          (typeof result === "object" &&
            result !== null &&
            "error" in result);

        if (failed) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    tool: "pl_setup",
                    success: false,
                    message:
                      "API key validation failed. Check that plugins are enabled and the key is correct, then try pl_setup again.",
                    done: true,
                  },
                  null,
                  2,
                ),
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
                  tool: "pl_setup",
                  success: true,
                  keyPath: config.keyPath,
                  message:
                    "API key validated and stored. ProjectionLab is ready to use.",
                  done: true,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Shouldn't reach here, but handle gracefully
      return {
        content: [
          {
            type: "text",
            text: "Error: invalid arguments. Call pl_setup with no args to start, with apiKey to store, or with requestId + result to confirm.",
          },
        ],
        isError: true,
      };
    },
  );
}
