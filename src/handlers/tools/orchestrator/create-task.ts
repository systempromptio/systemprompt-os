/**
 * @file Create task orchestrator tool
 * @module handlers/tools/orchestrator/create-task
 */

import type { ToolHandler, ToolHandlerContext, CallToolResult } from "../types.js";
import { formatToolResponse } from "../types.js";
import { logger } from "../../../utils/logger.js";
import { CreateTaskArgsSchema, type CreateTaskArgs, ToolNotAvailableError } from "./utils/index.js";
import { validateInput, isToolAvailable, agentOperations, taskOperations } from "./utils/index.js";
import { TASK_STATUS } from "../../../constants/task-status.js";

/**
 * Creates a new task and optionally starts an AI session to execute it
 *
 * @param args - Task creation parameters
 * @param context - Execution context containing session information
 * @returns Formatted response with task details and session information
 *
 * @example
 * ```typescript
 * await handleCreateTask({
 *   title: "Implement user authentication",
 *   tool: "CLAUDECODE",
 *   instructions: "Add JWT-based authentication to the API"
 * }, { sessionId: "session_123" });
 * ```
 */
export const handleCreateTask: ToolHandler<CreateTaskArgs> = async (
  args: unknown,
  context?: ToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    // Validate input
    const validated = validateInput(CreateTaskArgsSchema, args);

    // Always use CLAUDECODE
    const tool = "CLAUDECODE";

    // Check tool availability
    if (!isToolAvailable(tool)) {
      throw new ToolNotAvailableError(tool);
    }

    const projectPath = process.env.PROJECT_ROOT || "/workspace";
    const task = await taskOperations.createTask(
      {
        description: validated.instructions,
        tool: tool,
        projectPath,
      },
      context?.sessionId,
    );

    // Initialize result
    let agentSessionId: string | null = null;

    try {
      // Update task status to in_progress
      await taskOperations.updateTaskStatus(task.id, TASK_STATUS.IN_PROGRESS, context?.sessionId, {
        completedAt: undefined,
      });

      // Start agent session without git branch setup
      const agentResult = await agentOperations.startAgentForTask(tool, task, {
        workingDirectory: projectPath,
        branch: "", // No branch needed
        sessionId: context?.sessionId,
      });

      agentSessionId = agentResult.sessionId;

      // Update task with agent assignment
      await taskOperations.updateTask(task.id, { assigned_to: agentSessionId }, context?.sessionId);

      // Execute initial instructions asynchronously if provided
      if (validated.instructions) {
        // Start execution in background - don't await
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

        // Log that we're starting asynchronously
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
      // Update task status to failed
      await taskOperations.updateTaskStatus(task.id, TASK_STATUS.FAILED, context?.sessionId, {
        error: error instanceof Error ? error.message : String(error),
      });

      // End agent session if it was started
      if (agentSessionId) {
        await agentOperations.endAgentSession(agentSessionId, "Task creation failed");
      }

      throw error;
    }

    // Return success response
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
 * Executes initial instructions with the agent
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

    // Set up progress handlers for Claude
    if (tool === "CLAUDECODE") {
      cleanup = agentOperations.setupClaudeProgressHandlers(
        taskId,
        sessionId || "",
        agentSessionId,
      );
    }

    // Execute instructions
    const result = await agentOperations.executeInstructions(agentSessionId, instructions, {
      taskId,
      updateProgress: true,
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
      // Don't mark as completed - let end-task handle that
      // Just log the successful execution
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
        // Try to parse JSON output
        let parsedOutput: any = null;
        let isJson = false;
        try {
          if (result.output.trim().startsWith("{") || result.output.trim().startsWith("[")) {
            parsedOutput = JSON.parse(result.output);
            isJson = true;
          }
        } catch (e) {
          // Not JSON, treat as string
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
      // Mark task as completed_active (session still available for updates)
      await taskOperations.updateTaskStatus(taskId, TASK_STATUS.COMPLETED_ACTIVE, sessionId);
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
