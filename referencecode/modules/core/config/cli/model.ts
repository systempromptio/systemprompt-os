/**
 * @fileoverview Model management CLI command
 * @module modules/core/config/cli/model
 */

import { GoogleGenAI } from '@google/genai';
import { providers, getEnabledProviders, getProvider } from '../providers/index.js';
import type { GoogleLiveAPIConfig } from '../types/provider.js';

/**
 * List models
 */
async function listModels(options: { provider?: string }): Promise<void> {
  console.log('\nAvailable AI Models:');
  console.log('===================\n');

  const providerList = options.provider
    ? [providers[options.provider]].filter(Boolean)
    : getEnabledProviders();

  if (providerList.length === 0) {
    if (options.provider) {
      console.error(`Error: Provider '${options.provider}' not found or not enabled.`);
    } else {
      console.error('No enabled providers found.');
    }
    process.exit(1);
  }

  let totalModels = 0;

  providerList.forEach((provider) => {
    if (!provider) {throw new Error('provider is required');}
    if (!provider) {throw new Error('provider is required');}
    console.log(`Provider: ${provider.displayName} (${provider.name})`);
    if (!provider) {throw new Error('provider is required');}
    if (!provider) {throw new Error('provider is required');}
    console.log(`${'-'.repeat(50)}`);

    if (provider.name === 'google-liveapi') {
      const config = provider.config as GoogleLiveAPIConfig;
      const defaultModel = config.defaultModel;

      Object.entries(config.models).forEach(([key, model]) => {
        totalModels++;
        const isDefault = key === defaultModel;
        const defaultMark = isDefault ? ' [DEFAULT]' : '';

        console.log(`  ${key}${defaultMark}:`);
        console.log(`    Model: ${model.model}`);
        console.log(`    Display: ${model.displayName}`);
        console.log(`    Description: ${model.description}`);
        console.log(`    Temperature: ${model.generationConfig.temperature}`);
        console.log(`    Max Tokens: ${model.generationConfig.maxOutputTokens}`);

        if (model.tools && model.tools.length > 0) {
          const toolNames = model.tools
            .map((t) => (t.codeExecution ? 'Code Execution' : 'Unknown'))
            .join(', ');
          console.log(`    Tools: ${toolNames}`);
        }
        console.log();
      });
    } else {
      console.log('  Model information not available for this provider.\n');
    }
  });

  console.log(`Total models available: ${totalModels}`);
}

/**
 * Show model details
 */
async function showModel(options: { provider: string; model: string }): Promise<void> {
  const provider = getProvider(options.provider);

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

  const config = provider.config as GoogleLiveAPIConfig;
  const model = config.models[options.model];

  if (!model) {
    console.error(`Error: Model '${options.model}' not found in provider '${options.provider}'.`);
    console.error(`Available models: ${Object.keys(config.models).join(', ')}`);
    process.exit(1);
  }

  console.log('\nModel Configuration:');
  console.log('===================\n');
  console.log(`Provider: ${provider.displayName}`);
  console.log(`Model Key: ${options.model}`);
  if (config.defaultModel === options.model) {
    console.log('Status: DEFAULT MODEL');
  }
  console.log();

  console.log('Basic Information:');
  console.log(`  Model ID: ${model.model}`);
  console.log(`  Display Name: ${model.displayName}`);
  console.log(`  Description: ${model.description}`);
  console.log();

  console.log('Generation Configuration:');
  console.log(`  Temperature: ${model.generationConfig.temperature}`);
  console.log(`  Top K: ${model.generationConfig.topK}`);
  console.log(`  Top P: ${model.generationConfig.topP}`);
  console.log(`  Max Output Tokens: ${model.generationConfig.maxOutputTokens}`);
  console.log(`  Candidate Count: ${model.generationConfig.candidateCount}`);

  if (model.generationConfig.responseMimeType) {
    console.log(`  Response MIME Type: ${model.generationConfig.responseMimeType}`);
  }

  if (model.generationConfig.stopSequences && model.generationConfig.stopSequences.length > 0) {
    console.log(`  Stop Sequences: ${model.generationConfig.stopSequences.join(', ')}`);
  }
  console.log();

  console.log('Safety Settings:');
  model.safetySettings.forEach((setting) => {
    console.log(`  ${setting.category}: ${setting.threshold}`);
  });
  console.log();

  if (model.systemInstruction) {
    console.log('System Instruction:');
    console.log(`  ${model.systemInstruction}`);
    console.log();
  }

  if (model.tools && model.tools.length > 0) {
    console.log('Available Tools:');
    model.tools.forEach((tool) => {
      if (tool.codeExecution) {
        console.log('  - Code Execution');
      }
      if (tool.functionDeclarations) {
        console.log('  - Function Declarations');
      }
    });
    console.log();
  }

  console.log('Full Configuration (JSON):');
  console.log(JSON.stringify(model, null, 2));
}

/**
 * Test model
 */
async function testModel(options: {
  provider: string;
  model: string;
  prompt?: string;
}): Promise<void> {
  const provider = getProvider(options.provider);

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

  const config = provider.config as GoogleLiveAPIConfig;
  const modelConfig = config.models[options.model];

  if (!modelConfig) {
    console.error(`Error: Model '${options.model}' not found in provider '${options.provider}'.`);
    console.error(`Available models: ${Object.keys(config.models).join(', ')}`);
    process.exit(1);
  }

  if (!config.client.apiKey) {
    console.error('Error: API key not configured. Please set GEMINI_API_KEY environment variable.');
    process.exit(1);
  }

  const prompt = options.prompt || "Hello, please respond with 'Test successful!'";

  console.log('\nTesting Model Configuration:');
  console.log('===========================\n');
  console.log(`Provider: ${provider.displayName}`);
  console.log(`Model: ${modelConfig.displayName} (${modelConfig.model})`);
  console.log(`Prompt: ${prompt}`);
  console.log('\nSending request...\n');

  try {
    // Initialize the client
    const client = new GoogleGenAI({
      apiKey: config.client.apiKey,
    });

    // Send the request
    const startTime = Date.now();
    const generateConfig: any = {
      safetySettings: modelConfig.safetySettings,
    };

    if (modelConfig.systemInstruction) {
      generateConfig.systemInstruction = modelConfig.systemInstruction;
    }
    if (modelConfig.generationConfig?.temperature !== undefined) {
      generateConfig.temperature = modelConfig.generationConfig.temperature;
    }
    if (modelConfig.generationConfig?.topP !== undefined) {
      generateConfig.topP = modelConfig.generationConfig.topP;
    }
    if (modelConfig.generationConfig?.topK !== undefined) {
      generateConfig.topK = modelConfig.generationConfig.topK;
    }
    if (modelConfig.generationConfig?.maxOutputTokens !== undefined) {
      generateConfig.maxOutputTokens = modelConfig.generationConfig.maxOutputTokens;
    }

    const result = await client.models.generateContent({
      model: modelConfig.model,
      contents: [
        {
          role: 'user' as const,
          parts: [{ text: prompt }],
        },
      ],
      config: generateConfig,
    });
    const endTime = Date.now();

    // result is already the response
    console.log('Response received!\n');
    console.log('Response Details:');
    console.log(`  Time: ${endTime - startTime}ms`);

    if (result.usageMetadata) {
      console.log('\nToken Usage:');
      console.log(`  Prompt Tokens: ${result.usageMetadata.promptTokenCount || 'N/A'}`);
      console.log(`  Response Tokens: ${result.usageMetadata.candidatesTokenCount || 'N/A'}`);
      console.log(`  Total Tokens: ${result.usageMetadata.totalTokenCount || 'N/A'}`);
    }

    console.log('\nGenerated Text:');
    console.log('-'.repeat(50));
    console.log(result.text);
    console.log('-'.repeat(50));

    console.log('\n✓ Model test completed successfully!');
  } catch (error) {
    console.error('\nError testing model:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if (error.stack && process.env['DEBUG']) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(`  ${String(error)}`);
    }
    process.exit(1);
  }
}

/**
 * Execute model command
 */
async function execute(subcommand: string, options: any): Promise<void> {
  switch (subcommand) {
  case 'list':
    return listModels(options);
  case 'show':
    return showModel(options);
  case 'test':
    return testModel(options);
  default:
    console.error(`Unknown model subcommand: ${subcommand}`);
    console.error('Available subcommands: list, show, test');
    process.exit(1);
  }
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};
