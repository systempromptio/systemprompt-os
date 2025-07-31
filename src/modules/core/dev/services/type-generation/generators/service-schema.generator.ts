/**
 * Service Schema Generator Module
 * Generates Zod schemas for service methods.
 * @module dev/services/type-generation/generators
 */

import { existsSync, writeFileSync } from 'fs';
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

    let content = this.generateHeader(moduleName);
    content += this.generateImports(moduleName, entityName);
    content += this.generateServiceSchema(serviceInfo, moduleName);
    content += this.generateModuleExportsSchema(moduleName, serviceInfo.name);
    content += this.generateModuleSchema(moduleName);
    content += this.generateTypeExports(moduleName, serviceInfo.name);

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
   * @returns Import statements.
   */
  private generateImports(moduleName: string, entityName: string): string {
    return `import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';
import { ${entityName}Schema, ${entityName}CreateDataSchema, ${entityName}UpdateDataSchema } from './${moduleName}.module.generated';

`;
  }

  /**
   * Generate service schema.
   * @param serviceInfo - Service information.
   * @param moduleName - Module name.
   * @returns Service schema definition.
   */
  private generateServiceSchema(serviceInfo: ServiceInfo, moduleName: string): string {
    let schema = `// Zod schema for ${serviceInfo.name}
export const ${serviceInfo.name}Schema = z.object({
`;

    serviceInfo.methods.forEach(method => {
      schema += `  ${method.name}: z.function()`;

      if (method.params.length > 0) {
        schema += '\n    .args(';
        const paramSchemas = method.params.map(param =>
          { return this.typeConverter.typeToZodSchema(param.type, param.name, moduleName) });
        schema += paramSchemas.join(', ');
        schema += ')';
      } else {
        schema += '\n    .args()';
      }

      const returnSchema = this.typeConverter.typeToZodSchema(method.returnType, 'return', moduleName);
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
