/**
 * @fileoverview Provider management CLI command
 * @module modules/core/config/cli/provider
 */

import { providers, getEnabledProviders, providerRegistry, getProvider, enableProvider, disableProvider, setDefaultProvider } from '../providers/index.js';
import type { ProviderConfig, GoogleLiveAPIConfig } from '../types/provider.js';

/**
 * Format provider information for display
 */
function formatProvider(provider: ProviderConfig, isDefault: boolean = false): string {
  const status = provider.enabled ? '✓' : '✗';
  const defaultMark = isDefault ? ' (default)' : '';
  return `  ${status} ${provider.name}${defaultMark} - ${provider.displayName} v${provider.version}`;
}

/**
 * List providers
 */
async function listProviders(options: { enabled?: boolean }): Promise<void> {
  console.log('\nAI Providers:');
  console.log('=============\n');

  const providerList = options.enabled 
    ? getEnabledProviders()
    : Object.values(providers);

  if (providerList.length === 0) {
    console.log('No providers found.');
    return;
  }

  providerList.forEach(provider => {
    const isDefault = provider.name === providerRegistry.defaultProvider;
    console.log(formatProvider(provider, isDefault));
    console.log(`     ${provider.description}\n`);
  });

  if (!options.enabled) {
    console.log('\nProvider Status:');
    console.log(`  Total: ${Object.keys(providers).length}`);
    console.log(`  Enabled: ${providerRegistry.enabledProviders.length}`);
    console.log(`  Default: ${providerRegistry.defaultProvider}`);
  }
}

/**
 * Show provider details
 */
async function showProvider(options: { name: string; models?: boolean }): Promise<void> {
  const provider = getProvider(options.name);
  
  if (!provider) {
    console.error(`Error: Provider '${options.name}' not found.`);
    process.exit(1);
  }

  console.log('\nProvider Details:');
  console.log('=================\n');
  console.log(`Name: ${provider.name}`);
  console.log(`Display Name: ${provider.displayName}`);
  console.log(`Version: ${provider.version}`);
  console.log(`Status: ${provider.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Description: ${provider.description}`);

  if (provider.name === 'google-liveapi') {
    const config = provider.config as GoogleLiveAPIConfig;
    console.log('\nConfiguration:');
    console.log(`  API Key: ${config.client.apiKey ? `***${  config.client.apiKey.slice(-4)}` : 'Not set'}`);
    console.log(`  Default Model: ${config.defaultModel}`);
    
    if (options.models && config.models) {
      console.log('\nAvailable Models:');
      Object.entries(config.models).forEach(([key, model]) => {
        console.log(`\n  ${key}:`);
        console.log(`    Model: ${model.model}`);
        console.log(`    Display Name: ${model.displayName}`);
        console.log(`    Description: ${model.description}`);
        console.log(`    Temperature: ${model.generationConfig.temperature}`);
        console.log(`    Max Output Tokens: ${model.generationConfig.maxOutputTokens}`);
        if (model.systemInstruction) {
          console.log(`    System Instruction: ${model.systemInstruction.substring(0, 60)}...`);
        }
        if (model.tools && model.tools.length > 0) {
          console.log(`    Tools: ${model.tools.map(t => t.codeExecution ? 'Code Execution' : 'Unknown').join(', ')}`);
        }
      });
    }
  } else {
    console.log('\nConfiguration:');
    console.log(JSON.stringify(provider.config, null, 2));
  }
}

/**
 * Enable provider
 */
async function enableProviderCommand(options: { name: string }): Promise<void> {
  const provider = getProvider(options.name);
  
  if (!provider) {
    console.error(`Error: Provider '${options.name}' not found.`);
    console.error('Run "provider:list" to see available providers.');
    process.exit(1);
  }

  if (provider.enabled) {
    console.log(`Provider '${options.name}' is already enabled.`);
    return;
  }

  const success = enableProvider(options.name);
  
  if (success) {
    console.log(`✓ Provider '${options.name}' has been enabled.`);
    console.log(`  Display Name: ${provider.displayName}`);
    console.log(`  Version: ${provider.version}`);
  } else {
    console.error(`Failed to enable provider '${options.name}'.`);
    process.exit(1);
  }
}

/**
 * Disable provider
 */
async function disableProviderCommand(options: { name: string }): Promise<void> {
  const provider = getProvider(options.name);
  
  if (!provider) {
    console.error(`Error: Provider '${options.name}' not found.`);
    console.error('Run "provider:list" to see available providers.');
    process.exit(1);
  }

  if (!provider.enabled) {
    console.log(`Provider '${options.name}' is already disabled.`);
    return;
  }

  // Check if this is the default provider
  if (providerRegistry.defaultProvider === options.name) {
    console.error(`Error: Cannot disable the default provider '${options.name}'.`);
    console.error('Please set a different default provider first using "provider:set-default".');
    process.exit(1);
  }

  // Check if this is the last enabled provider
  if (providerRegistry.enabledProviders.length === 1) {
    console.error('Error: Cannot disable the last enabled provider.');
    console.error('At least one provider must remain enabled.');
    process.exit(1);
  }

  const success = disableProvider(options.name);
  
  if (success) {
    console.log(`✓ Provider '${options.name}' has been disabled.`);
    console.log(`  Remaining enabled providers: ${providerRegistry.enabledProviders.join(', ')}`);
  } else {
    console.error(`Failed to disable provider '${options.name}'.`);
    process.exit(1);
  }
}

/**
 * Set default provider
 */
async function setDefaultProviderCommand(options: { name: string }): Promise<void> {
  const provider = getProvider(options.name);
  
  if (!provider) {
    console.error(`Error: Provider '${options.name}' not found.`);
    console.error('Run "provider:list" to see available providers.');
    process.exit(1);
  }

  if (!provider.enabled) {
    console.error(`Error: Provider '${options.name}' is not enabled.`);
    console.error('Only enabled providers can be set as default.');
    console.error('Use "provider:enable" to enable the provider first.');
    process.exit(1);
  }

  if (providerRegistry.defaultProvider === options.name) {
    console.log(`Provider '${options.name}' is already the default.`);
    return;
  }

  const previousDefault = providerRegistry.defaultProvider;
  const success = setDefaultProvider(options.name);
  
  if (success) {
    console.log(`✓ Default provider changed from '${previousDefault}' to '${options.name}'.`);
    console.log(`  Display Name: ${provider.displayName}`);
    console.log(`  Version: ${provider.version}`);
  } else {
    console.error(`Failed to set '${options.name}' as default provider.`);
    process.exit(1);
  }
}

/**
 * Execute provider command
 */
async function execute(subcommand: string, options: any): Promise<void> {
  switch (subcommand) {
    case 'list':
      return listProviders(options);
    case 'show':
      return showProvider(options);
    case 'enable':
      return enableProviderCommand(options);
    case 'disable':
      return disableProviderCommand(options);
    case 'set-default':
      return setDefaultProviderCommand(options);
    default:
      console.error(`Unknown provider subcommand: ${subcommand}`);
      console.error('Available subcommands: list, show, enable, disable, set-default');
      process.exit(1);
  }
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute
};