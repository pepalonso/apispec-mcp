type Schema = Record<string, unknown>;

const FORMAT_EXAMPLES: Record<string, unknown> = {
  "date-time": "2026-01-15T09:30:00Z",
  date: "2026-01-15",
  time: "09:30:00Z",
  email: "user@example.com",
  uri: "https://example.com",
  url: "https://example.com",
  hostname: "example.com",
  ipv4: "192.168.1.1",
  ipv6: "::1",
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  byte: "U3dhZ2dlcg==",
  binary: "<binary>",
  password: "********",
  phone: "+1-555-555-5555",
};

export function generateExample(schema: Schema, depth = 0): unknown {
  if (depth > 10) return {};

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Handle oneOf/anyOf by picking the first option
  const composite = (schema.oneOf ?? schema.anyOf) as Schema[] | undefined;
  if (composite && composite.length > 0) {
    return generateExample(composite[0], depth + 1);
  }

  // Handle allOf by merging
  const allOf = schema.allOf as Schema[] | undefined;
  if (allOf && allOf.length > 0) {
    const merged: Record<string, unknown> = {};
    for (const sub of allOf) {
      const val = generateExample(sub, depth + 1);
      if (val && typeof val === "object" && !Array.isArray(val)) {
        Object.assign(merged, val);
      }
    }
    return merged;
  }

  const type = schema.type as string | undefined;

  if (type === "object" || schema.properties) {
    const properties = (schema.properties ?? {}) as Record<string, Schema>;
    const result: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(properties)) {
      result[key] = generateExample(propSchema, depth + 1);
    }
    return result;
  }

  if (type === "array") {
    const itemSchema = schema.items as Schema | undefined;
    if (itemSchema) {
      return [generateExample(itemSchema, depth + 1)];
    }
    return [];
  }

  if (type === "string") {
    const format = schema.format as string | undefined;
    if (format && format in FORMAT_EXAMPLES) {
      return FORMAT_EXAMPLES[format];
    }
    if (schema.minLength && typeof schema.minLength === "number") {
      return "a".repeat(schema.minLength);
    }
    return "string";
  }

  if (type === "integer") {
    if (typeof schema.minimum === "number") return schema.minimum;
    return 0;
  }

  if (type === "number") {
    if (typeof schema.minimum === "number") return schema.minimum;
    return 0.0;
  }

  if (type === "boolean") {
    return false;
  }

  if (type === "null") {
    return null;
  }

  return {};
}
