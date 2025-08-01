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

  options: [
    {
      name: 'all',
      alias: 'a',
      type: 'boolean',
      description: 'Regenerate types for all modules',
      required: false
    },
    {
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Module name to generate types for',
      required: false
    },
    {
      name: 'pattern',
      alias: 'p',
      type: 'string',
      description: 'Glob pattern for files to process',
      required: false
    },
    {
      name: 'types',
      alias: 't',
      type: 'string',
      description: 'Comma-separated list of types to generate (database,interfaces,schemas,service-schemas,type-guards,all)',
      required: false
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],

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
      if (args.all || args.a) {
        const modules = [
          'agents', 'auth', 'cli', 'config', 'database', 'dev',
          'events', 'logger', 'mcp', 'modules', 'monitor',
          'permissions', 'system', 'tasks', 'users', 'webhooks'
        ];

        const results = [];

        if (args.format !== 'json') {
          output.info('🔄 Generating types for all modules...');
        }

        for (const module of modules) {
          if (args.format !== 'json') {
            output.info(`\n📦 Processing module: ${module}`);
          }
          try {
            await devService.generateTypes({
              module,
              types: ['all']
            });
            results.push({ module, status: 'success', files: [`src/modules/core/${module}/types/database.generated.ts`, `src/modules/core/${module}/types/${module}.module.generated.ts`, `src/modules/core/${module}/types/${module}.service.generated.ts`] });
            if (args.format !== 'json') {
              output.success(`  ✅ Generated types for ${module}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            results.push({ module, status: 'error', error: errorMessage });
            if (args.format !== 'json') {
              output.error(`  ❌ Failed to generate types for ${module}: ${errorMessage}`);
            }
          }
        }

        if (args.format === 'json') {
          output.json({ modules: results, timestamp: new Date().toISOString() });
        } else {
          output.success('\n✅ Completed type generation for all modules');
        }
        return;
      }

      if (!options.module && !options.pattern) {
        output.error('Either --module, --pattern, or --all is required');
        output.info('Usage:');
        output.info('  dev generate-types --module <module-name>');
        output.info('  dev generate-types --pattern <glob-pattern>');
        output.info('  dev generate-types --all');
        output.info('  dev generate-types --module users --types database,interfaces');
        output.info('');
        output.info('Examples:');
        output.info('  dev generate-types --all                    # Regenerate all modules');
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

      const generatedFiles = [];
      if (typeOptions.includes('all') || typeOptions.includes('database')) {
        generatedFiles.push(`src/modules/core/${options.module}/types/database.generated.ts`);
      }
      if (typeOptions.includes('all') || typeOptions.includes('schemas')) {
        generatedFiles.push(`src/modules/core/${options.module}/types/${options.module}.module.generated.ts`);
      }
      if (typeOptions.includes('all') || typeOptions.includes('service-schemas')) {
        generatedFiles.push(`src/modules/core/${options.module}/types/${options.module}.service.generated.ts`);
      }

      const result = {
        module: options.module,
        pattern: options.pattern,
        types: typeOptions,
        files: generatedFiles,
        timestamp: new Date().toISOString()
      };

      if (args.format === 'json') {
        output.json(result);
      } else {
        if (options.module) {
          output.success(`✅ Successfully generated types for '${options.module}' module`);
          output.info('Generated files:');
          generatedFiles.forEach(file => output.info(`  • ${file}`));
        } else {
          output.success(`✅ Successfully generated types for pattern`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`❌ Failed to generate types: ${errorMessage}`);
      logger.error(LogSource.DEV, `Type generation failed: ${errorMessage}`);
      process.exit(1);
    }
  }
};
