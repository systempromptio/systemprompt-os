/**
 * @fileoverview Import configuration command
 * @module modules/core/config/cli/import
 */

import { ConfigModule } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Execute import command
 */
async function execute(options: {
  file: string;
  'dry-run'?: boolean;
  merge?: boolean;
}): Promise<void> {
  if (!options.file) {
    console.error('Error: Configuration file is required');
    process.exit(1);
  }

  const dryRun = options['dry-run'] || false;
  const merge = options.merge !== false; // Default to true as per module.yaml

  try {
    const configModule = new ConfigModule();
    await configModule.initialize();

    // Read the import file
    const filePath = path.resolve(options.file);
    let fileContent: string;

    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.error(`Error reading file: ${filePath}`);
      console.error(error);
      process.exit(1);
    }

    // Parse the configuration
    let importConfig: any;
    try {
      importConfig = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error parsing JSON from file: ${filePath}`);
      console.error(error);
      process.exit(1);
    }

    // Get current configuration
    const currentConfig = configModule.get() || {};

    // Prepare the new configuration
    let newConfig: any;
    if (merge) {
      // Merge configurations
      newConfig = deepMerge(currentConfig, importConfig);
    } else {
      // Replace configuration
      newConfig = importConfig;
    }

    // Show what will be changed
    console.log('\nConfiguration Import Preview');
    console.log('='.repeat(60));
    console.log(`Source file: ${filePath}`);
    console.log(`Mode: ${merge ? 'Merge' : 'Replace'}`);

    if (dryRun) {
      console.log('\n--- DRY RUN MODE ---');
      console.log('The following configuration would be applied:');
      console.log(JSON.stringify(newConfig, null, 2));
      console.log('\nNo changes have been made.');
      return;
    }

    // Apply the configuration
    if (merge) {
      // Apply each key individually when merging
      for (const [key, value] of Object.entries(importConfig)) {
        await configModule.set(key, value);
      }
    } else {
      // For replace mode, we need to clear existing and set new
      // Since ConfigModule doesn't have a clear method, we'll set the entire config
      for (const [key, value] of Object.entries(newConfig)) {
        await configModule.set(key, value);
      }
    }

    console.log('\n✓ Configuration imported successfully');
    console.log(`Imported ${Object.keys(importConfig).length} configuration key(s)`);
  } catch (error) {
    console.error(
      `Error importing configuration: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Deep merge two objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (isObject(source[key]) && isObject(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Check if value is a plain object
 */
function isObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};
