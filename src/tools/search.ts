import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAllEndpoints, type EndpointInfo } from "../spec-store.js";
import { safeStringify } from "../utils/safe-stringify.js";

interface ScoredEndpoint {
  ep: EndpointInfo;
  score: number;
}

function scoreEndpoint(ep: EndpointInfo, tokens: string[]): number {
  let score = 0;
  const path = ep.path.toLowerCase();
  const summary = ep.summary?.toLowerCase() ?? "";
  const description = ep.description?.toLowerCase() ?? "";
  const operationId = ep.operationId?.toLowerCase() ?? "";
  const tags = ep.tags.map((t) => t.toLowerCase());

  for (const token of tokens) {
    if (path.includes(token)) score += 10;
    if (operationId.includes(token)) score += 6;
    if (summary.includes(token)) score += 4;
    if (tags.some((t) => t.includes(token))) score += 3;
    if (description.includes(token)) score += 1;
  }

  return score;
}

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "search_endpoints",
    {
      title: "Search Endpoints",
      description:
        "Search endpoints by keywords. Multi-word queries match each word independently (OR). " +
        "Results are ranked: path matches score highest, then operationId, summary, tags, and description. " +
        "Returns top results with pagination.",
      inputSchema: {
        query: z
          .string()
          .describe("One or more search keywords separated by spaces"),
        limit: z
          .number()
          .optional()
          .describe("Max results to return (default 50, max 200)"),
        offset: z
          .number()
          .optional()
          .describe("Number of results to skip for pagination (default 0)"),
      },
    },
    async ({ query, limit, offset }) => {
      try {
        const endpoints = getAllEndpoints();
        const tokens = query
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 0);

        if (tokens.length === 0) {
          return {
            content: [{ type: "text", text: "Empty search query." }],
            isError: true,
          };
        }

        const scored: ScoredEndpoint[] = [];
        for (const ep of endpoints) {
          const s = scoreEndpoint(ep, tokens);
          if (s > 0) scored.push({ ep, score: s });
        }

        scored.sort((a, b) => b.score - a.score);

        const lim = Math.min(limit ?? 50, 200);
        const off = offset ?? 0;
        const page = scored.slice(off, off + lim);

        const results = page.map(({ ep, score }) => ({
          method: ep.method.toUpperCase(),
          path: ep.path,
          score,
          ...(ep.summary && { summary: ep.summary }),
          ...(ep.operationId && { operationId: ep.operationId }),
          tags: ep.tags,
        }));

        return {
          content: [
            {
              type: "text",
              text: safeStringify({
                query,
                totalMatches: scored.length,
                offset: off,
                limit: lim,
                returned: results.length,
                results,
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
    "get_endpoints_by_tag",
    {
      title: "Get Endpoints by Tag",
      description:
        "Filter endpoints by their OpenAPI tag group with pagination. " +
        'Example: all endpoints under "Flights" or "Users".',
      inputSchema: {
        tag: z
          .string()
          .describe("The tag name to filter by (case-insensitive)"),
        limit: z
          .number()
          .optional()
          .describe("Max results to return (default 50, max 500)"),
        offset: z
          .number()
          .optional()
          .describe("Number of results to skip for pagination (default 0)"),
      },
    },
    async ({ tag, limit, offset }) => {
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

        const lim = Math.min(limit ?? 50, 500);
        const off = offset ?? 0;
        const page = matches.slice(off, off + lim);

        const results = page.map((ep) => ({
          method: ep.method.toUpperCase(),
          path: ep.path,
          ...(ep.summary && { summary: ep.summary }),
          ...(ep.operationId && { operationId: ep.operationId }),
        }));

        return {
          content: [
            {
              type: "text",
              text: safeStringify({
                tag,
                totalCount: matches.length,
                offset: off,
                limit: lim,
                returned: results.length,
                endpoints: results,
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
