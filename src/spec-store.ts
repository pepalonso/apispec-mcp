import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export type OpenAPISpec = OpenAPI.Document;
export type PathItemObject =
  | OpenAPIV2.PathItemObject
  | OpenAPIV3.PathItemObject
  | OpenAPIV3_1.PathItemObject;

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface EndpointInfo {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags: string[];
  deprecated?: boolean;
}

let currentSpec: OpenAPISpec | null = null;
let currentSpecUrl: string | null = null;

export async function loadSpec(url: string): Promise<{
  title: string;
  version: string;
  endpointCount: number;
  schemaCount: number;
}> {
  const api = await SwaggerParser.dereference(url);
  currentSpec = api as OpenAPISpec;
  currentSpecUrl = url;

  const title = api.info?.title ?? "Untitled API";
  const version = api.info?.version ?? "unknown";
  const endpoints = getAllEndpoints();
  const schemas = getSchemaNames();

  return {
    title,
    version,
    endpointCount: endpoints.length,
    schemaCount: schemas.length,
  };
}

export function getSpec(): OpenAPISpec {
  if (!currentSpec) {
    throw new Error(
      "No spec loaded. Call load_spec first with a URL or file path to an OpenAPI/Swagger spec.",
    );
  }
  return currentSpec;
}

export function getSpecUrl(): string | null {
  return currentSpecUrl;
}

export function isV2(spec: OpenAPISpec): spec is OpenAPIV2.Document {
  return "swagger" in spec;
}

export function getAllEndpoints(): EndpointInfo[] {
  const spec = getSpec();
  const paths = spec.paths ?? {};
  const endpoints: EndpointInfo[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | OpenAPIV3.OperationObject
        | undefined;
      if (!operation) continue;
      endpoints.push({
        method,
        path,
        summary: operation.summary,
        description: operation.description,
        operationId: operation.operationId,
        tags: operation.tags ?? [],
        deprecated: operation.deprecated,
      });
    }
  }

  return endpoints;
}

export function getSchemaNames(): string[] {
  const spec = getSpec();
  if (isV2(spec)) {
    return Object.keys(spec.definitions ?? {});
  }
  const v3 = spec as OpenAPIV3.Document;
  return Object.keys(v3.components?.schemas ?? {});
}

export function getSchemaByName(
  name: string,
): Record<string, unknown> | null {
  const spec = getSpec();
  let schemas: Record<string, unknown>;
  if (isV2(spec)) {
    schemas = (spec.definitions ?? {}) as Record<string, unknown>;
  } else {
    const v3 = spec as OpenAPIV3.Document;
    schemas = (v3.components?.schemas ?? {}) as Record<string, unknown>;
  }
  return (schemas[name] as Record<string, unknown>) ?? null;
}

export function getOperation(
  path: string,
  method: string,
): Record<string, unknown> | null {
  const spec = getSpec();
  const pathItem = spec.paths?.[path] as Record<string, unknown> | undefined;
  if (!pathItem) return null;
  const op = pathItem[method.toLowerCase()] as
    | Record<string, unknown>
    | undefined;
  return op ?? null;
}

export function getPathItem(path: string): PathItemObject | null {
  const spec = getSpec();
  const item = spec.paths?.[path];
  return (item as PathItemObject) ?? null;
}

export function getSecuritySchemes(): Record<string, unknown> {
  const spec = getSpec();
  if (isV2(spec)) {
    return (spec.securityDefinitions ?? {}) as Record<string, unknown>;
  }
  const v3 = spec as OpenAPIV3.Document;
  return (v3.components?.securitySchemes ?? {}) as Record<string, unknown>;
}

export function getGlobalSecurity(): unknown[] {
  const spec = getSpec();
  return (spec.security as unknown[]) ?? [];
}

export function getServers(): unknown[] {
  const spec = getSpec();
  if (isV2(spec)) {
    const schemes = spec.schemes ?? ["https"];
    const host = spec.host ?? "localhost";
    const basePath = spec.basePath ?? "/";
    return schemes.map((scheme: string) => ({
      url: `${scheme}://${host}${basePath}`,
      description: `${scheme} server`,
    }));
  }
  const v3 = spec as OpenAPIV3.Document;
  return v3.servers ?? [];
}

export { HTTP_METHODS };
