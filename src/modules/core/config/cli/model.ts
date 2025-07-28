/**
 * Model CLI command implementation.
 * @file Model CLI command implementation.
 * @module modules/core/config/cli/model
 */

import {
  getEnabledProviders,
  getProvider,
  providers
} from '@/modules/core/config/providers';
import { GoogleGenAI } from '@google/genai';
import { getLoggerService } from '@/modules/core/logger';
import { LogSource } from '@/modules/core/logger/types';
import type {
  IModelCommandOptions,
  IProviderConfig
} from '@/modules/core/config/types/model.types';
import type { IProvider } from '@/modules/core/config/types/provider.types';
import { executeModelTest } from '@/modules/core/config/cli/model-commands';
import {
  formatTools,
  logModelConfigDetails
} from '@/modules/core/config/cli/model-helpers';

const logger = getLoggerService();

/**
 * Type guard to check if object is a valid provider.
 * @param obj - Object to check.
 * @returns True if valid provider.
 */
const isValidProvider = (obj: unknown): obj is {
  name: string;
  displayName: string;
  enabled: boolean;
  config?: unknown;
} => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }
  const record = obj as Record<string, unknown>;
  return 'name' in record
    && 'displayName' in record
    && 'enabled' in record
    && typeof record.name === 'string'
    && typeof record.displayName === 'string'
    && typeof record.enabled === 'boolean';
};

/**
 * Create typed provider from base provider.
 * @param provider - Base provider.
 * @returns Typed provider.
 * @throws {Error} If provider is invalid.
 */
const createTypedProvider = (provider: unknown): IProvider => {
  if (!isValidProvider(provider)) {
    throw new Error('Invalid provider structure');
  }

  const typedProvider: IProvider = {
    name: provider.name,
    displayName: provider.displayName,
    enabled: provider.enabled
  };

  if (provider.config !== undefined
      && typeof provider.config === 'object'
      && provider.config !== null) {
    const {config} = provider;
    if ('client' in config || 'models' in config || 'defaultModel' in config) {
      const providerConfig = config;
      Object.defineProperty(typedProvider, 'config', {
        value: providerConfig,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }

  return typedProvider;
};

/**
 * Validates provider for the given provider name.
 * @param providerName - The provider name to validate.
 * @returns The validated provider or exits the process.
 */
const validateProvider = (providerName: string): IProvider => {
  const provider = getProvider(providerName);

  if (provider === null) {
    logger.error(LogSource.CLI, `Provider '${providerName}' not found.`);
    process.exit(1);
  }

  if (!provider.enabled) {
    logger.error(LogSource.CLI, `Provider '${providerName}' is not enabled.`);
    process.exit(1);
  }

  return createTypedProvider(provider);
};

/**
 * Validates provider config and models.
 * @param provider - The provider to validate.
 * @param operation - The operation being performed.
 * @returns The validated provider config.
 */
const validateProviderConfig = (
  provider: IProvider,
  operation: string
): IProviderConfig => {
  if (provider.name !== 'google-liveapi') {
    logger.error(
      LogSource.CLI,
      `${operation} is only available for google-liveapi provider.`
    );
    process.exit(1);
  }

  const { config: providerConfig } = provider;
  if (providerConfig === undefined || providerConfig.models === undefined) {
    logger.error(LogSource.CLI, 'No models configured for this provider.');
    process.exit(1);
  }

  return providerConfig;
};

/**
 * Log model details for a single model.
 * @param modelKey - The model key.
 * @param modelConfig - The model configuration.
 * @param defaultModel - The default model key.
 */
const logModelDetails = (
  modelKey: string,
  modelConfig: NonNullable<IProviderConfig['models']>[string],
  defaultModel?: string
): void => {
  const isDefault = modelKey === defaultModel;
  logger.info(LogSource.CLI, `  ${modelKey}${isDefault ? ' [DEFAULT]' : ''}:`);
  logger.info(LogSource.CLI, `    Model: ${modelConfig.model}`);
  logger.info(LogSource.CLI, `    Display: ${modelConfig.displayName}`);

  if (modelConfig.description !== undefined) {
    logger.info(LogSource.CLI, `    Description: ${modelConfig.description}`);
  }

  if (modelConfig.generationConfig?.temperature !== undefined) {
    const { generationConfig } = modelConfig;
    const temp = String(generationConfig.temperature);
    logger.info(LogSource.CLI, `    Temperature: ${temp}`);
  }

  if (modelConfig.tools !== undefined) {
    logger.info(LogSource.CLI, `    Tools: ${formatTools(modelConfig.tools)}`);
  }

  logger.info(LogSource.CLI, '');
};

/**
 * Process provider models.
 * @param provider - The provider to process.
 * @returns Number of models found.
 */
const processProviderModels = (provider: IProvider): number => {
  let modelCount = 0;

  if (provider.name === 'google-liveapi'
      && provider.config?.models !== undefined) {
    const { config: providerConfig } = provider;
    const { models, defaultModel } = providerConfig;

    if (models !== undefined) {
      Object.entries(models).forEach(([modelKey, modelConfig]): void => {
        logModelDetails(modelKey, modelConfig, defaultModel);
        modelCount += 1;
      });
    }
  } else {
    logger.info(
      LogSource.CLI,
      '  Model information not available for this provider.'
    );
    logger.info(LogSource.CLI, '');
  }

  return modelCount;
};

/**
 * Get providers to check.
 * @param providerName - Optional provider name.
 * @returns Array of providers to check.
 */
const getProvidersToCheck = (providerName?: string): IProvider[] => {
  if (providerName === undefined) {
    const enabledProviders = getEnabledProviders().map((prov: unknown): IProvider => {
      return createTypedProvider(prov);
    });
    if (enabledProviders.length === 0) {
      logger.error(LogSource.CLI, 'No enabled providers found.');
      process.exit(1);
    }
    return enabledProviders;
  }

  const { [providerName]: providerData } = providers;
  if (providerData === undefined || !providerData.enabled) {
    logger.error(
      LogSource.CLI,
      `Provider '${providerName}' not found or not enabled.`
    );
    process.exit(1);
  }
  return [createTypedProvider(providerData)];
};

/**
 * List models subcommand implementation.
 * @param options - Command options.
 */
const listModels = (options: IModelCommandOptions): void => {
  const providersToCheck = getProvidersToCheck(options.provider);

  logger.info(LogSource.CLI, 'Available AI Models:');
  logger.info(LogSource.CLI, '==================\n');

  let totalModels = 0;

  providersToCheck.forEach((provider): void => {
    logger.info(LogSource.CLI, `Provider: ${provider.displayName} (${provider.name})`);
    logger.info(LogSource.CLI, '-'.repeat(50));
    totalModels += processProviderModels(provider);
  });

  logger.info(LogSource.CLI, `Total models available: ${String(totalModels)}`);
};

/**
 * Validate and get model config.
 * @param provider - The provider.
 * @param modelName - The model name.
 * @param providerName - The provider name.
 * @returns The model configuration.
 */
const getModelConfig = (
  provider: IProvider,
  modelName: string,
  providerName: string
): NonNullable<IProviderConfig['models']>[string] => {
  const providerConfig = validateProviderConfig(provider, 'Model operation');
  const { models } = providerConfig;

  if (!models || !(modelName in models) || models[modelName] === undefined) {
    const availableModels = models ? Object.keys(models) : [];
    logger.error(
      LogSource.CLI,
      `Model '${modelName}' not found in provider '${providerName}'.`
    );
    logger.error(LogSource.CLI, `Available models: ${availableModels.join(', ')}`);
    process.exit(1);
  }

  return models[modelName];
};

/**
 * Log model header info.
 * @param provider - The provider.
 * @param modelKey - The model key.
 * @param modelConfig - The model configuration.
 */
const logModelHeader = (
  provider: IProvider,
  modelKey: string,
  modelConfig: NonNullable<IProviderConfig['models']>[string]
): void => {
  const { config: providerConfig } = provider;
  const isDefault = providerConfig !== undefined
                    && modelKey === providerConfig.defaultModel;

  logger.info(LogSource.CLI, 'Model Configuration:');
  logger.info(LogSource.CLI, '===================');
  logger.info(LogSource.CLI, '');
  logger.info(LogSource.CLI, `Provider: ${provider.displayName}`);
  logger.info(LogSource.CLI, `Model Key: ${modelKey}`);
  logger.info(LogSource.CLI, `Status: ${isDefault ? 'DEFAULT MODEL' : 'AVAILABLE'}`);
  logger.info(LogSource.CLI, `Model ID: ${modelConfig.model}`);
  logger.info(LogSource.CLI, `Display Name: ${modelConfig.displayName}`);
};

/**
 * Show model details subcommand implementation.
 * @param options - Command options.
 */
const showModel = (options: IModelCommandOptions): void => {
  if (options.provider === undefined || options.model === undefined) {
    logger.error(LogSource.CLI, 'Both provider and model must be specified.');
    process.exit(1);
  }

  const provider = validateProvider(options.provider);
  validateProviderConfig(provider, 'Model details');
  const modelConfig = getModelConfig(provider, options.model, options.provider);

  logModelHeader(provider, options.model, modelConfig);
  logModelConfigDetails(modelConfig);
};

/**
 * Validate API key.
 * @param providerConfig - The provider configuration.
 */
const validateApiKey = (providerConfig: IProviderConfig): void => {
  if (providerConfig.client?.apiKey === undefined
      || providerConfig.client.apiKey === '') {
    logger.error(LogSource.CLI, 'API key not configured for this provider.');
    logger.error(
      LogSource.CLI,
      'Please set the API key in the provider configuration.'
    );
    process.exit(1);
  }
};

/**
 * Log test header.
 * @param provider - The provider.
 * @param modelConfig - The model configuration.
 * @param prompt - The test prompt.
 */
const logTestHeader = (
  provider: IProvider,
  modelConfig: NonNullable<IProviderConfig['models']>[string],
  prompt: string
): void => {
  logger.info(LogSource.CLI, 'Testing Model Configuration:');
  logger.info(LogSource.CLI, '===========================');
  logger.info(LogSource.CLI, '');
  logger.info(LogSource.CLI, `Provider: ${provider.displayName}`);
  logger.info(LogSource.CLI, `Model: ${modelConfig.displayName} (${modelConfig.model})`);
  logger.info(LogSource.CLI, `Prompt: ${prompt}`);
  logger.info(LogSource.CLI, '');
  logger.info(LogSource.CLI, 'Sending test request...');
};

/**
 * Handle test error.
 * @param error - The error.
 */
const handleTestError = (error: unknown): void => {
  logger.error(LogSource.CLI, 'Error testing model:');
  if (error instanceof Error) {
    logger.error(LogSource.CLI, error.message);

    if (process.env.DEBUG === 'true' && error.stack !== undefined) {
      logger.error(LogSource.CLI, '');
      logger.error(LogSource.CLI, 'Stack trace:');
      logger.error(LogSource.CLI, error.stack);
    }
  } else {
    logger.error(LogSource.CLI, String(error));
  }

  process.exit(1);
};

/**
 * Prepare model test parameters.
 * @param options - Command options.
 * @returns Test parameters.
 * @throws {Error} If API key is missing.
 */
const prepareModelTest = (options: IModelCommandOptions): {
  provider: IProvider;
  modelConfig: NonNullable<IProviderConfig['models']>[string];
  apiKey: string;
  prompt: string;
} => {
  if (options.provider === undefined || options.model === undefined) {
    logger.error(LogSource.CLI, 'Both provider and model must be specified.');
    process.exit(1);
  }

  const provider = validateProvider(options.provider);
  const providerConfig = validateProviderConfig(provider, 'Model testing');
  const modelConfig = getModelConfig(provider, options.model, options.provider);

  validateApiKey(providerConfig);

  const apiKey = providerConfig.client?.apiKey;
  if (apiKey === undefined || apiKey === '') {
    throw new Error('API key is missing');
  }

  const prompt = options.prompt ?? "Hello, please respond with 'Test successful!'";

  return {
 provider,
modelConfig,
apiKey,
prompt
};
};

/**
 * Test model subcommand implementation.
 * @param options - Command options.
 */
const testModel = async (options: IModelCommandOptions): Promise<void> => {
  const {
 provider, modelConfig, apiKey, prompt
} = prepareModelTest(options);

  logTestHeader(provider, modelConfig, prompt);

  try {
    const genAI = new GoogleGenAI({ apiKey });
    await executeModelTest(genAI, modelConfig, prompt);
  } catch (error) {
    handleTestError(error);
  }
};

/**
 * Model CLI command object.
 */
export const command = {
  description: 'Manage AI model configurations',

  /**
   * Execute the model command.
   * @param subcommand - The subcommand to execute.
   * @param options - Command options.
   */
  execute: async (subcommand: string, options: IModelCommandOptions = {}): Promise<void> => {
    switch (subcommand) {
      case 'list':
        listModels(options);
        break;

      case 'show':
        showModel(options);
        break;

      case 'test':
        await testModel(options);
        break;

      default:
        logger.error(LogSource.CLI, `Unknown model subcommand: ${subcommand}`);
        logger.error(LogSource.CLI, 'Available subcommands: list, show, test');
        process.exit(1);
    }
  }
};
