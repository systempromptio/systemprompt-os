/**
 * @fileoverview MCP Resource handlers for agent status and task resources
 * @module handlers/resource-handlers
 * 
 * @remarks
 * This module provides handlers for MCP resource operations including:
 * - Listing available resources (static and dynamic)
 * - Reading resource contents (tasks, logs, status)
 * - Handling resource templates for dynamic URIs
 * 
 * @example
 * ```typescript
 * import { handleListResources, handleResourceCall } from './handlers/resource-handlers';
 * 
 * // List all resources
 * const { resources } = await handleListResources();
 * 
 * // Read a specific task
 * const result = await handleResourceCall({
 *   params: { uri: 'task://123' }
 * });
 * ```
 */

import type {
  ListResourcesResult,
  ReadResourceRequest,
  ReadResourceResult,
  Resource,
} from "@modelcontextprotocol/sdk/types.js";
import { RESOURCES } from "../constants/resources.js";
import { TaskStore } from "../services/task-store.js";
import { logger } from "../utils/logger.js";
import { matchResourceTemplate } from "./resource-templates-handler.js";
import { type TaskResourceContent, type TaskSession, type TaskMetadata } from "../types/resources/task-resource.js";
import { enhanceTask } from "../types/enhanced-task.js";

/**
 * Lists all available MCP resources including static and dynamic task resources
 * 
 * @returns List of available resources with metadata
 * @throws {Error} If resource listing fails
 * 
 * @example
 * ```typescript
 * const { resources } = await handleListResources();
 * console.log(`Available resources: ${resources.length}`);
 * ```
 */
export async function handleListResources(): Promise<ListResourcesResult> {
  try {
    const resources: Resource[] = [...RESOURCES];

    const taskStore = TaskStore.getInstance();
    const tasks = await taskStore.getTasks();
    tasks.forEach((task) => {
      resources.push({
        uri: `task://${task.id}`,
        name: `Task: ${task.description}`,
        mimeType: "application/json",
        description: `${task.description} (Status: ${task.status})`,
      });
    });


    logger.debug(
      `📚 Listing ${resources.length} resources (${RESOURCES.length} static, ${tasks.length} tasks)`,
    );

    return { resources };
  } catch (error) {
    throw new Error(`Failed to list resources: ${error}`);
  }
}

/**
 * Handles MCP resource read requests for various resource types
 * 
 * @param request - The resource read request with URI
 * @param _extra - Additional context (unused)
 * @returns Resource content in appropriate format
 * @throws {Error} If resource is not found or read fails
 * 
 * @remarks
 * Supports multiple resource URI patterns:
 * - `agent://status` - Agent status and capabilities
 * - `task://list` - List of all tasks
 * - `task://[id]` - Individual task details
 * - `task://[id]/logs` - Task logs
 * - `task://[id]/result` - Task result
 * - Various template-based resources
 * 
 * @example
 * ```typescript
 * const result = await handleResourceCall({
 *   params: { uri: 'agent://status' }
 * });
 * const status = JSON.parse(result.contents[0].text);
 * ```
 */
export async function handleResourceCall(
  request: ReadResourceRequest,
  _extra?: unknown,
): Promise<ReadResourceResult> {
  try {
    const { uri } = request.params;
    const taskStore = TaskStore.getInstance();

    if (uri === "agent://status") {
      const tasks = await taskStore.getTasks();
      const activeTasks = tasks.filter((t) => t.status === "in_progress");

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                status: "ready",
                version: "0.01",
                capabilities: ["claude", "gemini", "task-management"],
                activeTaskCount: activeTasks.length,
                totalTaskCount: tasks.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (uri === "task://list" || uri === "agent://tasks") {
      const tasks = await taskStore.getTasks();
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                count: tasks.length,
                tasks: tasks.map((task) => ({
                  id: task.id,
                  description: task.description,
                  status: task.status,
                  created_at: task.created_at,
                  updated_at: task.updated_at,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }


    if (uri.startsWith("task://")) {
      const taskId = uri.replace("task://", "");
      const task = await taskStore.getTask(taskId);

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Enhance the task to parse stringified JSON and extract metrics
      const enhancedTask = enhanceTask(task);
      
      const { AgentManager } = await import("../services/agent-manager/index.js");
      const agentManager = AgentManager.getInstance();
      const sessions = agentManager.getAllSessions();
      const taskSession = sessions.find(s => s.taskId === taskId);
      
      let session: TaskSession | undefined;
      
      if (taskSession) {
        session = {
          id: taskSession.id,
          type: taskSession.type,
          status: taskSession.status
        };
      }
      
      // Get metadata from enhanced task
      const metadata: TaskMetadata | undefined = enhancedTask.claudeMetrics ? {
        duration_ms: enhancedTask.claudeMetrics.duration,
        cost_usd: enhancedTask.claudeMetrics.cost,
        tokens: {
          input: enhancedTask.claudeMetrics.usage.inputTokens,
          output: enhancedTask.claudeMetrics.usage.outputTokens,
          cached: enhancedTask.claudeMetrics.usage.cacheCreationTokens + enhancedTask.claudeMetrics.usage.cacheReadTokens
        }
      } : undefined;

      // Create resource content with parsed result
      const processResource: TaskResourceContent & {
        logs?: typeof enhancedTask.logs;
        tool_invocations?: typeof enhancedTask.toolInvocations;
        tool_usage_summary?: typeof enhancedTask.toolUsageSummary;
        files_affected?: typeof enhancedTask.filesAffected;
        commands_executed?: typeof enhancedTask.commandsExecuted;
      } = {
        id: enhancedTask.id,
        description: enhancedTask.description,
        tool: enhancedTask.tool,
        status: enhancedTask.status,
        created_at: enhancedTask.created_at,
        updated_at: enhancedTask.updated_at,
        session,
        result: enhancedTask.result, // This is now properly parsed
        error: enhancedTask.error,
        metadata,
        log_count: enhancedTask.logs.length,
        // Include full enhanced data
        logs: enhancedTask.logs,
        tool_invocations: enhancedTask.toolInvocations,
        tool_usage_summary: enhancedTask.toolUsageSummary,
        files_affected: enhancedTask.filesAffected,
        commands_executed: enhancedTask.commandsExecuted
      };

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(processResource, null, 2),
          },
        ],
      };
    }

    if (uri === "agent://sessions") {
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                sessions: [],
                count: 0,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    const templateMatch = matchResourceTemplate(uri);
    if (templateMatch) {
      const { template, params } = templateMatch;
      logger.debug(`📋 Matched resource template: ${template.name}`, params);

      if (uri.match(/^task:\/\/[^\/]+\/logs$/)) {
        const taskId = params.taskId;
        const task = await taskStore.getTask(taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "text/plain",
              text: task.logs.join("\n") || "No logs available",
            },
          ],
        };
      }

      if (uri.match(/^task:\/\/[^\/]+\/result$/)) {
        const taskId = params.taskId;
        const task = await taskStore.getTask(taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(task.result || { message: "No result available" }, null, 2),
            },
          ],
        };
      }

      if (uri.match(/^session:\/\/[^\/]+\/[^\/]+$/)) {
        const { sessionType, sessionId } = params;
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  type: sessionType,
                  id: sessionId,
                  status: "placeholder",
                  message: "Session details not yet implemented",
                },
                null,
                2,
              ),
            },
          ],
        };
      }


      if (uri.match(/^project:\/\/[^\/]+\/status$/)) {
        const { projectPath } = params;
        const tasks = await taskStore.getTasks();
        const projectTasks: typeof tasks = [];
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  project: projectPath,
                  taskCount: projectTasks.length,
                  activeTasks: projectTasks.filter((t) => t.status === "in_progress").length,
                  completedTasks: projectTasks.filter((t) => t.status === "completed").length,
                  status: "active",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (uri.match(/^log:\/\/[^\/]+\/[^\/]+$/)) {
        const { logType, date } = params;
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "text/plain",
              text: `Logs for ${logType} on ${date}\n\nLog retrieval not yet implemented.`,
            },
          ],
        };
      }
    }

    throw new Error(`Unknown resource: ${uri}`);
  } catch (error) {
    throw new Error(`Failed to read resource: ${error}`);
  }
}
