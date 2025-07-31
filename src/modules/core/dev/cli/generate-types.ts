/**
 * Generate Types CLI Command
 * Generates comprehensive types for a module using the TypeGuardGeneratorService.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Generate comprehensive types for a module (database types, interfaces, Zod schemas)',

  async execute(context: ICLIContext): Promise<void> {
    const { args } = context;
    const options = {
      module: args.module as string | undefined,
      pattern: args.pattern as string | undefined,
      types: args.types as string | undefined
    };
    const output = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();
    const devService = DevService.getInstance();

    devService.setLogger(logger);
    await devService.initialize();

    try {
      if (!options.module && !options.pattern) {
        output.error('Either --module or --pattern is required');
        output.info('Usage:');
        output.info('  dev generate-types --module <module-name>');
        output.info('  dev generate-types --pattern <glob-pattern>');
        output.info('  dev generate-types --module users --types database,interfaces');
        output.info('');
        output.info('Examples:');
        output.info('  dev generate-types --module users');
        output.info('  dev generate-types --pattern "src/modules/core/*/**.ts"');
        output.info('  dev generate-types --module users --types all');
        return;
      }

      const validTypes = ['database', 'interfaces', 'schemas', 'service-schemas', 'type-guards', 'all'] as const;
      type ValidType = typeof validTypes[number];

      const typeOptions: ValidType[] = options.types
        ? options.types.split(',').filter((t): t is ValidType => { return validTypes.includes(t as ValidType) })
        : ['all'];

      if (options.module) {
        output.info(`🔄 Generating types for '${options.module}' module...`);
      } else {
        output.info(`🔄 Generating types for pattern '${options.pattern}'...`);
      }

      await devService.generateTypes({
        ...options.module && { module: options.module },
        ...options.pattern && { pattern: options.pattern },
        types: typeOptions
      });

      if (options.module) {
        output.success(`✅ Successfully generated types for '${options.module}' module`);
        output.info('Generated files:');
        if (typeOptions.includes('all') || typeOptions.includes('database')) {
          output.info(`  • src/modules/core/${options.module}/types/database.generated.ts`);
        }
        if (typeOptions.includes('all') || typeOptions.includes('schemas')) {
          output.info(`  • src/modules/core/${options.module}/types/${options.module}.module.generated.ts`);
        }
        if (typeOptions.includes('all') || typeOptions.includes('service-schemas')) {
          output.info(`  • src/modules/core/${options.module}/types/${options.module}.service.generated.ts`);
        }
      } else {
        output.success(`✅ Successfully generated types for pattern`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`❌ Failed to generate types: ${errorMessage}`);
      logger.error(LogSource.DEV, `Type generation failed: ${errorMessage}`);
      process.exit(1);
    }
  }
};
