// eslint-disable-next-line systemprompt-os/no-block-comments
/* eslint-disable systemprompt-os/no-console-with-help,
   @typescript-eslint/consistent-type-assertions,
   max-statements,
   @typescript-eslint/require-await,
   prefer-destructuring,
   systemprompt-os/enforce-type-exports */

/**
 * Provider CLI command implementation for managing AI providers.
 * @file Provider CLI command implementation.
 * @module modules/core/config/cli/provider
 */

import {
  disableProvider,
  enableProvider,
  getEnabledProviders,
  getProvider,
  providerRegistry,
  providers,
  setDefaultProvider
} from '@/modules/core/config/providers';
import type {
  IGenerationConfig,
  IModelConfig,
  ITool
} from '@/modules/core/config/types/manual';
import type {
  ICommandOptions,
  IProviderWithVersion
} from '@/modules/core/config/types/manual';

/**
 * Output interface for CLI operations.
 */
interface IOutput {
  log: typeof console.log;
  error: typeof console.error;
}

/**
 * Get the output function based on context.
 * @returns Output function.
 */
const getOutput = (): IOutput => {
  return {
    log: console.log,
    error: console.error
  };
};

/**
 * Mask API key for display purposes.
 * @param apiKey - The API key to mask.
 * @returns Masked API key.
 */
const maskApiKey = (apiKey: string): string => {
  if (apiKey.length === 0) {
    return 'Not set';
  }
  if (apiKey.length <= 4) {
    return '***';
  }
  return `***${apiKey.slice(-4)}`;
};

/**
 * Format provider configuration for display.
 * @param provider - Provider object.
 * @returns Formatted configuration.
 */
const formatProviderConfig = (provider: IProviderWithVersion): string => {
  if (provider.name === 'google-liveapi'
      && provider.config?.client?.apiKey !== undefined) {
    const lines = [];
    lines.push(`    API Key: ${maskApiKey(provider.config.client.apiKey)}`);
    if (provider.config.defaultModel !== undefined) {
      lines.push(`    Default Model: ${provider.config.defaultModel}`);
    }
    return lines.join('\n');
  }

  return JSON.stringify(provider.config, null, 2);
};

/**
 * Format generation config details.
 * @param config - Generation config.
 * @returns Formatted lines.
 */
const formatGenerationConfig = (config: IGenerationConfig): string[] => {
  const lines: string[] = [];
  if (config.temperature !== undefined) {
    lines.push(`    Temperature: ${String(config.temperature)}`);
  }
  if (config.maxOutputTokens !== undefined) {
    const tokens = String(config.maxOutputTokens);
    lines.push(`    Max Output Tokens: ${tokens}`);
  }
  return lines;
};

/**
 * Format tool names.
 * @param tools - Tools array.
 * @returns Formatted tool names.
 */
const formatTools = (tools: ITool[]): string => {
  return tools.map((tool): string => {
    if (tool.codeExecution === true) {
      return 'Code Execution';
    }
    return 'Unknown Tool';
  }).join(', ');
};

/**
 * Format model details for display.
 * @param model - Model configuration.
 * @returns Formatted model details.
 */
const formatModelDetails = (model: IModelConfig): string => {
  const lines = [];
  lines.push(`    Model: ${model.model}`);
  lines.push(`    Display Name: ${model.displayName}`);

  if (model.description !== undefined && model.description.length > 0) {
    lines.push(`    Description: ${model.description}`);
  }

  if (model.generationConfig !== undefined) {
    const configLines = formatGenerationConfig(model.generationConfig);
    lines.push(...configLines);
  }

  if (model.systemInstruction !== undefined && model.systemInstruction.length > 0) {
    const truncated = model.systemInstruction.length > 50
      ? `${model.systemInstruction.substring(0, 50)}....`
      : model.systemInstruction;
    lines.push(`    System Instruction: ${truncated}`);
  }

  if (model.tools !== undefined && model.tools.length > 0) {
    const toolNames = formatTools(model.tools);
    lines.push(`    Tools: ${toolNames}`);
  }

  return lines.join('\n');
};

/**
 * Display provider status summary.
 * @param output - Output interface.
 */
const displayProviderStatus = (output: IOutput): void => {
  output.log('\nProvider Status:');
  const providerKeys = Object.keys(providers);
  const totalProviders = providerKeys.length;
  const enabledProviders = getEnabledProviders();
  const enabledCount = enabledProviders.length;
  output.log(`Total: ${String(totalProviders)}`);
  output.log(`Enabled: ${String(enabledCount)}`);
  output.log(`Default: ${providerRegistry.defaultProvider}`);
};

/**
 * List subcommand - displays all or enabled providers.
 * @param options - Command options.
 */
const listProviders = async (options: ICommandOptions = {}): Promise<void> => {
  const output = getOutput();
  let providersToShow: IProviderWithVersion[];

  if (options.enabled === true) {
    const enabledProviders = getEnabledProviders();
    providersToShow = enabledProviders as unknown as IProviderWithVersion[];
    if (providersToShow.length === 0) {
      output.log('No providers found.');
      return;
    }
  } else {
    const allProviders = Object.values(providers);
    providersToShow = allProviders as unknown as IProviderWithVersion[];
    output.log('AI Providers:');
  }

  for (const provider of providersToShow) {
    const status = provider.enabled ? '✓' : '✗';
    const isDefault = provider.name === providerRegistry.defaultProvider;
    const defaultText = isDefault && provider.enabled ? ' (default)' : '';

    output.log(
      `${status} ${provider.name}${defaultText} - `
      + `${provider.displayName} v${provider.version}`
    );
    output.log(`  ${provider.description}`);
  }

  if (options.enabled !== true) {
    displayProviderStatus(output);
  }
};

/**
 * Display provider details.
 * @param provider - Provider to display.
 * @param output - Output interface.
 */
const displayProviderDetails = (
  provider: IProviderWithVersion,
  output: IOutput
): void => {
  output.log('Provider Details:');
  output.log(`Name: ${provider.name}`);
  output.log(`Display Name: ${provider.displayName}`);
  output.log(`Version: ${provider.version}`);
  output.log(`Status: ${provider.enabled ? 'Enabled' : 'Disabled'}`);
  output.log(`Description: ${provider.description}`);
  output.log('\nConfiguration:');
  output.log(formatProviderConfig(provider));
};

/**
 * Show subcommand - displays detailed information about a specific provider.
 * @param options - Command options.
 */
const showProvider = async (options: ICommandOptions): Promise<void> => {
  const output = getOutput();
  const { name, models } = options;

  if (name === undefined) {
    output.error('Error: Provider name is required.');
    process.exit(1);
  }

  const providerResult = getProvider(name);
  const provider = providerResult as unknown as IProviderWithVersion | null;

  if (provider === null) {
    output.error(`Error: Provider '${name}' not found.`);
    process.exit(1);
  }

  displayProviderDetails(provider, output);

  if (models === true && provider.config?.models !== undefined) {
    output.log('\nAvailable Models:');
    for (const [modelKey, modelConfig] of Object.entries(provider.config.models)) {
      output.log(`  ${modelKey}:`);
      output.log(formatModelDetails(modelConfig));
    }
  }
};

/**
 * Enable subcommand - enables a disabled provider.
 * @param options - Command options.
 */
const enableProviderCommand = async (
  options: ICommandOptions
): Promise<void> => {
  const output = getOutput();
  const { name } = options;

  if (name === undefined) {
    output.error('Error: Provider name is required.');
    process.exit(1);
  }

  const providerResult = getProvider(name);
  const provider = providerResult as unknown as IProviderWithVersion | null;

  if (provider === null) {
    output.error(`Error: Provider '${name}' not found.`);
    output.error('Run "provider:list" to see available providers.');
    process.exit(1);
  }

  if (provider.enabled) {
    output.log(`Provider '${name}' is already enabled.`);
    return;
  }

  const success = enableProvider(name);
  if (!success) {
    output.error(`Failed to enable provider '${name}'.`);
    process.exit(1);
  }

  output.log(`✓ Provider '${name}' has been enabled.`);
  output.log(`Display Name: ${provider.displayName}`);
  output.log(`Version: ${provider.version}`);
};

/**
 * Check if provider can be disabled.
 * @param name - Provider name.
 * @param output - Output interface.
 * @returns True if can be disabled.
 */
const canDisableProvider = (
  name: string,
  output: IOutput
): boolean => {
  if (name === providerRegistry.defaultProvider) {
    output.error(`Error: Cannot disable the default provider '${name}'.`);
    output.error(
      'Please set a different default provider first using '
      + '"provider:set-default <name>".'
    );
    return false;
  }

  const enabledProviders = getEnabledProviders();
  if (enabledProviders.length === 1 && enabledProviders[0]?.name === name) {
    output.error(`Error: Cannot disable the last enabled provider '${name}'.`);
    output.error('At least one provider must remain enabled.');
    return false;
  }

  return true;
};

/**
 * Disable subcommand - disables an enabled provider.
 * @param options - Command options.
 */
const disableProviderCommand = async (
  options: ICommandOptions
): Promise<void> => {
  const output = getOutput();
  const { name } = options;

  if (name === undefined) {
    output.error('Error: Provider name is required.');
    process.exit(1);
  }

  const providerResult = getProvider(name);
  const provider = providerResult as unknown as IProviderWithVersion | null;

  if (provider === null) {
    output.error(`Error: Provider '${name}' not found.`);
    process.exit(1);
  }

  if (!canDisableProvider(name, output)) {
    process.exit(1);
  }

  if (!provider.enabled) {
    output.log(`Provider '${name}' is already disabled.`);
    return;
  }

  const success = disableProvider(name);
  if (!success) {
    output.error(`Failed to disable provider '${name}'.`);
    process.exit(1);
  }

  output.log(`✓ Provider '${name}' has been disabled.`);
  output.log(
    `Remaining enabled providers: ${providerRegistry.enabledProviders.join(', ')}`
  );
};

/**
 * Set-default subcommand - sets a provider as the default.
 * @param options - Command options.
 */
const setDefaultProviderCommand = async (
  options: ICommandOptions
): Promise<void> => {
  const output = getOutput();
  const { name } = options;

  if (name === undefined) {
    output.error('Error: Provider name is required.');
    process.exit(1);
  }

  const providerResult = getProvider(name);
  const provider = providerResult as unknown as IProviderWithVersion | null;

  if (provider === null) {
    output.error(`Error: Provider '${name}' not found.`);
    process.exit(1);
  }

  if (!provider.enabled) {
    output.error(`Error: Provider '${name}' is not enabled.`);
    output.error('Only enabled providers can be set as default.');
    process.exit(1);
  }

  if (name === providerRegistry.defaultProvider) {
    output.log(`Provider '${name}' is already the default.`);
    return;
  }

  const { defaultProvider: previousDefault } = providerRegistry;
  const success = setDefaultProvider(name);
  if (!success) {
    output.error(`Failed to set '${name}' as default provider.`);
    process.exit(1);
  }

  const message = `✓ Default provider changed from '${previousDefault}' to '${name}'.`;
  output.log(message);
  output.log(`Display Name: ${provider.displayName}`);
};

/**
 * Main command object.
 */
export const command = {
  description: 'Manage AI providers',

  /**
   * Execute the provider command.
   * @param subcommand - The subcommand to execute.
   * @param options - Command options.
   */
  async execute(
    subcommand: string,
    options: ICommandOptions = {}
  ): Promise<void> {
    switch (subcommand) {
      case 'list':
        await listProviders(options);
        break;
      case 'show':
        await showProvider(options);
        break;
      case 'enable':
        await enableProviderCommand(options);
        break;
      case 'disable':
        await disableProviderCommand(options);
        break;
      case 'set-default':
        await setDefaultProviderCommand(options);
        break;
      default: {
        const output = getOutput();
        output.error(`Unknown provider subcommand: ${subcommand}`);
        output.error(
          'Available subcommands: list, show, enable, disable, set-default'
        );
        process.exit(1);
      }
    }
  }
};
