#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerLoadSpec } from "./tools/load-spec.js";
import { registerDiscoveryTools } from "./tools/discovery.js";
import { registerSchemaTools } from "./tools/schemas.js";
import { registerSearchTools } from "./tools/search.js";
import { registerAuthAndServerTools } from "./tools/auth-and-servers.js";
import { registerExampleTools } from "./tools/examples.js";

const server = new McpServer({
  name: "apispec-mcp",
  version: "0.1.0",
});

registerLoadSpec(server);
registerDiscoveryTools(server);
registerSchemaTools(server);
registerSearchTools(server);
registerAuthAndServerTools(server);
registerExampleTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
