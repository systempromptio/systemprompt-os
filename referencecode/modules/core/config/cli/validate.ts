/**
 * @fileoverview Validate configuration CLI command
 * @module modules/core/config/cli/validate
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigModule } from '../index.js';

/**
 * Validate configuration structure
 */
function validateConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for required top-level sections
  if (!config.defaults) {
    errors.push('Missing required section: defaults');
  }

  if (!config.providers) {
    errors.push('Missing required section: providers');
  } else {
    if (!config.providers.available || !Array.isArray(config.providers.available)) {
      errors.push('providers.available must be an array');
    }
    if (!config.providers.enabled || !Array.isArray(config.providers.enabled)) {
      errors.push('providers.enabled must be an array');
    }
    if (!config.providers.default || typeof config.providers.default !== 'string') {
      errors.push('providers.default must be a string');
    }

    // Check that enabled providers are subset of available
    if (config.providers.enabled && config.providers.available) {
      config.providers.enabled.forEach((provider: string) => {
        if (!config.providers.available.includes(provider)) {
          errors.push(`Enabled provider '${provider}' is not in available providers`);
        }
      });
    }

    // Check that default is enabled
    if (config.providers.default && config.providers.enabled) {
      if (!config.providers.enabled.includes(config.providers.default)) {
        errors.push(`Default provider '${config.providers.default}' is not enabled`);
      }
    }
  }

  // Check system defaults
  if (config.defaults?.system) {
    const system = config.defaults.system;
    if (typeof system.port !== 'number' || system.port < 1 || system.port > 65535) {
      errors.push('defaults.system.port must be a valid port number (1-65535)');
    }
    if (typeof system.host !== 'string') {
      errors.push('defaults.system.host must be a string');
    }
    if (!['development', 'production', 'test'].includes(system.environment)) {
      errors.push('defaults.system.environment must be one of: development, production, test');
    }
    if (!['error', 'warn', 'info', 'debug'].includes(system.logLevel)) {
      errors.push('defaults.system.logLevel must be one of: error, warn, info, debug');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Execute validate command
 */
async function execute(options: { file?: string }): Promise<void> {
  console.log('\nValidating Configuration...');
  console.log('=========================\n');

  let config: any;

  if (options.file) {
    // Validate external file
    const filePath = resolve(process.cwd(), options.file);

    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    try {
      const content = readFileSync(filePath, 'utf-8');

      if (filePath.endsWith('.json')) {
        config = JSON.parse(content);
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        const yaml = await import('yaml');
        config = yaml.parse(content);
      } else {
        console.error('Error: Unsupported file format. Use .json or .yaml/.yml');
        process.exit(1);
      }

      console.log(`Validating file: ${filePath}`);
    } catch (error) {
      console.error(`Error parsing file: ${error}`);
      process.exit(1);
    }
  } else {
    // Validate current configuration
    const configModule = new ConfigModule();
    await configModule.initialize();
    config = configModule.get();
    console.log('Validating current configuration');
  }

  const result = validateConfig(config);

  if (result.valid) {
    console.log('\n✓ Configuration is valid!');
    console.log('\nSummary:');
    console.log(
      `  Providers: ${config.providers?.available?.length || 0} available, ${config.providers?.enabled?.length || 0} enabled`,
    );
    console.log(`  Default Provider: ${config.providers?.default || 'Not set'}`);
    console.log(`  Environment: ${config.defaults?.system?.environment || 'Not set'}`);
    console.log(
      `  Server: ${config.defaults?.system?.host || 'localhost'}:${config.defaults?.system?.port || 8080}`,
    );
  } else {
    console.error('\n✗ Configuration is invalid!');
    console.error('\nErrors found:');
    result.errors.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error}`);
    });
    process.exit(1);
  }
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};
