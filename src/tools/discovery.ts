import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAllEndpoints,
  getOperation,
  getPathItem,
  getSpec,
  isV2,
  type EndpointInfo,
} from "../spec-store.js";
import type { OpenAPIV3 } from "openapi-types";

function groupByTag(endpoints: EndpointInfo[]): Record<string, EndpointInfo[]> {
  const grouped: Record<string, EndpointInfo[]> = {};
  for (const ep of endpoints) {
    const tags = ep.tags.length > 0 ? ep.tags : ["untagged"];
    for (const tag of tags) {
      if (!grouped[tag]) grouped[tag] = [];
      grouped[tag].push(ep);
    }
  }
  return grouped;
}

export function registerDiscoveryTools(server: McpServer): void {
  server.registerTool(
    "get_endpoints",
    {
      title: "Get Endpoints",
      description:
        "List all available endpoints grouped by tag/domain, with HTTP method, path, and summary. " +
        "Gives a quick map of the entire API surface.",
    },
    async () => {
      try {
        const endpoints = getAllEndpoints();
        const grouped = groupByTag(endpoints);

        const result: Record<
          string,
          { method: string; path: string; summary?: string; deprecated?: boolean }[]
        > = {};
        for (const [tag, eps] of Object.entries(grouped)) {
          result[tag] = eps.map((ep) => ({
            method: ep.method.toUpperCase(),
            path: ep.path,
            ...(ep.summary && { summary: ep.summary }),
            ...(ep.deprecated && { deprecated: true }),
          }));
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
    "get_endpoint_detail",
    {
      title: "Get Endpoint Detail",
      description:
        "Given a path and HTTP method, return the full operation: parameters, request body schema, " +
        "response schemas, auth requirements, and description.",
      inputSchema: {
        path: z.string().describe("The endpoint path, e.g. /pets/{petId}"),
        method: z
          .string()
          .describe("HTTP method: get, post, put, delete, patch, etc."),
      },
    },
    async ({ path, method }) => {
      try {
        const operation = getOperation(path, method);
        if (!operation) {
          const endpoints = getAllEndpoints();
          const available = endpoints
            .filter((ep) => ep.path === path)
            .map((ep) => ep.method.toUpperCase());

          if (available.length > 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No ${method.toUpperCase()} operation found for "${path}". Available methods: ${available.join(", ")}`,
                },
              ],
              isError: true,
            };
          }

          const similar = endpoints
            .filter((ep) => ep.path.includes(path.split("/").pop() ?? ""))
            .slice(0, 5)
            .map((ep) => `${ep.method.toUpperCase()} ${ep.path}`);

          return {
            content: [
              {
                type: "text",
                text: `Path "${path}" not found.${similar.length > 0 ? ` Did you mean one of: ${similar.join(", ")}?` : ""}`,
              },
            ],
            isError: true,
          };
        }

        const pathItem = getPathItem(path);
        const spec = getSpec();

        const detail: Record<string, unknown> = {
          method: method.toUpperCase(),
          path,
          ...operation,
        };

        // Merge path-level parameters
        if (pathItem && "parameters" in pathItem && pathItem.parameters) {
          const opParams = (operation.parameters as unknown[]) ?? [];
          detail.parameters = [
            ...(pathItem.parameters as unknown[]),
            ...opParams,
          ];
        }

        // Include security from operation level or global
        if (!operation.security) {
          const globalSec = (spec as Record<string, unknown>).security;
          if (globalSec) {
            detail.security = globalSec;
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
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
