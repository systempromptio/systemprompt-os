/**
 * @file Check status orchestrator tool
 * @module handlers/tools/orchestrator/check-status
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from "./types.js";
import { formatToolResponse } from "./types.js";
import { logger } from "../../utils/logger.js";
import { execSync } from "child_process";
import * as net from "net";
import { 
  type CheckStatusArgs, 
  StatusCheckError,
  SystemStatus,
  ServiceStatus,
  SessionStatus,
  type CheckStatusResponse
} from "./utils/index.js";
import { agentToOrchestratorState, type AgentState } from "../../types/session-states.js";
import { isToolAvailable, taskOperations, agentOperations } from "./utils/index.js";
import { TASK_STATUS } from "../../constants/task-status.js";

/**
 * Internal service status information
 */
interface InternalServiceStatus {
  available: boolean;
  cli_path: string | null;
  error: string | null;
  version: string | null;
  cli_name: string;
  daemon_reachable?: boolean;
  daemon_has_tool?: boolean;
}

/**
 * Checks the status of Claude Code SDK availability
 *
 * @param args - Check status parameters including verbosity and test options
 * @param context - Execution context containing session information
 * @returns Comprehensive status report of all services and system state
 *
 * @example
 * ```typescript
 * await handleCheckStatus({
 *   verbose: true,
 *   include_tasks: true
 * });
 * ```
 */
export const handleCheckStatus: ToolHandler<CheckStatusArgs> = async (
  args: CheckStatusArgs,
  context?: ToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    // No validation needed - check-status accepts no arguments

    logger.info("Checking system status", {
      sessionId: context?.sessionId,
    });

    // Initialize internal status structure
    const claudeStatus = createEmptyServiceStatus("Claude Code");
    const daemonHost = process.env.CLAUDE_PROXY_HOST ||
      process.env.HOST_BRIDGE_DAEMON_HOST ||
      "host.docker.internal";
    const daemonPort = parseInt(
      process.env.CLAUDE_PROXY_PORT || process.env.HOST_BRIDGE_DAEMON_PORT || "9876",
      10,
    );

    // Check daemon connectivity first
    const daemonStatus = await checkDaemonConnectivity();
    
    // Check tool availability - prefer daemon status over environment
    if (daemonStatus.reachable) {
      claudeStatus.daemon_reachable = true;
      claudeStatus.daemon_has_tool = daemonStatus.tools.includes("claude");

      // Use daemon status if available
      claudeStatus.available = claudeStatus.daemon_has_tool;

      // Get tool paths from environment
      claudeStatus.cli_path = process.env.CLAUDE_PATH || null;
    } else {
      // Fall back to environment variables
      claudeStatus.available = isToolAvailable("CLAUDECODE");
    }

    // Perform detailed checks
    await checkClaudeCodeVersion(claudeStatus);

    // Get active tasks and sessions
    const tasks = await taskOperations.taskStore.getAllTasks();
    const activeTasks = tasks.filter(
      (t: any) => t.status === TASK_STATUS.PENDING || 
                   t.status === TASK_STATUS.IN_PROGRESS ||
                   t.status === TASK_STATUS.COMPLETED_ACTIVE,
    );

    const sessions = agentOperations.agentManager.getAllSessions();
    const activeSessions = sessions.filter(
      (s: any) => s.status === "active" || s.status === "busy",
    );

    // Determine overall system status
    const claudeActive = claudeStatus.available;
    let systemStatus: SystemStatus;

    if (claudeActive) {
      systemStatus = SystemStatus.ACTIVE;
    } else {
      systemStatus = SystemStatus.NOT_ACTIVE;
    }

    logger.info("Status check completed", {
      systemStatus,
      claudeActive,
      activeTasks: activeTasks.length,
      activeSessions: activeSessions.length,
    });

    // Build clean response
    const response: CheckStatusResponse = {
      status: systemStatus,
      services: {
        claude: {
          status: claudeActive ? ServiceStatus.ACTIVE : ServiceStatus.NOT_ACTIVE,
          available: claudeActive,
        },
      },
      daemon: {
        connected: daemonStatus.reachable,
        host: daemonHost,
        port: daemonPort,
      },
      tasks: {
        active: activeTasks.length,
        total: tasks.length,
      },
      sessions: {
        active: activeSessions.length,
        total: sessions.length,
      },
      processes: activeSessions.map((s: any) => {
        const orchestratorState = agentToOrchestratorState(s.status as AgentState);
        // Default to TERMINATED if state is not mapped (e.g., error, starting)
        const status = orchestratorState === 'active' ? SessionStatus.ACTIVE :
                      orchestratorState === 'busy' ? SessionStatus.BUSY :
                      SessionStatus.TERMINATED;
        
        return {
          id: s.id,
          type: s.type as "claude",
          status,
          taskId: s.taskId,
        };
      }),
    };

    return formatToolResponse({
      message: `System ${systemStatus}`,
      result: response,
    });
  } catch (error) {
    logger.error("Failed to check status", { error, args });

    if (error instanceof StatusCheckError) {
      return formatToolResponse({
        status: "error",
        message: error.message,
        error: {
          type: "status_check_error",
          details: error.details,
        },
      });
    }

    return formatToolResponse({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to check status",
      error: {
        type: "status_check_error",
        details: error instanceof Error ? error.stack : undefined,
      },
    });
  }
};

/**
 * Creates an empty service status object
 */
function createEmptyServiceStatus(cliName: string): InternalServiceStatus {
  return {
    available: false,
    cli_path: null,
    error: null,
    version: null,
    cli_name: cliName,
  };
}

/**
 * Checks daemon connectivity and available tools
 */
async function checkDaemonConnectivity(): Promise<{
  reachable: boolean;
  tools: string[];
  error?: string;
}> {
  const proxyHost =
    process.env.CLAUDE_PROXY_HOST || process.env.HOST_BRIDGE_DAEMON_HOST || "host.docker.internal";
  const proxyPort = parseInt(
    process.env.CLAUDE_PROXY_PORT || process.env.HOST_BRIDGE_DAEMON_PORT || "9876",
    10,
  );

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ reachable: false, tools: [], error: "Connection timeout" });
    }, 5000);

    const client = net.createConnection({ port: proxyPort, host: proxyHost });

    client.on("connect", () => {
      clearTimeout(timeout);
      // Send a status request
      const message = JSON.stringify({
        tool: "status",
        command: "check",
      });
      client.write(message + "\n");

      let responseData = "";
      client.on("data", (data) => {
        responseData += data.toString();
        // Simple check for available tools in response
        if (responseData.includes("Available tools:")) {
          const tools: string[] = [];
          if (responseData.includes("claude")) tools.push("claude");
          client.destroy();
          resolve({ reachable: true, tools });
        }
      });

      // Fallback if no proper response
      setTimeout(() => {
        client.destroy();
        // Assume daemon is reachable but couldn't parse tools
        resolve({ reachable: true, tools: [] });
      }, 2000);
    });

    client.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        reachable: false,
        tools: [],
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

/**
 * Checks Claude Code CLI version
 */
async function checkClaudeCodeVersion(claudeStatus: InternalServiceStatus): Promise<void> {
  try {
    if (!claudeStatus.available && !claudeStatus.daemon_has_tool) {
      claudeStatus.error = "Claude Code CLI not available";
      return;
    }

    // If daemon has the tool, we can try to get version through it
    if (claudeStatus.daemon_reachable && claudeStatus.daemon_has_tool) {
      logger.info("Claude available through daemon");
      claudeStatus.version = "Available via daemon";
      return;
    }

    logger.info("Checking Claude Code version locally");
    const version = execSync("claude --version", {
      encoding: "utf-8",
      env: { ...process.env },
      timeout: 30000,
    }).trim();

    claudeStatus.version = version;
    logger.info("Claude Code version detected", { version });
  } catch (error) {
    claudeStatus.error = "Failed to get Claude Code version";
    logger.error("Claude Code version check failed", { error });
  }
}


