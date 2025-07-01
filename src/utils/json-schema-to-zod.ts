/**
 * @fileoverview JSON Schema to Zod converter utility
 * @module utils/json-schema-to-zod
 * @since 1.0.0
 * 
 * @remarks
 * This module provides a converter from JSON Schema to Zod schemas, specifically
 * tailored for Model Context Protocol (MCP) tool definitions. It supports a subset
 * of JSON Schema features commonly used in MCP tools.
 * 
 * @example
 * ```typescript
 * import { jsonSchemaToZod } from './utils/json-schema-to-zod';
 * 
 * const jsonSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *     active: { type: 'boolean', default: true }
 *   },
 *   required: ['name']
 * };
 * 
 * const zodSchema = jsonSchemaToZod(jsonSchema);
 * const result = zodSchema.parse({ name: 'John', age: 30 });
 * ```
 */

import { z } from 'zod';

/**
 * JSON Schema type definition for type safety
 * @internal
 */
interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  default?: any;
}

/**
 * Convert JSON Schema to Zod schema
 * 
 * @param schema - The JSON Schema object to convert
 * @returns A Zod schema that validates according to the JSON Schema rules
 * @since 1.0.0
 * 
 * @remarks
 * This converter supports:
 * - Basic types: string, number, boolean, object, array
 * - Object properties with required/optional fields
 * - Default values
 * - String enums
 * - Nested schemas
 * 
 * Limitations:
 * - Does not support all JSON Schema features
 * - Designed specifically for MCP tool input schemas
 * - Complex validators (patterns, formats) are not supported
 * 
 * @example
 * ```typescript
 * // Simple type
 * const stringSchema = jsonSchemaToZod({ type: 'string' });
 * 
 * // Object with required and optional fields
 * const objSchema = jsonSchemaToZod({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'string' },
 *     count: { type: 'number', default: 0 }
 *   },
 *   required: ['id']
 * });
 * 
 * // Enum
 * const enumSchema = jsonSchemaToZod({
 *   type: 'string',
 *   enum: ['active', 'inactive', 'pending']
 * });
 * ```
 */
export function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') {
    return z.any();
  }

  if (schema.type === 'object' && schema.properties) {
    const shape: Record<string, z.ZodTypeAny> = {};
    
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      let zodType = jsonSchemaToZod(propSchema as any);
      
      if ((propSchema as any).default !== undefined) {
        zodType = zodType.default((propSchema as any).default);
      }
      
      if (!schema.required?.includes(key)) {
        zodType = zodType.optional();
      }
      
      shape[key] = zodType;
    }
    
    return z.object(shape);
  }
  
  if (schema.type === 'string') {
    if (schema.enum) {
      return z.enum(schema.enum as [string, ...string[]]);
    }
    return z.string();
  }
  
  if (schema.type === 'boolean') {
    return z.boolean();
  }
  
  if (schema.type === 'number') {
    return z.number();
  }
  
  if (schema.type === 'array') {
    return z.array(jsonSchemaToZod(schema.items || {}));
  }
  
  return z.any();
}