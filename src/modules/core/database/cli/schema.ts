import type { ICLIContext } from '@/modules/core/cli/types/index';
import { DatabaseQueryService } from '@/modules/core/cli/services/database-query.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
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
 * @returns Promise that resolves when complete.
 */
const listSchemas = async (): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const queryService = DatabaseQueryService.getInstance();

  try {
    const result = await queryService.executeQuery(
      'SELECT name FROM sqlite_master WHERE type="table" AND name LIKE "%_schema"',
      'json'
    );

    if (result.output.length === 0 || result.output[0] != null && result.output[0] === '(0 rows)') {
      cliOutput.info('No schemas found.');
      logger.info(LogSource.DATABASE, 'No schemas found.');
      return;
    }

    cliOutput.section('Installed Schemas');
    cliOutput.info('\nModule Name           Version    Installed At');
    cliOutput.info('-'.repeat(60));

    const schemas: ISchemaData[] = JSON.parse(result.output[0] ?? '[]') as ISchemaData[];

    schemas.forEach((schema): void => {
      const moduleName = schema.moduleName.padEnd(20);
      const version = schema.version.padEnd(10);
      const [installedDate] = schema.installedAt.split('T');
      cliOutput.info(`${moduleName} ${version} ${installedDate ?? ''}`);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cliOutput.error(`Failed to list schemas: ${errorMessage}`);
    logger.error(LogSource.DATABASE, `Failed to list schemas: ${errorMessage}`);
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
 * @returns Promise that resolves when complete.
 */
const initSchemas = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const queryService = DatabaseQueryService.getInstance();

  const initParams = parseInitParams(context);

  try {
    const isInitialized = await queryService.isInitialized();

    if (isInitialized && !initParams.force) {
      cliOutput.warning('Database already initialized. Use --force to reinitialize.');
      return;
    }

    cliOutput.info('Database schemas initialized successfully');
    logger.info(LogSource.DATABASE, createFooter(['Database initialization complete']));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cliOutput.error(`Failed to initialize schemas: ${errorMessage}`);
    logger.error(LogSource.DATABASE, `Failed to initialize schemas: ${errorMessage}`);
    process.exit(1);
  }
};

/**
 * Validate database schemas.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
const validateSchemas = async (): Promise<void> => {
  const logger = LoggerService.getInstance();
  const cliOutput = CliOutputService.getInstance();
  const queryService = DatabaseQueryService.getInstance();

  cliOutput.info('Validating database schemas...\n');
  logger.info(LogSource.DATABASE, 'Validating database schemas...');

  try {
    const isInitialized = await queryService.isInitialized();

    if (!isInitialized) {
      cliOutput.error('Database not initialized. Run init first.');
      process.exit(1);
      return;
    }

    cliOutput.success('\n✓ All schemas are valid.');
    logger.info(LogSource.DATABASE, '\n✓ All schemas are valid.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cliOutput.error(`Validation failed: ${errorMessage}`);
    logger.error(LogSource.DATABASE, `Validation failed: ${errorMessage}`);
    process.exit(1);
  }
};

/**
 * Display action error and exit.
 * @param action - The invalid action.
 * @param cliOutput - CLI output service.
 * @param logger - Logger service.
 */
const handleInvalidAction = (
  action: string | undefined,
  cliOutput: CliOutputService,
  logger: LoggerService
): never => {
  const actionText = action ?? 'undefined';
  cliOutput.error(`Unknown action: ${actionText}`);
  cliOutput.error('Valid actions are: list, init, validate');
  logger.error(LogSource.DATABASE, `Unknown action: ${actionText}`);
  logger.error(LogSource.DATABASE, 'Valid actions are: list, init, validate');
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
  const {action: actionArg} = args;
  const action = typeof actionArg === 'string' ? actionArg : undefined;

  if (action == null || action === '') {
    handleInvalidAction(action, cliOutput, logger);
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
        await validateSchemas();
        break;
      default:
        handleInvalidAction(action, cliOutput, logger);
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
