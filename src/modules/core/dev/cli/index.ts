/**
 * Development module CLI commands aggregator.
 */

export { command as lint } from '@/modules/core/dev/cli/lint';
export { command as typecheck } from '@/modules/core/dev/cli/typecheck';
export { command as test } from '@/modules/core/dev/cli/test';
export { command as createModule } from '@/modules/core/dev/cli/create-module';

/**
 * Dev command metadata for CLI registration.
 */
export const devCommands = {
  name: 'dev',
  alias: 'd',
  description: 'Development tools and utilities',
  subcommands: [
    {
      name: 'lint',
      description: 'Run ESLint and display a formatted summary of issues',
      handler: 'dev:lint'
    },
    {
      name: 'typecheck',
      description: 'Run TypeScript compiler and display a formatted summary of type errors',
      handler: 'dev:typecheck'
    },
    {
      name: 'test',
      description: 'Run unit tests and display a formatted summary of failures',
      handler: 'dev:test'
    },
    {
      name: 'create-module',
      description: 'Create a new SystemPrompt OS module with complete boilerplate',
      handler: 'dev:create-module'
    }
  ]
};

/**
 * Export command metadata for CLI registration.
 */
export default devCommands;
