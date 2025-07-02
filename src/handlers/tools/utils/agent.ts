/**
 * @fileoverview Agent management utilities for orchestrator tools providing
 * high-level operations for starting, executing, and managing AI agent sessions
 * @module handlers/tools/orchestrator/utils/agent
 */

import { AgentManager } from "../../../services/agent-manager/index.js";
import { ClaudeCodeService, ClaudeCodeOptions } from "../../../services/claude-code/index.js";
import { TaskStore } from "../../../services/task-store.js";
import { logger } from "../../../utils/logger.js";
import type { AITool, Task, TaskLogEntry } from "../../../types/task.js";
import { TASK_STATUS } from "../../../constants/task-status.js";

/**
 * Result of starting an agent session
 */
export interface AgentStartResult {
  sessionId: string;
  serviceSessionId?: string;
  tool: AITool;
}

/**
 * Result of executing agent instructions
 */
export interface AgentExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

/**
 * High-level utilities for agent management
 */
export class AgentOperations {
  public readonly agentManager: AgentManager;
  private readonly claudeService: ClaudeCodeService;
  private readonly taskStore: TaskStore;

  constructor(agentManager?: AgentManager, taskStore?: TaskStore) {
    this.agentManager = agentManager || AgentManager.getInstance();
    this.claudeService = ClaudeCodeService.getInstance();
    this.taskStore = taskStore || TaskStore.getInstance();
  }

  /**
   * Starts an agent session for a task
   * 
   * @param tool The AI tool to use
   * @param task The task to execute
   * @param options Additional options
   * @returns Agent session information
   */
  async startAgentForTask(
    tool: AITool,
    task: Task,
    options: {
      workingDirectory?: string;
      sessionId?: string;
    } = {},
  ): Promise<AgentStartResult> {
    const workingDirectory = options.workingDirectory || process.cwd();

    try {
      if (tool === "CLAUDECODE") {
        const claudeOptions: ClaudeCodeOptions = {
          workingDirectory,
        };

        const sessionId = await this.agentManager.startClaudeSession({
          project_path: workingDirectory,
          task_id: task.id,
          mcp_session_id: options.sessionId,
          options: claudeOptions,
        });

        const agentSession = this.agentManager.getSession(sessionId);
        if (agentSession?.serviceSessionId) {
          this.claudeService.setTaskId(agentSession.serviceSessionId, task.id);

          if (options.sessionId) {
            this.claudeService.setMcpSessionId(agentSession.serviceSessionId, options.sessionId);

            const logEntry: TaskLogEntry = {
              timestamp: new Date().toISOString(),
              level: 'info',
              type: 'system',
              message: `Session ready`,
              metadata: {
                sessionId: agentSession.serviceSessionId,
                mcpSessionId: options.sessionId,
              }
            };
            await this.taskStore.addLog(task.id, logEntry, options.sessionId);
          }
        }

        return {
          sessionId,
          serviceSessionId: agentSession?.serviceSessionId,
          tool: "CLAUDECODE",
        };
      } else {
        throw new Error(`Unsupported tool: ${tool}`);
      }
    } catch (error) {
      logger.error("Failed to start agent", { tool, taskId: task.id, error });
      throw error;
    }
  }

  /**
   * Executes instructions with an agent
   * 
   * @param sessionId The agent session ID
   * @param instructions The instructions to execute
   * @param options Execution options
   * @returns Execution result
   */
  async executeInstructions(
    sessionId: string,
    instructions: string,
    options: {
      taskId?: string;
      updateProgress?: boolean;
      timeout?: number;
    } = {},
  ): Promise<AgentExecuteResult> {
    const startTime = Date.now();
    const { taskId, updateProgress = true, timeout = 300000 } = options;

    try {
      let progressInterval: NodeJS.Timeout | undefined;

      if (updateProgress && taskId) {
        await this.taskStore.addLog(taskId, {
          timestamp: new Date().toISOString(),
          level: "info",
          type: "progress",
          message: "Task started, processing instructions..."
        });
        
        let updateCount = 0;
        progressInterval = setInterval(async () => {
          updateCount++;
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          
          let message = "";
          if (minutes > 0) {
            message = `Still processing... (${minutes}m ${seconds}s)`;
          } else {
            message = `Processing... (${elapsed}s)`;
          }
          
          if (elapsed > 120) {
            message = `Complex task in progress... (${minutes}m ${seconds}s)`;
          }
          
          await this.taskStore.addLog(taskId, {
            timestamp: new Date().toISOString(),
            level: "info",
            type: "progress",
            message: message
          });
        }, 30000);
      }

      try {
        const result = await this.agentManager.sendCommand(sessionId, {
          command: instructions,
          timeout,
        });

        const duration = Date.now() - startTime;

        if (progressInterval) {
          clearInterval(progressInterval);
        }

        if (result.success) {
          return {
            success: true,
            output: result.output,
            duration,
          };
        } else {
          return {
            success: false,
            error:
              typeof result.error === "string"
                ? result.error
                : result.error?.message || "Command failed",
            duration,
          };
        }
      } finally {
        if (progressInterval) {
          clearInterval(progressInterval);
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Failed to execute instructions", { sessionId, error });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  /**
   * Sets up event handlers for Claude progress tracking
   * 
   * @param taskId The task ID to track
   * @param sessionId The session ID
   * @param agentSessionId The agent session ID
   * @returns Cleanup function to remove handlers
   */
  setupClaudeProgressHandlers(
    taskId: string,
    sessionId?: string,
    agentSessionId?: string,
  ): () => void {
    const progressHandler = async (data: any) => {
      if (data.taskId === taskId) {
        await this.taskStore.addLog(taskId, `[PROGRESS] ${data.event}: ${data.data}`, sessionId);

        if (data.event === "error:occurred") {
          await this.taskStore.updateTask(taskId, { status: TASK_STATUS.FAILED }, sessionId);
        }
      }
    };

    const streamHandler = async (data: any) => {
      if (data.taskId === taskId && agentSessionId) {
        const agentSession = this.agentManager.getSession(agentSessionId);
        if (agentSession) {
          agentSession.last_activity = new Date().toISOString();
        }
      }
    };

    this.claudeService.on("task:progress", progressHandler);
    this.claudeService.on("stream:data", streamHandler);

    return () => {
      this.claudeService.off("task:progress", progressHandler);
      this.claudeService.off("stream:data", streamHandler);
    };
  }

  /**
   * Ends an agent session gracefully
   * 
   * @param sessionId The session ID to end
   * @param reason Optional reason for ending
   */
  async endAgentSession(sessionId: string, reason?: string): Promise<void> {
    try {
      const session = this.agentManager.getSession(sessionId);
      if (!session) {
        logger.warn("Session not found when ending", { sessionId });
        return;
      }

      await this.agentManager.endSession(sessionId);

      if (reason) {
        logger.info("Agent session ended", { sessionId, reason });
      }
    } catch (error) {
      logger.error("Failed to end agent session", { sessionId, error });
    }
  }

  /**
   * Gets statistics about active agents
   * 
   * @returns Agent statistics
   */
  async getAgentStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    byTool: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const sessions = this.agentManager.getAllSessions();

    const byTool = sessions.reduce(
      (acc) => {
        const tool = "CLAUDECODE";
        acc[tool] = (acc[tool] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byStatus = sessions.reduce(
      (acc, session) => {
        acc[session.status] = (acc[session.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === "active" || s.status === "busy").length,
      byTool,
      byStatus,
    };
  }
}

/**
 * Singleton instance of agent operations
 */
export const agentOperations = new AgentOperations();
