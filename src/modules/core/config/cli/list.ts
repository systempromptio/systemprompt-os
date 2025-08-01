/**
 * Config list CLI command implementation.
 * @module modules/core/config/cli/list
 */

import { configModule } from '@/modules/core/config/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import type { IListCommandOptions } from '@/modules/core/config/types/manual';

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
 * Build config data object from list array.
 * @param configList - List of config entries.
 * @returns Config data object.
 */
const buildConfigDataFromList = (
  configList: unknown[]
): Record<string, unknown> => {
  return configList.reduce<Record<string, unknown>>(
    (acc, entry): Record<string, unknown> => {
      if (entry !== null && entry !== undefined
          && typeof entry === 'object' && 'key' in entry && 'value' in entry) {
        const typedEntry = entry as { key: string; value: unknown };
        return {
          ...acc,
          [typedEntry.key]: typedEntry.value
        };
      }
      return acc;
    },
    {}
  );
};

export const command = {
  /**
   * Execute the list command.
   * @param {object} options - Command options.
   * @param {string} [options.format] - Output format (tree, json, yaml).
   * @returns {Promise<void>} Promise that resolves when command completes.
   */
  async execute(options: IListCommandOptions = {}): Promise<void> {
    try {
      await configModule.initialize();
      const configList = await configModule.exports.service().list();

      const configData = Array.isArray(configList)
        ? buildConfigDataFromList(configList)
        : configList;

      const cliOutput = CliOutputService.getInstance();

      if (configData === null || configData === undefined
          || typeof configData === 'object' && Object.keys(configData).length === 0) {
        cliOutput.info('No configuration values found.');
        process.exit(0);
        return;
      }

      const format = options.format ?? 'tree';

      switch (format) {
        case 'json':
          cliOutput.info(JSON.stringify(configData, null, 2));
          break;

        case 'yaml':
          cliOutput.info(formatYaml(configData));
          break;

        case 'tree':
          cliOutput.info('\nConfiguration Values:');
          cliOutput.info('====================\n');
          cliOutput.info(formatTree(configData));
          break;
        default:
          cliOutput.info('\nConfiguration Values:');
          cliOutput.info('====================\n');
          cliOutput.info(formatTree(configData));
          break;
      }
    } catch (error) {
      const logger = LoggerService.getInstance();
      const cliOutput = CliOutputService.getInstance();
      cliOutput.error('Failed to list configuration');
      logger.error(LogSource.CLI, 'Failed to list configuration', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }
  }
};
