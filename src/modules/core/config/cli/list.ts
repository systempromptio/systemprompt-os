/**
 * Config list CLI command implementation.
 * @module modules/core/config/cli/list
 */

import { ConfigModule } from '@/modules/core/config/index';

// Export functions for testing
export { formatTree, formatYaml };

/**
 * Format configuration data in tree structure.
 * @param {any} data - Configuration data to format.
 * @param {string} prefix - Current line prefix for tree structure.
 * @returns {string} Formatted tree string.
 */
function formatTree(data: any, prefix = ''): string {
  if (data === null || data === undefined) {
    return '';
  }

  const lines: string[] = [];
  const keys = Object.keys(data);

  keys.forEach((key, index) => {
    const isLastKey = index === keys.length - 1;
    const value = data[key];
    const currentPrefix = isLastKey ? '└── ' : '├── ';
    const nextPrefix = isLastKey ? '    ' : '│   ';

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${prefix}${currentPrefix}${key}/`);
      const childLines = formatTree(value, prefix + nextPrefix);
      if (childLines) {
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
}

/**
 * Format configuration data in YAML format.
 * @param {any} data - Configuration data to format.
 * @param {number} indent - Current indentation level.
 * @returns {string} Formatted YAML string.
 */
function formatYaml(data: any, indent = 0): string {
  if (data === null) {
    return 'null';
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    if (typeof data === 'string') {
      return `"${data}"`;
    }
    return JSON.stringify(data);
  }

  const lines: string[] = [];
  const indentStr = '  '.repeat(indent);
  const keys = Object.keys(data);

  keys.forEach(key => {
    const value = data[key];
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
}

interface ListCommandOptions {
  format?: 'tree' | 'json' | 'yaml';
}

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
  async execute(options: ListCommandOptions = {}): Promise<void> {
    const configModule = new ConfigModule();
    await configModule.initialize();

    const configData = await configModule.get();

    if (!configData || typeof configData === 'object' && Object.keys(configData as any).length === 0) {
      console.log('No configuration values found.');
      return;
    }

    const format = options.format || 'tree';

    switch (format) {
      case 'json':
        console.log(JSON.stringify(configData, null, 2));
        break;

      case 'yaml':
        console.log(formatYaml(configData));
        break;

      case 'tree':
      default:
        console.log('\nConfiguration Values:');
        console.log('====================\n');
        console.log(formatTree(configData));
        break;
    }
  }
};
