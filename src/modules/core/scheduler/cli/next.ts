/**
 * @fileoverview Show next scheduled runs command
 * @module modules/core/scheduler/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { options = {} } = context;
    
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const schedulerModule = moduleLoader.getModule('scheduler');

    if (!schedulerModule) {
      console.error('Scheduler module not found');
      process.exit(1);
    }

    try {
      const schedulerService = schedulerModule.exports?.SchedulerService;
      if (!schedulerService) {
        console.error('Scheduler service not available');
        process.exit(1);
      }

      const count = options.count || 10;
      const nextRuns = await schedulerService.getNextRuns(count, options.task);

      if (nextRuns.length === 0) {
        console.log('No upcoming scheduled runs found');
        return;
      }

      console.log('\nUpcoming Scheduled Runs:');
      console.log('─'.repeat(100));
      console.log(
        'Task ID'.padEnd(38) +
        'Task Name'.padEnd(30) +
        'Schedule'.padEnd(15) +
        'Next Run'
      );
      console.log('─'.repeat(100));

      const now = new Date();
      
      nextRuns.forEach(run => {
        const timeUntil = run.next_run.getTime() - now.getTime();
        const minutes = Math.floor(timeUntil / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        let timeStr = run.next_run.toISOString().slice(0, 19);
        
        if (days > 0) {
          timeStr += ` (in ${days}d)`;
        } else if (hours > 0) {
          timeStr += ` (in ${hours}h)`;
        } else if (minutes > 0) {
          timeStr += ` (in ${minutes}m)`;
        } else {
          timeStr += ' (soon)';
        }
        
        console.log(
          run.task_id.padEnd(38) +
          run.task_name.slice(0, 29).padEnd(30) +
          run.schedule.slice(0, 14).padEnd(15) +
          timeStr
        );
      });

      console.log('─'.repeat(100));
      console.log(`Showing ${nextRuns.length} upcoming runs\n`);
    } catch (error) {
      console.error('Failed to get next runs:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};