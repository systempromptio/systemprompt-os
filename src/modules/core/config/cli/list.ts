/**
 * Config list CLI command implementation.
 * @module modules/core/config/cli/list
 */

import { getConfigModule } from '@/modules/core/config/index';
import { LogSource, getLoggerModule } from '@/modules/core/logger/index';

/**
 * Options for the list command.
 */
interface IListCommandOptions {
  format?: 'tree' | 'json' | 'yaml';
}

/**
 * Format configuration data in tree structure.
 * @param {unknown} configData - Configuration data to format.
 * @param {string} prefix - Current line prefix for tree structure.
 * @returns {string} Formatted tree string.
 */
const formatTree = (configData: unknown, prefix = ''): string => {
  if (configData === null || configData === undefined) {
    return '';
  }

  if (typeof configData !== 'object' || Array.isArray(configData)) {
    return '';
  }

  const lines: string[] = [];
  const dataObject = configData as Record<string, unknown>;
  const keys = Object.keys(dataObject);

  keys.forEach((key, index): void => {
    const isLastKey = index === keys.length - 1;
    const { [key]: value } = dataObject;
    const currentPrefix = isLastKey ? '└── ' : '├── ';
    const nextPrefix = isLastKey ? '    ' : '│   ';

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${prefix}${currentPrefix}${key}/`);
      const childLines = formatTree(value, prefix + nextPrefix);
      if (childLines.length > 0) {
        lines.push(childLines);
      }
    } else {
      let formattedValue: string;
      if (Array.isArray(value)) {
        formattedValue = JSON.stringify(value);
      } else if (typeof value === 'string') {
        formattedValue = `"${value}"`;
      } else {
        formattedValue = String(value);
      }
      lines.push(`${prefix}${currentPrefix}${key}: ${formattedValue}`);
    }
  });

  return lines.join('\n');
};

/**
 * Format configuration data in YAML format.
 * @param {unknown} configData - Configuration data to format.
 * @param {number} indent - Current indentation level.
 * @returns {string} Formatted YAML string.
 */
const formatYaml = (configData: unknown, indent = 0): string => {
  if (configData === null) {
    return 'null';
  }

  if (typeof configData !== 'object' || Array.isArray(configData)) {
    if (typeof configData === 'string') {
      return `"${configData}"`;
    }
    return JSON.stringify(configData);
  }

  const lines: string[] = [];
  const indentStr = '  '.repeat(indent);
  const dataObject = configData as Record<string, unknown>;
  const keys = Object.keys(dataObject);

  keys.forEach((key): void => {
    const { [key]: value } = dataObject;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${indentStr}${key}:`);
      const childYaml = formatYaml(value, indent + 1);
      lines.push(childYaml);
    } else {
      let formattedValue: string;
      if (typeof value === 'string') {
        formattedValue = `"${value}"`;
      } else {
        formattedValue = JSON.stringify(value);
      }
      lines.push(`${indentStr}${key}: ${formattedValue}`);
    }
  });

  return lines.join('\n');
};

/**
 * Export functions for testing.
 */
export { formatTree, formatYaml };

/**
 * CLI command for listing configuration values.
 */
export const command = {
  /**
   * Execute the list command.
   * @param {object} options - Command options.
   * @param {string} [options.format] - Output format (tree, json, yaml).
   * @returns {Promise<void>} Promise that resolves when command completes.
   */
  async execute(options: IListCommandOptions = {}): Promise<void> {
    try {
      const configModule = getConfigModule();
      const configList = await configModule.exports.get();

      const configData = Array.isArray(configList)
        ? configList.reduce<Record<string, unknown>>((acc, entry) => {
            if (entry && typeof entry === 'object' && 'key' in entry && 'value' in entry) {
              acc[String(entry.key)] = entry.value;
            }
            return acc;
          }, {})
        : configList;

      const loggerModule = getLoggerModule();
      const logger = loggerModule.exports.service();

      if (!configData || typeof configData === 'object'
          && Object.keys(configData).length === 0) {
        logger.info(LogSource.CLI, 'No configuration values found.');
        process.exit(0);
        return;
      }

      const format = options.format ?? 'tree';

      switch (format) {
        case 'json':
          logger.info(LogSource.CLI, JSON.stringify(configData, null, 2));
          break;

        case 'yaml':
          logger.info(LogSource.CLI, formatYaml(configData));
          break;

        case 'tree':
          logger.info(LogSource.CLI, '\nConfiguration Values:');
          logger.info(LogSource.CLI, '====================\n');
          logger.info(LogSource.CLI, formatTree(configData));
          break;
      }
    } catch (error) {
      const loggerModule = getLoggerModule();
      const logger = loggerModule.exports.service();
      logger.error(LogSource.CLI, 'Failed to list configuration', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }
  }
};
