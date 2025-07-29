/**
 * JSON Schema to Zod converter utility.
 * Provides functions to convert JSON Schema objects to equivalent Zod schemas.
 * @file JSON Schema to Zod converter utility.
 * @module src/utils/json-schema-to-zod
 */

import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';

import type { ValidJSONSchema7 } from '@/utils/types/json-schema.types';

/**
 * Type guard to check if schema is a valid object.
 * @param schema - The schema to check.
 * @returns True if schema is a valid object.
 */
const isValidSchema = (schema: JSONSchema7): schema is ValidJSONSchema7 => {
  return Boolean(schema && typeof schema === 'object');
};

/**
 * Creates a string enum from enum values.
 * @param enumValues - Array of enum values.
 * @returns Zod enum schema.
 * @throws Error when enum array is empty or has no valid string values.
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
 * @throws Error when enum array is empty or first value is undefined.
 */
const createLiteralUnion = (
  enumValues: unknown[]
): z.ZodTypeAny => {
  if (enumValues.length === 0) {
    throw new Error('Cannot create union from empty array');
  }

  const literals = enumValues.map((value: unknown): z.ZodTypeAny => {
    if (value === null || value === undefined
        || typeof value === 'string' || typeof value === 'number'
        || typeof value === 'boolean') {
      return z.literal(value);
    }
    if (value !== null && typeof value === 'object') {
      try {
        return z.literal(JSON.stringify(value));
      } catch {
        return z.literal(String(value));
      }
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
  if (rest.length === 1 && rest[0] !== undefined) {
    return z.union([first, rest[0]]);
  }
  if (rest.length > 1 && rest[0] !== undefined) {
    return z.union([first, rest[0], ...rest.slice(1)]);
  }
  return first;
};

/**
 * Handles enum type schemas.
 * @param schema - The schema to process.
 * @returns Zod enum or union schema.
 */
const handleEnumType = (schema: ValidJSONSchema7): z.ZodTypeAny => {
  const { enum: enumProperty } = schema;
  if (!Array.isArray(enumProperty)) {
    return z.any();
  }

  if (schema.type === 'string') {
    return createStringEnum(enumProperty);
  }
  return createLiteralUnion(enumProperty);
};

/**
 * Handles array type schemas.
 * @param schema - The schema to process.
 * @param converter - Function to convert nested schemas.
 * @returns Zod array schema.
 */
const handleArrayType = (
  schema: ValidJSONSchema7,
  converter: (s: JSONSchema7) => z.ZodTypeAny
): z.ZodArray<z.ZodTypeAny> => {
  if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
    return z.array(converter(schema.items));
  }
  return z.array(z.any());
};

/**
 * Handles object type schemas.
 * @param schema - The schema to process.
 * @param converter - Function to convert nested schemas.
 * @returns Zod object schema.
 */
const handleObjectType = (
  schema: ValidJSONSchema7,
  converter: (s: JSONSchema7) => z.ZodTypeAny
): z.ZodObject<Record<string, z.ZodTypeAny>> => {
  const propertiesObj = schema.properties && typeof schema.properties === 'object'
    ? schema.properties as Record<string, JSONSchema7>
    : {};
  const requiredArray = Array.isArray(schema.required) ? schema.required : [];
  const zodShape: Record<string, z.ZodTypeAny> = {};

  Object.entries(propertiesObj).forEach(([key, propSchema]: [string, JSONSchema7]): void => {
    let zodProp = converter(propSchema);

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
};

/**
 * Processes primitive types.
 * @param type - The JSON Schema type.
 * @returns Zod schema for primitives.
 */
const processPrimitiveType = (type: unknown): z.ZodTypeAny | null => {
  if (Array.isArray(type)) {
    return null;
  }
  const typeStr = type as string | undefined;
  switch (typeStr) {
    case 'string':
      return z.string();
    case 'number':
    case 'integer':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'null':
      return z.null();
    default:
      return null;
  }
};

/**
 * Converts a JSON Schema object to a Zod schema.
 * @param schema - The JSON Schema object to convert.
 * @returns A Zod schema equivalent to the JSON Schema.
 */
export const JSONSchema7ToZod = (schema: JSONSchema7): z.ZodTypeAny => {
  if (!isValidSchema(schema)) {
    return z.any();
  }

  const { enum: enumProperty } = schema;
  if (Array.isArray(enumProperty)) {
    return handleEnumType(schema);
  }

  const primitiveResult = processPrimitiveType(schema.type);
  if (primitiveResult) {
    return primitiveResult;
  }

  if (schema.type === 'array') {
    return handleArrayType(schema, JSONSchema7ToZod);
  }

  if (schema.type === 'object' || schema.properties) {
    return handleObjectType(schema, JSONSchema7ToZod);
  }

  return z.any();
};
