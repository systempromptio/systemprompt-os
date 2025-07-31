/**
 * Development module CLI commands aggregator.
 */

export { command as lint } from '@/modules/core/dev/cli/lint';
export { command as test } from '@/modules/core/dev/cli/test';
export { command as createModule } from '@/modules/core/dev/cli/create-module';
export { command as generateTypes } from '@/modules/core/dev/cli/generate-types';
export { command as validate } from '@/modules/core/dev/cli/validate';
export { command as syncRules } from '@/modules/core/dev/cli/sync-rules';

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
      description: 'Run linter and display a formatted summary of issues',
      handler: 'dev:lint'
    },
    {
      name: 'test',
      description: 'Run integration tests and display test coverage summary',
      handler: 'dev:test'
    },
    {
      name: 'create-module',
      description: 'Create a new SystemPrompt OS module with complete boilerplate',
      handler: 'dev:create-module'
    },
    {
      name: 'generate-types',
      description: 'Generate comprehensive types for a module (database types, interfaces, Zod schemas, type guards)',
      handler: 'dev:generate-types'
    },
    {
      name: 'validate',
      description: 'Validate that a module is fully type-safe using generated types',
      handler: 'dev:validate'
    },
    {
      name: 'sync-rules',
      description: 'Sync generic rules to specific modules with placeholder replacement',
      handler: 'dev:sync-rules'
    }
  ]
};

/**
 * Export command metadata for CLI registration.
 */
export default devCommands;
