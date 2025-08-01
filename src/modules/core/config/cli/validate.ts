/**
 * Config validate CLI command.
 * Provides validation functionality for configuration files and current configuration.
 * @file Config validate CLI command.
 * @module modules/core/config/cli/validate
 */

import { z } from 'zod';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'yaml';
import { configModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import type {
  IConfigStructure,
  IProvidersConfig,
  ISystemDefaults
} from '@/modules/core/config/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

/**
 * Zod schema for command arguments.
 */
const validateArgsSchema = z.object({
  file: z.string().optional(),
  format: z.enum(['text', 'json']).default('text')
});

/**
 * Valid environment options.
 */
const VALID_ENVIRONMENTS = ['development', 'production', 'test'] as const;

/**
 * Valid log levels.
 */
const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;

/**
 * Validate system defaults configuration.
 * @param system - System configuration.
 * @returns Array of validation errors.
 */
const validateSystemDefaults = (system: ISystemDefaults): string[] => {
  const errors: string[] = [];

  if (system.port !== undefined && (typeof system.port !== 'number' || system.port < 1 || system.port > 65535)) {
    errors.push('defaults.system.port must be a valid port number (1-65535)');
  }

  if (system.host !== undefined && typeof system.host !== 'string') {
    errors.push('defaults.system.host must be a string');
  }

  if (system.environment !== undefined && typeof system.environment === 'string'
      && !VALID_ENVIRONMENTS.includes(system.environment as typeof VALID_ENVIRONMENTS[number])) {
    errors.push('defaults.system.environment must be one of: development, production, test');
  }

  if (system.logLevel !== undefined && typeof system.logLevel === 'string'
      && !VALID_LOG_LEVELS.includes(system.logLevel as typeof VALID_LOG_LEVELS[number])) {
    errors.push('defaults.system.logLevel must be one of: error, warn, info, debug');
  }

  return errors;
};

/**
 * Validate providers section.
 * @param providers - Providers configuration.
 * @returns Array of validation errors.
 */
const validateProviders = (providers: IProvidersConfig): string[] => {
  const errors: string[] = [];

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

  return errors;
};

/**
 * Validate configuration structure and content.
 * @param config - Configuration object to validate.
 * @returns Array of validation errors (empty if valid).
 */
const validateConfig = (config: IConfigStructure): string[] => {
  const errors: string[] = [];

  if (!config.defaults) {
    errors.push('Missing required section: defaults');
  }

  if (!config.providers) {
    errors.push('Missing required section: providers');
  }

  if (config.defaults?.system) {
    const systemErrors = validateSystemDefaults(config.defaults.system);
    errors.push(...systemErrors);
  }

  if (config.providers) {
    const providerErrors = validateProviders(config.providers);
    errors.push(...providerErrors);
  }

  return errors;
};

/**
 * Parse file content based on extension.
 * @param filepath - File path.
 * @param content - File content.
 * @returns Parsed configuration object.
 */
const parseFileContent = async (filepath: string, content: string): Promise<IConfigStructure> => {
  const ext = filepath.toLowerCase().split('.')
.pop();

  if (ext === 'json') {
    try {
      return JSON.parse(content) as IConfigStructure;
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (ext === 'yaml' || ext === 'yml') {
    try {
      return yaml.parse(content) as IConfigStructure;
    } catch (error) {
      throw new Error(`Invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error('Unsupported file format. Use .json or .yaml/.yml');
};

/**
 * Create default configuration structure.
 * @returns Default configuration object.
 */
const createDefaultConfig = (): IConfigStructure => {
  return {
    defaults: {
      system: {
        port: 3000,
        host: '0.0.0.0',
        environment: 'development',
        logLevel: 'info'
      }
    },
    providers: {
      available: ['google', 'openai'],
      enabled: ['google'],
      default: 'google'
    }
  };
};

/**
 * Load configuration from file.
 * @param filepath - File path to load.
 * @returns Parsed configuration.
 */
const loadConfigFromFile = async (filepath: string): Promise<IConfigStructure> => {
  const content = readFileSync(filepath, 'utf-8');
  return await parseFileContent(filepath, content);
};

/**
 * Load current configuration from module.
 * @returns Current configuration or default if invalid.
 */
const loadCurrentConfig = async (): Promise<IConfigStructure> => {
  await configModule.initialize();
  const rawConfig = await configModule.exports.service().list();

  if (!rawConfig || Array.isArray(rawConfig) || typeof rawConfig !== 'object'
      || !('defaults' in rawConfig || 'providers' in rawConfig)) {
    return createDefaultConfig();
  }

  return rawConfig as IConfigStructure;
};

/**
 * Output validation results in text format.
 * @param result - Validation result.
 * @param result.valid
 * @param config - Configuration object.
 * @param result.errors
 * @param cliOutput - CLI output service.
 */
const outputTextResult = (
  result: { valid: boolean; errors: string[] },
  config: IConfigStructure,
  cliOutput: CliOutputService
): void => {
  if (result.valid) {
    cliOutput.success('✓ Configuration is valid!');
    displayConfigSummary(config, cliOutput);
  } else {
    cliOutput.error('✗ Configuration is invalid!');
    result.errors.forEach((error: string) => {
      cliOutput.error(`  ${error}`);
    });
  }
};

/**
 * Display configuration summary.
 * @param config - Configuration object.
 * @param cliOutput - CLI output service.
 */
const displayConfigSummary = (config: IConfigStructure, cliOutput: CliOutputService): void => {
  if (config.providers) {
    const availableCount = Array.isArray(config.providers.available)
      ? config.providers.available.length
      : 0;
    const enabledCount = Array.isArray(config.providers.enabled)
      ? config.providers.enabled.length
      : 0;

    cliOutput.info(`Providers: ${String(availableCount)} available, ${String(enabledCount)} enabled`);

    if (config.providers.default) {
      cliOutput.info(`Default Provider: ${config.providers.default}`);
    }
  }

  if (config.defaults?.system) {
    if (config.defaults.system.environment) {
      cliOutput.info(`Environment: ${config.defaults.system.environment}`);
    }
    if (config.defaults.system.host && config.defaults.system.port) {
      cliOutput.info(`Server: ${config.defaults.system.host}:${String(config.defaults.system.port)}`);
    }
  }
};

/**
 * Handle validation errors.
 * @param error - Error object.
 * @param context - CLI context.
 * @param cliOutput - CLI output service.
 * @param logger - Logger service.
 */
const handleValidationError = (
  error: unknown,
  context: ICLIContext,
  cliOutput: CliOutputService,
  logger: LoggerService
): void => {
  const errorResult = {
    valid: false,
    errors: [error instanceof Error ? error.message : String(error)]
  };

  if (context.args.format === 'json') {
    cliOutput.json(errorResult);
  } else if (error instanceof z.ZodError) {
    cliOutput.error('Invalid arguments:');
    error.errors.forEach((err: z.ZodIssue) => {
      cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    cliOutput.error('Validation failed');
    logger.error(LogSource.CLI, 'Validation failed', {
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
};

export const command: ICLICommand = {
  description: 'Validate configuration file or current configuration',
  options: [
    {
      name: 'file',
      alias: 'f',
      type: 'string',
      description: 'Configuration file to validate (optional, validates current config if not provided)'
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = validateArgsSchema.parse(context.args);

      let config: IConfigStructure;

      if (validatedArgs.file) {
        const filepath = resolve(validatedArgs.file);

        if (!existsSync(filepath)) {
          const errorResult = {
            valid: false,
            errors: [`File not found: ${validatedArgs.file}`]
          };

          if (validatedArgs.format === 'json') {
            cliOutput.json(errorResult);
          } else {
            cliOutput.error(`File not found: ${validatedArgs.file}`);
          }
          process.exit(1);
        }

        config = await loadConfigFromFile(filepath);
      } else {
        config = await loadCurrentConfig();
      }

      const errors = validateConfig(config);
      const result = {
        valid: errors.length === 0,
        errors,
        summary: errors.length === 0
          ? 'Configuration is valid'
          : `Configuration has ${String(errors.length)} error(s)`
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(result);
      } else {
        outputTextResult(result, config, cliOutput);
      }

      process.exit(result.valid ? 0 : 1);
    } catch (error) {
      handleValidationError(error, context, cliOutput, logger);
      process.exit(1);
    }
  },
};
