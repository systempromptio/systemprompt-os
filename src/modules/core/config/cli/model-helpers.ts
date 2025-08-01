/**
 * Model CLI helper functions.
 * @file Model CLI helper functions.
 * @module modules/core/config/cli/model-helpers
 */

import { getLoggerService } from '@/modules/core/logger';
import { LogSource } from '@/modules/core/logger/types/manual';
import type {
  IProviderConfig,
  ISafetySetting,
  ITool
} from '@/modules/core/config/types/manual';

const logger = getLoggerService();

/**
 * Format tools array for display.
 * @param tools - Array of tool objects.
 * @returns Formatted tools string.
 */
export const formatTools = (tools?: ITool[]): string => {
  if (tools === undefined || !Array.isArray(tools)) {
    return 'None';
  }

  const toolNames = tools.map((tool): string => {
    if (tool.codeExecution !== undefined) {
      return 'Code Execution';
    }
    return 'Unknown Tool';
  });

  return toolNames.length > 0 ? toolNames.join(', ') : 'None';
};

/**
 * Format safety settings for display.
 * @param safetySettings - Array of safety setting objects.
 * @returns Formatted safety settings string.
 */
export const formatSafetySettings = (safetySettings?: ISafetySetting[]): string => {
  if (safetySettings === undefined || !Array.isArray(safetySettings)) {
    return 'None configured';
  }

  if (safetySettings.length === 0) {
    return 'None configured';
  }

  return safetySettings.map((setting): string => {
    return `${setting.category}: ${setting.threshold}`;
  }).join('\n    ');
};

/**
 * Logs generation configuration details.
 * @param config - The generation configuration.
 */
export const logGenerationConfig = (
  config: NonNullable<IProviderConfig['models']>[string]['generationConfig']
): void => {
  if (config === undefined) { return; }

  const configs: Array<[string, unknown]> = [
    ['Temperature', config.temperature],
    ['Top K', config.topK],
    ['Top P', config.topP],
    ['Max Output Tokens', config.maxOutputTokens],
    ['Candidate Count', config.candidateCount],
    ['Response MIME Type', config.responseMimeType]
  ];

  configs.forEach(([label, value]): void => {
    if (value !== undefined) {
      let stringValue: string;
      if (typeof value === 'object' && value !== null) {
        stringValue = JSON.stringify(value);
      } else if (
        typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
      ) {
        stringValue = String(value);
      } else {
        stringValue = JSON.stringify(value);
      }
      logger.info(LogSource.CLI, `  ${label}: ${stringValue}`);
    }
  });

  if (config.stopSequences !== undefined && config.stopSequences.length > 0) {
    logger.info(LogSource.CLI, `  Stop Sequences: ${config.stopSequences.join(', ')}`);
  }
};

/**
 * Log model description if available.
 * @param description - The model description.
 */
const logModelDescription = (description?: string): void => {
  if (description !== undefined) {
    logger.info(LogSource.CLI, `Description: ${description}`);
  }
};

/**
 * Log generation configuration section.
 * @param generationConfig - The generation configuration.
 */
const logGenerationSection = (
  generationConfig: NonNullable<IProviderConfig['models']>[string]['generationConfig']
): void => {
  logger.info(LogSource.CLI, '');
  logger.info(LogSource.CLI, 'Generation Configuration:');
  logger.info(LogSource.CLI, '------------------------');
  logGenerationConfig(generationConfig);
};

/**
 * Log safety settings section.
 * @param safetySettings - The safety settings.
 */
const logSafetySection = (safetySettings?: ISafetySetting[]): void => {
  logger.info(LogSource.CLI, '');
  logger.info(LogSource.CLI, 'Safety Settings:');
  logger.info(LogSource.CLI, '---------------');
  logger.info(LogSource.CLI, `  ${formatSafetySettings(safetySettings)}`);
};

/**
 * Log system instruction section.
 * @param systemInstruction - The system instruction.
 */
const logSystemInstructionSection = (systemInstruction?: string): void => {
  if (systemInstruction !== undefined) {
    logger.info(LogSource.CLI, '');
    logger.info(LogSource.CLI, 'System Instruction:');
    logger.info(LogSource.CLI, '------------------');
    logger.info(LogSource.CLI, `  ${systemInstruction}`);
  }
};

/**
 * Log tools section.
 * @param tools - The tools configuration.
 */
const logToolsSection = (tools?: ITool[]): void => {
  logger.info(LogSource.CLI, '');
  logger.info(LogSource.CLI, 'Available Tools:');
  logger.info(LogSource.CLI, '---------------');
  logger.info(LogSource.CLI, `  - ${formatTools(tools)}`);
};

/**
 * Log full configuration as JSON.
 * @param modelConfig - The model configuration.
 */
const logFullConfiguration = (
  modelConfig: NonNullable<IProviderConfig['models']>[string]
): void => {
  logger.info(LogSource.CLI, '');
  logger.info(LogSource.CLI, 'Full Configuration (JSON):');
  logger.info(LogSource.CLI, '--------------------------');
  logger.info(LogSource.CLI, JSON.stringify(modelConfig, null, 2));
};

/**
 * Log model configuration details.
 * @param modelConfig - The model configuration.
 */
export const logModelConfigDetails = (
  modelConfig: NonNullable<IProviderConfig['models']>[string]
): void => {
  logModelDescription(modelConfig.description);
  logGenerationSection(modelConfig.generationConfig);
  logSafetySection(modelConfig.safetySettings);
  logSystemInstructionSection(modelConfig.systemInstruction);
  logToolsSection(modelConfig.tools);
  logFullConfiguration(modelConfig);
};
