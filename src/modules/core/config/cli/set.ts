/**
 * @fileoverview Set configuration value CLI command
 * @module modules/core/config/cli/set
 */

import { ConfigModule } from '../index.js';

/**
 * Execute set command
 */
async function execute(options: { key: string; value: string }): Promise<void> {
  if (!options.key || !options.value) {
    console.error('Error: Both key and value are required.');
    process.exit(1);
  }
  
  // Create a temporary config module instance
  const configModule = new ConfigModule();
  await configModule.initialize({ config: { configPath: './state/config' } });
  
  // Parse value if it looks like JSON
  let parsedValue: any = options.value;
  if (options.value.startsWith('{') || options.value.startsWith('[') || 
      options.value === 'true' || options.value === 'false' ||
      !isNaN(Number(options.value))) {
    try {
      parsedValue = JSON.parse(options.value);
    } catch {
      // Keep as string if JSON parse fails
    }
  }
  
  configModule.set(options.key, parsedValue);
  
  console.log(`✓ Configuration updated:`);
  console.log(`  ${options.key} = ${JSON.stringify(parsedValue)}`);
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute
};