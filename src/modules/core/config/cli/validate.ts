/**
 * @file Config validate CLI command.
 * @module modules/core/config/cli/validate
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigModule } from '@/modules/core/config/index';

interface SystemDefaults {
  port?: number;
  host?: string;
  environment?: string;
  logLevel?: string;
}

interface DefaultsConfig {
  system?: SystemDefaults;
}

interface ProvidersConfig {
  available?: string[];
  enabled?: string[];
  default?: string;
}

interface ConfigStructure {
  defaults?: DefaultsConfig;
  providers?: ProvidersConfig;
  [key: string]: any;
}

interface ValidateCommandContext {
  file?: string;
}

/**
 * Validate configuration structure and content.
 * @param {object} config - Configuration object to validate.
 * @returns {string[]} Array of validation errors (empty if valid).
 */
function validateConfig(config: ConfigStructure): string[] {
  const errors: string[] = [];

  if (!config.defaults) {
    errors.push('Missing required section: defaults');
  }

  if (!config.providers) {
    errors.push('Missing required section: providers');
  }

  if (config.defaults) {
    validateDefaults(config.defaults, errors);
  }

  if (config.providers) {
    validateProviders(config.providers, errors);
  }

  return errors;
}

/**
 * Validate defaults section.
 * @param {object} defaults - Defaults configuration.
 * @param {string[]} errors - Array to collect errors.
 */
function validateDefaults(defaults: DefaultsConfig, errors: string[]): void {
  if (defaults.system) {
    const { system } = defaults;

    if (system.port !== undefined) {
      if (typeof system.port !== 'number' || system.port < 1 || system.port > 65535) {
        errors.push('defaults.system.port must be a valid port number (1-65535)');
      }
    }

    if (system.host !== undefined && typeof system.host !== 'string') {
      errors.push('defaults.system.host must be a string');
    }

    if (system.environment !== undefined) {
      const validEnvironments = ['development', 'production', 'test'];
      if (!validEnvironments.includes(system.environment)) {
        errors.push('defaults.system.environment must be one of: development, production, test');
      }
    }

    if (system.logLevel !== undefined) {
      const validLogLevels = ['error', 'warn', 'info', 'debug'];
      if (!validLogLevels.includes(system.logLevel)) {
        errors.push('defaults.system.logLevel must be one of: error, warn, info, debug');
      }
    }
  }
}

/**
 * Validate providers section.
 * @param {object} providers - Providers configuration.
 * @param {string[]} errors - Array to collect errors.
 */
function validateProviders(providers: ProvidersConfig, errors: string[]): void {
  if (!Array.isArray(providers.available)) {
    errors.push('providers.available must be an array');
  }

  if (!Array.isArray(providers.enabled)) {
    errors.push('providers.enabled must be an array');
  }

  if (typeof providers.default !== 'string') {
    errors.push('providers.default must be a string');
  }

  if (Array.isArray(providers.available) && Array.isArray(providers.enabled)) {
    for (const enabledProvider of providers.enabled) {
      if (!providers.available.includes(enabledProvider)) {
        errors.push(`Enabled provider '${enabledProvider}' is not in available providers`);
      }
    }
  }

  if (Array.isArray(providers.enabled) && typeof providers.default === 'string') {
    if (!providers.enabled.includes(providers.default)) {
      errors.push(`Default provider '${providers.default}' is not enabled`);
    }
  }
}

/**
 * Parse file content based on extension.
 * @param {string} filepath - File path.
 * @param {string} content - File content.
 * @returns {Promise<object>} Parsed configuration object.
 * @throws {Error} If parsing fails or format is unsupported.
 */
async function parseFileContent(filepath: string, content: string): Promise<ConfigStructure> {
  const ext = filepath.toLowerCase().split('.')
.pop();

  if (ext === 'json') {
    return JSON.parse(content);
  }

  if (ext === 'yaml' || ext === 'yml') {
    const yaml = await import('yaml');
    return yaml.parse(content);
  }

  throw new Error('Unsupported file format. Use .json or .yaml/.yml');
}

/**
 * Display configuration summary.
 * @param {object} config - Configuration object.
 */
function displayConfigSummary(config: ConfigStructure): void {
  if (config.providers) {
    const availableCount = Array.isArray(config.providers.available) ? config.providers.available.length : 0;
    const enabledCount = Array.isArray(config.providers.enabled) ? config.providers.enabled.length : 0;
    console.log(`Providers: ${availableCount} available, ${enabledCount} enabled`);

    if (config.providers.default) {
      console.log(`Default Provider: ${config.providers.default}`);
    }
  }

  if (config.defaults?.system) {
    const { system } = config.defaults;
    if (system.environment) {
      console.log(`Environment: ${system.environment}`);
    }
    if (system.host && system.port) {
      console.log(`Server: ${system.host}:${system.port}`);
    }
  }
}

export const command = {
  description: 'Validate configuration file or current configuration',
  execute: async (context: ValidateCommandContext): Promise<void> => {
    const { file } = context;

    try {
      let config: ConfigStructure;

      if (file) {
        console.log('Validating Configuration...');
        console.log(`Validating file: ${file}`);

        const filepath = resolve(file);

        if (!existsSync(filepath)) {
          console.error(`Error: File not found: ${file}`);
          process.exit(1);
        }

        const content = readFileSync(filepath, 'utf-8');
        config = await parseFileContent(filepath, content);
      } else {
        console.log('Validating Configuration...');
        console.log('Validating current configuration');

        const configModule = new ConfigModule();
        await configModule.initialize();
        config = await configModule.get() as ConfigStructure;
      }

      const errors = validateConfig(config);

      if (errors.length === 0) {
        console.log('✓ Configuration is valid!');
        displayConfigSummary(config);
      } else {
        console.error('✗ Configuration is invalid!');
        for (const error of errors) {
          console.error(`  ${error}`);
        }
        process.exit(1);
      }
    } catch (error) {
      const err = error as Error;
      if (file && err.message.includes('Unsupported file format')) {
        console.error(`Error: ${err.message}`);
      } else if (err.name === 'SyntaxError' || err.message.includes('JSON')) {
        console.error(`Error parsing file: ${err.message}`);
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }
  },
};
