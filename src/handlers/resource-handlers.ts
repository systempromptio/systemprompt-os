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

export async function handleListResources(): Promise<ListResourcesResult> {
  try {
    // Start with static resources
    const resources: Resource[] = [...RESOURCES];

    // Add dynamic task resources
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

    // Task output resources removed - consolidated into main task resources

    logger.debug(
      `📚 Listing ${resources.length} resources (${RESOURCES.length} static, ${tasks.length} tasks)`,
    );

    return { resources };
  } catch (error) {
    throw new Error(`Failed to list resources: ${error}`);
  }
}

export async function handleResourceCall(
  request: ReadResourceRequest,
  _extra?: any,
): Promise<ReadResourceResult> {
  try {
    const { uri } = request.params;
    const taskStore = TaskStore.getInstance();

    // Handle agent status
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
                version: "1.0.0",
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

    // Handle task list
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


    // Handle individual task resources
    if (uri.startsWith("task://")) {
      const taskId = uri.replace("task://", "");
      const task = await taskStore.getTask(taskId);

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Get session information if available
      const { AgentManager } = await import("../services/agent-manager/index.js");
      const { ClaudeCodeService } = await import("../services/claude-code/index.js");
      
      const agentManager = AgentManager.getInstance();
      const claudeService = ClaudeCodeService.getInstance();
      
      const sessions = agentManager.getAllSessions();
      const taskSession = sessions.find(s => s.taskId === taskId);
      
      let sessionInfo = null;
      let streamOutput: string | any = "";
      
      if (taskSession) {
        sessionInfo = {
          id: taskSession.id,
          type: taskSession.type,
          status: taskSession.status,
          created_at: taskSession.created_at,
          last_activity: taskSession.last_activity,
          service_session_id: taskSession.serviceSessionId
        };
        
        // Get streaming output if Claude session
        if (taskSession.type === 'claude' && taskSession.serviceSessionId) {
          const claudeSession = claudeService.getSession(taskSession.serviceSessionId);
          if (claudeSession && claudeSession.streamBuffer) {
            // Join the stream buffer lines
            const rawOutput = claudeSession.streamBuffer.join("\n");
            
            // Try to parse as JSON if it looks like JSON
            if (rawOutput.trim().startsWith('{') || rawOutput.trim().startsWith('[')) {
              try {
                // Parse the JSON to validate it, then store as parsed object
                streamOutput = JSON.parse(rawOutput);
              } catch (e) {
                // If parsing fails, keep as string
                streamOutput = rawOutput;
              }
            } else {
              streamOutput = rawOutput;
            }
          }
        }
      }

      // Calculate duration
      let duration_seconds = 0;
      if (task.started_at) {
        const endTime = task.completed_at ? new Date(task.completed_at) : new Date();
        duration_seconds = Math.floor((endTime.getTime() - new Date(task.started_at).getTime()) / 1000);
      }

      // Build complete process resource
      const processResource = {
        id: task.id,
        description: task.description,
        tool: task.tool,
        status: task.status,
        created_at: task.created_at,
        started_at: task.started_at,
        completed_at: task.completed_at,
        updated_at: task.updated_at,
        duration_seconds,
        
        // Complete execution log with proper formatting
        logs: task.logs || [],
        
        // Process information
        process: {
          assigned_to: task.assigned_to,
          session: sessionInfo,
          working_directory: "/workspace",
          stream_output: streamOutput
        },
        
        // Execution results
        result: task.result || null,
        error: task.error || null,
        
        // Metadata
        metadata: {
          log_count: task.logs?.length || 0,
          has_error: !!task.error,
          has_output: !!streamOutput,
          last_updated: task.updated_at || task.created_at
        }
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

    // Handle active sessions (placeholder for now)
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

    // Try to match against resource templates
    const templateMatch = matchResourceTemplate(uri);
    if (templateMatch) {
      const { template, params } = templateMatch;
      logger.debug(`📋 Matched resource template: ${template.name}`, params);

      // Handle task logs template
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

      // Handle task result template
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

      // Handle session template
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

      // Handle branch tasks template
      if (uri.match(/^branch:\/\/[^\/]+\/tasks$/)) {
        const { branchName } = params;
        const tasks = await taskStore.getTasks();
        // Branch filtering removed - returning empty array
        const branchTasks: typeof tasks = [];
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  branch: branchName,
                  count: branchTasks.length,
                  tasks: branchTasks.map((t) => ({
                    id: t.id,
                    description: t.description,
                    status: t.status,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Handle project status template
      if (uri.match(/^project:\/\/[^\/]+\/status$/)) {
        const { projectPath } = params;
        const tasks = await taskStore.getTasks();
        // Project filtering by branch removed - returning empty array
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

      // Handle log template
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
