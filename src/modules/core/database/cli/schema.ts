import type { ICLIContext } from '@/modules/core/cli/types/index';
import { DatabaseSchemaService } from '@/modules/core/cli/services/database-schema.service';
import type { ISchemaInitParams, ISchemaValidateParams } from '@/modules/core/cli/services/database-schema.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { createFooter, createHeader } from '@/modules/core/cli/utils/cli-formatter';

/**
 * List installed schemas.
 * @returns Promise that resolves when complete.
 */
const listSchemas = async (): Promise<void> => {
  const logger = LoggerService.getInstance();
  const schemaService = DatabaseSchemaService.getInstance();

  const result = await schemaService.listSchemas();

  if (!result.success) {
    logger.error(LogSource.DATABASE, result.message ?? 'Failed to list schemas');
    return;
  }

  if (!result.data || result.data.schemas.length === 0) {
    logger.info(LogSource.DATABASE, 'No schemas found.');
    return;
  }

  logger.info(LogSource.DATABASE, createHeader('Installed Schemas', undefined, false));
  logger.info(LogSource.DATABASE, '\nModule Name           Version    Installed At');
  logger.info(LogSource.DATABASE, '-'.repeat(60));

  result.data.schemas.forEach((schema): void => {
    const moduleName = schema.moduleName.padEnd(20);
    const version = schema.version.padEnd(10);
    const [installedDate] = schema.installedAt.split('T');
    logger.info(LogSource.DATABASE, `${moduleName} ${version} ${installedDate ?? ''}`);
  });
};

/**
 * Initialize database schemas.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
const initSchemas = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const schemaService = DatabaseSchemaService.getInstance();

  const {args} = context;
  const {module: moduleNameArg, force: forceArg} = args;
  const moduleName = typeof moduleNameArg === 'string' ? moduleNameArg : undefined;
  const forceInit = Boolean(forceArg);

  const initParams: ISchemaInitParams = {
    force: forceInit
  };

  if (moduleName) {
    initParams.module = moduleName;
  }

  const initResult = await schemaService.initializeSchemas(initParams);

  if (!initResult.success) {
    logger.error(LogSource.DATABASE, initResult.message ?? 'Failed to initialize schemas');
    process.exit(1);
  }

  if (initResult.warnings) {
    initResult.warnings.forEach((warning): void => {
      logger.warn(LogSource.DATABASE, warning);
    });
  }

  if (initResult.results) {
    initResult.results.forEach((result): void => {
      if (result.success) {
        logger.info(LogSource.DATABASE, `✓ ${result.module}: ${result.message ?? 'Success'}`);
      } else {
        logger.error(LogSource.DATABASE, `✗ ${result.module}: ${result.message ?? 'Failed'}`);
      }
    });
  }

  logger.info(LogSource.DATABASE, createFooter(['Database initialization complete']));
};

/**
 * Validate database schemas.
 * @param context - CLI context.
 * @returns Promise that resolves when complete.
 */
const validateSchemas = async (context: ICLIContext): Promise<void> => {
  const logger = LoggerService.getInstance();
  const schemaService = DatabaseSchemaService.getInstance();

  const {args} = context;
  const {module: moduleNameArg} = args;
  const moduleName = typeof moduleNameArg === 'string' ? moduleNameArg : undefined;

  logger.info(LogSource.DATABASE, 'Validating database schemas...\n');

  const validateParams: ISchemaValidateParams = {};

  if (moduleName) {
    validateParams.module = moduleName;
  }

  const validationResult = await schemaService.validateSchemas(validateParams);

  if (!validationResult.success) {
    logger.error(LogSource.DATABASE, validationResult.message ?? 'Validation failed');
    process.exit(1);
  }

  if (validationResult.issues
      && validationResult.issues.length > 0) {
    validationResult.issues.forEach((issue): void => {
      const icon = issue.severity === 'error' ? '✗' : '⚠️';
      if (issue.severity === 'error') {
        logger.error(LogSource.DATABASE, `${icon} ${issue.module}: ${issue.message}`);
      } else {
        logger.warn(LogSource.DATABASE, `${icon} ${issue.module}: ${issue.message}`);
      }
    });

    logger.warn(
      LogSource.DATABASE,
      '\n⚠️  Schema validation found issues. '
      + "Run 'systemprompt database:schema --action=init' to fix."
    );
    process.exit(1);
  } else {
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
  const {args} = context;
  const {action: actionArg} = args;
  const action = typeof actionArg === 'string' ? actionArg : undefined;

  if (!action) {
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
        logger.error(LogSource.DATABASE, `Unknown action: ${action}`);
        logger.error(LogSource.DATABASE, 'Valid actions are: list, init, validate');
        process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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
