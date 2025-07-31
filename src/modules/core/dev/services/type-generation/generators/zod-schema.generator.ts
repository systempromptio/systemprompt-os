/**
 * Zod Schema Generator Module
 * Generates Zod schemas for module types
 * @module dev/services/type-generation/generators
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import { TypeScriptParser } from '../parsers/typescript.parser';
import { TypeConverter } from '../utils/type-converter';
import { StringUtils } from '../utils/string-utils';
import type { InterfaceField } from '../types';

/**
 * Generates Zod schemas for modules
 */
export class ZodSchemaGenerator {
  private readonly tsParser: TypeScriptParser;
  private readonly typeConverter: TypeConverter;
  private readonly stringUtils: StringUtils;

  constructor(private readonly logger: ILogger) {
    this.tsParser = new TypeScriptParser();
    this.typeConverter = new TypeConverter();
    this.stringUtils = new StringUtils();
  }

  /**
   * Generate Zod schemas for a module
   * @param moduleName - Module name
   */
  public async generate(moduleName: string): Promise<void> {
    const outputPath = join(process.cwd(), `src/modules/core/${moduleName}/types/${moduleName}.module.generated.ts`);
    const entityName = this.stringUtils.getEntityName(moduleName);
    
    let content = this.generateHeader(moduleName);
    content += this.generateImports(moduleName);
    content += this.generateMainSchema(entityName, moduleName);
    content += await this.generateCreateUpdateSchemas(entityName, moduleName);
    content += this.generateTypeExports(entityName);
    
    writeFileSync(outputPath, content);
    this.logger.info(LogSource.DEV, `Generated Zod schemas for ${moduleName}`);
  }

  /**
   * Generate file header
   * @param moduleName - Module name
   * @returns Header content
   */
  private generateHeader(moduleName: string): string {
    return `// Auto-generated Zod schemas for ${moduleName} module
// Generated on: ${new Date().toISOString()}
// Do not modify this file manually - it will be overwritten

`;
  }

  /**
   * Generate imports
   * @param moduleName - Module name
   * @returns Import statements
   */
  private generateImports(moduleName: string): string {
    let imports = `import { z } from 'zod';\n`;
    
    const databaseTypesPath = join(process.cwd(), `src/modules/core/${moduleName}/types/database.generated.ts`);
    if (existsSync(databaseTypesPath)) {
      const dbContent = readFileSync(databaseTypesPath, 'utf-8');
      
      // Extract enum imports
      const enumMatches = dbContent.matchAll(/export enum (\w+)/g);
      const enums = Array.from(enumMatches).map(m => m[1]);
      
      if (enums.length > 0) {
        // Only import the schemas, not the enums themselves unless they're used
        imports += `import { ${enums.map(e => `${e}Schema`).join(', ')} } from './database.generated';\n`;
      }
      
      // Always import row schema
      imports += `import { ${this.stringUtils.toPascalCase(moduleName)}RowSchema } from './database.generated';\n`;
    }
    
    return imports;
  }

  /**
   * Generate main schema
   * @param entityName - Entity name
   * @param moduleName - Module name
   * @returns Main schema definition
   */
  private generateMainSchema(entityName: string, moduleName: string): string {
    return `
// ${entityName} schema - directly use database row schema
export const ${entityName}Schema = ${this.stringUtils.toPascalCase(moduleName)}RowSchema;

`;
  }

  /**
   * Generate create/update schemas
   * @param entityName - Entity name
   * @param moduleName - Module name
   * @returns Schema definitions
   */
  private async generateCreateUpdateSchemas(entityName: string, moduleName: string): Promise<string> {
    const databaseTypesPath = join(process.cwd(), `src/modules/core/${moduleName}/types/database.generated.ts`);
    
    if (!existsSync(databaseTypesPath)) {
      this.logger.warn(LogSource.DEV, `Database types not found for ${moduleName}, skipping create/update schemas`);
      return '';
    }
    
    const dbContent = readFileSync(databaseTypesPath, 'utf-8');
    
    // Extract the interface definition
    const interfaceMatch = dbContent.match(/export interface I(\w+)Row\s*\{([^}]+)\}/s);
    if (!interfaceMatch) {
      this.logger.warn(LogSource.DEV, `Could not find interface definition in ${databaseTypesPath}`);
      return '';
    }
    
    // Parse the fields
    const fields = this.tsParser.parseInterfaceFields(interfaceMatch[2] || '');
    
    // Fields to exclude from create/update operations
    const excludeFromCreate = ['id', 'created_at', 'updated_at', 'deleted_at'];
    const excludeFromUpdate = ['id', 'created_at', 'updated_at', 'deleted_at'];
    
    const createFields = fields.filter(f => !excludeFromCreate.includes(f.name));
    const updateFields = fields.filter(f => !excludeFromUpdate.includes(f.name));
    
    let schemas = '';
    
    // Generate create schema
    schemas += this.generateZodObjectSchema(`${entityName}CreateDataSchema`, createFields, moduleName);
    
    // Generate update schema (all fields optional)
    const updateFieldsOptional = updateFields.map(f => ({ ...f, optional: true }));
    schemas += this.generateZodObjectSchema(`${entityName}UpdateDataSchema`, updateFieldsOptional, moduleName);
    
    return schemas;
  }

  /**
   * Generate Zod object schema
   * @param schemaName - Schema name
   * @param fields - Interface fields
   * @param moduleName - Module name
   * @returns Schema definition
   */
  private generateZodObjectSchema(schemaName: string, fields: InterfaceField[], moduleName: string): string {
    let schema = `export const ${schemaName} = z.object({\n`;
    
    fields.forEach(field => {
      let zodType = this.typeConverter.typeToZodType(field.type, field.name, moduleName);
      
      if (field.nullable && !field.optional) {
        zodType += '.nullable()';
      } else if (field.nullable && field.optional) {
        zodType += '.nullable().optional()';
      } else if (field.optional) {
        zodType += '.optional()';
      }
      
      schema += `  ${field.name}: ${zodType},\n`;
    });
    
    schema += `});\n\n`;
    return schema;
  }

  /**
   * Generate type exports
   * @param entityName - Entity name
   * @returns Type export statements
   */
  private generateTypeExports(entityName: string): string {
    return `// Type inference from schemas
export type ${entityName} = z.infer<typeof ${entityName}Schema>;
export type ${entityName}CreateData = z.infer<typeof ${entityName}CreateDataSchema>;
export type ${entityName}UpdateData = z.infer<typeof ${entityName}UpdateDataSchema>;

// Domain type aliases for easier imports
export type I${entityName} = ${entityName};
export type I${entityName}CreateData = ${entityName}CreateData;
export type I${entityName}UpdateData = ${entityName}UpdateData;
`;
  }
}