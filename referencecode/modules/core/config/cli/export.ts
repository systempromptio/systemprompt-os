/**
 * @fileoverview Export configuration command
 * @module modules/core/config/cli/export
 */

import { ConfigModule } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Execute export command
 */
async function execute(options: {
  output?: string;
  format?: string;
  'include-secrets'?: boolean;
}): Promise<void> {
  const output = options.output || './backup/config-export.json';
  const format = options.format || 'json';
  const includeSecrets = options['include-secrets'] || false;

  try {
    const configModule = new ConfigModule();
    await configModule.initialize();

    // Get all configuration values
    const allConfig = configModule.get() || {};

    // Mask secrets if requested
    const exportConfig = includeSecrets ? allConfig : maskSecrets(allConfig);

    // Format the output
    let exportData: string;
    if (format === 'yaml') {
      // Simple YAML formatting
      exportData = objectToYaml(exportConfig);
    } else {
      exportData = JSON.stringify(exportConfig, null, 2);
    }

    // Ensure output directory exists
    const outputPath = path.resolve(output);
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write to file
    await fs.writeFile(outputPath, exportData, 'utf-8');

    console.log(`\nConfiguration exported successfully to: ${outputPath}`);
    console.log(`Format: ${format.toUpperCase()}`);
    console.log(`Secrets included: ${includeSecrets ? 'Yes' : 'No (masked)'}`);
  } catch (error) {
    console.error(
      `Error exporting configuration: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

function objectToYaml(obj: any, indent = 0): string {
  const spaces = ' '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n${objectToYaml(value, indent + 2)}`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      value.forEach((item) => {
        yaml += `${spaces}- ${typeof item === 'object' ? `\n${  objectToYaml(item, indent + 4)}` : item}\n`;
      });
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

function maskSecrets(config: any): any {
  const sensitivePatterns = [
    'SECRET',
    'PASSWORD',
    'PASS',
    'KEY',
    'TOKEN',
    'PRIVATE',
    'CREDENTIAL',
    'AUTH',
    'API_KEY',
  ];

  const maskValue = (key: string, value: any): any => {
    const upperKey = key.toUpperCase();
    const isSensitive = sensitivePatterns.some((pattern) => upperKey.includes(pattern));

    if (isSensitive && typeof value === 'string') {
      return '***MASKED***';
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const masked: any = {};
      for (const [k, v] of Object.entries(value)) {
        masked[k] = maskValue(k, v);
      }
      return masked;
    }

    return value;
  };

  const masked: any = {};
  for (const [k, v] of Object.entries(config)) {
    masked[k] = maskValue(k, v);
  }

  return masked;
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};
