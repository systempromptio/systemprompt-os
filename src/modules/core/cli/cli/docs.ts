/**
 * @fileoverview Generate command documentation
 * @module modules/core/cli/cli/docs
 */

import { CLIModule } from '@/modules/core/cli';
import { CLIContext, CLICommand } from '@/modules/core/cli/types';
import { CommandExecutionError, DocumentationGenerationError } from '@/modules/core/cli/utils/errors';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

export const command: CLICommand = {
  description: 'Generate command documentation',
  options: [
    {
      name: 'output',
      alias: 'o',
      type: 'string',
      description: 'Output file path'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Documentation format (markdown, html, json)',
      default: 'markdown',
      choices: ['markdown', 'html', 'json']
    }
  ],
  examples: [
    'systemprompt cli:docs',
    'systemprompt cli:docs --output CLI_COMMANDS.md',
    'systemprompt cli:docs --format json --output commands.json'
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      console.log('Generating command documentation...');
      
      const cliModule = new CLIModule();
      await cliModule.initialize({ logger: context.logger });
      
      // Get all available commands
      const commands = await cliModule.getAllCommands();
      
      // Generate documentation
      const format = args.format || 'markdown';
      let docs: string;
      
      try {
        docs = cliModule.generateDocs(commands, format);
      } catch (error) {
        throw new DocumentationGenerationError(format, error as Error);
      }
      
      if (args.output) {
        // Write to file
        const outputPath = resolve(context.cwd, args.output);
        writeFileSync(outputPath, docs);
        console.log(`Documentation generated: ${outputPath}`);
      } else {
        // Output to console
        console.log('\n' + docs);
      }
      
      console.log(`\nGenerated documentation for ${commands.size} commands`);
    } catch (error) {
      if (error instanceof DocumentationGenerationError) {
        throw error;
      }
      throw new CommandExecutionError('cli:docs', error as Error);
    }
  }
};