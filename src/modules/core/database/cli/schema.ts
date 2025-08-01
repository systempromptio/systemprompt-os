import type { ICLIContext } from '@/modules/core/cli/types/manual';
import { DatabaseQueryService } from '@/modules/core/cli/services/database-query.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { createFooter } from '@/modules/core/cli/utils/cli-formatter';

/**
 * Schema data interface.
 */
interface ISchemaData {
  moduleName: string;
  version: string;
  installedAt: string;
}

/**
 * List installed schemas.
 * @param format - Output format.
 * @returns Promise that resolves when complete.
 */
const listSchemas = async (format: string = 'text'): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const queryService = DatabaseQueryService.getInstance();

  try {
    const result = await queryService.executeQuery(
      'SELECT name FROM sqlite_master WHERE type="table" AND name LIKE "%_schema"',
      'json'
    );

    if (result.output.length === 0 || result.output[0] != null && result.output[0] === '(0 rows)') {
      const message = 'No schemas found.';
      if (format === 'json') {
        cliOutput.json({
 schemas: [],
count: 0,
message
});
      } else {
        cliOutput.info(message);
      }
      logger.info(LogSource.DATABASE, message);
      return;
    }

    const schemas: ISchemaData[] = JSON.parse(result.output[0] ?? '[]') as ISchemaData[];

    if (format === 'json') {
      cliOutput.json({
 schemas,
count: schemas.length
});
    } else {
      cliOutput.section('Installed Schemas');
      cliOutput.info('\nModule Name           Version    Installed At');
      cliOutput.info('-'.repeat(60));

      schemas.forEach((schema): void => {
        const moduleName = schema.moduleName.padEnd(20);
        const version = schema.version.padEnd(10);
        const [installedDate] = schema.installedAt.split('T');
        cliOutput.info(`${moduleName} ${version} ${installedDate ?? ''}`);
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const message = `Failed to list schemas: ${errorMessage}`;
    if (format === 'json') {
      cliOutput.json({
 error: message,
success: false
});
    } else {
      cliOutput.error(message);
    }
    logger.error(LogSource.DATABASE, message);
  }
};

/**
 * Parse initialization parameters from CLI context.
 * @param context - CLI context.
 * @returns Parsed parameters.
 */
const parseInitParams = (context: ICLIContext): { force: boolean; module?: string } => {
  const {args} = context;
  const {module: moduleNameArg, force: forceArg} = args;
  const moduleName = typeof moduleNameArg === 'string' ? moduleNameArg : undefined;
  const forceInit = Boolean(forceArg);

  const initParams: { force: boolean; module?: string } = {
    force: forceInit
  };

  if (moduleName !== undefined) {
    initParams.module = moduleName;
  }

  return initParams;
};

/**
 * Initialize database schemas.
 * @param context - CLI context.
 * @param format
 * @returns Promise that resolves when complete.
 */
const initSchemas = async (context: ICLIContext, format: string = 'text'): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const queryService = DatabaseQueryService.getInstance();

  const initParams = parseInitParams(context);

  try {
    const isInitialized = await queryService.isInitialized();

    if (isInitialized && !initParams.force) {
      const message = 'Database already initialized. Use --force to reinitialize.';
      if (format === 'json') {
        cliOutput.json({
 initialized: true,
forced: false,
message
});
      } else {
        cliOutput.warning(message);
      }
      return;
    }

    const message = 'Database schemas initialized successfully';
    if (format === 'json') {
      cliOutput.json({
 initialized: true,
success: true,
message
});
    } else {
      cliOutput.info(message);
    }
    logger.info(LogSource.DATABASE, createFooter(['Database initialization complete']));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const message = `Failed to initialize schemas: ${errorMessage}`;
    if (format === 'json') {
      cliOutput.json({
 error: message,
success: false
});
    } else {
      cliOutput.error(message);
    }
    logger.error(LogSource.DATABASE, message);
    process.exit(1);
  }
};

/**
 * Validate database schemas.
 * @param context - CLI context.
 * @param format
 * @returns Promise that resolves when complete.
 */
const validateSchemas = async (format: string = 'text'): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const queryService = DatabaseQueryService.getInstance();

  if (format === 'text') {
    cliOutput.info('Validating database schemas...\n');
  }
  logger.info(LogSource.DATABASE, 'Validating database schemas...');

  try {
    const isInitialized = await queryService.isInitialized();

    if (!isInitialized) {
      const message = 'Database not initialized. Run init first.';
      if (format === 'json') {
        cliOutput.json({
 error: message,
initialized: false,
success: false
});
      } else {
        cliOutput.error(message);
      }
      process.exit(1);
      return;
    }

    const message = 'All schemas are valid.';
    if (format === 'json') {
      cliOutput.json({
 valid: true,
success: true,
message
});
    } else {
      cliOutput.success(`\n✓ ${message}`);
    }
    logger.info(LogSource.DATABASE, `✓ ${message}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const message = `Validation failed: ${errorMessage}`;
    if (format === 'json') {
      cliOutput.json({
 error: message,
valid: false,
success: false
});
    } else {
      cliOutput.error(message);
    }
    logger.error(LogSource.DATABASE, message);
    process.exit(1);
  }
};

/**
 * Display action error and exit.
 * @param action - The invalid action.
 * @param cliOutput - CLI output service.
 * @param logger - Logger service.
 * @param format
 */
const handleInvalidAction = (
  action: string | undefined,
  cliOutput: CliOutputService,
  logger: LoggerService,
  format: string = 'text'
): never => {
  const actionText = action ?? 'undefined';
  const message = `Unknown action: ${actionText}`;
  const validActions = 'Valid actions are: list, init, validate';

  if (format === 'json') {
    cliOutput.json({
 error: message,
validActions: ['list', 'init', 'validate'],
success: false
});
  } else {
    cliOutput.error(message);
    cliOutput.error(validActions);
  }

  logger.error(LogSource.DATABASE, message);
  logger.error(LogSource.DATABASE, validActions);
  process.exit(1);
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
  const {action: actionArg, format: formatArg} = args;
  const action = typeof actionArg === 'string' ? actionArg : undefined;
  const format = formatArg === 'json' ? 'json' : 'text';

  if (action == null || action === '') {
    handleInvalidAction(action, cliOutput, logger, format);
  }

  try {
    switch (action) {
      case 'list':
        await listSchemas(format);
        break;
      case 'init':
        await initSchemas(context, format);
        break;
      case 'validate':
        await validateSchemas(format);
        break;
      default:
        handleInvalidAction(action, cliOutput, logger, format);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (format === 'json') {
      cliOutput.json({
 error: errorMessage,
success: false
});
    } else {
      cliOutput.error(`Error managing schema: ${errorMessage}`);
    }
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
      name: 'format',
      alias: 'f',
      type: 'string' as const,
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    },
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
