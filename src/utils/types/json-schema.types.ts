/**
 * Types for JSON Schema to Zod conversion utility.
 * @file JSON Schema types.
 * @module src/utils/types/json-schema.types
 */

import type { JSONSchema7 } from 'json-schema';

/**
 * A validated JSON Schema type that ensures the schema is not null and is an object.
 */
export type ValidJSONSchema7 = NonNullable<JSONSchema7> & { [key: string]: unknown };
