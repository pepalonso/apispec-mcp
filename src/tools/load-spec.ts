import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadSpec } from "../spec-store.js";

const LOAD_SPEC_DESCRIPTION =
  "Fetch, parse, and dereference an OpenAPI/Swagger spec. Must be called before any other tool. " +
  "Supports Swagger 2.0, OpenAPI 3.0, and 3.1 in JSON or YAML. " +
  "If you already have the spec URL, pass it as `url`. " +
  "If you do not have the URL, do NOT ask the user for it — just call this tool without `url` and " +
  "the user will be prompted to enter it. Never guess URLs and never fetch OpenAPI specs with web or " +
  "browser tools; only this tool loads the spec.";

const FALLBACK_NO_ELICITATION =
  "Interactive URL entry is not available in this MCP client. " +
  "User: please paste the OpenAPI/Swagger spec URL (or local file path) in the chat. " +
  "Assistant: call load_spec again with the `url` parameter set exactly to that value.";

function isFormElicitationUnsupported(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message === "Client does not support form elicitation."
  );
}

export function registerLoadSpec(server: McpServer): void {
  server.registerTool(
    "load_spec",
    {
      title: "Load OpenAPI Spec",
      description: LOAD_SPEC_DESCRIPTION,
      inputSchema: {
        url: z
          .string()
          .optional()
          .describe(
            "The spec URL or local file path. Pass it if you already have it. " +
            "If you don't have it, omit this — the user will be prompted to enter it.",
          ),
      },
    },
    async ({ url }) => {
      let resolved = (url ?? "").trim();

      if (!resolved) {
        try {
          const elicit = await server.server.elicitInput({
            mode: "form",
            message:
              "Paste the OpenAPI or Swagger spec URL, or a local path to the JSON/YAML file.",
            requestedSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  title: "OpenAPI / Swagger URL or path",
                  description:
                    "HTTPS URL, file:// URL, or file system path to the spec",
                  minLength: 1,
                },
              },
              required: ["url"],
            },
          });

          if (elicit.action === "accept" && elicit.content) {
            const u = elicit.content.url;
            if (typeof u === "string" && u.trim()) {
              resolved = u.trim();
            }
          } else if (elicit.action === "decline") {
            return {
              content: [
                {
                  type: "text",
                  text: "Load cancelled: URL entry was declined.",
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: "Load cancelled.",
                },
              ],
            };
          }
        } catch (err) {
          if (isFormElicitationUnsupported(err)) {
            return {
              content: [{ type: "text", text: FALLBACK_NO_ELICITATION }],
            };
          }
          return {
            content: [
              {
                type: "text",
                text: `Failed to prompt for URL: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      }

      if (!resolved) {
        return {
          content: [
            {
              type: "text",
              text: "No spec URL was provided. Try again or paste the URL in chat and call load_spec with that URL if the client does not support prompts.",
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await loadSpec(resolved);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "loaded",
                  title: result.title,
                  version: result.version,
                  endpointCount: result.endpointCount,
                  schemaCount: result.schemaCount,
                  specUrl: resolved,
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
            {
              type: "text",
              text: `Failed to load spec from "${resolved}": ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
