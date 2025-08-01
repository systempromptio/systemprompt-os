/**
 * Tasks module get CLI command.
 * @file Tasks module get CLI command.
 * @module modules/core/tasks/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { validateCliArgs } from '@/modules/core/tasks/utils/cli-validation';

/**
 * Execute get command.
 * @param context - CLI context.
 * @returns Promise that resolves when task is retrieved.
 */
const executeGet = async (context: ICLIContext): Promise<void> => {
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const validatedArgs = validateCliArgs('get', context.args, cliOutput);
    if (!validatedArgs) {
      process.exit(1);
    }

    const {
 id, format, include_metadata
} = validatedArgs;

    const taskService = TaskService.getInstance();
    const task = await taskService.getTaskById(id);

    if (!task) {
      cliOutput.error(`Task ${id} not found`);
      process.exit(1);
    }

    if (format === 'json') {
      if (include_metadata) {
        const taskWithMetadata = {
          ...task,
          _metadata: {
            created_ago: task.created_at ? `${Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000)}s ago` : null,
            updated_ago: task.updated_at ? `${Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 1000)}s ago` : null,
            is_overdue: task.scheduled_at ? new Date(task.scheduled_at) < new Date() : false,
            execution_attempts: task.retry_count || 0,
            max_executions: task.max_executions || 3
          }
        };
        cliOutput.json(taskWithMetadata);
      } else {
        cliOutput.json(task);
      }
    } else {
      cliOutput.section('Task Details');
      cliOutput.keyValue({
        ID: task.id,
        Type: task.type,
        Status: task.status || 'pending',
        Priority: task.priority || 0,
        Module: task.module_id,
        Progress: task.progress ? `${task.progress}%` : 'N/A',
        Executions: `${task.retry_count || 0}/${task.max_executions || 3}`,
        ...task.assigned_agent_id && { 'Assigned Agent': task.assigned_agent_id },
        ...task.max_time && { 'Max Time': `${task.max_time}s` },
        Created: task.created_at ? new Date(task.created_at).toLocaleString() : 'Unknown',
        ...task.updated_at && { Updated: new Date(task.updated_at).toLocaleString() },
        ...task.scheduled_at && { Scheduled: new Date(task.scheduled_at).toLocaleString() },
        ...task.started_at && { Started: new Date(task.started_at).toLocaleString() },
        ...task.completed_at && { Completed: new Date(task.completed_at).toLocaleString() }
      });

      if (task.instructions) {
        cliOutput.section('Instructions');
        cliOutput.info(task.instructions);
      }

      if (task.result) {
        cliOutput.section('Result');
        cliOutput.info(task.result);
      }

      if (task.error) {
        cliOutput.section('Error');
        cliOutput.error(task.error);
      }

      if (include_metadata) {
        cliOutput.section('Metadata');
        const now = new Date();
        const created = task.created_at ? new Date(task.created_at) : null;
        const updated = task.updated_at ? new Date(task.updated_at) : null;

        cliOutput.keyValue({
          'Created Ago': created ? `${Math.floor((now.getTime() - created.getTime()) / 1000)}s ago` : 'Unknown',
          'Updated Ago': updated ? `${Math.floor((now.getTime() - updated.getTime()) / 1000)}s ago` : 'Never',
          'Is Overdue': task.scheduled_at ? new Date(task.scheduled_at) < now ? 'Yes' : 'No' : 'N/A',
          'Execution Attempts': `${task.retry_count || 0}`,
          'Max Executions': `${task.max_executions || 3}`
        });
      }
    }

    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error retrieving task: ${errorMessage}`);
    logger.error(LogSource.TASKS, 'Get command failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
};

/**
 * Tasks get command.
 */
export const command: ICLICommand = {
  description: 'Get detailed information about a task by ID',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'number',
      description: 'Task ID to retrieve',
      required: true
    },
    {
      name: 'include_metadata',
      alias: 'meta',
      type: 'boolean',
      description: 'Include additional metadata information',
      default: false
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      default: 'text',
      choices: ['text', 'json']
    }
  ],
  execute: executeGet
};

export default command;
