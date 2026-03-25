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
import { safeStringify } from "../utils/safe-stringify.js";

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

function formatEndpoint(ep: EndpointInfo) {
  return {
    method: ep.method.toUpperCase(),
    path: ep.path,
    ...(ep.summary && { summary: ep.summary }),
    ...(ep.deprecated && { deprecated: true }),
  };
}

function paginate<T>(items: T[], limit: number, offset: number) {
  return {
    totalCount: items.length,
    offset,
    limit,
    items: items.slice(offset, offset + limit),
  };
}

export function registerDiscoveryTools(server: McpServer): void {
  server.registerTool(
    "get_endpoints",
    {
      title: "Get Endpoints",
      description:
        "List endpoints with optional filtering and pagination. " +
        "Without filters returns all endpoints grouped by tag. " +
        "With filters returns a flat paginated list.",
      inputSchema: {
        path_prefix: z
          .string()
          .optional()
          .describe("Filter to endpoints whose path starts with this prefix, e.g. /api/v2/resources"),
        tag: z
          .string()
          .optional()
          .describe("Filter to endpoints with this tag (case-insensitive)"),
        limit: z
          .number()
          .optional()
          .describe("Max results to return (default 100, max 500)"),
        offset: z
          .number()
          .optional()
          .describe("Number of results to skip for pagination (default 0)"),
      },
    },
    async ({ path_prefix, tag, limit, offset }) => {
      try {
        let endpoints = getAllEndpoints();
        const hasFilters = path_prefix || tag;

        if (path_prefix) {
          const prefix = path_prefix.toLowerCase();
          endpoints = endpoints.filter((ep) =>
            ep.path.toLowerCase().startsWith(prefix),
          );
        }
        if (tag) {
          const tagLower = tag.toLowerCase();
          endpoints = endpoints.filter((ep) =>
            ep.tags.some((t) => t.toLowerCase() === tagLower),
          );
        }

        if (hasFilters || limit || offset) {
          const lim = Math.min(limit ?? 100, 500);
          const off = offset ?? 0;
          const page = paginate(endpoints, lim, off);
          return {
            content: [
              {
                type: "text",
                text: safeStringify({
                  totalCount: page.totalCount,
                  offset: page.offset,
                  limit: page.limit,
                  returned: page.items.length,
                  endpoints: page.items.map(formatEndpoint),
                }),
              },
            ],
          };
        }

        const grouped = groupByTag(endpoints);
        const result: Record<string, ReturnType<typeof formatEndpoint>[]> = {};
        for (const [t, eps] of Object.entries(grouped)) {
          result[t] = eps.map(formatEndpoint);
        }

        return {
          content: [{ type: "text", text: safeStringify(result) }],
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

        if (pathItem && "parameters" in pathItem && pathItem.parameters) {
          const opParams = (operation.parameters as unknown[]) ?? [];
          detail.parameters = [
            ...(pathItem.parameters as unknown[]),
            ...opParams,
          ];
        }

        if (!operation.security) {
          const globalSec = (spec as Record<string, unknown>).security;
          if (globalSec) {
            detail.security = globalSec;
          }
        }

        return {
          content: [{ type: "text", text: safeStringify(detail) }],
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
    "get_endpoint_parameters",
    {
      title: "Get Endpoint Parameters",
      description:
        "Return only the parameters (path, query, header, cookie) for an endpoint. " +
        "Lighter than get_endpoint_detail — useful when you only need param names, types, and locations, " +
        "or when get_endpoint_detail fails on large/circular schemas.",
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
          return {
            content: [
              { type: "text", text: `No ${method.toUpperCase()} operation at "${path}".` },
            ],
            isError: true,
          };
        }

        const pathItem = getPathItem(path);
        const pathParams = (pathItem && "parameters" in pathItem && pathItem.parameters)
          ? (pathItem.parameters as Record<string, unknown>[])
          : [];
        const opParams = (operation.parameters as Record<string, unknown>[] | undefined) ?? [];

        const seen = new Set<string>();
        const merged: Record<string, unknown>[] = [];
        for (const p of [...opParams, ...pathParams]) {
          const key = `${p.in}:${p.name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const param: Record<string, unknown> = {
            name: p.name,
            in: p.in,
            required: p.required ?? false,
          };
          if (p.description) param.description = p.description;
          if (p.schema) param.schema = p.schema;
          merged.push(param);
        }

        const grouped: Record<string, unknown[]> = {};
        for (const p of merged) {
          const loc = p.in as string;
          if (!grouped[loc]) grouped[loc] = [];
          grouped[loc].push(p);
        }

        return {
          content: [
            {
              type: "text",
              text: safeStringify({
                method: method.toUpperCase(),
                path,
                parameterCount: merged.length,
                parameters: grouped,
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
}
