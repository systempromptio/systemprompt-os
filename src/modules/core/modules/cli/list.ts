/**
 * List modules CLI command.
 * @file List modules CLI command.
 * @module modules/core/modules/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import type { IModulesRow } from '@/modules/core/modules/types/database.generated';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Helper function to display module information in text format.
 * @param filteredModules - Array of modules to display.
 * @param logger - Logger service instance.
 */
const displayModulesAsText = (filteredModules: IModulesRow[]): void => {
  console.log('\nInstalled Modules:');
  console.log('═════════════════\n');

  if (filteredModules.length === 0) {
    console.log('No modules found.');
  } else {
    filteredModules.forEach((moduleItem): void => {
      console.log(`Name: ${String(moduleItem.name)}`);
      console.log(`Type: ${String(moduleItem.type)}`);
      console.log(`Version: ${String(moduleItem.version)}`);
      console.log(`Status: ${moduleItem.enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`Path: ${String(moduleItem.path)}`);
      console.log(`─────────────────`);
    });
  }

  console.log(`\nTotal: ${String(filteredModules.length)} modules`);
};

/**
 * Check if value is a valid string.
 * @param value - Value to check.
 * @returns True if value is a string.
 */
const isValidString = (value: unknown): value is string => {
  return value !== undefined && value !== null && typeof value === 'string';
};

/**
 * Execute list modules functionality with type filtering.
 * @param config - Configuration object.
 * @param config.modules - All available modules.
 * @param config.typeFilter - Type filter to apply.
 * @param config.format - Output format (json or text).
 * @param config.logger - Logger service instance.
 */
const executeListModules = (config: {
  modules: IModulesRow[];
  typeFilter: string;
  format: string;
  logger: LoggerService;
}): void => {
  const {
    modules,
    typeFilter,
    format,
    logger: _logger
  } = config;
  let filteredModules = modules;
  if (typeFilter !== 'all') {
    filteredModules = modules.filter((moduleItem): boolean => {
      return String(moduleItem.type) === typeFilter;
    });
  }

  if (format === 'json') {
    console.log(JSON.stringify(filteredModules, null, 2));
  } else {
    displayModulesAsText(filteredModules);
  }
};

const command: ICLICommand = {
  description: 'List installed extensions and modules',
  async execute(context: ICLIContext): Promise<void> {
    const { args } = context;
    const logger = LoggerService.getInstance();

    try {
      const moduleManager = ModuleManagerService.getInstance();
      const modules = await moduleManager.getAllModules();

      const { type: typeValue, format: formatValue } = args;

      const typeFilter = isValidString(typeValue) ? typeValue : 'all';
      const format = isValidString(formatValue) ? formatValue : 'text';

      executeListModules({
        modules,
        typeFilter,
        format,
        logger
      });

      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LogSource.MODULES, `Error listing modules: ${errorMessage}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  },
};

export { command };
