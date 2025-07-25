/**
 * @fileoverview Get configuration value CLI command
 * @module modules/core/config/cli/get
 */

import { ConfigModule } from '../index.js';

/**
 * Execute get command
 */
async function execute(options: { key?: string }): Promise<void> {
  // Create a temporary config module instance
  const configModule = new ConfigModule();
  await configModule.initialize();

  const value = configModule.get(options.key);

  if (value === undefined) {
    if (options.key) {
      console.error(`Configuration key '${options.key}' not found.`);
      process.exit(1);
    } else {
      console.log('No configuration values found.');
    }
    return;
  }

  console.log(JSON.stringify(value, null, 2));
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};