import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getOperation, getSpec, isV2 } from "../spec-store.js";
import { generateExample } from "../utils/example-generator.js";

function extractRequestBodySchema(
  operation: Record<string, unknown>,
  contentType: string,
): Record<string, unknown> | null {
  const spec = getSpec();

  // OpenAPI 3.x
  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  if (requestBody) {
    const content = requestBody.content as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (content) {
      const mediaType = content[contentType] ?? content["*/*"];
      if (mediaType?.schema) {
        return mediaType.schema as Record<string, unknown>;
      }
    }
    return null;
  }

  // Swagger 2.x: body parameter
  if (isV2(spec)) {
    const params = operation.parameters as
      | Array<Record<string, unknown>>
      | undefined;
    if (params) {
      const bodyParam = params.find((p) => p.in === "body");
      if (bodyParam?.schema) {
        return bodyParam.schema as Record<string, unknown>;
      }
    }
  }

  return null;
}

function extractResponseSchema(
  operation: Record<string, unknown>,
  statusCode: string,
  contentType: string,
): Record<string, unknown> | null {
  const spec = getSpec();
  const responses = operation.responses as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!responses) return null;

  const response = responses[statusCode] ?? responses.default;
  if (!response) return null;

  // OpenAPI 3.x
  const content = response.content as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (content) {
    const mediaType = content[contentType] ?? content["*/*"];
    if (mediaType?.schema) {
      return mediaType.schema as Record<string, unknown>;
    }
  }

  // Swagger 2.x
  if (isV2(spec) && response.schema) {
    return response.schema as Record<string, unknown>;
  }

  return null;
}

export function registerExampleTools(server: McpServer): void {
  server.registerTool(
    "get_request_example",
    {
      title: "Get Request Example",
      description:
        "Generate a filled-in example request body for a given endpoint, based on the schema's " +
        "example values, defaults, or synthesized from types.",
      inputSchema: {
        path: z.string().describe("The endpoint path, e.g. /pets"),
        method: z.string().describe("HTTP method: post, put, patch, etc."),
        content_type: z
          .string()
          .optional()
          .describe(
            "Content type to use (default: application/json)",
          ),
      },
    },
    async ({ path, method, content_type }) => {
      try {
        const ct = content_type ?? "application/json";
        const operation = getOperation(path, method);
        if (!operation) {
          return {
            content: [
              {
                type: "text",
                text: `No ${method.toUpperCase()} operation found for "${path}".`,
              },
            ],
            isError: true,
          };
        }

        const schema = extractRequestBodySchema(operation, ct);
        if (!schema) {
          return {
            content: [
              {
                type: "text",
                text: `No request body schema found for ${method.toUpperCase()} ${path} with content type "${ct}".`,
              },
            ],
            isError: true,
          };
        }

        const example = generateExample(schema);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  method: method.toUpperCase(),
                  path,
                  contentType: ct,
                  example,
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
    "get_response_example",
    {
      title: "Get Response Example",
      description:
        "Generate a filled-in example response body for a given endpoint and status code, " +
        "based on the schema's example values, defaults, or synthesized from types.",
      inputSchema: {
        path: z.string().describe("The endpoint path, e.g. /pets/{petId}"),
        method: z.string().describe("HTTP method: get, post, etc."),
        status_code: z
          .string()
          .optional()
          .describe('HTTP status code (default: "200")'),
        content_type: z
          .string()
          .optional()
          .describe(
            "Content type to use (default: application/json)",
          ),
      },
    },
    async ({ path, method, status_code, content_type }) => {
      try {
        const sc = status_code ?? "200";
        const ct = content_type ?? "application/json";
        const operation = getOperation(path, method);
        if (!operation) {
          return {
            content: [
              {
                type: "text",
                text: `No ${method.toUpperCase()} operation found for "${path}".`,
              },
            ],
            isError: true,
          };
        }

        const schema = extractResponseSchema(operation, sc, ct);
        if (!schema) {
          const responses = operation.responses as
            | Record<string, unknown>
            | undefined;
          const availableCodes = responses
            ? Object.keys(responses).join(", ")
            : "none";
          return {
            content: [
              {
                type: "text",
                text: `No response schema found for ${method.toUpperCase()} ${path} status ${sc}. Available status codes: ${availableCodes}`,
              },
            ],
            isError: true,
          };
        }

        const example = generateExample(schema);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  method: method.toUpperCase(),
                  path,
                  statusCode: sc,
                  contentType: ct,
                  example,
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
}
