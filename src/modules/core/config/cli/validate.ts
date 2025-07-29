/**
 * Config validate CLI command.
 * Provides validation functionality for configuration files and current configuration.
 * @file Config validate CLI command.
 * @module modules/core/config/cli/validate
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { getConfigModule } from '@/modules/core/config/index';
import type {
  IConfigStructure,
  IDefaultsConfig,
  IProvidersConfig,
  ISystemDefaults,
  IValidateCommandContext
} from '@/modules/core/config/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';

/**
 * Valid environment options.
 */
const VALID_ENVIRONMENTS = ['development', 'production', 'test'] as const;

/**
 * Valid log levels.
 */
const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;

/**
 * Validate port number.
 * @param port - Port to validate.
 * @returns Error message or null.
 */
const validatePort = (port: unknown): string | null => {
  if (typeof port !== 'number' || port < 1 || port > 65535) {
    return 'defaults.system.port must be a valid port number (1-65535)';
  }
  return null;
};

/**
 * Validate host string.
 * @param host - Host to validate.
 * @returns Error message or null.
 */
const validateHost = (host: unknown): string | null => {
  if (typeof host !== 'string') {
    return 'defaults.system.host must be a string';
  }
  return null;
};

/**
 * Validate environment string.
 * @param environment - Environment to validate.
 * @returns Error message or null.
 */
const validateEnvironment = (environment: unknown): string | null => {
  if (typeof environment === 'string' && !VALID_ENVIRONMENTS.includes(environment as 'development' | 'production' | 'test')) {
    return 'defaults.system.environment must be one of: development, production, test';
  }
  return null;
};

/**
 * Validate log level string.
 * @param logLevel - Log level to validate.
 * @returns Error message or null.
 */
const validateLogLevel = (logLevel: unknown): string | null => {
  if (typeof logLevel === 'string' && !VALID_LOG_LEVELS.includes(logLevel as 'error' | 'warn' | 'info' | 'debug')) {
    return 'defaults.system.logLevel must be one of: error, warn, info, debug';
  }
  return null;
};

/**
 * Validate port configuration.
 * @param system - System configuration.
 * @param errors - Array to collect errors.
 */
const validatePortConfig = (system: ISystemDefaults, errors: string[]): void => {
  if (system.port !== undefined) {
    const portError = validatePort(system.port);
    if (portError !== null) {
      errors.push(portError);
    }
  }
};

/**
 * Validate host configuration.
 * @param system - System configuration.
 * @param errors - Array to collect errors.
 */
const validateHostConfig = (system: ISystemDefaults, errors: string[]): void => {
  if (system.host !== undefined) {
    const hostError = validateHost(system.host);
    if (hostError !== null) {
      errors.push(hostError);
    }
  }
};

/**
 * Validate environment configuration.
 * @param system - System configuration.
 * @param errors - Array to collect errors.
 */
const validateEnvironmentConfig = (system: ISystemDefaults, errors: string[]): void => {
  if (system.environment !== undefined) {
    const envError = validateEnvironment(system.environment);
    if (envError !== null) {
      errors.push(envError);
    }
  }
};

/**
 * Validate log level configuration.
 * @param system - System configuration.
 * @param errors - Array to collect errors.
 */
const validateLogLevelConfig = (system: ISystemDefaults, errors: string[]): void => {
  if (system.logLevel !== undefined) {
    const logError = validateLogLevel(system.logLevel);
    if (logError !== null) {
      errors.push(logError);
    }
  }
};

/**
 * Validate system defaults configuration.
 * @param system - System configuration.
 * @returns Array of validation errors.
 */
const validateSystemDefaults = (system: ISystemDefaults): string[] => {
  const errors: string[] = [];

  validatePortConfig(system, errors);
  validateHostConfig(system, errors);
  validateEnvironmentConfig(system, errors);
  validateLogLevelConfig(system, errors);

  return errors;
};

/**
 * Validate defaults section.
 * @param defaults - Defaults configuration.
 * @param errors - Array to collect errors.
 */
const validateDefaults = (defaults: IDefaultsConfig, errors: string[]): void => {
  if (defaults.system !== null && defaults.system !== undefined) {
    const systemErrors = validateSystemDefaults(defaults.system);
    errors.push(...systemErrors);
  }
};

/**
 * Validate providers arrays.
 * @param providers - Providers configuration.
 * @param errors - Array to collect errors.
 */
const validateProvidersArrays = (providers: IProvidersConfig, errors: string[]): void => {
  if (!Array.isArray(providers.available)) {
    errors.push('providers.available must be an array');
  }

  if (!Array.isArray(providers.enabled)) {
    errors.push('providers.enabled must be an array');
  }

  if (typeof providers.default !== 'string') {
    errors.push('providers.default must be a string');
  }
};

/**
 * Validate enabled providers against available.
 * @param providers - Providers configuration.
 * @param errors - Array to collect errors.
 */
const validateEnabledProviders = (providers: IProvidersConfig, errors: string[]): void => {
  if (Array.isArray(providers.available) && Array.isArray(providers.enabled)) {
    for (const enabledProvider of providers.enabled) {
      if (!providers.available.includes(enabledProvider)) {
        errors.push(`Enabled provider '${enabledProvider}' is not in available providers`);
      }
    }
  }
};

/**
 * Validate default provider against enabled.
 * @param providers - Providers configuration.
 * @param errors - Array to collect errors.
 */
const validateDefaultProvider = (providers: IProvidersConfig, errors: string[]): void => {
  if (Array.isArray(providers.enabled) && typeof providers.default === 'string') {
    if (!providers.enabled.includes(providers.default)) {
      errors.push(`Default provider '${providers.default}' is not enabled`);
    }
  }
};

/**
 * Validate providers section.
 * @param providers - Providers configuration.
 * @param errors - Array to collect errors.
 */
const validateProviders = (providers: IProvidersConfig, errors: string[]): void => {
  validateProvidersArrays(providers, errors);
  validateEnabledProviders(providers, errors);
  validateDefaultProvider(providers, errors);
};

/**
 * Validate configuration structure and content.
 * @param config - Configuration object to validate.
 * @returns Array of validation errors (empty if valid).
 */
const validateConfig = (config: IConfigStructure): string[] => {
  const errors: string[] = [];

  if (config.defaults === null || config.defaults === undefined) {
    errors.push('Missing required section: defaults');
  }

  if (config.providers === null || config.providers === undefined) {
    errors.push('Missing required section: providers');
  }

  if (config.defaults !== null && config.defaults !== undefined) {
    validateDefaults(config.defaults, errors);
  }

  if (config.providers !== null && config.providers !== undefined) {
    validateProviders(config.providers, errors);
  }

  return errors;
};

/**
 * Parse JSON file content.
 * @param content - File content.
 * @returns Parsed configuration object.
 */
const parseJsonContent = (content: string): IConfigStructure => {
  try {
    const parsed = JSON.parse(content);
    return parsed as IConfigStructure;
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Parse YAML file content.
 * @param content - File content.
 * @returns Parsed configuration object.
 */
const parseYamlContent = async (content: string): Promise<IConfigStructure> => {
  try {
    const yaml = await import('yaml');
    const parsed = yaml.parse(content);
    return parsed as IConfigStructure;
  } catch (error) {
    throw new Error(`Invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Parse file content based on extension.
 * @param filepath - File path.
 * @param content - File content.
 * @returns Parsed configuration object.
 * @throws If parsing fails or format is unsupported.
 */
const parseFileContent = async (filepath: string, content: string): Promise<IConfigStructure> => {
  const ext = filepath.toLowerCase()
    .split('.')
    .pop();

  if (ext === 'json') {
    return parseJsonContent(content);
  }

  if (ext === 'yaml' || ext === 'yml') {
    return await parseYamlContent(content);
  }

  throw new Error('Unsupported file format. Use .json or .yaml/.yml');
};

/**
 * Log provider summary.
 * @param providers - Providers configuration.
 * @param logger - Logger instance.
 */
const logProviderSummary = (providers: IProvidersConfig, logger: ILogger): void => {
  const availableCount = Array.isArray(providers.available)
    ? providers.available.length
    : 0;
  const enabledCount = Array.isArray(providers.enabled)
    ? providers.enabled.length
    : 0;

  logger.info(LogSource.CLI, `Providers: ${String(availableCount)} available, ${String(enabledCount)} enabled`);

  if (providers.default !== null && providers.default !== undefined && providers.default.length > 0) {
    logger.info(LogSource.CLI, `Default Provider: ${providers.default}`);
  }
};

/**
 * Log system summary.
 * @param system - System configuration.
 * @param logger - Logger instance.
 */
const logSystemSummary = (system: ISystemDefaults, logger: ILogger): void => {
  if (typeof system.environment === 'string' && system.environment.length > 0) {
    logger.info(LogSource.CLI, `Environment: ${system.environment}`);
  }

  if (typeof system.host === 'string'
      && system.host.length > 0
      && typeof system.port === 'number') {
    logger.info(LogSource.CLI, `Server: ${system.host}:${String(system.port)}`);
  }
};

/**
 * Display configuration summary.
 * @param config - Configuration object.
 * @param logger - Logger instance.
 */
const displayConfigSummary = (config: IConfigStructure, logger: ILogger): void => {
  if (config.providers !== null && config.providers !== undefined) {
    logProviderSummary(config.providers, logger);
  }

  if (config.defaults?.system !== null && config.defaults?.system !== undefined) {
    logSystemSummary(config.defaults.system, logger);
  }
};

/**
 * Check if configuration object has required structure.
 * @param rawConfig - Raw configuration from source.
 * @returns Whether the configuration has defaults or providers.
 */
const hasRequiredStructure = (rawConfig: unknown): boolean => {
  if (rawConfig === null || rawConfig === undefined || Array.isArray(rawConfig)) {
    return false;
  }

  if (typeof rawConfig !== 'object') {
    return false;
  }

  const config = rawConfig as Record<string, unknown>;
  return 'defaults' in config || 'providers' in config;
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
 * @param file - File path.
 * @param logger - Logger instance.
 * @returns Configuration object.
 */
const loadConfigFromFile = async (file: string, logger: ILogger): Promise<IConfigStructure> => {
  logger.info(LogSource.CLI, 'Validating Configuration...');
  logger.info(LogSource.CLI, `Validating file: ${file}`);

  const filepath = resolve(file);

  if (!existsSync(filepath)) {
    logger.error(LogSource.CLI, `Error: File not found: ${file}`);
    process.exit(1);
  }

  const content = readFileSync(filepath, 'utf-8');
  return await parseFileContent(filepath, content);
};

/**
 * Load current configuration.
 * @param logger - Logger instance.
 * @returns Configuration object.
 */
const loadCurrentConfig = async (logger: ILogger): Promise<IConfigStructure> => {
  logger.info(LogSource.CLI, 'Validating Configuration...');
  logger.info(LogSource.CLI, 'Validating current configuration');

  const configModule = getConfigModule();
  const rawConfig = await configModule.exports.get();

  if (hasRequiredStructure(rawConfig)) {
    const config = rawConfig as IConfigStructure;
    return config;
  }

  return createDefaultConfig();
};

/**
 * Log validation errors.
 * @param errors - Array of validation errors.
 * @param logger - Logger instance.
 */
const logValidationErrors = (errors: string[], logger: ILogger): void => {
  logger.error(LogSource.CLI, '✗ Configuration is invalid!');
  for (const error of errors) {
    logger.error(LogSource.CLI, `  ${error}`);
  }
};

/**
 * Handle validation errors during file operations.
 * @param error - Error object.
 * @param file - File path or null.
 * @param logger - Logger instance.
 */
const handleValidationError = (error: unknown, file: string | null | undefined, logger: ILogger): void => {
  if (error instanceof Error) {
    if (file !== null
        && file !== undefined
        && file.length > 0
        && error.message.includes('Unsupported file format')) {
      logger.error(LogSource.CLI, `Error: ${error.message}`);
    } else if (error.name === 'SyntaxError' || error.message.includes('JSON')) {
      logger.error(LogSource.CLI, `Error parsing file: ${error.message}`);
    } else {
      logger.error(LogSource.CLI, `Error: ${error.message}`);
    }
  } else {
    logger.error(LogSource.CLI, `Error: ${String(error)}`);
  }
};

/**
 * Execute configuration validation.
 * @param context - Command context.
 */
const executeValidation = async (context: IValidateCommandContext): Promise<void> => {
  const { file } = context;
  const logger = LoggerService.getInstance();

  try {
    const config = file !== null && file !== undefined && file.length > 0
      ? await loadConfigFromFile(file, logger)
      : await loadCurrentConfig(logger);

    const errors = validateConfig(config);

    if (errors.length === 0) {
      logger.info(LogSource.CLI, '✓ Configuration is valid!');
      displayConfigSummary(config, logger);
    } else {
      logValidationErrors(errors, logger);
      process.exit(1);
    }
  } catch (error) {
    handleValidationError(error, file, logger);
    process.exit(1);
  }
};

export const command = {
  description: 'Validate configuration file or current configuration',
  execute: executeValidation,
};
