# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-24

### Added
- Initial release
- `load_spec` — fetch and dereference an OpenAPI/Swagger spec from a URL or local file path. Supports Swagger 2.0, OpenAPI 3.0, and 3.1 (JSON or YAML). Uses MCP form elicitation to prompt the user for the URL so the agent never needs to supply or fetch it directly. Falls back to requesting the URL in chat when the client does not support interactive input.
- `get_endpoints` — list all endpoints grouped by tag with HTTP method, path, and summary
- `get_endpoint_detail` — full operation detail including parameters, request body, responses, and auth requirements
- `get_schemas` — list all named schemas/components with type and property count
- `get_schema_detail` — full expanded schema with all `$ref` references resolved
- `search_endpoints` — full-text search across paths, summaries, descriptions, and tags
- `get_endpoints_by_tag` — filter endpoints by tag
- `get_auth_schemes` — security schemes and which endpoints require them
- `get_servers` — base URLs and environments defined in the spec
- `get_request_example` — generate an example request body from the schema
- `get_response_example` — generate an example response body for a given status code
