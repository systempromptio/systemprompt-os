/**
 * @fileoverview Task output resource handler for MCP protocol
 * @module handlers/resources/task-output
 */

import { Resource } from "@modelcontextprotocol/sdk/types.js";
import { TaskStore } from "../../services/task-store.js";
import { ClaudeCodeService } from "../../services/claude-code/index.js";
import { AgentManager } from "../../services/agent-manager/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Gets task output as a resource
 * 
 * @param uri - Resource URI containing task ID
 * @returns Task output resource with logs and session data
 */
export async function getTaskOutputResource(uri: URL): Promise<Resource> {
  const taskId = uri.pathname.replace("/task-output/", "");
  
  if (!taskId) {
    throw new Error("Task ID is required");
  }
  
  const taskStore = TaskStore.getInstance();
  const claudeService = ClaudeCodeService.getInstance();
  const agentManager = AgentManager.getInstance();
  
  try {
    const task = await taskStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    const sessions = agentManager.getAllSessions();
    const taskSession = sessions.find(s => s.taskId === taskId);
    
    let streamOutput: string | any = "";
    let progressEvents: any[] = [];
    
    if (taskSession && taskSession.type === 'claude') {
      const claudeSession = claudeService.getSession(taskSession.serviceSessionId);
      if (claudeSession) {
        const rawOutput = claudeSession.streamBuffer.join("\n");
        
        if (rawOutput.trim().startsWith('{') || rawOutput.trim().startsWith('[')) {
          try {
            streamOutput = JSON.parse(rawOutput);
          } catch (e) {
            streamOutput = rawOutput;
          }
        } else {
          streamOutput = rawOutput;
        }
      }
    }
    
    const output = {
      task: {
        id: task.id,
        description: task.description,
        status: task.status,
        elapsed_seconds: 0,
        created_at: task.created_at,
        updated_at: task.updated_at
      },
      session: taskSession ? {
        id: taskSession.id,
        type: taskSession.type,
        status: taskSession.status,
        created_at: taskSession.created_at,
        last_activity: taskSession.last_activity
      } : null,
      logs: task.logs || [],
      stream_output: streamOutput,
      progress_events: progressEvents,
      files_created: [],
      commands_executed: []
    };
    
    return {
      uri: uri.toString(),
      name: `Task Output: ${task.description}`,
      description: `Complete output and progress for task ${taskId}`,
      mimeType: "application/json",
      text: JSON.stringify(output, null, 2)
    };
    
  } catch (error) {
    logger.error("Failed to get task output resource", { taskId, error });
    throw error;
  }
}

/**
 * Lists available task output resources
 * 
 * @returns Array of task output resources for active tasks
 */
export async function listTaskOutputResources(): Promise<Resource[]> {
  const taskStore = TaskStore.getInstance();
  const tasks = await taskStore.getTasks();
  
  const activeTasks = tasks.filter(t => 
    t.status === 'in_progress' || 
    t.status === 'pending' ||
    (t.status === 'completed' && t.updated_at && 
     new Date(t.updated_at).getTime() > Date.now() - 3600000)
  );
  
  return activeTasks.map(task => ({
    uri: `task-output://task-output/${task.id}`,
    name: `Task Output: ${task.description}`,
    description: `Live output for ${task.status} task`,
    mimeType: "application/json"
  }));
}