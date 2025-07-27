/**
 * Model CLI command implementations - split file for reduced complexity.
 * @file Model CLI command implementations.
 * @module modules/core/config/cli/model-commands
 */

import type { GoogleGenerativeAI, ModelParams } from '@google/generative-ai';
import { getLoggerService } from '@/modules/core/logger';
import { LogSource } from '@/modules/core/logger/types';
import type {
  IProviderConfig
} from '@/modules/core/config/types/model.types';

const logger = getLoggerService();

/**
 * Log usage statistics from model response.
 * @param usageMetadata - The usage metadata from response.
 */
export const logUsageStatistics = (
  usageMetadata: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } | null | undefined
): void => {
  if (usageMetadata === null || usageMetadata === undefined) { return; }

  logger.info(LogSource.CLI, 'Usage Statistics:');
  logger.info(LogSource.CLI, '----------------');

  const promptTokens = usageMetadata.promptTokenCount ?? 0;
  const responseTokens = usageMetadata.candidatesTokenCount ?? 0;
  const totalTokens = usageMetadata.totalTokenCount ?? 0;

  logger.info(
    LogSource.CLI,
    `Prompt Tokens: ${promptTokens === 0 ? 'N/A' : String(promptTokens)}`
  );
  logger.info(
    LogSource.CLI,
    `Response Tokens: ${responseTokens === 0 ? 'N/A' : String(responseTokens)}`
  );
  logger.info(
    LogSource.CLI,
    `Total Tokens: ${totalTokens === 0 ? 'N/A' : String(totalTokens)}`
  );
  logger.info(LogSource.CLI, '');
};

/**
 * Build model parameters.
 * @param modelConfig - The model configuration.
 * @returns Model parameters.
 */
export const buildModelParams = (
  modelConfig: NonNullable<IProviderConfig['models']>[string]
): ModelParams => {
  const modelParams: ModelParams = {
    model: modelConfig.model
  };

  if (modelConfig.generationConfig !== undefined) {
    modelParams.generationConfig = modelConfig.generationConfig;
  }
  if (modelConfig.safetySettings !== undefined) {
    modelParams.safetySettings = modelConfig.safetySettings;
  }
  if (modelConfig.systemInstruction !== undefined) {
    modelParams.systemInstruction = modelConfig.systemInstruction;
  }
  if (modelConfig.tools !== undefined) {
    modelParams.tools = modelConfig.tools.map(tool => {
      if (tool.codeExecution === true) {
        return { codeExecution: {} };
      }
      return { codeExecution: {} };
    });
  }

  return modelParams;
};

/**
 * Execute model test.
 * @param genAI - Google Generative AI instance.
 * @param modelConfig - Model configuration.
 * @param prompt - Test prompt.
 */
export const executeModelTest = async (
  genAI: GoogleGenerativeAI,
  modelConfig: NonNullable<IProviderConfig['models']>[string],
  prompt: string
): Promise<void> => {
  const modelParams = buildModelParams(modelConfig);
  const model = genAI.getGenerativeModel(modelParams);
  const result = await model.generateContent(prompt);

  logger.info(LogSource.CLI, 'Response received!');
  logger.info(LogSource.CLI, '');

  logUsageStatistics(result.response.usageMetadata);

  logger.info(LogSource.CLI, 'Response:');
  logger.info(LogSource.CLI, '--------');
  const { response } = result;
  const text = response.text();
  logger.info(LogSource.CLI, text === '' ? 'No text response received' : text);
  logger.info(LogSource.CLI, '');
  logger.info(LogSource.CLI, '✓ Model test completed successfully!');
};
