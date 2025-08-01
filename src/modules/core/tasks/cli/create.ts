/**
 * Tasks module create CLI command.
 * @file Tasks module create CLI command.
 * @module modules/core/tasks/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { TaskService } from '@/modules/core/tasks/services/tasks.service';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import { validateCliArgs } from '@/modules/core/tasks/utils/cli-validation';

/**
 * Execute create command.
 * @param context - CLI context.
 * @returns Promise that resolves when task is created.
 */
const executeCreate = async (context: ICLIContext): Promise<void> => {
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const validatedArgs = validateCliArgs('create', context.args, cliOutput);
    if (!validatedArgs) {
      process.exit(1);
    }

    const {
      format,
      type,
      module_id,
      instructions,
      priority,
      status,
      max_executions,
      max_time,
      progress,
      assigned_agent_id,
      scheduled_at,
      created_by
    } = validatedArgs;

    const taskService = TaskService.getInstance();

    const taskData = {
      type,
      module_id,
      instructions,
      priority,
      status,
      max_executions,
      max_time,
      progress,
      assigned_agent_id,
      scheduled_at,
      created_by
    };

    const task = await taskService.addTask(taskData);

    if (format === 'json') {
      cliOutput.json(task);
    } else {
      cliOutput.success('Task created successfully');
      cliOutput.keyValue({
        'ID': task.id,
        'Type': task.type,
        'Module': task.module_id,
        'Status': task.status || 'pending',
        'Priority': task.priority || 0,
        'Max Executions': task.max_executions || 3,
        ...task.instructions && { Instructions: task.instructions },
        ...task.progress && { Progress: `${task.progress}%` },
        ...task.assigned_agent_id && { 'Assigned Agent': task.assigned_agent_id },
        'Created': task.created_at ? new Date(task.created_at).toLocaleString() : 'Now'
      });
    }

    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cliOutput.error(`Error creating task: ${errorMessage}`);
    logger.error(LogSource.TASKS, 'Create command failed', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
};

/**
 * Tasks create command.
 */
export const command: ICLICommand = {
  description: 'Create a new task in the queue',
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Task type',
      required: true
    },
    {
      name: 'module_id',
      alias: 'm',
      type: 'string',
      description: 'Module ID',
      required: true
    },
    {
      name: 'instructions',
      alias: 'i',
      type: 'string',
      description: 'Task instructions (JSON string)'
    },
    {
      name: 'priority',
      alias: 'p',
      type: 'number',
      description: 'Task priority (default: 0)',
      default: 0
    },
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Initial task status',
      default: 'pending',
      choices: Object.values(TaskStatus)
    },
    {
      name: 'max_executions',
      type: 'number',
      description: 'Maximum number of execution attempts',
      default: 3
    },
    {
      name: 'max_time',
      type: 'number',
      description: 'Maximum execution time in seconds'
    },
    {
      name: 'progress',
      type: 'number',
      description: 'Initial progress (0-100)'
    },
    {
      name: 'assigned_agent_id',
      type: 'string',
      description: 'Assigned agent ID'
    },
    {
      name: 'scheduled_at',
      type: 'string',
      description: 'Schedule task for specific time (ISO 8601 format)'
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
  execute: executeCreate
};

export default command;
