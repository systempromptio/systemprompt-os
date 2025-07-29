#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { glob } from 'glob';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
}

interface CheckConstraint {
  columnName: string;
  values: string[];
}

interface Table {
  name: string;
  columns: Column[];
  checkConstraints: CheckConstraint[];
}

class SQLTypeGenerator {
  private checkConstraints: Map<string, CheckConstraint[]> = new Map();
  private sqlToTypeScript(sqlType: string): string {
    const type = sqlType.toUpperCase();
    
    if (type.includes('TEXT') || type.includes('VARCHAR') || type.includes('CHAR')) {
      return 'string';
    }
    if (type.includes('INTEGER') || type.includes('INT') || type.includes('REAL') || type.includes('NUMERIC')) {
      return 'number';
    }
    if (type.includes('BOOLEAN') || type.includes('BOOL')) {
      return 'boolean';
    }
    if (type.includes('TIMESTAMP') || type.includes('DATETIME') || type.includes('DATE')) {
      return 'string'; // ISO date strings
    }
    if (type.includes('JSON')) {
      return 'string'; // JSON stored as string, will need parsing
    }
    
    // Default to string for unknown types
    return 'string';
  }

  private parseCreateTable(sql: string): Table[] {
    const tables: Table[] = [];
    
    // Match CREATE TABLE statements (including IF NOT EXISTS)
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)\s*\(([\s\S]*?)\);/gi;
    
    let match;
    while ((match = createTableRegex.exec(sql)) !== null) {
      const tableName = match[1].trim();
      const tableBody = match[2].trim();
      
      const columns = this.parseColumns(tableBody);
      
      if (columns.length > 0) {
        const checkConstraints = this.parseCheckConstraints(tableBody, tableName);
        tables.push({
          name: tableName,
          columns,
          checkConstraints
        });
      }
    }
    
    return tables;
  }

  private parseCheckConstraints(tableBody: string, tableName: string): CheckConstraint[] {
    const constraints: CheckConstraint[] = [];
    
    // Match CHECK constraints in column definitions
    const columnCheckRegex = /(\w+)\s+\w+\s+CHECK\s*\(\s*\1\s+IN\s*\(([^)]+)\)\s*\)/gi;
    let match;
    while ((match = columnCheckRegex.exec(tableBody)) !== null) {
      const columnName = match[1];
      const valuesStr = match[2];
      const values = valuesStr.split(',').map(v => v.trim().replace(/['"`]/g, ''));
      constraints.push({ columnName, values });
    }
    
    // Also match standalone CHECK constraints
    const standaloneCheckRegex = /CHECK\s*\((\w+)\s+IN\s*\(([^)]+)\)\s*\)/gi;
    while ((match = standaloneCheckRegex.exec(tableBody)) !== null) {
      const columnName = match[1];
      const valuesStr = match[2];
      const values = valuesStr.split(',').map(v => v.trim().replace(/['"`]/g, ''));
      
      // Avoid duplicates
      if (!constraints.some(c => c.columnName === columnName)) {
        constraints.push({ columnName, values });
      }
    }
    
    return constraints;
  }

  private parseColumns(tableBody: string): Column[] {
    const columns: Column[] = [];
    
    // Split by commas, but be careful of nested parentheses and quoted strings
    const lines = tableBody.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--') && !line.startsWith('FOREIGN KEY') && !line.startsWith('PRIMARY KEY') && !line.startsWith('UNIQUE') && !line.startsWith('CHECK') && !line.startsWith('CONSTRAINT'));
    
    for (const line of lines) {
      // Skip triggers, indexes, and other non-column definitions
      if (line.toUpperCase().includes('TRIGGER') || 
          line.toUpperCase().includes('INDEX') || 
          line.toUpperCase().includes('REFERENCES') ||
          line.startsWith(')')) {
        continue;
      }
      
      // Remove trailing comma
      const cleanLine = line.replace(/,$/, '');
      
      // Parse column definition: column_name TYPE [NOT NULL] [PRIMARY KEY] [AUTOINCREMENT] [DEFAULT ...]
      const columnMatch = cleanLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+([A-Z][A-Z0-9_]*(?:\([^)]*\))?)\s*(.*)?$/i);
      
      if (columnMatch) {
        const columnName = columnMatch[1];
        const columnType = columnMatch[2];
        const constraints = (columnMatch[3] || '').toUpperCase();
        
        const nullable = !constraints.includes('NOT NULL') && !constraints.includes('PRIMARY KEY');
        const primaryKey = constraints.includes('PRIMARY KEY');
        const autoIncrement = constraints.includes('AUTOINCREMENT');
        
        columns.push({
          name: columnName,
          type: columnType,
          nullable,
          primaryKey,
          autoIncrement
        });
      }
    }
    
    return columns;
  }

  private generateInterface(table: Table): string {
    const interfaceName = `I${this.toPascalCase(table.name)}Row`;
    
    let interfaceContent = `/**\n * Generated from database table: ${table.name}\n * Do not modify this file manually - it will be overwritten\n */\nexport interface ${interfaceName} {\n`;
    
    for (const column of table.columns) {
      // Check if this column has a CHECK constraint enum
      const constraint = table.checkConstraints.find(c => c.columnName === column.name);
      const tsType = constraint 
        ? `${this.toPascalCase(table.name)}${this.toPascalCase(constraint.columnName)}`
        : this.sqlToTypeScript(column.type);
      
      const nullableSuffix = column.nullable ? ' | null' : '';
      const comment = column.type.toUpperCase().includes('JSON') ? ' // JSON string, requires parsing' : '';
      
      interfaceContent += `  ${column.name}: ${tsType}${nullableSuffix};${comment}\n`;
    }
    
    interfaceContent += '}\n';
    
    return interfaceContent;
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private generateEnumFromConstraints(table: Table): string[] {
    const enums: string[] = [];
    
    for (const constraint of table.checkConstraints) {
      const enumName = `${this.toPascalCase(table.name)}${this.toPascalCase(constraint.columnName)}`;
      const enumValues = constraint.values
        .map(value => `  ${value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')} = '${value}'`)
        .join(',\n');
      
      enums.push(`export enum ${enumName} {\n${enumValues}\n}`);
    }
    
    return enums;
  }

  private generateTypesFile(tables: Table[], moduleName: string): string {
    let content = `// Auto-generated database types for ${moduleName} module\n`;
    content += `// Generated on: ${new Date().toISOString()}\n`;
    content += `// Do not modify this file manually - it will be overwritten\n\n`;
    
    // Generate enums from CHECK constraints
    const allEnums: string[] = [];
    for (const table of tables) {
      const tableEnums = this.generateEnumFromConstraints(table);
      allEnums.push(...tableEnums);
    }
    
    if (allEnums.length > 0) {
      content += '// Enums generated from CHECK constraints\n';
      content += allEnums.join('\n\n') + '\n\n';
    }
    
    // Generate interfaces
    for (const table of tables) {
      content += this.generateInterface(table) + '\n';
    }
    
    // Add utility type for all row types in this module
    const rowTypes = tables.map(t => `I${this.toPascalCase(t.name)}Row`).join(' | ');
    if (rowTypes) {
      content += `/**\n * Union type of all database row types in this module\n */\n`;
      content += `export type ${this.toPascalCase(moduleName)}DatabaseRow = ${rowTypes};\n\n`;
    }
    
    // Add table name constants
    content += `/**\n * Database table names for this module\n */\n`;
    content += `export const ${moduleName.toUpperCase()}_TABLES = {\n`;
    for (const table of tables) {
      content += `  ${table.name.toUpperCase().replace(/_/g, '')}: '${table.name}',\n`;
    }
    content += '} as const;\n';
    
    return content;
  }

  public async generateFromSchemaFile(schemaPath: string, outputPath: string, moduleName: string): Promise<void> {
    try {
      const sql = readFileSync(schemaPath, 'utf-8');
      const tables = this.parseCreateTable(sql);
      
      if (tables.length === 0) {
        console.warn(`No tables found in schema: ${schemaPath}`);
        return;
      }
      
      const typesContent = this.generateTypesFile(tables, moduleName);
      
      // Ensure output directory exists
      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      
      writeFileSync(outputPath, typesContent);
      console.log(`✅ Generated types for ${moduleName}: ${tables.length} tables → ${outputPath}`);
      
    } catch (error) {
      console.error(`❌ Error generating types for ${schemaPath}:`, error);
      throw error;
    }
  }
}

async function main() {
  console.log('🔄 Generating database types from SQL schemas...\n');
  
  const generator = new SQLTypeGenerator();
  const baseDir = process.cwd();
  
  // Find all schema.sql files in modules
  const schemaFiles = await glob('src/modules/core/*/database/schema.sql', { cwd: baseDir });
  
  let generatedCount = 0;
  let errorCount = 0;
  
  for (const schemaFile of schemaFiles) {
    try {
      // Extract module name from path: src/modules/core/[module]/database/schema.sql
      const pathParts = schemaFile.split('/');
      const moduleName = pathParts[3]; // [module] part
      
      const schemaPath = join(baseDir, schemaFile);
      const outputPath = join(baseDir, `src/modules/core/${moduleName}/types/database.generated.ts`);
      
      await generator.generateFromSchemaFile(schemaPath, outputPath, moduleName);
      generatedCount++;
      
    } catch (error) {
      console.error(`Failed to process ${schemaFile}:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Generation complete:`);
  console.log(`   ✅ ${generatedCount} modules processed successfully`);
  if (errorCount > 0) {
    console.log(`   ❌ ${errorCount} modules had errors`);
  }
  
  // Also check for any additional SQL files that might need processing
  const additionalSqlFiles = await glob('src/modules/core/*/database/*.sql', { 
    cwd: baseDir,
    ignore: ['**/schema.sql', '**/migrations/**']
  });
  
  if (additionalSqlFiles.length > 0) {
    console.log(`\n💡 Additional SQL files found (not processed):`);
    additionalSqlFiles.forEach(file => console.log(`   - ${file}`));
  }
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run if this is the main module
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { SQLTypeGenerator };