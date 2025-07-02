/**
 * @fileoverview Create task tool handler for spawning AI agent tasks
 * @module handlers/tools/orchestrator/create-task
 * 
 * @remarks
 * This handler creates new tasks and optionally starts AI agent sessions
 * to execute them. It supports asynchronous task execution with progress
 * tracking and comprehensive logging.
 * 
 * @example
 * ```typescript
 * import { handleCreateTask } from './handlers/tools/create-task';
 * 
 * const result = await handleCreateTask({
 *   instructions: "Implement user authentication",
 *   tool: "CLAUDECODE"
 * }, { sessionId: "mcp_123" });
 * ```
 */

import type { ToolHandler, ToolHandlerContext, CallToolResult } from "./types.js";
import { formatToolResponse } from "./types.js";
import { logger } from "../../utils/logger.js";
import { CreateTaskArgsSchema, type CreateTaskArgs, ToolNotAvailableError } from "./utils/index.js";
import { validateInput, isToolAvailable, agentOperations, taskOperations } from "./utils/index.js";
import { TASK_STATUS } from "../../constants/task-status.js";

/**
 * Creates a new task and optionally starts an AI session to execute it
 *
 * @param args - Task creation parameters
 * @param context - Execution context containing session information
 * @returns Formatted response with task details and session information
 *
 * @remarks
 * This handler:
 * 1. Validates input arguments
 * 2. Creates a new task in the task store
 * 3. Starts an AI agent session (always CLAUDECODE)
 * 4. Executes initial instructions asynchronously
 * 5. Returns task details immediately
 *
 * @example
 * ```typescript
 * const result = await handleCreateTask({
 *   instructions: "Add JWT-based authentication to the API"
 * }, { sessionId: "mcp_123" });
 * 
 * console.log(result.result.task_id); // Task ID
 * console.log(result.result.session_id); // Agent session ID
 * ```
 */
export const handleCreateTask: ToolHandler<CreateTaskArgs> = async (
  args: unknown,
  context?: ToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    const validated = validateInput(CreateTaskArgsSchema, args);

    const tool = "CLAUDECODE";

    if (!isToolAvailable(tool)) {
      throw new ToolNotAvailableError(tool);
    }

    const projectPath = process.env.PROJECT_ROOT || "/workspace";
    
    // Limit description to 2555 characters
    const truncatedDescription = validated.instructions.length > 2555
      ? validated.instructions.substring(0, 2552) + '...'
      : validated.instructions;
    
    logger.debug("Creating task with description", {
      originalLength: validated.instructions.length,
      truncated: validated.instructions.length > 2555,
      finalLength: truncatedDescription.length,
    });
    
    const task = await taskOperations.createTask(
      {
        description: truncatedDescription,
        tool: tool,
        projectPath,
      },
      context?.sessionId,
    );

    let agentSessionId: string | null = null;

    try {
      await taskOperations.updateTaskStatus(task.id, TASK_STATUS.IN_PROGRESS, context?.sessionId, {
        completedAt: undefined,
      });

      const agentResult = await agentOperations.startAgentForTask(tool, task, {
        workingDirectory: projectPath,
        branch: "", // No branch needed
        sessionId: context?.sessionId,
      });

      agentSessionId = agentResult.sessionId;

      await taskOperations.updateTask(task.id, { assigned_to: agentSessionId }, context?.sessionId);

      if (validated.instructions) {
        executeInitialInstructions(
          agentSessionId,
          validated.instructions,
          task.id,
          tool,
          context?.sessionId,
        ).catch((error) => {
          logger.error("Background instruction execution failed", { error, taskId: task.id });
          taskOperations.addTaskLog(
            task.id,
            `Error: ${error}`,
            context?.sessionId,
          );
        });

        await taskOperations.addTaskLog(
          task.id,
          `Starting ${tool} agent...`,
          context?.sessionId,
        );
      }

      logger.info("Task created successfully", {
        taskId: task.id,
        agentSessionId,
      });
    } catch (error) {
      await taskOperations.updateTaskStatus(task.id, TASK_STATUS.FAILED, context?.sessionId, {
        error: error instanceof Error ? error.message : String(error),
      });

      if (agentSessionId) {
        await agentOperations.endAgentSession(agentSessionId, "Task creation failed");
      }

      throw error;
    }

    return formatToolResponse({
      message: `Task spawned successfully with ID ${task.id}`,
      result: {
        task_id: task.id,
        description: task.description,
        status: TASK_STATUS.IN_PROGRESS,
        tool: tool,
        session_id: agentSessionId,
        instructions_started: !!validated.instructions,
        created_at: task.created_at,
      },
    });
  } catch (error) {
    logger.error("Failed to create task", { error, args });
    return formatToolResponse({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to create task",
      error: {
        type: "task_creation_error",
        details: error instanceof Error ? error.stack : undefined,
      },
    });
  }
};

/**
 * Executes initial instructions with the agent asynchronously
 * 
 * @param agentSessionId - The agent session ID
 * @param instructions - Instructions to execute
 * @param taskId - The task ID
 * @param tool - The tool being used (always CLAUDECODE)
 * @param sessionId - Optional MCP session ID
 * @returns Execution result
 * 
 * @remarks
 * This function runs asynchronously after task creation to:
 * 1. Set up progress handlers for real-time updates
 * 2. Execute the provided instructions
 * 3. Log execution results and timing
 * 4. Update task status based on outcome
 */
async function executeInitialInstructions(
  agentSessionId: string,
  instructions: string,
  taskId: string,
  tool: string,
  sessionId?: string,
): Promise<any> {
  let cleanup: (() => void) | undefined;

  try {
    await taskOperations.addTaskLog(
      taskId,
      `Processing request...`,
      sessionId,
    );

    if (tool === "CLAUDECODE") {
      cleanup = agentOperations.setupClaudeProgressHandlers(
        taskId,
        sessionId || "",
        agentSessionId,
      );
    }

    const result = await agentOperations.executeInstructions(agentSessionId, instructions, {
      taskId,
      updateProgress: true,
    });
    
    // Debug logging to trace the result structure
    logger.info("executeInstructions result", {
      taskId,
      success: result.success,
      hasOutput: !!result.output,
      outputType: typeof result.output,
      outputLength: result.output?.length || 0,
      resultKeys: Object.keys(result || {}),
    });

    const durationSeconds = Math.floor(result.duration / 1000);
    await taskOperations.addTaskLog(
      taskId,
      {
        timestamp: new Date().toISOString(),
        level: "info",
        type: "system",
        prefix: "EXECUTION_TIME",
        message: `${tool} execution took ${durationSeconds} seconds`,
        metadata: {
          tool,
          duration: durationSeconds,
        },
      },
      sessionId,
    );

    if (result.success) {
      await taskOperations.addTaskLog(
        taskId,
        {
          timestamp: new Date().toISOString(),
          level: "info",
          type: "system",
          message: "Task completed successfully",
          metadata: {
            tool,
          },
        },
        sessionId,
      );

      if (result.output) {
        let parsedOutput: any = null;
        let isJson = false;
        try {
          if (result.output.trim().startsWith("{") || result.output.trim().startsWith("[")) {
            parsedOutput = JSON.parse(result.output);
            isJson = true;
          }
        } catch (e) {
        }

        await taskOperations.addTaskLog(
          taskId,
          {
            timestamp: new Date().toISOString(),
            level: "info",
            type: "output",
            prefix: `${tool}_OUTPUT`,
            message: isJson ? "Tool execution result" : result.output,
            metadata: {
              tool,
              outputLength: result.output.length,
              isJson,
              ...(isJson && parsedOutput ? { data: parsedOutput } : {}),
            },
          },
          sessionId,
        );
      }
      // Add debug logging to trace output capture
      logger.info("Updating task to WAITING with output", {
        taskId,
        hasOutput: !!result.output,
        outputLength: result.output?.length || 0,
      });
      
      await taskOperations.updateTaskStatus(taskId, TASK_STATUS.WAITING, sessionId, {
        result: result.output || null,
      });
    } else {
      await taskOperations.updateTaskStatus(taskId, TASK_STATUS.FAILED, sessionId, {
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to execute instructions", { error, taskId });
    await taskOperations.addTaskLog(
      taskId,
      {
        timestamp: new Date().toISOString(),
        level: "error",
        type: "system",
        prefix: "ERROR",
        message: `Instructions error: ${error}`,
        metadata: {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : error,
        },
      },
      sessionId,
    );
    throw error;
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
}
