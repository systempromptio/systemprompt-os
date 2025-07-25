/**
 * @file JSON Schema to Zod converter utility.
 * @module src/utils/json-schema-to-zod
 */

import { z } from 'zod';

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
} | null | undefined | string;

/**
 * Converts a JSON Schema object to a Zod schema.
 * @param schema - The JSON Schema object to convert.
 * @returns A Zod schema equivalent to the JSON Schema.
 */
export function jsonSchemaToZod(schema: JsonSchema): z.ZodType {
  if (!schema || typeof schema !== 'object') {
    return z.any();
  }

  if (schema.enum && Array.isArray(schema.enum)) {
    if (schema.type === 'string') {
      return z.enum(schema.enum as [string, ...string[]]);
    }
    return z.union(schema.enum.map(value => { return z.literal(value) }) as [z.ZodLiteral<any>, ...z.ZodLiteral<any>[]]);
  }

  switch (schema.type) {
    case 'string':
      return z.string();

    case 'number':
      return z.number();

    case 'boolean':
      return z.boolean();

    case 'array':
      if (schema.items) {
        return z.array(jsonSchemaToZod(schema.items));
      }
      return z.array(z.any());

    case 'object':
      return handleObjectSchema(schema);

    default:
      if (schema.properties) {
        return handleObjectSchema(schema);
      }
      return z.any();
  }
}

/**
 * Handles object schema conversion.
 * @param schema - The object schema to convert.
 * @returns A Zod object schema.
 */
function handleObjectSchema(schema: JsonSchema): z.ZodObject<any> {
  if (!schema || typeof schema !== 'object') {
    return z.object({});
  }

  const { properties = {}, required = [] } = schema;
  const zodShape: Record<string, z.ZodType> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    let zodProp = jsonSchemaToZod(propSchema);

    if (!required.includes(key)) {
      zodProp = zodProp.optional();
    }

    zodShape[key] = zodProp;
  }

  const objectSchema = z.object(zodShape);

  if (Object.keys(properties).length === 0) {
    return objectSchema.passthrough();
  }

  return objectSchema;
}
