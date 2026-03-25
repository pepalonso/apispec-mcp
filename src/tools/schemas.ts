import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSchemaNames, getSchemaByName } from "../spec-store.js";
import { safeStringify } from "../utils/safe-stringify.js";

export function registerSchemaTools(server: McpServer): void {
  server.registerTool(
    "get_schemas",
    {
      title: "Get Schemas",
      description:
        "List all named schemas/components defined in the spec (e.g. BookingRequest, FlightSegment). " +
        "Shows schema names and their type/description when available.",
    },
    async () => {
      try {
        const names = getSchemaNames();
        const summaries = names.map((name) => {
          const schema = getSchemaByName(name);
          const entry: Record<string, unknown> = { name };
          if (schema) {
            if (schema.type) entry.type = schema.type;
            if (schema.description)
              entry.description = schema.description;
            if (schema.enum) entry.enum = schema.enum;
            const props = schema.properties as
              | Record<string, unknown>
              | undefined;
            if (props) {
              entry.propertyCount = Object.keys(props).length;
            }
          }
          return entry;
        });

        return {
          content: [
            {
              type: "text",
              text: safeStringify({ count: names.length, schemas: summaries }),
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
    "get_schema_detail",
    {
      title: "Get Schema Detail",
      description:
        "Expand a specific schema by name, with all $ref references already resolved. " +
        "Returns the full shape so you don't need to chase references manually.",
      inputSchema: {
        schema_name: z
          .string()
          .describe(
            "The schema name as it appears in components/schemas (or definitions for Swagger 2)",
          ),
      },
    },
    async ({ schema_name }) => {
      try {
        const schema = getSchemaByName(schema_name);
        if (!schema) {
          const available = getSchemaNames();
          const lower = schema_name.toLowerCase();
          const suggestions = available
            .filter((n) => n.toLowerCase().includes(lower))
            .slice(0, 5);

          return {
            content: [
              {
                type: "text",
                text: `Schema "${schema_name}" not found.${suggestions.length > 0 ? ` Did you mean: ${suggestions.join(", ")}?` : ` Available schemas: ${available.slice(0, 20).join(", ")}${available.length > 20 ? "..." : ""}`}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: safeStringify({ name: schema_name, schema }),
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
