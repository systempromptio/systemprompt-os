/**
 * @fileoverview Check status tool handler that inspects system health and service availability
 * @module handlers/tools/check-status
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from "./types.js";
import { formatToolResponse } from "./types.js";
import { logger } from "../../utils/logger.js";
import { execSync } from "node:child_process";
import * as net from "net";

/**
 * Check status arguments
 */
interface CheckStatusArgs {
  verbose?: boolean;
}

/**
 * Internal service status information
 */
interface InternalServiceStatus {
  available: boolean;
  clipath: string | null;
  error: string | null;
  version: string | null;
  cliname: string;
  daemonreachable?: boolean;
  daemonhas_tool?: boolean;
}

/**
 * Checks the status of system services
 *
 * @param args - Check status parameters including verbosity options
 * @param context - Execution context containing session information
 * @returns Status report of services and system state
 *
 * @example
 * ```typescript
 * await handleCheckStatus({
 *   verbose: true
 * });
 * ```
 */
export const handleCheckStatus: ToolHandler<CheckStatusArgs> = async (
  args: CheckStatusArgs,
  context?: ToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    logger.info("Checking system status", {
      sessionId: context?.sessionId,
    });

    const claudeStatus = createEmptyServiceStatus("Claude Code");
    const daemonHost = process.env.CLAUDEPROXY_HOST ||
      process.env.HOSTBRIDGE_DAEMON_HOST ||
      "host.docker.internal";
    const daemonPort = parseInt(
      process.env.CLAUDEPROXY_PORT || process.env.HOSTBRIDGE_DAEMON_PORT || "9876",
      10,
    );

    const daemonStatus = await checkDaemonConnectivity();
    
    if (daemonStatus.reachable) {
      claudeStatus.daemonreachable = true;
      claudeStatus.daemonhas_tool = daemonStatus.tools.includes("claude");
      claudeStatus.available = claudeStatus.daemonhas_tool;
      claudeStatus.clipath = process.env.CLAUDEPATH || null;
    } else {
      claudeStatus.available = false;
    }

    await checkClaudeCodeVersion(claudeStatus);

    const claudeActive = claudeStatus.available;
    const systemStatus = claudeActive ? "ACTIVE" : "NOT_ACTIVE";

    logger.info("Status check completed", {
      systemStatus,
      claudeActive,
    });

    const response = {
      status: systemStatus,
      services: {
        claude: {
          status: claudeActive ? "ACTIVE" : "NOT_ACTIVE",
          available: claudeActive,
        },
      },
      daemon: {
        connected: daemonStatus.reachable,
        host: daemonHost,
        port: daemonPort,
      },
    };

    return formatToolResponse({
      message: `System ${systemStatus}`,
      result: response,
    });
  } catch (error) {
    logger.error("Failed to check status", { error, args });

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
 * 
 * @param cliName - Name of the CLI service
 * @returns Empty internal service status structure
 */
function createEmptyServiceStatus(cliName: string): InternalServiceStatus {
  return {
    available: false,
    clipath: null,
    error: null,
    version: null,
    cliname: cliName,
  };
}

/**
 * Checks daemon connectivity and available tools
 * 
 * @returns Daemon status with reachability and available tools
 */
async function checkDaemonConnectivity(): Promise<{
  reachable: boolean;
  tools: string[];
  error?: string;
}> {
  const proxyHost =
    process.env.CLAUDEPROXY_HOST || process.env.HOSTBRIDGE_DAEMON_HOST || "host.docker.internal";
  const proxyPort = parseInt(
    process.env.CLAUDEPROXY_PORT || process.env.HOSTBRIDGE_DAEMON_PORT || "9876",
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
      const message = JSON.stringify({
        tool: "status",
        command: "check",
      });
      client.write(message + "\n");

      let responseData = "";
      client.on("data", (data) => {
        responseData += data.toString();
        if (responseData.includes("Available tools:")) {
          const tools: string[] = [];
          if (responseData.includes("claude")) tools.push("claude");
          client.destroy();
          resolve({ reachable: true, tools });
        }
      });

      setTimeout(() => {
        client.destroy();
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
 * 
 * @param claudeStatus - Service status object to update with version info
 */
async function checkClaudeCodeVersion(claudeStatus: InternalServiceStatus): Promise<void> {
  try {
    if (!claudeStatus.available && !claudeStatus.daemonhas_tool) {
      claudeStatus.error = "Claude Code CLI not available";
      return;
    }

    if (claudeStatus.daemonreachable && claudeStatus.daemonhas_tool) {
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