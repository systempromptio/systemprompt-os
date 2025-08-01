/**
 * @file Docs command.
 * @module modules/core/cli/cli/docs
 * Provides documentation generation for CLI commands.
 */

import { CLIModule } from '@/modules/core/cli';
import type { CLICommand, CLIContext } from '@/modules/core/cli/types/manual';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

export const command: CLICommand = {
  description: 'Generate documentation for all CLI commands',
  options: [
    {
      name: 'output',
      alias: 'o',
      type: 'string',
      description: 'Output file path for generated documentation',
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Documentation format (markdown, html, etc.)',
      default: 'markdown',
    },
  ],
  examples: [
    'systemprompt cli:docs',
    'systemprompt cli:docs --output docs/commands.md',
    'systemprompt cli:docs --format html --output docs/commands.html',
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { cwd, args } = context;

    try {
      console.log('Generating command documentation...');

      const cliModule = new CLIModule();
      await cliModule.initialize();
      
      const commands = await cliModule.getAllCommands();
      const format = (args?.format as string) || 'markdown';
      const documentation = cliModule.generateDocs(commands, format);

      if (args?.output) {
        const outputPath = resolve(cwd, args.output as string);
        writeFileSync(outputPath, documentation);
        console.log(`✓ Documentation generated: ${outputPath}`);
      } else {
        console.log(`\n${documentation}`);
        console.log(`\n✓ Generated documentation for ${String(commands.size)} commands`);
      }
    } catch (error) {
      console.error('Error generating documentation:', error);
      process.exit(1);
    }
  },
};
