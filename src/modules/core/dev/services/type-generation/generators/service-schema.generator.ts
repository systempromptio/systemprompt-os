/**
 * Service Schema Generator Module
 * Generates Zod schemas for service methods.
 * @module dev/services/type-generation/generators
 */

import {
 existsSync, writeFileSync
} from 'fs';
import { join } from 'path';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import { TypeScriptParser } from '@/modules/core/dev/services/type-generation/parsers/typescript.parser';
import { TypeConverter } from '@/modules/core/dev/services/type-generation/utils/type-converter';
import { StringUtils } from '@/modules/core/dev/services/type-generation/utils/string-utils';
import type { ServiceInfo } from '@/modules/core/dev/services/type-generation/types';

/**
 * Generates service schemas for modules.
 */
export class ServiceSchemaGenerator {
  private readonly tsParser: TypeScriptParser;
  private readonly typeConverter: TypeConverter;
  private readonly stringUtils: StringUtils;

  constructor(private readonly logger: ILogger) {
    this.tsParser = new TypeScriptParser();
    this.typeConverter = new TypeConverter();
    this.stringUtils = new StringUtils();
  }

  /**
   * Generate service schemas for a module.
   * @param moduleName - Module name.
   */
  public async generate(moduleName: string): Promise<void> {
    const servicePath = join(process.cwd(), `src/modules/core/${moduleName}/services/${moduleName}.service.ts`);
    const outputPath = join(process.cwd(), `src/modules/core/${moduleName}/types/${moduleName}.service.generated.ts`);

    if (!existsSync(servicePath)) {
      this.logger.info(LogSource.DEV, `No service found for module ${moduleName}, skipping service schema generation`);
      return;
    }

    const serviceInfo = await this.tsParser.parseServiceFile(servicePath, moduleName);
    if (!serviceInfo) {
      this.logger.warn(LogSource.DEV, `Could not parse service for ${moduleName}`);
      return;
    }

    const content = this.generateContent(serviceInfo, moduleName);
    writeFileSync(outputPath, content);

    this.logger.info(LogSource.DEV, `Generated service schemas for ${moduleName}`);
  }

  /**
   * Generate service schema content.
   * @param serviceInfo - Service information.
   * @param moduleName - Module name.
   * @returns Generated content.
   */
  private generateContent(serviceInfo: ServiceInfo, moduleName: string): string {
    const entityName = this.stringUtils.getEntityName(moduleName);
    const usedSchemas = new Set<string>();

    let content = this.generateHeader(moduleName);
    const serviceSchema = this.generateServiceSchema(serviceInfo, moduleName, usedSchemas);
    const moduleExportsSchema = this.generateModuleExportsSchema(moduleName, serviceInfo.name);
    const moduleSchema = this.generateModuleSchema(moduleName);
    const typeExports = this.generateTypeExports(moduleName, serviceInfo.name);

    const moduleSchemaPath = join(process.cwd(), `src/modules/core/${moduleName}/types/${moduleName}.module.generated.ts`);
    const hasModuleSchemas = existsSync(moduleSchemaPath);

    content += this.generateImports(moduleName, entityName, usedSchemas, hasModuleSchemas);
    content += serviceSchema;
    content += moduleExportsSchema;
    content += moduleSchema;
    content += typeExports;

    return content;
  }

  /**
   * Generate file header.
   * @param moduleName - Module name.
   * @returns Header content.
   */
  private generateHeader(moduleName: string): string {
    return `// Auto-generated service schemas for ${moduleName} module
// Generated on: ${new Date().toISOString()}
// Do not modify this file manually - it will be overwritten

`;
  }

  /**
   * Generate imports.
   * @param moduleName - Module name.
   * @param entityName - Entity name.
   * @param usedSchemas - Set of actually used schemas.
   * @param hasModuleSchemas
   * @returns Import statements.
   */
  private generateImports(moduleName: string, entityName: string, usedSchemas: Set<string>, hasModuleSchemas: boolean): string {
    let imports = `import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/manual';
`;

    if (hasModuleSchemas && usedSchemas.size > 0) {
      const schemasToImport = [];
      if (usedSchemas.has(`${entityName}Schema`)) { schemasToImport.push(`${entityName}Schema`); }
      if (usedSchemas.has(`${entityName}CreateDataSchema`)) { schemasToImport.push(`${entityName}CreateDataSchema`); }
      if (usedSchemas.has(`${entityName}UpdateDataSchema`)) { schemasToImport.push(`${entityName}UpdateDataSchema`); }

      if (schemasToImport.length > 0) {
        imports += `import { ${schemasToImport.join(', ')} } from './${moduleName}.module.generated';\n`;
      }
    }

    imports += '\n';
    return imports;
  }

  /**
   * Generate service schema.
   * @param serviceInfo - Service information.
   * @param moduleName - Module name.
   * @param usedSchemas - Set to track used schemas.
   * @returns Service schema definition.
   */
  private generateServiceSchema(serviceInfo: ServiceInfo, moduleName: string, usedSchemas: Set<string>): string {
    let schema = `// Zod schema for ${serviceInfo.name}
export const ${serviceInfo.name}Schema = z.object({
`;

    serviceInfo.methods.forEach(method => {
      schema += `  ${method.name}: z.function()`;

      if (method.params.length > 0) {
        schema += '\n    .args(';
        const paramSchemas = method.params.map(param => {
          const paramSchema = this.typeConverter.typeToZodSchema(param.type, param.name, moduleName);
          const entityName = this.stringUtils.getEntityName(moduleName);
          if (paramSchema === `${entityName}Schema`) { usedSchemas.add(`${entityName}Schema`); }
          if (paramSchema === `${entityName}CreateDataSchema`) { usedSchemas.add(`${entityName}CreateDataSchema`); }
          if (paramSchema === `${entityName}UpdateDataSchema`) { usedSchemas.add(`${entityName}UpdateDataSchema`); }
          return paramSchema;
        });
        schema += paramSchemas.join(', ');
        schema += ')';
      } else {
        schema += '\n    .args()';
      }

      const returnSchema = this.typeConverter.typeToZodSchema(method.returnType, 'return', moduleName);
      const entityName = this.stringUtils.getEntityName(moduleName);
      if (returnSchema.includes(`${entityName}Schema`)) { usedSchemas.add(`${entityName}Schema`); }
      if (returnSchema.includes(`${entityName}CreateDataSchema`)) { usedSchemas.add(`${entityName}CreateDataSchema`); }
      if (returnSchema.includes(`${entityName}UpdateDataSchema`)) { usedSchemas.add(`${entityName}UpdateDataSchema`); }

      schema += `\n    .returns(${returnSchema}),\n`;
    });

    schema += `});

`;

    return schema;
  }

  /**
   * Generate module exports schema.
   * @param moduleName - Module name.
   * @param serviceName - Service name.
   * @returns Module exports schema definition.
   */
  private generateModuleExportsSchema(moduleName: string, serviceName: string): string {
    return `// Zod schema for I${this.stringUtils.toPascalCase(moduleName)}ModuleExports
export const ${this.stringUtils.toPascalCase(moduleName)}ModuleExportsSchema = z.object({
  service: z.function().returns(${serviceName}Schema)
});

`;
  }

  /**
   * Generate module schema.
   * @param moduleName - Module name.
   * @returns Module schema definition.
   */
  private generateModuleSchema(moduleName: string): string {
    return `// Zod schema for complete module
export const ${this.stringUtils.toPascalCase(moduleName)}ModuleSchema = createModuleSchema(${this.stringUtils.toPascalCase(moduleName)}ModuleExportsSchema).extend({
  name: z.literal('${moduleName}'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

`;
  }

  /**
   * Generate type exports.
   * @param moduleName - Module name.
   * @param serviceName - Service name.
   * @returns Type export statements.
   */
  private generateTypeExports(moduleName: string, serviceName: string): string {
    return `// TypeScript interfaces inferred from schemas
export type I${serviceName} = z.infer<typeof ${serviceName}Schema>;
export type I${this.stringUtils.toPascalCase(moduleName)}ModuleExports = z.infer<typeof ${this.stringUtils.toPascalCase(moduleName)}ModuleExportsSchema>;
`;
  }
}
