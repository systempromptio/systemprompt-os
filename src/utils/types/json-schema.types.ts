/**
 * Represents a JSON Schema object with various properties.
 * Can be an object with schema properties, null, undefined, or a string.
 */
export type JsonSchema = {
    type?: string;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    required?: string[];
    enum?: unknown[];
    default?: unknown;
} | null | undefined | string;
