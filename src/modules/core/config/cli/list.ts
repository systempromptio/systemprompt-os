/**
 * Config list CLI command implementation.
 * @module modules/core/config/cli/list
 */

import { z } from 'zod';
import { configModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

// Zod schema for command arguments
const listArgsSchema = z.object({
  format: z.enum(['text', 'json', 'table']).default('text')
});

/**
 * Format configuration data in tree structure.
 * @param configData - Configuration data to format.
 * @param prefix - Current line prefix for tree structure.
 * @returns Formatted tree string.
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

export const command: ICLICommand = {
  description: 'List all configuration values',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json', 'table'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = listArgsSchema.parse(context.args);

      await configModule.initialize();
      const configService = configModule.exports.service();
      const configList = await configService.list();

      const configData = Array.isArray(configList)
        ? buildConfigDataFromList(configList)
        : configList;

      if (configData === null || configData === undefined
          || typeof configData === 'object' && Object.keys(configData).length === 0) {
        if (validatedArgs.format === 'json') {
          cliOutput.json([]);
        } else {
          cliOutput.info('No configuration values found.');
        }
        process.exit(0);
        return;
      }

      switch (validatedArgs.format) {
        case 'json':
          if (Array.isArray(configList)) {
            cliOutput.json(configList);
          } else {
            cliOutput.json(configData);
          }
          break;

        case 'table':
          if (Array.isArray(configList)) {
            cliOutput.table(configList, [
              {
 key: 'key',
header: 'Key'
},
              {
 key: 'value',
header: 'Value'
},
              {
 key: 'description',
header: 'Description'
}
            ]);
          } else {
            const tableData = Object.entries(configData).map(([key, value]) => { return {
              key,
              value: typeof value === 'string' ? value : JSON.stringify(value),
              description: ''
            } });
            cliOutput.table(tableData, [
              {
 key: 'key',
header: 'Key'
},
              {
 key: 'value',
header: 'Value'
}
            ]);
          }
          break;

        case 'text':
        default:
          cliOutput.section('Configuration Values');
          cliOutput.output(formatTree(configData));
          break;
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        cliOutput.error('Failed to list configuration');
        logger.error(LogSource.CLI, 'Failed to list configuration', {
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
      process.exit(1);
    }
  }
};
