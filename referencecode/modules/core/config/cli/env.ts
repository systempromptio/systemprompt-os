/**
 * @fileoverview Manage environment variables command
 * @module modules/core/config/cli/env
 */

import { ConfigModule } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Execute env command
 */
async function execute(options: {
  action?: string;
  key?: string;
  value?: string;
  file?: string;
}): Promise<void> {
  const action = options.action || 'list';
  const envFile = options.file || '.env';

  try {
    const configModule = new ConfigModule();
    await configModule.initialize();

    // For now, we'll use process.env directly since ConfigModule doesn't have env-specific methods
    switch (action) {
    case 'list':
      await listEnvVars(envFile);
      break;

    case 'get':
      if (!options.key) {
        console.error('Error: Key is required for get action');
        process.exit(1);
      }
      await getEnvVar(options.key, envFile);
      break;

    case 'set':
      if (!options.key || options.value === undefined) {
        console.error('Error: Key and value are required for set action');
        process.exit(1);
      }
      await setEnvVar(options.key, options.value, envFile);
      break;

    case 'unset':
      if (!options.key) {
        console.error('Error: Key is required for unset action');
        process.exit(1);
      }
      await unsetEnvVar(options.key, envFile);
      break;

    case 'export':
      await exportEnvFile(envFile);
      break;

    default:
      console.error(`Error: Unknown action: ${action}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `Error managing environment variables: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

async function listEnvVars(envFile: string) {
  try {
    const fullPath = path.resolve(envFile);
    if (!(await fileExists(fullPath))) {
      console.log(`\nEnvironment file not found: ${envFile}`);
      console.log('No environment variables to display.');
      return;
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    const envVars = parseEnvFile(content);

    console.log(`\nEnvironment Variables from ${envFile}`);
    console.log('='.repeat(60));

    if (Object.keys(envVars).length === 0) {
      console.log('No environment variables found');
      return;
    }

    const sortedKeys = Object.keys(envVars).sort();
    for (const key of sortedKeys) {
      const value = envVars[key];
      console.log(`${key}=${value}`);
    }

    console.log(`\nTotal: ${sortedKeys.length} variable(s)`);
  } catch (error) {
    console.error(`Error reading environment file: ${error}`);
    process.exit(1);
  }
}

async function getEnvVar(key: string, envFile: string) {
  try {
    const fullPath = path.resolve(envFile);
    if (!(await fileExists(fullPath))) {
      console.error(`Environment file not found: ${envFile}`);
      process.exit(1);
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    const envVars = parseEnvFile(content);

    if (envVars[key] !== undefined) {
      console.log(envVars[key]);
    } else {
      console.error(`Environment variable '${key}' not found in ${envFile}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error reading environment file: ${error}`);
    process.exit(1);
  }
}

async function setEnvVar(key: string, value: string, envFile: string) {
  try {
    const fullPath = path.resolve(envFile);
    let envVars: Record<string, string> = {};

    if (await fileExists(fullPath)) {
      const content = await fs.readFile(fullPath, 'utf-8');
      envVars = parseEnvFile(content);
    }

    envVars[key] = value;

    // Write back to file
    let newContent = '';
    for (const [k, v] of Object.entries(envVars)) {
      newContent += `${k}=${v}\n`;
    }

    await fs.writeFile(fullPath, newContent, 'utf-8');
    console.log(`✓ Set ${key}=${value} in ${envFile}`);
  } catch (error) {
    console.error(`Error setting environment variable: ${error}`);
    process.exit(1);
  }
}

async function unsetEnvVar(key: string, envFile: string) {
  try {
    const fullPath = path.resolve(envFile);
    if (!(await fileExists(fullPath))) {
      console.error(`Environment file not found: ${envFile}`);
      process.exit(1);
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    const envVars = parseEnvFile(content);

    if (envVars[key] === undefined) {
      console.error(`Environment variable '${key}' not found in ${envFile}`);
      process.exit(1);
    }

    delete envVars[key];

    // Write back to file
    let newContent = '';
    for (const [k, v] of Object.entries(envVars)) {
      newContent += `${k}=${v}\n`;
    }

    await fs.writeFile(fullPath, newContent, 'utf-8');
    console.log(`✓ Unset ${key} from ${envFile}`);
  } catch (error) {
    console.error(`Error unsetting environment variable: ${error}`);
    process.exit(1);
  }
}

async function exportEnvFile(envFile: string) {
  try {
    const fullPath = path.resolve(envFile);
    if (!(await fileExists(fullPath))) {
      console.error(`Environment file not found: ${envFile}`);
      process.exit(1);
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    const envVars = parseEnvFile(content);

    // Export to stdout in a format that can be sourced
    console.log('# Environment variables export');
    console.log(`# Generated on ${new Date().toISOString()}`);
    console.log('');

    const sortedKeys = Object.keys(envVars).sort();
    for (const key of sortedKeys) {
      const value = envVars[key];
      // Properly escape values for shell
      if (!value) {throw new Error('value is required');}
      const escapedValue = value.replace(/"/g, '\\"');
      console.log(`export ${key}="${escapedValue}"`);
    }

    console.log('');
    console.log(`# Total: ${sortedKeys.length} variable(s) exported`);
  } catch (error) {
    console.error(`Error exporting environment variables: ${error}`);
    process.exit(1);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const variables: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {continue;}

    // Parse KEY=VALUE format
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {continue;}

    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    variables[key] = value;
  }

  return variables;
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};
