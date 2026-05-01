#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSessionTools } from "./tools/session.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";
import { registerSnapshotTools } from "./tools/snapshots.js";
import { registerBootstrapTools } from "./tools/bootstrap.js";

const server = new McpServer(
  {
    name: "finance",
    version: "0.1.0",
  },
  {
    instructions: [
      "This MCP server orchestrates ProjectionLab browser actions.",
      "It does NOT control the browser directly — it returns action sequences",
      "that you execute via a separate Playwright MCP server.",
      "",
      "Workflow for most tools:",
      "1. Call the tool (returns an action sequence with a requestId)",
      "2. Execute each step via the Playwright MCP",
      "3. Call the tool again with the requestId and the result",
      "4. Repeat until the response includes done: true",
      "",
      "First-time setup: call pl_setup to open ProjectionLab settings,",
      "guide the user through enabling plugins, and store the API key.",
      "",
      "Before using any tools, ensure ProjectionLab is open by calling pl_status",
      "or pl_open. The Plugin API must be available in the browser.",
      "",
      "All write operations automatically create snapshots before modifying data.",
      "Use pl_list_snapshots and pl_restore to manage backups.",
    ].join("\n"),
  },
);

registerSessionTools(server);
registerReadTools(server);
registerWriteTools(server);
registerSnapshotTools(server);
registerBootstrapTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("finance MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
