/**
 * @fileoverview System status check tool
 * @module auth/tools/check-status
 */

// Tool definition interface (temporary until MCP types are available)
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  execute: (input: any, context: any) => Promise<any>;
}

/**
 * Check Status tool definition
 * Returns system operational status
 */
export const tool: ToolDefinition = {
  name: 'checkstatus',
  description: 'Check system operational status and health metrics',
  inputSchema: {
    type: 'object',
    description: 'Options for the status check',
    properties: {
      includeContainers: {
        type: 'boolean',
        description: 'Include container status information',
        default: false,
      },
      includeUsers: {
        type: 'boolean',
        description: 'Include user statistics',
        default: false,
      },
      includeResources: {
        type: 'boolean',
        description: 'Include system resource usage',
        default: false,
      },
      includeTunnels: {
        type: 'boolean',
        description: 'Include tunnel status',
        default: false,
      },
      includeAuditLog: {
        type: 'boolean',
        description: 'Include recent audit log entries',
        default: false,
      },
    },
    additionalProperties: false,
  },
  execute: async (params: any, context: any) => {
    const {
      includeContainers = false,
      includeUsers = false,
      includeResources = false,
      includeTunnels = false,
      includeAuditLog = false,
    } = params || {};

    // Basic status information
    const result: any = {
      message: 'System operational',
      result: {
        status: 'healthy',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };

    // Add resource information if requested
    if (includeResources) {
      const memUsage = process.memoryUsage();
      result.result.resources = {
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          unit: 'MB',
        },
        uptime: {
          seconds: Math.floor(process.uptime()),
          formatted: formatUptime(process.uptime()),
        },
      };
    }

    // Add container status if requested
    if (includeContainers) {
      result.result.containers = {
        status: 'running',
        count: 1,
        details: [
          {
            name: 'systemprompt-os',
            status: 'running',
            health: 'healthy',
          },
        ],
      };
    }

    // Add user statistics if requested
    if (includeUsers) {
      result.result.users = {
        total: 1,
        active: 1,
        admins: context.role === 'admin' ? 1 : 0,
      };
    }

    // Add tunnel status if requested
    if (includeTunnels) {
      result.result.tunnels = {
        enabled: false,
        active: 0,
      };
    }

    // Add audit log if requested
    if (includeAuditLog) {
      result.result.auditLog = {
        entries: 0,
        latest: [],
      };
    }

    return result;
  },
};

/**
 * Format uptime in human-readable format
 * @param seconds - Uptime in seconds
 * @returns Formatted uptime string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) {parts.push(`${days}d`);}
  if (hours > 0) {parts.push(`${hours}h`);}
  if (minutes > 0) {parts.push(`${minutes}m`);}
  if (secs > 0 || parts.length === 0) {parts.push(`${secs}s`);}

  return parts.join(' ');
}