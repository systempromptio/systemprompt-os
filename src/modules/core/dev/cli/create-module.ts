/**
 * Create module command - placeholder implementation.
 * @file Create module command for SystemPrompt OS.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { ModuleGeneratorService } from '@/modules/core/dev/services/module-generator.service';
import type { IModuleGeneratorOptions } from '@/modules/core/dev/types/manual';

/**
 * Extract module name from arguments.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @param moduleGenerator - Module generator service.
 * @returns Module name.
 */
const extractModuleName = (
  args: Record<string, unknown>,
  cliOutput: CliOutputService,
  moduleGenerator: ModuleGeneratorService
): string => {
  const name = typeof args.name === 'string' ? args.name : undefined;

  if (name === undefined || name.trim() === '') {
    cliOutput.error('Module name is required. Use --name or -n flag.');
    process.exit(1);
  }

  if (!moduleGenerator.validateModuleName(name)) {
    cliOutput.error(
      'Invalid module name. Use lowercase with hyphens only (minimum 3 characters).'
    );
    process.exit(1);
  }

  return name;
};

/**
 * Extract module type from arguments.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @returns Module type.
 */
const extractModuleType = (
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): 'service' | 'utility' | 'integration' => {
  const validTypes = ['service', 'utility', 'integration'] as const;
  const { type: rawType } = args;

  if (typeof rawType !== 'string') {
    cliOutput.error(
      'Module type is required. Use --type or -t flag with: service, utility, or integration.'
    );
    process.exit(1);
  }

  const type = validTypes.find((validType): boolean => {
    return validType === rawType;
  });
  if (type === undefined) {
    cliOutput.error(
      'Module type is required. Use --type or -t flag with: service, utility, or integration.'
    );
    process.exit(1);
  }

  return type;
};

/**
 * Extract module description from arguments.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @returns Module description.
 */
const extractModuleDescription = (
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): string => {
  const description = typeof args.description === 'string' ? args.description : undefined;

  if (description === undefined || description.trim() === '') {
    cliOutput.error('Module description is required. Use --description or -d flag.');
    process.exit(1);
  }

  return description;
};

/**
 * Parse and validate command arguments.
 * @param context - CLI context.
 * @param cliOutput - CLI output service.
 * @param moduleGenerator - Module generator service.
 * @returns Parsed module options.
 */
const parseAndValidateArgs = (
  context: ICLIContext,
  cliOutput: CliOutputService,
  moduleGenerator: ModuleGeneratorService
): IModuleGeneratorOptions => {
  const { args } = context;

  const name = extractModuleName(args, cliOutput, moduleGenerator);
  const type = extractModuleType(args, cliOutput);
  const description = extractModuleDescription(args, cliOutput);
  const noDatabaseFlag = Boolean(args['no-database']);
  const noCliFlag = Boolean(args['no-cli']);
  const deps = Array.isArray(args.deps) ? args.deps : [];

  return {
    name,
    type,
    description,
    needsDatabase: !noDatabaseFlag,
    needsCli: !noCliFlag,
    dependencies: deps,
    isCustom: false
  };
};

/**
 * Display module creation information.
 * @param options - Module generation options.
 * @param cliOutput - CLI output service.
 */
const displayModuleInfo = (options: IModuleGeneratorOptions, cliOutput: CliOutputService): void => {
  cliOutput.info(`🏗️ Creating module: ${options.name}`);
  cliOutput.info(`Type: ${options.type}`);
  cliOutput.info(`Description: ${options.description}`);
  cliOutput.info(`Database: ${options.needsDatabase ? 'Yes' : 'No'}`);
  cliOutput.info(`CLI: ${options.needsCli ? 'Yes' : 'No'}`);
};

/**
 * Display next steps after module creation.
 * @param options - Module generation options.
 * @param cliOutput - CLI output service.
 */
const displayNextSteps = (options: IModuleGeneratorOptions, cliOutput: CliOutputService): void => {
  cliOutput.success('✅ Module created successfully!');
  cliOutput.info('Next steps:');
  cliOutput.info('1. Add module to ModuleName enum in src/modules/types/index.ts');
  cliOutput.info('2. Register module in src/bootstrap/phases/core-modules-phase.ts');
  if (options.needsCli) {
    cliOutput.info('3. Add CLI command to src/modules/core/cli/commands/index.ts');
  }
};

/**
 * Execute create module command.
 * @param context - CLI context.
 */
const executeCreateModule = async (context: ICLIContext): Promise<void> => {
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const moduleGenerator = ModuleGeneratorService.getInstance();
    await moduleGenerator.initialize();

    const options = parseAndValidateArgs(context, cliOutput, moduleGenerator);

    displayModuleInfo(options, cliOutput);

    await moduleGenerator.generateModule(options);

    displayNextSteps(options, cliOutput);

    logger.info(LogSource.CLI, `Successfully created module: ${options.name}`);
  } catch (error) {
    logger.error(
      LogSource.CLI,
      `Error in create module command: ${error instanceof Error ? error.message : String(error)}`
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error creating module: ${errorMessage}`);
    process.exit(1);
  }
};

export const command: ICLICommand = {
  description: 'Create a new SystemPrompt OS module with complete boilerplate',
  options: [
    {
      name: 'name',
      alias: 'n',
      type: 'string',
      description: 'Module name (lowercase with hyphens)'
    },
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Module type (service, utility, integration)'
    },
    {
      name: 'description',
      alias: 'd',
      type: 'string',
      description: 'Module description'
    },
    {
      name: 'no-database',
      type: 'boolean',
      description: 'Skip database setup'
    },
    {
      name: 'no-cli',
      type: 'boolean',
      description: 'Skip CLI commands'
    },
    {
      name: 'deps',
      type: 'array',
      description: 'Module dependencies'
    }
  ],
  execute: executeCreateModule
};
