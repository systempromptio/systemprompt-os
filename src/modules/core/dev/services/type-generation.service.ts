/**
 * Type Generation Service
 * Unified service that orchestrates all type generation for modules.
 * @module dev/services/type-generation
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import type { ILogger } from '@/modules/core/logger/types/manual';
import { LogSource } from '@/modules/core/logger/types/manual';
import { DatabaseGenerator } from '@/modules/core/dev/services/type-generation/generators/database.generator';
import { InterfaceGenerator } from '@/modules/core/dev/services/type-generation/generators/interface.generator';
import { ZodSchemaGenerator } from '@/modules/core/dev/services/type-generation/generators/zod-schema.generator';
import { ServiceSchemaGenerator } from '@/modules/core/dev/services/type-generation/generators/service-schema.generator';
import { TypeGuardGenerator } from '@/modules/core/dev/services/type-generation/generators/type-guard.generator';
import type { ModuleGenerationOptions, TypeGenerationOptions } from '@/modules/core/dev/services/type-generation/types';

/**
 * Main type generation service that orchestrates all generators.
 */
export class TypeGenerationService {
  private static instance: TypeGenerationService;
  private readonly databaseGenerator: DatabaseGenerator;
  private readonly interfaceGenerator: InterfaceGenerator;
  private readonly zodSchemaGenerator: ZodSchemaGenerator;
  private readonly serviceSchemaGenerator: ServiceSchemaGenerator;
  private readonly typeGuardGenerator: TypeGuardGenerator;

  /**
   * Private constructor for singleton pattern.
   * @param logger
   */
  private constructor(private readonly logger: ILogger) {
    this.databaseGenerator = new DatabaseGenerator(logger);
    this.interfaceGenerator = new InterfaceGenerator(logger);
    this.zodSchemaGenerator = new ZodSchemaGenerator(logger);
    this.serviceSchemaGenerator = new ServiceSchemaGenerator(logger);
    this.typeGuardGenerator = new TypeGuardGenerator(logger);
  }

  /**
   * Get singleton instance.
   * @param logger - Logger instance.
   * @returns TypeGenerationService instance.
   */
  public static getInstance(logger: ILogger): TypeGenerationService {
    TypeGenerationService.instance ||= new TypeGenerationService(logger);
    return TypeGenerationService.instance;
  }

  /**
   * Main entry point for type generation.
   * @param options - Generation options.
   */
  public async generateTypes(options: TypeGenerationOptions = {}): Promise<void> {
    const types = options.types || ['all'];
    const shouldGenerateAll = types.includes('all');

    try {
      if (options.module) {
        await this.generateForModule(options.module, {
          database: shouldGenerateAll || types.includes('database'),
          interfaces: shouldGenerateAll || types.includes('interfaces'),
          schemas: shouldGenerateAll || types.includes('schemas'),
          serviceSchemas: shouldGenerateAll || types.includes('service-schemas'),
          typeGuards: shouldGenerateAll || types.includes('type-guards'),
        });
      } else if (options.pattern) {
        await this.generateForPattern(options.pattern, {
          database: shouldGenerateAll || types.includes('database'),
          interfaces: shouldGenerateAll || types.includes('interfaces'),
          schemas: shouldGenerateAll || types.includes('schemas'),
          serviceSchemas: shouldGenerateAll || types.includes('service-schemas'),
          typeGuards: shouldGenerateAll || types.includes('type-guards'),
        });
      } else {
        const modules = await this.discoverModules();
        for (const module of modules) {
          await this.generateForModule(module, {
            database: shouldGenerateAll || types.includes('database'),
            interfaces: shouldGenerateAll || types.includes('interfaces'),
            schemas: shouldGenerateAll || types.includes('schemas'),
            serviceSchemas: shouldGenerateAll || types.includes('service-schemas'),
            typeGuards: shouldGenerateAll || types.includes('type-guards'),
          });
        }
      }

      if (types.includes('type-guards') || types.includes('all')) {
        await this.typeGuardGenerator.generate();
      }
    } catch (error) {
      this.logger.error(LogSource.DEV, 'Type generation failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Generate types for a specific module.
   * @param moduleName - Module name.
   * @param options - Generation options.
   */
  private async generateForModule(
    moduleName: string,
    options: ModuleGenerationOptions
  ): Promise<void> {
    this.logger.info(LogSource.DEV, `Generating types for module: ${moduleName}`);

    const modulePath = join(process.cwd(), `src/modules/core/${moduleName}`);
    const typesDir = join(modulePath, 'types');

    if (!existsSync(typesDir)) {
      mkdirSync(typesDir, { recursive: true });
    }

    if (options.database) {
      await this.databaseGenerator.generate(moduleName);
    }

    if (options.interfaces) {
      await this.interfaceGenerator.generate(moduleName);
    }

    if (options.schemas) {
      await this.zodSchemaGenerator.generate(moduleName);
    }

    if (options.serviceSchemas) {
      await this.serviceSchemaGenerator.generate(moduleName);
    }

    this.logger.info(LogSource.DEV, `Successfully generated types for module: ${moduleName}`);
  }

  /**
   * Generate types for files matching a pattern.
   * @param pattern - Glob pattern.
   * @param options - Generation options.
   */
  private async generateForPattern(
    pattern: string,
    options: ModuleGenerationOptions
  ): Promise<void> {
    const files = await glob(pattern, { cwd: process.cwd() });
    this.logger.info(LogSource.DEV, `Found ${files.length} files matching pattern: ${pattern}`);

    const modules = new Set<string>();
    files.forEach(file => {
      const match = file.match(/src\/modules\/core\/([^/]+)\//);
      if (match?.[1]) {
        modules.add(match[1]);
      }
    });

    for (const module of modules) {
      await this.generateForModule(module, options);
    }
  }

  /**
   * Discover all modules in the system.
   * @returns Array of module names.
   */
  private async discoverModules(): Promise<string[]> {
    const pattern = 'src/modules/core/*/index.ts';
    const files = await glob(pattern, { cwd: process.cwd() });

    return files.map(file => {
      const match = file.match(/src\/modules\/core\/([^/]+)\/index.ts/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[];
  }
}
