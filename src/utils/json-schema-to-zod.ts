/**
 * JSON Schema to Zod converter utility.
 * Provides functions to convert JSON Schema objects to equivalent Zod schemas.
 * @file JSON Schema to Zod converter utility.
 * @module src/utils/json-schema-to-zod
 */

import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';

type ValidJSONSchema7 = NonNullable<JSONSchema7> & { [key: string]: unknown };

/**
 * Type guard to check if schema is a valid object.
 * @param schema - The schema to check.
 * @returns True if schema is a valid object.
 */
const isValidSchema = (schema: JSONSchema7): schema is ValidJSONSchema7 => {
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

  if (stringValues.length === 0) {
    throw new Error('Cannot create enum from empty array');
  }

  const [first, ...rest] = stringValues;
  if (first === undefined) {
    throw new Error('First enum value cannot be undefined');
  }

  return z.enum([first, ...rest]);
};

/**
 * Creates a union of literals from enum values.
 * @param enumValues - Array of enum values.
 * @returns Zod union schema.
 */
const createLiteralUnion = (
  enumValues: unknown[]
): z.ZodTypeAny => {
  if (enumValues.length === 0) {
    throw new Error('Cannot create union from empty array');
  }

  const literals = enumValues.map((value: unknown) => {
    if (value === null || value === undefined
        || typeof value === 'string' || typeof value === 'number'
        || typeof value === 'boolean') {
      return z.literal(value);
    }
    return z.literal(String(value));
  });

  const [first, ...rest] = literals;
  if (first === undefined) {
    throw new Error('First literal value cannot be undefined');
  }

  if (rest.length === 0) {
    return first;
  }
  return z.union([first, ...rest] as unknown as readonly [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
};

/**
 * Handles enum type schemas.
 * @param schema - The schema to process.
 * @returns Zod enum or union schema.
 */
const handleEnumType = (schema: ValidJSONSchema7): z.ZodType => {
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
export const JSONSchema7ToZod = (schema: JSONSchema7): z.ZodType => {
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
    const itemsProperty = schema.items as JSONSchema7;
    if (itemsProperty !== null && itemsProperty !== undefined) {
      return z.array(JSONSchema7ToZod(itemsProperty));
    }
    return z.array(z.any());
  }

  if (schema.type === 'object' || schema.properties !== undefined) {
    const propertiesObj = (schema.properties as Record<string, JSONSchema7>) ?? {};
    const requiredArray = (schema.required as string[]) ?? [];
    const zodShape: Record<string, z.ZodType> = {};

    Object.entries(propertiesObj).forEach(([key, propSchema]: [string, JSONSchema7]): void => {
      let zodProp = JSONSchema7ToZod(propSchema);

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
