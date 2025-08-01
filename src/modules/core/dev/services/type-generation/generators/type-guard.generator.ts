/**
 * Type Guard Generator Module
 * Generates type guards for module export interfaces.
 * @module dev/services/type-generation/generators
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import type { ILogger } from '@/modules/core/logger/types/manual';
import { LogSource } from '@/modules/core/logger/types/manual';

interface ModuleExportInterface {
  name: string;
  moduleName: string;
  properties: Array<{
    name: string;
    type: 'function' | 'object' | 'other';
    required: boolean;
  }>;
  filePath: string;
}

/**
 * Generates type guards for module exports.
 */
export class TypeGuardGenerator {
  constructor(private readonly logger: ILogger) {}

  /**
   * Generate type guards for all modules.
   */
  public async generate(): Promise<void> {
    this.logger.info(LogSource.DEV, 'Starting type guard generation');

    try {
      const interfaces = await this.findExportInterfaces();
      const typeGuards = this.generateTypeGuardCode(interfaces);
      await this.writeTypeGuardsFile(typeGuards);

      this.logger.info(LogSource.DEV, `Generated type guards for ${interfaces.length} module interfaces`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(LogSource.DEV, `Failed to generate type guards: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Find all module export interfaces in the codebase.
   */
  private async findExportInterfaces(): Promise<ModuleExportInterface[]> {
    const interfaces: ModuleExportInterface[] = [];
    const pattern = 'src/modules/core/*/types/*.ts';
    const files = await glob(pattern, { cwd: process.cwd() });

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const foundInterfaces = this.parseExportInterfaces(content, file);
      interfaces.push(...foundInterfaces);
    }

    return interfaces;
  }

  /**
   * Parse export interfaces from a TypeScript file.
   * @param content
   * @param filePath
   */
  private parseExportInterfaces(content: string, filePath: string): ModuleExportInterface[] {
    const interfaces: ModuleExportInterface[] = [];
    const interfaceRegex = /export\s+interface\s+(I(\w+)ModuleExports)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const moduleName = match[2];
      const interfaceBody = match[3];

      if (interfaceName && moduleName && interfaceBody) {
        const properties = this.parseInterfaceProperties(interfaceBody);

        interfaces.push({
          name: interfaceName,
          moduleName: moduleName.toLowerCase(),
          properties,
          filePath
        });
      }
    }

    return interfaces;
  }

  /**
   * Parse properties from interface body.
   * @param interfaceBody
   */
  private parseInterfaceProperties(interfaceBody: string): ModuleExportInterface['properties'] {
    const properties: ModuleExportInterface['properties'] = [];
    const cleanBody = interfaceBody.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').trim();

    const lines = cleanBody.split('\n');
    let currentProperty = '';
    let depth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { continue; }

      for (const char of trimmed) {
        if (char === '(') { depth++; }
        if (char === ')') { depth--; }
      }

      currentProperty += ` ${trimmed}`;

      if (depth === 0 && (trimmed.endsWith(';') || trimmed.endsWith(','))) {
        const match = currentProperty.match(/^\s*(?:readonly\s+)?(\w+)(\?)?:\s*(.+?)(?:;|,)\s*$/);
        if (match) {
          const propertyName = match[1];
          const optional = match[2];
          const propertyType = match[3];

          if (propertyName && propertyType) {
            let type: 'function' | 'object' | 'other' = 'other';
            if (propertyType.includes('=>') || propertyType.includes('function')) {
              type = 'function';
            } else if (propertyType.includes('{') || propertyType.startsWith('Record<')) {
              type = 'object';
            }

            properties.push({
              name: propertyName,
              type,
              required: !optional
            });
          }
        }
        currentProperty = '';
      }
    }

    return properties;
  }

  /**
   * Generate TypeScript code for type guards.
   * @param interfaces
   */
  private generateTypeGuardCode(interfaces: ModuleExportInterface[]): string {
    const uniqueInterfaces = new Map<string, ModuleExportInterface>();
    for (const iface of interfaces) {
      if (!uniqueInterfaces.has(iface.name)) {
        uniqueInterfaces.set(iface.name, iface);
      }
    }

    const dedupedInterfaces = Array.from(uniqueInterfaces.values());
    const imports = this.generateImports(dedupedInterfaces);
    const typeGuards = dedupedInterfaces.map(iface => { return this.generateSingleTypeGuard(iface) }).join('\n\n');

    return `/**
 * Auto-generated type guards for module exports
 * Generated on: ${new Date().toISOString()}
 * DO NOT EDIT - Generated by TypeGuardGenerator
 */

${imports}

${typeGuards}
`;
  }

  /**
   * Generate import statements for the type guards file.
   * @param interfaces
   */
  private generateImports(interfaces: ModuleExportInterface[]): string {
    const importMap = new Map<string, Set<string>>();

    for (const iface of interfaces) {
      const relativePath = this.getRelativeImportPath(iface.filePath);
      if (!importMap.has(relativePath)) {
        importMap.set(relativePath, new Set());
      }
      importMap.get(relativePath)!.add(iface.name);
    }

    const imports: string[] = [];
    for (const [path, interfaces] of importMap) {
      const interfaceList = Array.from(interfaces).sort()
.join(', ');
      imports.push(`import type { ${interfaceList} } from '${path}';`);
    }

    imports.push(`import { ModuleName } from '@/modules/types/module-names.types';`);
    imports.push(`import type { IModule } from '@/modules/core/modules/types';`);

    return imports.join('\n');
  }

  /**
   * Generate a single type guard function.
   * @param iface
   */
  private generateSingleTypeGuard(iface: ModuleExportInterface): string {
    const functionName = `is${iface.name.replace(/^I/, '')}`;
    const moduleNameConstant = iface.moduleName.toUpperCase();

    const propertyChecks = iface.properties.map(prop => {
      const check = this.generatePropertyCheck(prop, 'candidate.exports');
      return `    && ${check}`;
    }).join('\n');

    return `/**
 * Type guard to check if a module is the ${iface.moduleName} module with proper exports.
 * @param mod - Module to check.
 * @returns True if module is the ${iface.moduleName} module with valid exports.
 */
export const ${functionName} = (
  mod: unknown
): mod is IModule<${iface.name}> => {
  const candidate = mod as IModule<${iface.name}>;
  return candidate?.name === ModuleName.${moduleNameConstant}
    && Boolean(candidate.exports)
    && typeof candidate.exports === 'object'${propertyChecks ? `\n${propertyChecks}` : ''};
};`;
  }

  /**
   * Generate property check for a specific property.
   * @param prop
   * @param accessPath
   */
  private generatePropertyCheck(prop: ModuleExportInterface['properties'][0], accessPath: string): string {
    const propPath = `${accessPath}.${prop.name}`;

    if (!prop.required) {
      return `(!${propPath} || typeof ${propPath} === '${prop.type === 'function' ? 'function' : 'object'}')`;
    }

    switch (prop.type) {
      case 'function':
        return `typeof ${propPath} === 'function'`;
      case 'object':
        return `typeof ${propPath} === 'object' && ${propPath} !== null`;
      default:
        return `${propPath} !== undefined`;
    }
  }

  /**
   * Get relative import path for a file.
   * @param filePath
   */
  private getRelativeImportPath(filePath: string): string {
    return filePath.replace(/^src\//, '@/').replace(/\.ts$/, '');
  }

  /**
   * Write generated type guards to file.
   * @param content
   */
  private async writeTypeGuardsFile(content: string): Promise<void> {
    const outputPath = join(process.cwd(), 'src/modules/types/generated-type-guards.ts');
    writeFileSync(outputPath, content, 'utf-8');
    this.logger.debug(LogSource.DEV, `Wrote type guards to ${outputPath}`);
  }
}
