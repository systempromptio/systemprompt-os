/**
 * Zod Schema Generator Module
 * Generates Zod schemas for module types.
 * @module dev/services/type-generation/generators
 */

import {
 existsSync, readFileSync, writeFileSync
} from 'fs';
import { join } from 'path';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import { TypeScriptParser } from '@/modules/core/dev/services/type-generation/parsers/typescript.parser';
import { TypeConverter } from '@/modules/core/dev/services/type-generation/utils/type-converter';
import { StringUtils } from '@/modules/core/dev/services/type-generation/utils/string-utils';
import type { InterfaceField } from '@/modules/core/dev/services/type-generation/types';

/**
 * Generates Zod schemas for modules.
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
   * Generate Zod schemas for a module.
   * @param moduleName - Module name.
   */
  public async generate(moduleName: string): Promise<void> {
    const outputPath = join(process.cwd(), `src/modules/core/${moduleName}/types/${moduleName}.module.generated.ts`);
    const entityName = this.stringUtils.getEntityName(moduleName);

    const usedSchemas = new Set<string>();

    let content = this.generateHeader(moduleName);
    const mainSchema = this.generateMainSchema(entityName, moduleName, usedSchemas);
    const createUpdateSchemas = await this.generateCreateUpdateSchemas(entityName, moduleName, usedSchemas);

    content += this.generateImports(moduleName, usedSchemas);
    content += mainSchema;
    content += createUpdateSchemas;
    content += this.generateTypeExports(entityName);

    writeFileSync(outputPath, content);
    this.logger.info(LogSource.DEV, `Generated Zod schemas for ${moduleName}`);
  }

  /**
   * Generate file header.
   * @param moduleName - Module name.
   * @returns Header content.
   */
  private generateHeader(moduleName: string): string {
    return `// Auto-generated Zod schemas for ${moduleName} module
// Generated on: ${new Date().toISOString()}
// Do not modify this file manually - it will be overwritten

`;
  }

  /**
   * Generate imports.
   * @param moduleName - Module name.
   * @param usedSchemas - Set of actually used schemas.
   * @returns Import statements.
   */
  private generateImports(moduleName: string, usedSchemas: Set<string>): string {
    let imports = `import { z } from 'zod';\n`;

    const databaseTypesPath = join(process.cwd(), `src/modules/core/${moduleName}/types/database.generated.ts`);
    if (existsSync(databaseTypesPath)) {
      const dbContent = readFileSync(databaseTypesPath, 'utf-8');

      const enumSchemaMatches = Array.from(dbContent.matchAll(/export const (\w+Schema) = z\.nativeEnum/g));
      const availableEnumSchemas = enumSchemaMatches.map(match => { return match[1] });

      const rowSchemaMatches = Array.from(dbContent.matchAll(/export const (\w+RowSchema) = /g));
      const availableRowSchemas = rowSchemaMatches.map(match => { return match[1] });

      const usedEnumSchemas = Array.from(usedSchemas).filter(schema =>
        { return availableEnumSchemas.includes(schema) });

      const usedRowSchemas = Array.from(usedSchemas).filter(schema =>
        { return availableRowSchemas.includes(schema) });

      const schemasToImport = [...usedEnumSchemas, ...usedRowSchemas];

      if (schemasToImport.length > 0) {
        imports += `import { ${schemasToImport.join(', ')} } from './database.generated';\n`;
      }
    }

    return imports;
  }

  /**
   * Generate main schema.
   * @param entityName - Entity name.
   * @param moduleName - Module name.
   * @param usedSchemas - Set to track used schemas.
   * @returns Main schema definition.
   */
  private generateMainSchema(entityName: string, moduleName: string, usedSchemas: Set<string>): string {
    const databaseTypesPath = join(process.cwd(), `src/modules/core/${moduleName}/types/database.generated.ts`);

    if (!existsSync(databaseTypesPath)) {
      return `
// ${entityName} schema
export const ${entityName}Schema = z.object({});

`;
    }

    const dbContent = readFileSync(databaseTypesPath, 'utf-8');

    const schemaMatches = Array.from(dbContent.matchAll(/export const (\w+RowSchema) = /g));
    const schemas = schemaMatches.map(match => { return match[1] });

    const moduleSchema = schemas.find(s => { return s?.toLowerCase().includes(moduleName.toLowerCase()) }) || schemas[0];

    if (!moduleSchema) {
      return `
// ${entityName} schema
export const ${entityName}Schema = z.object({});

`;
    }

    usedSchemas.add(moduleSchema);

    return `
// ${entityName} schema - directly use database row schema
export const ${entityName}Schema = ${moduleSchema};

`;
  }

  /**
   * Generate create/update schemas.
   * @param entityName - Entity name.
   * @param moduleName - Module name.
   * @param usedSchemas - Set to track used schemas.
   * @returns Schema definitions.
   */
  private async generateCreateUpdateSchemas(entityName: string, moduleName: string, usedSchemas: Set<string>): Promise<string> {
    const databaseTypesPath = join(process.cwd(), `src/modules/core/${moduleName}/types/database.generated.ts`);

    if (!existsSync(databaseTypesPath)) {
      this.logger.warn(LogSource.DEV, `Database types not found for ${moduleName}, skipping create/update schemas`);
      return '';
    }

    const dbContent = readFileSync(databaseTypesPath, 'utf-8');

    const interfaceMatches = Array.from(dbContent.matchAll(/export interface I(\w+)Row\s*\{([^}]+)\}/gs));

    let interfaceMatch = interfaceMatches.find(match => { return match[1]?.toLowerCase().includes(moduleName.toLowerCase()) });

    if (!interfaceMatch && interfaceMatches.length > 0) {
      interfaceMatch = interfaceMatches[0];
    }
    if (!interfaceMatch) {
      this.logger.warn(LogSource.DEV, `Could not find interface definition in ${databaseTypesPath}`);
      return '';
    }

    const fields = this.tsParser.parseInterfaceFields(interfaceMatch[2] || '');

    const excludeFromCreate = ['id', 'created_at', 'updated_at', 'deleted_at'];
    const excludeFromUpdate = ['id', 'created_at', 'updated_at', 'deleted_at'];

    const createFields = fields.filter(f => { return !excludeFromCreate.includes(f.name) });
    const updateFields = fields.filter(f => { return !excludeFromUpdate.includes(f.name) });

    let schemas = '';

    schemas += this.generateZodObjectSchema(`${entityName}CreateDataSchema`, createFields, moduleName, usedSchemas);

    const updateFieldsOptional = updateFields.map(f => { return {
 ...f,
optional: true
} });
    schemas += this.generateZodObjectSchema(`${entityName}UpdateDataSchema`, updateFieldsOptional, moduleName, usedSchemas);

    return schemas;
  }

  /**
   * Generate Zod object schema.
   * @param schemaName - Schema name.
   * @param fields - Interface fields.
   * @param moduleName - Module name.
   * @param usedSchemas - Set to track used schemas.
   * @returns Schema definition.
   */
  private generateZodObjectSchema(schemaName: string, fields: InterfaceField[], moduleName: string, usedSchemas: Set<string>): string {
    let schema = `export const ${schemaName} = z.object({\n`;

    fields.forEach(field => {
      let zodType = this.typeConverter.typeToZodType(field.type, field.name, moduleName);

      if (zodType.endsWith('Schema') && !zodType.startsWith('z.')) {
        usedSchemas.add(zodType);
      }

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
   * Generate type exports.
   * @param entityName - Entity name.
   * @returns Type export statements.
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
