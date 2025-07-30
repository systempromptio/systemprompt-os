/**
 * Monitor CLI commands.
 */
export { command as status } from '@/modules/core/monitor/cli/status';
export { command as list } from '@/modules/core/monitor/cli/list';
export { command as record } from '@/modules/core/monitor/cli/record';

/**
 * Monitor command metadata for CLI registration.
 */
export const monitorCommands = {
  name: 'monitor',
  alias: 'mon',
  description: 'System monitoring commands',
  subcommands: [
    {
      name: 'status',
      description: 'Show monitor module status',
      handler: 'monitor:status'
    },
    {
      name: 'list',
      description: 'List recorded metrics',
      handler: 'monitor:list'
    },
    {
      name: 'record',
      description: 'Record a metric',
      handler: 'monitor:record'
    }
  ]
};

/**
 * Export command metadata for CLI registration.
 */
export default monitorCommands;
