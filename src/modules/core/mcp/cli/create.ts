/**
 * Create MCP context CLI command.
 * @file Create MCP context CLI command.
 * @module modules/core/mcp/cli/create
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { type CreateMcpArgs, cliSchemas } from '@/modules/core/mcp/utils/cli-validation';

export const command: ICLICommand = {
  description: 'Create a new MCP context',
  options: [
    {
      name: 'name',
      alias: 'n',
      type: 'string',
      description: 'Context name',
      required: true
    },
    {
      name: 'model',
      alias: 'm',
      type: 'string',
      description: 'Model to use',
      required: true
    },
    {
      name: 'description',
      alias: 'd',
      type: 'string',
      description: 'Context description'
    },
    {
      name: 'max_tokens',
      type: 'number',
      description: 'Maximum tokens'
    },
    {
      name: 'temperature',
      alias: 't',
      type: 'number',
      description: 'Temperature (0.0-2.0)'
    },
    {
      name: 'top_p',
      type: 'number',
      description: 'Top P (0.0-1.0)'
    },
    {
      name: 'frequency_penalty',
      type: 'number',
      description: 'Frequency penalty (-2.0 to 2.0)'
    },
    {
      name: 'presence_penalty',
      type: 'number',
      description: 'Presence penalty (-2.0 to 2.0)'
    },
    {
      name: 'stop_sequences',
      type: 'string',
      description: 'Stop sequences (comma-separated)'
    },
    {
      name: 'system_prompt',
      alias: 's',
      type: 'string',
      description: 'System prompt'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      const validatedArgs = cliSchemas.create.parse(context.args);

      const service = MCPService.getInstance();

      const contextData = {
        name: validatedArgs.name,
        model: validatedArgs.model,
        description: validatedArgs.description || null,
        max_tokens: validatedArgs.max_tokens || null,
        temperature: validatedArgs.temperature || null,
        top_p: validatedArgs.top_p || null,
        frequency_penalty: validatedArgs.frequency_penalty || null,
        presence_penalty: validatedArgs.presence_penalty || null,
        stop_sequences: validatedArgs.stop_sequences || null,
        system_prompt: validatedArgs.system_prompt || null
      };

      const newContext = await service.createContext(
        contextData.name,
        contextData.model,
        {
          description: contextData.description,
          maxTokens: contextData.max_tokens,
          temperature: contextData.temperature,
          topP: contextData.top_p,
          frequencyPenalty: contextData.frequency_penalty,
          presencePenalty: contextData.presence_penalty,
          stopSequences: contextData.stop_sequences,
          systemPrompt: contextData.system_prompt
        }
      );

      if (validatedArgs.format === 'json') {
        cliOutput.json(newContext);
      } else {
        cliOutput.success('MCP context created successfully');
        cliOutput.keyValue({
          'ID': newContext.id,
          'Name': newContext.name,
          'Model': newContext.model,
          'Description': newContext.description || 'N/A',
          'Max Tokens': newContext.max_tokens?.toString() || 'N/A',
          'Temperature': newContext.temperature?.toString() || 'N/A',
          'Created': newContext.created_at ? new Date(newContext.created_at).toLocaleString() : 'N/A'
        });
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        cliOutput.error('Invalid arguments:');
        (error as any).issues?.forEach((issue: any) => {
          cliOutput.error(`  ${issue.path.join('.')}: ${issue.message}`);
        });
      } else {
        cliOutput.error('Error creating MCP context');
        logger.error(LogSource.MCP, 'Create command failed', { error });
      }
      process.exit(1);
    }
  },
};
