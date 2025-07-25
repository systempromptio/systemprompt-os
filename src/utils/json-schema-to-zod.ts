/**
 * JSON Schema to Zod converter utility.
 * Provides functions to convert JSON Schema objects to equivalent Zod schemas.
 * @file JSON Schema to Zod converter utility.
 * @module src/utils/json-schema-to-zod
 */

import { z } from 'zod';
import type { JsonSchema } from '@/utils/types';

type ValidJsonSchema = NonNullable<JsonSchema> & { [key: string]: unknown };

/**
 * Type guard to check if schema is a valid object.
 * @param schema - The schema to check.
 * @returns True if schema is a valid object.
 */
const isValidSchema = (schema: JsonSchema): schema is ValidJsonSchema => {
  return schema !== null && schema !== undefined && typeof schema === 'object';
};

/**
 * Creates a string enum from enum values.
 * @param enumValues - Array of enum values.
 * @returns Zod enum schema.
 */
const createStringEnum = (enumValues: unknown[]): z.ZodEnum<[string, ...string[]]> => {
  const stringValues = enumValues.filter((value): value is string => {
    return typeof value === 'string';
  });
  const [first, ...rest] = stringValues;
  return z.enum([first, ...rest]);
};

/**
 * Creates a union of literals from enum values.
 * @param enumValues - Array of enum values.
 * @returns Zod union schema.
 */
const createLiteralUnion = (
  enumValues: unknown[]
): z.ZodUnion<[z.ZodLiteral<unknown>, ...z.ZodLiteral<unknown>[]]> => {
  const literals = enumValues.map((value: unknown): z.ZodLiteral<unknown> => {
    return z.literal(value);
  });
  const [first, ...rest] = literals;
  return z.union([first, ...rest]);
};

/**
 * Handles enum type schemas.
 * @param schema - The schema to process.
 * @returns Zod enum or union schema.
 */
const handleEnumType = (schema: ValidJsonSchema): z.ZodType => {
  const enumProperty = schema.enum;
  if (!Array.isArray(enumProperty)) {
    return z.any();
  }

  if (schema.type === 'string') {
    return createStringEnum(enumProperty);
  }
  return createLiteralUnion(enumProperty);
};

/**
 * Converts a JSON Schema object to a Zod schema.
 * @param schema - The JSON Schema object to convert.
 * @returns A Zod schema equivalent to the JSON Schema.
 */
export const jsonSchemaToZod = (schema: JsonSchema): z.ZodType => {
  if (!isValidSchema(schema)) {
    return z.any();
  }

  const enumProperty = schema.enum;
  if (Array.isArray(enumProperty)) {
    return handleEnumType(schema);
  }

  if (schema.type === 'string') {
    return z.string();
  }

  if (schema.type === 'number') {
    return z.number();
  }

  if (schema.type === 'boolean') {
    return z.boolean();
  }

  if (schema.type === 'array') {
    const itemsProperty = schema.items as JsonSchema;
    if (itemsProperty !== null && itemsProperty !== undefined) {
      return z.array(jsonSchemaToZod(itemsProperty));
    }
    return z.array(z.any());
  }

  if (schema.type === 'object' || schema.properties !== undefined) {
    const propertiesObj = (schema.properties as Record<string, JsonSchema>) ?? {};
    const requiredArray = (schema.required as string[]) ?? [];
    const zodShape: Record<string, z.ZodType> = {};

    Object.entries(propertiesObj).forEach(([key, propSchema]: [string, JsonSchema]): void => {
      let zodProp = jsonSchemaToZod(propSchema);

      if (!requiredArray.includes(key)) {
        zodProp = zodProp.optional();
      }

      zodShape[key] = zodProp;
    });

    const objectSchema = z.object(zodShape);

    if (Object.keys(propertiesObj).length === 0) {
      return objectSchema.passthrough();
    }

    return objectSchema;
  }

  return z.any();
};
