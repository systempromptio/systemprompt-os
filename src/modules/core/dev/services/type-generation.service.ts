/**
 * Type Generation Service
 * Unified service that orchestrates all type generation for modules
 * @module dev/services/type-generation
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import { DatabaseGenerator } from './type-generation/generators/database.generator';
import { InterfaceGenerator } from './type-generation/generators/interface.generator';
import { ZodSchemaGenerator } from './type-generation/generators/zod-schema.generator';
import { ServiceSchemaGenerator } from './type-generation/generators/service-schema.generator';
import { TypeGuardGenerator } from './type-generation/generators/type-guard.generator';
import type { TypeGenerationOptions, ModuleGenerationOptions } from './type-generation/types';

/**
 * Main type generation service that orchestrates all generators
 */
export class TypeGenerationService {
  private static instance: TypeGenerationService;
  private readonly databaseGenerator: DatabaseGenerator;
  private readonly interfaceGenerator: InterfaceGenerator;
  private readonly zodSchemaGenerator: ZodSchemaGenerator;
  private readonly serviceSchemaGenerator: ServiceSchemaGenerator;
  private readonly typeGuardGenerator: TypeGuardGenerator;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(private readonly logger: ILogger) {
    this.databaseGenerator = new DatabaseGenerator(logger);
    this.interfaceGenerator = new InterfaceGenerator(logger);
    this.zodSchemaGenerator = new ZodSchemaGenerator(logger);
    this.serviceSchemaGenerator = new ServiceSchemaGenerator(logger);
    this.typeGuardGenerator = new TypeGuardGenerator(logger);
  }

  /**
   * Get singleton instance
   * @param logger - Logger instance
   * @returns TypeGenerationService instance
   */
  public static getInstance(logger: ILogger): TypeGenerationService {
    if (!TypeGenerationService.instance) {
      TypeGenerationService.instance = new TypeGenerationService(logger);
    }
    return TypeGenerationService.instance;
  }

  /**
   * Main entry point for type generation
   * @param options - Generation options
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
        });
      } else if (options.pattern) {
        await this.generateForPattern(options.pattern, {
          database: shouldGenerateAll || types.includes('database'),
          interfaces: shouldGenerateAll || types.includes('interfaces'),
          schemas: shouldGenerateAll || types.includes('schemas'),
          serviceSchemas: shouldGenerateAll || types.includes('service-schemas'),
        });
      } else {
        // Generate for all modules
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
      
      // Generate type guards if requested (runs after all modules are processed)
      if (types.includes('type-guards') || types.includes('all')) {
        await this.typeGuardGenerator.generate();
      }
    } catch (error) {
      this.logger.error(LogSource.DEV, 'Type generation failed', { error });
      throw error;
    }
  }

  /**
   * Generate types for a specific module
   * @param moduleName - Module name
   * @param options - Generation options
   */
  private async generateForModule(
    moduleName: string,
    options: ModuleGenerationOptions
  ): Promise<void> {
    this.logger.info(LogSource.DEV, `Generating types for module: ${moduleName}`);

    const modulePath = join(process.cwd(), `src/modules/core/${moduleName}`);
    const typesDir = join(modulePath, 'types');

    // Ensure types directory exists
    if (!existsSync(typesDir)) {
      mkdirSync(typesDir, { recursive: true });
    }

    // Stage 1: Generate database types from schema.sql
    if (options.database) {
      await this.databaseGenerator.generate(moduleName);
    }

    // Stage 2: Generate interface types from exported interfaces
    if (options.interfaces) {
      await this.interfaceGenerator.generate(moduleName);
    }

    // Stage 3: Generate Zod schemas
    if (options.schemas) {
      await this.zodSchemaGenerator.generate(moduleName);
    }

    // Stage 4: Generate service schemas
    if (options.serviceSchemas) {
      await this.serviceSchemaGenerator.generate(moduleName);
    }

    this.logger.info(LogSource.DEV, `Successfully generated types for module: ${moduleName}`);
  }

  /**
   * Generate types for files matching a pattern
   * @param pattern - Glob pattern
   * @param options - Generation options
   */
  private async generateForPattern(
    pattern: string,
    options: ModuleGenerationOptions
  ): Promise<void> {
    const files = await glob(pattern, { cwd: process.cwd() });
    this.logger.info(LogSource.DEV, `Found ${files.length} files matching pattern: ${pattern}`);

    // Extract unique modules from file paths
    const modules = new Set<string>();
    files.forEach(file => {
      const match = file.match(/src\/modules\/core\/([^/]+)\//);
      if (match) {
        modules.add(match[1]);
      }
    });

    // Generate types for each unique module
    for (const module of modules) {
      await this.generateForModule(module, options);
    }
  }

  /**
   * Discover all modules in the system
   * @returns Array of module names
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