# apispec-mcp

[![npm version](https://img.shields.io/npm/v/apispec-mcp)](https://www.npmjs.com/package/apispec-mcp)
[![npm downloads](https://img.shields.io/npm/dm/apispec-mcp)](https://www.npmjs.com/package/apispec-mcp)
[![license](https://img.shields.io/npm/l/apispec-mcp)](LICENSE)

An MCP server that lets AI agents explore and understand OpenAPI/Swagger specifications. Point it at any spec URL and use 11 tools to browse endpoints, schemas, auth, and generate examples — without the agent ever loading the raw JSON into context.

Supports Swagger 2.0, OpenAPI 3.0, and OpenAPI 3.1 (JSON or YAML).

## Quick start

No installation needed. Add this to your MCP client config and you're done.

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "swagger-mcp": {
      "command": "npx",
      "args": ["-y", "apispec-mcp"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apispec-mcp": {
      "command": "npx",
      "args": ["-y", "apispec-mcp"]
    }
  }
}
```

### Other MCP clients

Any client that supports stdio MCP servers can run it with:

```bash
npx apispec-mcp
```

## Usage

Once configured, tell the agent to load a spec — it will prompt you for the URL:

> Load the API spec and show me all endpoints.

When the agent calls `load_spec`, **you will be prompted to enter the spec URL** (if your client supports interactive input). If it doesn't, paste the URL in chat and the agent will use it.

Example URLs:

- `https://petstore3.swagger.io/api/v3/openapi.json`
- `/path/to/local/openapi.yaml`

## Tools

### Spec Loading

| Tool        | Description                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `load_spec` | Fetch and parse an OpenAPI spec. Prompts the user for the URL — the agent should not supply it. Must be called before any other tool. |

### Core Discovery

| Tool                  | Params           | Description                                                             |
| --------------------- | ---------------- | ----------------------------------------------------------------------- |
| `get_endpoints`       | --               | List all endpoints grouped by tag, with HTTP method, path, and summary. |
| `get_endpoint_detail` | `path`, `method` | Full operation detail: parameters, request body, responses, auth.       |
| `get_schemas`         | --               | List all named schemas with type and property count.                    |
| `get_schema_detail`   | `schema_name`    | Full expanded schema with all `$ref`s resolved.                         |

### Search

| Tool                   | Params  | Description                                                       |
| ---------------------- | ------- | ----------------------------------------------------------------- |
| `search_endpoints`     | `query` | Full-text search across paths, summaries, descriptions, and tags. |
| `get_endpoints_by_tag` | `tag`   | Filter endpoints by their OpenAPI tag.                            |

### Context & Auth

| Tool               | Params | Description                                        |
| ------------------ | ------ | -------------------------------------------------- |
| `get_auth_schemes` | --     | Security schemes and which endpoints require them. |
| `get_servers`      | --     | Base URLs / environments defined in the spec.      |

### Examples

| Tool                   | Params                                            | Description                                          |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `get_request_example`  | `path`, `method`, `content_type?`                 | Generate an example request body from the schema.    |
| `get_response_example` | `path`, `method`, `status_code?`, `content_type?` | Generate an example response body for a status code. |

## How it works

1. The agent calls `load_spec` (no URL needed as an argument).
2. If your MCP client supports interactive input, you are prompted to enter the spec URL or file path.
3. If interactive input is not supported, the agent asks you to paste the URL in chat and passes it along.
4. The server fetches, parses, and fully dereferences the spec (all `$ref` pointers resolved) — the full JSON never enters the agent's context.
5. All other tools query the parsed spec in memory.

## Requirements

- Node.js 18+
- An MCP-compatible client (Cursor, Claude Desktop, etc.)

## Tech stack

- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server framework (stdio transport)
- [`@apidevtools/swagger-parser`](https://github.com/APIDevTools/swagger-parser) — OpenAPI parsing and `$ref` resolution
- [`zod`](https://zod.dev) — Input schema validation
- TypeScript, Node.js 18+
