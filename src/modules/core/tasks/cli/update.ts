/**
 * Tasks module update CLI command.
 * @file Tasks module update CLI command.
 * @module modules/core/tasks/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import { type UpdateTaskArgs, validateCliArgs } from '@/modules/core/tasks/utils/cli-validation';

/**
 * Execute update command.
 * @param context - CLI context.
 * @returns Promise that resolves when task is updated.
 */
const executeUpdate = async (context: ICLIContext): Promise<void> => {
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const validatedArgs = validateCliArgs('update', context.args, cliOutput);
    if (!validatedArgs) {
      process.exit(1);
    }

    const {
 id, format, ...updateFields
} = validatedArgs;

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateFields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      cliOutput.error('No update fields provided. Specify at least one field to update.');
      process.exit(1);
    }

    const taskService = TaskService.getInstance();

    const existingTask = await taskService.getTaskById(id);
    if (!existingTask) {
      cliOutput.error(`Task ${id} not found`);
      process.exit(1);
    }

    const updatedTask = await taskService.updateTask(id, updates);

    if (format === 'json') {
      cliOutput.json(updatedTask);
    } else {
      cliOutput.success('Task updated successfully');
      cliOutput.keyValue({
        ID: updatedTask.id,
        Type: updatedTask.type,
        Status: updatedTask.status || 'pending',
        Priority: updatedTask.priority || 0,
        Module: updatedTask.module_id,
        Progress: updatedTask.progress ? `${updatedTask.progress}%` : 'N/A',
        Executions: `${updatedTask.retry_count || 0}/${updatedTask.max_executions || 3}`,
        ...updatedTask.assigned_agent_id && { 'Assigned Agent': updatedTask.assigned_agent_id },
        ...updatedTask.max_time && { 'Max Time': `${updatedTask.max_time}s` },
        Updated: updatedTask.updated_at ? new Date(updatedTask.updated_at).toLocaleString() : 'Now'
      });

      if (updatedTask.result) {
        cliOutput.section('Result');
        cliOutput.info(updatedTask.result);
      }

      if (updatedTask.error) {
        cliOutput.section('Error');
        cliOutput.error(updatedTask.error);
      }

      const updatedFields = Object.keys(updates).filter(key => { return key !== 'format' });
      if (updatedFields.length > 0) {
        cliOutput.section('Updated Fields');
        cliOutput.info(`Updated: ${updatedFields.join(', ')}`);
      }
    }

    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error updating task: ${errorMessage}`);
    logger.error(LogSource.TASKS, 'Update command failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
};

/**
 * Tasks update command.
 */
export const command: ICLICommand = {
  description: 'Update an existing task with new values',
  options: [
    {
      name: 'id',
      alias: 'i',
      type: 'number',
      description: 'Task ID to update',
      required: true
    },
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Task type'
    },
    {
      name: 'module_id',
      alias: 'm',
      type: 'string',
      description: 'Module ID'
    },
    {
      name: 'instructions',
      alias: 'n',
      type: 'string',
      description: 'Task instructions (JSON string)'
    },
    {
      name: 'priority',
      alias: 'p',
      type: 'number',
      description: 'Task priority'
    },
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Task status',
      choices: Object.values(TaskStatus)
    },
    {
      name: 'retry_count',
      type: 'number',
      description: 'Retry count'
    },
    {
      name: 'max_executions',
      alias: 'x',
      type: 'number',
      description: 'Maximum number of execution attempts'
    },
    {
      name: 'max_time',
      type: 'number',
      description: 'Maximum execution time in seconds'
    },
    {
      name: 'result',
      alias: 'r',
      type: 'string',
      description: 'Task result'
    },
    {
      name: 'error',
      alias: 'e',
      type: 'string',
      description: 'Task error message'
    },
    {
      name: 'progress',
      alias: 'g',
      type: 'number',
      description: 'Task progress (0-100)'
    },
    {
      name: 'assigned_agent_id',
      alias: 'a',
      type: 'string',
      description: 'Assigned agent ID'
    },
    {
      name: 'scheduled_at',
      type: 'string',
      description: 'Schedule task for specific time (ISO 8601 format)'
    },
    {
      name: 'completed_at',
      type: 'string',
      description: 'Task completion time (ISO 8601 format)'
    },
    {
      name: 'created_by',
      type: 'string',
      description: 'Creator identifier'
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
  execute: executeUpdate
};

export default command;
