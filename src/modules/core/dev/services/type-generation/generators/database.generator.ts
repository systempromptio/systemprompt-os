/**
 * Database Type Generator Module
 * Generates TypeScript types from SQL schema files
 * @module dev/services/type-generation/generators
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import { SQLParser } from '../parsers/sql.parser';
import { TypeConverter } from '../utils/type-converter';
import { StringUtils } from '../utils/string-utils';
import type { Table } from '../types';

/**
 * Generates TypeScript types from database schemas
 */
export class DatabaseGenerator {
  private readonly sqlParser: SQLParser;
  private readonly typeConverter: TypeConverter;
  private readonly stringUtils: StringUtils;

  constructor(private readonly logger: ILogger) {
    this.sqlParser = new SQLParser();
    this.typeConverter = new TypeConverter();
    this.stringUtils = new StringUtils();
  }

  /**
   * Generate database types for a module
   * @param moduleName - Module name
   */
  public async generate(moduleName: string): Promise<void> {
    const schemaPath = join(process.cwd(), `src/modules/core/${moduleName}/database/schema.sql`);
    const outputPath = join(process.cwd(), `src/modules/core/${moduleName}/types/database.generated.ts`);

    if (!existsSync(schemaPath)) {
      this.logger.info(LogSource.DEV, `No schema.sql found for module ${moduleName}, skipping database type generation`);
      return;
    }

    const sql = readFileSync(schemaPath, 'utf-8');
    const tables = this.sqlParser.parseSQLSchema(sql);

    if (tables.length === 0) {
      this.logger.warn(LogSource.DEV, `No tables found in schema for module ${moduleName}`);
      return;
    }

    const content = this.generateContent(tables, moduleName);
    writeFileSync(outputPath, content);

    this.logger.info(LogSource.DEV, `Generated database types for ${moduleName}: ${tables.length} tables`);
  }

  /**
   * Generate TypeScript content from tables
   * @param tables - Array of table definitions
   * @param moduleName - Module name
   * @returns Generated TypeScript content
   */
  private generateContent(tables: Table[], moduleName: string): string {
    let content = `// Auto-generated database types for ${moduleName} module\n`;
    content += `// Generated on: ${new Date().toISOString()}\n`;
    content += `// Do not modify this file manually - it will be overwritten\n\n`;
    content += `import { z } from 'zod';\n\n`;
    
    // Generate enums from CHECK constraints
    const allEnums: string[] = [];
    const allZodEnumSchemas: string[] = [];
    
    for (const table of tables) {
      for (const constraint of table.checkConstraints) {
        const enumName = `${this.stringUtils.toPascalCase(table.name)}${this.stringUtils.toPascalCase(constraint.columnName)}`;
        const enumValues = constraint.values
          .map(value => `  ${value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')} = '${value}'`)
          .join(',\n');
        
        allEnums.push(`export enum ${enumName} {\n${enumValues}\n}`);
        allZodEnumSchemas.push(`export const ${enumName}Schema = z.nativeEnum(${enumName});`);
      }
    }
    
    if (allEnums.length > 0) {
      content += '// Enums generated from CHECK constraints\n';
      content += `${allEnums.join('\n\n')}\n\n`;
      content += '// Zod schemas for enums\n';
      content += `${allZodEnumSchemas.join('\n')}\n\n`;
    }
    
    // Generate interfaces and schemas for tables
    for (const table of tables) {
      content += `${this.generateTableInterface(table)}\n`;
    }
    
    // Generate Zod schemas
    content += '// Zod schemas for database row validation\n';
    for (const table of tables) {
      content += `${this.generateTableZodSchema(table)}\n`;
    }
    
    // Add utility types
    content += this.generateUtilityTypes(tables, moduleName);
    
    return content;
  }

  /**
   * Generate TypeScript interface for a table
   * @param table - Table definition
   * @returns Interface definition
   */
  private generateTableInterface(table: Table): string {
    const interfaceName = `I${this.stringUtils.toPascalCase(table.name)}Row`;
    
    let content = `/**\n * Generated from database table: ${table.name}\n * Do not modify this file manually - it will be overwritten\n */\nexport interface ${interfaceName} {\n`;
    
    for (const column of table.columns) {
      const constraint = table.checkConstraints.find(c => c.columnName === column.name);
      const tsType = constraint 
        ? `${this.stringUtils.toPascalCase(table.name)}${this.stringUtils.toPascalCase(constraint.columnName)}`
        : this.typeConverter.sqlToTypeScript(column.type);
      
      const nullableSuffix = column.nullable ? ' | null' : '';
      content += `  ${column.name}: ${tsType}${nullableSuffix};\n`;
    }
    
    content += '}\n';
    return content;
  }

  /**
   * Generate Zod schema for a table
   * @param table - Table definition
   * @returns Zod schema definition
   */
  private generateTableZodSchema(table: Table): string {
    const schemaName = `${this.stringUtils.toPascalCase(table.name)}RowSchema`;
    
    let content = `export const ${schemaName} = z.object({\n`;
    
    for (const column of table.columns) {
      const constraint = table.checkConstraints.find(c => c.columnName === column.name);
      
      let zodType;
      if (constraint) {
        const enumName = `${this.stringUtils.toPascalCase(table.name)}${this.stringUtils.toPascalCase(constraint.columnName)}`;
        zodType = `z.nativeEnum(${enumName})`;
      } else {
        zodType = this.typeConverter.sqlToZodType(column.type, column.name);
      }
      
      if (column.nullable) {
        zodType += '.nullable()';
      }
      
      content += `  ${column.name}: ${zodType},\n`;
    }
    
    content += '});\n';
    return content;
  }

  /**
   * Generate utility types for the module
   * @param tables - Array of table definitions
   * @param moduleName - Module name
   * @returns Utility type definitions
   */
  private generateUtilityTypes(tables: Table[], moduleName: string): string {
    let content = '';
    
    // Union type of all row types
    const rowTypes = tables.map(t => `I${this.stringUtils.toPascalCase(t.name)}Row`).join(' | ');
    if (rowTypes) {
      content += `/**\n * Union type of all database row types in this module\n */\n`;
      content += `export type ${this.stringUtils.toPascalCase(moduleName)}DatabaseRow = ${rowTypes};\n\n`;
    }
    
    // Union Zod schema
    const zodSchemas = tables.map(t => `${this.stringUtils.toPascalCase(t.name)}RowSchema`);
    if (zodSchemas.length > 1) {
      content += `/**\n * Union Zod schema for all database row types in this module\n */\n`;
      content += `export const ${this.stringUtils.toPascalCase(moduleName)}DatabaseRowSchema = z.union([${zodSchemas.join(', ')}]);\n\n`;
    } else if (zodSchemas.length === 1) {
      content += `/**\n * Zod schema for database row type in this module\n */\n`;
      content += `export const ${this.stringUtils.toPascalCase(moduleName)}DatabaseRowSchema = ${zodSchemas[0]};\n\n`;
    }
    
    // Table name constants
    content += `/**\n * Database table names for this module\n */\n`;
    content += `export const ${moduleName.toUpperCase()}_TABLES = {\n`;
    for (const table of tables) {
      content += `  ${table.name.toUpperCase()}: '${table.name}',\n`;
    }
    content += '} as const;\n';
    
    return content;
  }
}