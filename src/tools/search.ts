import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAllEndpoints, type EndpointInfo } from "../spec-store.js";

function matchesQuery(ep: EndpointInfo, query: string): boolean {
  const q = query.toLowerCase();
  return (
    ep.path.toLowerCase().includes(q) ||
    (ep.summary?.toLowerCase().includes(q) ?? false) ||
    (ep.description?.toLowerCase().includes(q) ?? false) ||
    (ep.operationId?.toLowerCase().includes(q) ?? false) ||
    ep.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "search_endpoints",
    {
      title: "Search Endpoints",
      description:
        "Full-text search across endpoint paths, summaries, descriptions, operationIds, and tags. " +
        'Useful when you don\'t know the exact path but know what you\'re looking for (e.g. "payment", "booking").',
      inputSchema: {
        query: z
          .string()
          .describe("Search term to match against endpoint metadata"),
      },
    },
    async ({ query }) => {
      try {
        const endpoints = getAllEndpoints();
        const matches = endpoints.filter((ep) => matchesQuery(ep, query));

        const results = matches.map((ep) => ({
          method: ep.method.toUpperCase(),
          path: ep.path,
          ...(ep.summary && { summary: ep.summary }),
          ...(ep.operationId && { operationId: ep.operationId }),
          tags: ep.tags,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  matchCount: results.length,
                  results,
                },
                null,
                2,
              ),
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
    "get_endpoints_by_tag",
    {
      title: "Get Endpoints by Tag",
      description:
        'Filter endpoints by their OpenAPI tag group (e.g. all endpoints under "Flights" or "Users").',
      inputSchema: {
        tag: z
          .string()
          .describe("The tag name to filter by (case-insensitive)"),
      },
    },
    async ({ tag }) => {
      try {
        const endpoints = getAllEndpoints();
        const tagLower = tag.toLowerCase();
        const matches = endpoints.filter((ep) =>
          ep.tags.some((t) => t.toLowerCase() === tagLower),
        );

        if (matches.length === 0) {
          const allTags = [
            ...new Set(endpoints.flatMap((ep) => ep.tags)),
          ];
          return {
            content: [
              {
                type: "text",
                text: `No endpoints found with tag "${tag}". Available tags: ${allTags.join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        const results = matches.map((ep) => ({
          method: ep.method.toUpperCase(),
          path: ep.path,
          ...(ep.summary && { summary: ep.summary }),
          ...(ep.operationId && { operationId: ep.operationId }),
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { tag, count: results.length, endpoints: results },
                null,
                2,
              ),
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
