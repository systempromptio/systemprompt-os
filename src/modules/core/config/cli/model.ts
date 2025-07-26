/**
 * @file Model CLI command implementation.
 * @module modules/core/config/cli/model
 */

import {
  getEnabledProviders, getProvider, providers
} from '@/modules/core/config/providers';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Tool {
  codeExecution?: boolean;
}

interface SafetySetting {
  category: string;
  threshold: string;
}

interface GenerationConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  candidateCount?: number;
  responseMimeType?: string;
  stopSequences?: string[];
}

interface ModelConfig {
  model: string;
  displayName: string;
  description?: string;
  generationConfig?: GenerationConfig;
  tools?: Tool[];
  safetySettings?: SafetySetting[];
  systemInstruction?: string;
}

interface ProviderConfig {
  models?: Record<string, ModelConfig>;
  defaultModel?: string;
  client?: {
    apiKey?: string;
  };
}

interface Provider {
  name: string;
  displayName: string;
  enabled: boolean;
  config?: ProviderConfig;
}

interface ModelCommandOptions {
  provider?: string;
  model?: string;
  prompt?: string;
}

/**
 * Format tools array for display.
 * @param {Array} tools - Array of tool objects.
 * @returns {string} Formatted tools string.
 */
function formatTools(tools?: Tool[]): string {
  if (!tools || !Array.isArray(tools)) {
    return 'None';
  }

  const toolNames = tools.map(tool => {
    if (tool.codeExecution !== undefined) {
      return 'Code Execution';
    }
    return 'Unknown Tool';
  });

  return toolNames.join(', ') || 'None';
}

/**
 * Format safety settings for display.
 * @param {Array} safetySettings - Array of safety setting objects.
 * @returns {string} Formatted safety settings string.
 */
function formatSafetySettings(safetySettings?: SafetySetting[]): string {
  if (!safetySettings || !Array.isArray(safetySettings) || safetySettings.length === 0) {
    return 'None configured';
  }

  return safetySettings.map(setting => { return `${setting.category}: ${setting.threshold}` }).join('\n    ');
}

/**
 * List models subcommand implementation.
 * @param {Object} options - Command options.
 * @param {string} [options.provider] - Specific provider to list models for.
 */
async function listModels(options: ModelCommandOptions): Promise<void> {
  let providersToCheck: Provider[];

  if (options.provider) {
    const provider = providers[options.provider] as Provider;
    if (!provider || !provider.enabled) {
      console.error(`Error: Provider '${options.provider}' not found or not enabled.`);
      process.exit(1);
    }
    providersToCheck = [provider];
  } else {
    providersToCheck = getEnabledProviders() as Provider[];
    if (providersToCheck.length === 0) {
      console.error('No enabled providers found.');
      process.exit(1);
    }
  }

  console.log('Available AI Models:');
  console.log('==================\n');

  let totalModels = 0;

  for (const provider of providersToCheck) {
    console.log(`Provider: ${provider.displayName} (${provider.name})`);
    console.log('-'.repeat(50));

    if (provider.name === 'google-liveapi' && provider.config?.models) {
      const { models } = provider.config;
      const { defaultModel } = provider.config;

      for (const [modelKey, modelConfig] of Object.entries(models)) {
        const isDefault = modelKey === defaultModel;
        console.log(`  ${modelKey}${isDefault ? ' [DEFAULT]' : ''}:`);
        console.log(`    Model: ${modelConfig.model}`);
        console.log(`    Display: ${modelConfig.displayName}`);
        if (modelConfig.description) {
          console.log(`    Description: ${modelConfig.description}`);
        }
        if (modelConfig.generationConfig?.temperature !== undefined) {
          console.log(`    Temperature: ${modelConfig.generationConfig.temperature}`);
        }
        if (modelConfig.tools) {
          console.log(`    Tools: ${formatTools(modelConfig.tools)}`);
        }
        console.log('');
        totalModels++;
      }
    } else {
      console.log('  Model information not available for this provider.');
      console.log('');
    }
  }

  console.log(`Total models available: ${totalModels}`);
}

/**
 * Show model details subcommand implementation.
 * @param {Object} options - Command options.
 * @param {string} options.provider - Provider name.
 * @param {string} options.model - Model key.
 */
async function showModel(options: ModelCommandOptions): Promise<void> {
  if (!options.provider || !options.model) {
    console.error('Error: Both provider and model must be specified.');
    process.exit(1);
  }

  const provider = getProvider(options.provider) as Provider;

  if (!provider) {
    console.error(`Error: Provider '${options.provider}' not found.`);
    process.exit(1);
  }

  if (!provider.enabled) {
    console.error(`Error: Provider '${options.provider}' is not enabled.`);
    process.exit(1);
  }

  if (provider.name !== 'google-liveapi') {
    console.error('Model details are only available for google-liveapi provider.');
    process.exit(1);
  }

  if (!provider.config || !provider.config.models) {
    console.error('No models configured for this provider.');
    process.exit(1);
  }

  const modelConfig = provider.config.models[options.model];
  if (!modelConfig) {
    const availableModels = Object.keys(provider.config.models);
    console.error(`Error: Model '${options.model}' not found in provider '${options.provider}'.`);
    console.error(`Available models: ${availableModels.join(', ')}`);
    process.exit(1);
  }

  const isDefault = options.model === provider.config.defaultModel;

  console.log('Model Configuration:');
  console.log('===================');
  console.log('');
  console.log(`Provider: ${provider.displayName}`);
  console.log(`Model Key: ${options.model}`);
  console.log(`Status: ${isDefault ? 'DEFAULT MODEL' : 'AVAILABLE'}`);
  console.log(`Model ID: ${modelConfig.model}`);
  console.log(`Display Name: ${modelConfig.displayName}`);

  if (modelConfig.description) {
    console.log(`Description: ${modelConfig.description}`);
  }

  console.log('');
  console.log('Generation Configuration:');
  console.log('------------------------');

  if (modelConfig.generationConfig) {
    const config = modelConfig.generationConfig;
    if (config.temperature !== undefined) { console.log(`  Temperature: ${config.temperature}`); }
    if (config.topK !== undefined) { console.log(`  Top K: ${config.topK}`); }
    if (config.topP !== undefined) { console.log(`  Top P: ${config.topP}`); }
    if (config.maxOutputTokens !== undefined) { console.log(`  Max Output Tokens: ${config.maxOutputTokens}`); }
    if (config.candidateCount !== undefined) { console.log(`  Candidate Count: ${config.candidateCount}`); }
    if (config.responseMimeType) { console.log(`  Response MIME Type: ${config.responseMimeType}`); }
    if (config.stopSequences && config.stopSequences.length > 0) {
      console.log(`  Stop Sequences: ${config.stopSequences.join(', ')}`);
    }
  }

  console.log('');
  console.log('Safety Settings:');
  console.log('---------------');
  console.log(`  ${formatSafetySettings(modelConfig.safetySettings)}`);

  if (modelConfig.systemInstruction) {
    console.log('');
    console.log('System Instruction:');
    console.log('------------------');
    console.log(`  ${modelConfig.systemInstruction}`);
  }

  console.log('');
  console.log('Available Tools:');
  console.log('---------------');
  console.log(`  - ${formatTools(modelConfig.tools)}`);

  console.log('');
  console.log('Full Configuration (JSON):');
  console.log('--------------------------');
  console.log(JSON.stringify(modelConfig, null, 2));
}

/**
 * Test model subcommand implementation.
 * @param {Object} options - Command options.
 * @param {string} options.provider - Provider name.
 * @param {string} options.model - Model key.
 * @param {string} [options.prompt] - Custom test prompt.
 */
async function testModel(options: ModelCommandOptions): Promise<void> {
  if (!options.provider || !options.model) {
    console.error('Error: Both provider and model must be specified.');
    process.exit(1);
  }

  const provider = getProvider(options.provider) as Provider;

  if (!provider) {
    console.error(`Error: Provider '${options.provider}' not found.`);
    process.exit(1);
  }

  if (!provider.enabled) {
    console.error(`Error: Provider '${options.provider}' is not enabled.`);
    process.exit(1);
  }

  if (provider.name !== 'google-liveapi') {
    console.error('Model testing is only available for google-liveapi provider.');
    process.exit(1);
  }

  if (!provider.config || !provider.config.models) {
    console.error('No models configured for this provider.');
    process.exit(1);
  }

  const modelConfig = provider.config.models[options.model];
  if (!modelConfig) {
    const availableModels = Object.keys(provider.config.models);
    console.error(`Error: Model '${options.model}' not found in provider '${options.provider}'.`);
    console.error(`Available models: ${availableModels.join(', ')}`);
    process.exit(1);
  }

  if (!provider.config.client || !provider.config.client.apiKey) {
    console.error('Error: API key not configured for this provider.');
    console.error('Please set the API key in the provider configuration.');
    process.exit(1);
  }

  const prompt = options.prompt || "Hello, please respond with 'Test successful!'";

  console.log('Testing Model Configuration:');
  console.log('===========================');
  console.log('');
  console.log(`Provider: ${provider.displayName}`);
  console.log(`Model: ${modelConfig.displayName} (${modelConfig.model})`);
  console.log(`Prompt: ${prompt}`);
  console.log('');
  console.log('Sending test request...');

  try {
    const genAI = new GoogleGenerativeAI(provider.config.client.apiKey);

    const modelParams: any = {
      model: modelConfig.model
    };

    if (modelConfig.generationConfig) {
      modelParams.generationConfig = modelConfig.generationConfig;
    }
    if (modelConfig.safetySettings) {
      modelParams.safetySettings = modelConfig.safetySettings;
    }
    if (modelConfig.systemInstruction) {
      modelParams.systemInstruction = modelConfig.systemInstruction;
    }
    if (modelConfig.tools) {
      modelParams.tools = modelConfig.tools;
    }

    const model = genAI.getGenerativeModel(modelParams);

    const result = await model.generateContent(prompt);

    console.log('Response received!');
    console.log('');

    if (result.response.usageMetadata) {
      console.log('Usage Statistics:');
      console.log('----------------');
      console.log(`Prompt Tokens: ${result.response.usageMetadata.promptTokenCount || 'N/A'}`);
      console.log(`Response Tokens: ${result.response.usageMetadata.candidatesTokenCount || 'N/A'}`);
      console.log(`Total Tokens: ${result.response.usageMetadata.totalTokenCount || 'N/A'}`);
      console.log('');
    }

    console.log('Response:');
    console.log('--------');
    const {response} = result;
    const text = response.text();
    console.log(text || 'No text response received');
    console.log('');
    console.log('✓ Model test completed successfully!');
  } catch (error) {
    console.error('Error testing model:');
    console.error((error as Error).message);

    if (process.env.DEBUG === 'true' && (error as Error).stack) {
      console.error('');
      console.error('Stack trace:');
      console.error((error as Error).stack);
    }

    process.exit(1);
  }
}

/**
 * Model CLI command object.
 */
export const command = {
  description: 'Manage AI model configurations',

  /**
   * Execute the model command.
   * @param {string} subcommand - The subcommand to execute.
   * @param {Object} options - Command options.
   */
  async execute(subcommand: string, options: ModelCommandOptions = {}): Promise<void> {
    switch (subcommand) {
      case 'list':
        await listModels(options);
        break;

      case 'show':
        await showModel(options);
        break;

      case 'test':
        await testModel(options);
        break;

      default:
        console.error(`Unknown model subcommand: ${subcommand}`);
        console.error('Available subcommands: list, show, test');
        process.exit(1);
    }
  }
};
