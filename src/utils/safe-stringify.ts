/**
 * JSON.stringify that handles circular references produced by SwaggerParser.dereference().
 * Circular nodes are replaced with the string "[Circular]".
 */
export function safeStringify(value: unknown, indent = 2): string {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    },
    indent,
  );
}
