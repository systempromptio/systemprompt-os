import type { ICLIContext } from '@/modules/core/cli/types/index';
import { DatabaseCLIHandlerService } from '@/modules/core/database/services/cli-handler.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { createFooter } from '@/modules/core/cli/utils/cli-formatter';

/**
 * List installed schemas.
 * @returns Promise that resolves when complete.
 */
const listSchemas = async (): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const schemaService = DatabaseCLIHandlerService.getInstance(logger);

  const result = await schemaService.listSchemas();

  if (!result.success) {
    cliOutput.error(result.message ?? 'Failed to list schemas');
    logger.error(LogSource.DATABASE, result.message ?? 'Failed to list schemas');
    return;
  }

  if (!result.data || result.data.schemas.length === 0) {
    cliOutput.info('No schemas found.');
    logger.info(LogSource.DATABASE, 'No schemas found.');
    return;
  }

  cliOutput.section('Installed Schemas');
  cliOutput.info('\nModule Name           Version    Installed At');
  cliOutput.info('-'.repeat(60));

  result.data.schemas.forEach((schema): void => {
    const moduleName = schema.moduleName.padEnd(20);
    const version = schema.version.padEnd(10);
    const [installedDate] = schema.installedAt.split('T');
    cliOutput.info(`${moduleName} ${version} ${installedDate ?? ''}`);
  });
};

/**
 * Initialize database schemas.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
const initSchemas = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const schemaService = DatabaseCLIHandlerService.getInstance(logger);

  const {args} = context;
  const {module: moduleNameArg, force: forceArg} = args;
  const moduleName = typeof moduleNameArg === 'string' ? moduleNameArg : undefined;
  const forceInit = Boolean(forceArg);

  const initParams: { force?: boolean; module?: string } = {
    force: forceInit
  };

  if (moduleName !== undefined) {
    initParams.module = moduleName;
  }

  const initResult = await schemaService.initializeSchemas(initParams);

  const initResultTyped = initResult as { success: boolean; message?: string; warnings?: string[]; results?: Array<{ success: boolean; module: string; message?: string }> };

  if (!initResultTyped.success) {
    cliOutput.error(initResultTyped.message ?? 'Failed to initialize schemas');
    logger.error(LogSource.DATABASE, initResultTyped.message ?? 'Failed to initialize schemas');
    process.exit(1);
  }

  if (initResultTyped.warnings) {
    initResultTyped.warnings.forEach((warning): void => {
      cliOutput.warning(warning);
      logger.warn(LogSource.DATABASE, warning);
    });
  }

  if (initResultTyped.results) {
    initResultTyped.results.forEach((item): void => {
      if (item.success) {
        cliOutput.success(`✓ ${item.module}: ${item.message ?? 'Success'}`);
        logger.info(LogSource.DATABASE, `✓ ${item.module}: ${item.message ?? 'Success'}`);
      } else {
        cliOutput.error(`✗ ${item.module}: ${item.message ?? 'Failed'}`);
        logger.error(LogSource.DATABASE, `✗ ${item.module}: ${item.message ?? 'Failed'}`);
      }
    });
  }

  cliOutput.success('Database initialization complete');
  logger.info(LogSource.DATABASE, createFooter(['Database initialization complete']));
};

/**
 * Validate database schemas.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
const validateSchemas = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const schemaService = DatabaseCLIHandlerService.getInstance(logger);

  const {args} = context;
  const {module: moduleNameArg} = args;
  const moduleName = typeof moduleNameArg === 'string' ? moduleNameArg : undefined;

  cliOutput.info('Validating database schemas...\n');
  logger.info(LogSource.DATABASE, 'Validating database schemas...');

  const validateParams: { module?: string } = {};

  if (moduleName !== undefined) {
    validateParams.module = moduleName;
  }

  const validationResult = await schemaService.validateSchemas(validateParams);

  const validationResultTyped = validationResult as { success: boolean; message?: string; issues?: Array<{ severity: string; module: string; message: string }> };

  if (!validationResultTyped.success) {
    cliOutput.error(validationResultTyped.message ?? 'Validation failed');
    logger.error(LogSource.DATABASE, validationResultTyped.message ?? 'Validation failed');
    process.exit(1);
  }

  if (validationResultTyped.issues
      && validationResultTyped.issues.length > 0) {
    validationResultTyped.issues.forEach((issue): void => {
      const icon = issue.severity === 'error' ? '✗' : '⚠️';
      if (issue.severity === 'error') {
        cliOutput.error(`${icon} ${issue.module}: ${issue.message}`);
        logger.error(LogSource.DATABASE, `${icon} ${issue.module}: ${issue.message}`);
      } else {
        cliOutput.warning(`${icon} ${issue.module}: ${issue.message}`);
        logger.warn(LogSource.DATABASE, `${icon} ${issue.module}: ${issue.message}`);
      }
    });

    cliOutput.warning(
      '\n⚠️  Schema validation found issues. '
      + "Run 'systemprompt database:schema --action=init' to fix."
    );
    logger.warn(
      LogSource.DATABASE,
      '\n⚠️  Schema validation found issues. '
      + "Run 'systemprompt database:schema --action=init' to fix."
    );
    process.exit(1);
  } else {
    cliOutput.success('\n✓ All schemas are valid.');
    logger.info(LogSource.DATABASE, '\n✓ All schemas are valid.');
  }
};

/**
 * Execute the schema command based on the action.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
const executeSchemaCommand = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const {args} = context;
  const {action: actionArg} = args;
  const action = typeof actionArg === 'string' ? actionArg : undefined;

  if (!action) {
    cliOutput.error('Unknown action: undefined');
    cliOutput.error('Valid actions are: list, init, validate');
    logger.error(LogSource.DATABASE, 'Unknown action: undefined');
    logger.error(LogSource.DATABASE, 'Valid actions are: list, init, validate');
    process.exit(1);
  }

  try {
    switch (action) {
      case 'list':
        await listSchemas();
        break;
      case 'init':
        await initSchemas(context);
        break;
      case 'validate':
        await validateSchemas(context);
        break;
      default:
        cliOutput.error(`Unknown action: ${action}`);
        cliOutput.error('Valid actions are: list, init, validate');
        logger.error(LogSource.DATABASE, `Unknown action: ${action}`);
        logger.error(LogSource.DATABASE, 'Valid actions are: list, init, validate');
        process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error managing schema: ${errorMessage}`);
    logger.error(LogSource.DATABASE, 'Error managing schema:', { error: errorMessage });
    process.exit(1);
  }
};

/**
 * Schema command definition.
 */
export const command = {
  name: 'schema',
  description: 'Manage database schemas',
  options: [
    {
      name: 'action',
      type: 'string' as const,
      description: 'Action to perform (list, init, validate)',
      required: false
    },
    {
      name: 'force',
      type: 'boolean' as const,
      description: 'Force reinitialize database',
      required: false
    },
    {
      name: 'module',
      type: 'string' as const,
      description: 'Specific module to operate on',
      required: false
    }
  ],
  execute: executeSchemaCommand
};
