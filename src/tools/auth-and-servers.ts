import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { safeStringify } from "../utils/safe-stringify.js";
import {
  getAllEndpoints,
  getOperation,
  getSecuritySchemes,
  getGlobalSecurity,
  getServers,
} from "../spec-store.js";

export function registerAuthAndServerTools(server: McpServer): void {
  server.registerTool(
    "get_auth_schemes",
    {
      title: "Get Auth Schemes",
      description:
        "Return the security schemes defined in the spec (API key, OAuth2, Bearer, etc.) " +
        "and which endpoints require them.",
    },
    async () => {
      try {
        const schemes = getSecuritySchemes();
        const globalSecurity = getGlobalSecurity();
        const endpoints = getAllEndpoints();

        const endpointSecurity: Record<string, unknown[]> = {};
        for (const ep of endpoints) {
          const op = getOperation(ep.path, ep.method);
          if (op?.security) {
            const key = `${ep.method.toUpperCase()} ${ep.path}`;
            endpointSecurity[key] = op.security as unknown[];
          }
        }

        return {
          content: [
            {
              type: "text",
              text: safeStringify({
                  securitySchemes: schemes,
                  globalSecurity,
                  endpointSpecificSecurity: endpointSecurity,
                }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: err instanceof Error ? err.message : String(err) },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_servers",
    {
      title: "Get Servers",
      description:
        "Return the base URLs/environments defined in the spec (prod, staging, sandbox, etc.).",
    },
    async () => {
      try {
        const servers = getServers();
        return {
          content: [
            { type: "text", text: safeStringify({ servers }) },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: err instanceof Error ? err.message : String(err) },
          ],
          isError: true,
        };
      }
    },
  );
}
