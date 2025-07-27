import {
  ONE,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  ZERO
} from '@/modules/core/auth/constants';
import type {
  IToolContext,
  IToolDefinition,
  IToolResult
} from '@/modules/core/auth/types/tool.types';

/**
 * Status check input parameters interface.
 */
interface IStatusCheckInput {
  includeContainers?: boolean;
  includeUsers?: boolean;
  includeResources?: boolean;
  includeTunnels?: boolean;
  includeAuditLog?: boolean;
}

/**
 * Resource information interface.
 */
interface IResourceInfo {
  memory: {
    used: number;
    total: number;
    unit: string;
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
}

/**
 * Container information interface.
 */
interface IContainerInfo {
  status: string;
  count: number;
  details: Array<{
    name: string;
    status: string;
    health: string;
  }>;
}

/**
 * User statistics interface.
 */
interface IUserStats {
  total: number;
  active: number;
  admins: number;
}

/**
 * Tunnel status interface.
 */
interface ITunnelStatus {
  enabled: boolean;
  active: number;
}

/**
 * Audit log summary interface.
 */
interface IAuditLogSummary {
  entries: number;
  latest: Array<unknown>;
}

/**
 * Status check result interface.
 */
interface IStatusCheckResult {
  status: string;
  version: string;
  uptime: number;
  timestamp: string;
  resources?: IResourceInfo;
  containers?: IContainerInfo;
  users?: IUserStats;
  tunnels?: ITunnelStatus;
  auditLog?: IAuditLogSummary;
}

/**
 * Status check response interface.
 */
interface IStatusCheckResponse extends IToolResult {
  result: IStatusCheckResult;
}

/**
 * Status check tool definition.
 * Provides system health and operational status information.
 */
export const tool: IToolDefinition = {
  name: 'checkstatus',
  description: 'Check system operational status and health metrics',
  inputSchema: {
    type: 'object',
    description: 'Options for the status check',
    properties: {
      includeContainers: {
        type: 'boolean',
        description: 'Include container status information',
        default: false
      },
      includeUsers: {
        type: 'boolean',
        description: 'Include user statistics',
        default: false
      },
      includeResources: {
        type: 'boolean',
        description: 'Include system resource usage',
        default: false
      },
      includeTunnels: {
        type: 'boolean',
        description: 'Include tunnel status',
        default: false
      },
      includeAuditLog: {
        type: 'boolean',
        description: 'Include recent audit log entries',
        default: false
      }
    },
    additionalProperties: false
  },
  /**
   * Executes the status check and returns system information.
   * @param params - Input parameters for status check.
   * @param context - Execution context with user information.
   * @returns Promise resolving to status check response.
   */
  execute: async (params: unknown, context: unknown): Promise<IToolResult> => {
    const input = (params as IStatusCheckInput) ?? {};
    const {
      includeContainers = false,
      includeUsers = false,
      includeResources = false,
      includeTunnels = false,
      includeAuditLog = false
    } = input;

    const statusResult: IStatusCheckResult = {
      status: 'healthy',
      version: `${ONE}.${ZERO}.0`,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    const result: IStatusCheckResponse = {
      message: 'System operational',
      result: statusResult
    };

    if (includeResources) {
      const memUsage = process.memoryUsage();
      const resourceInfo: IResourceInfo = {
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          unit: 'MB'
        },
        uptime: {
          seconds: Math.floor(process.uptime()),
          formatted: formatUptime(process.uptime())
        }
      };
      result.result.resources = resourceInfo;
    }

    if (includeContainers) {
      const containerInfo: IContainerInfo = {
        status: 'running',
        count: ONE,
        details: [
          {
            name: 'systemprompt-os',
            status: 'running',
            health: 'healthy'
          }
        ]
      };
      result.result.containers = containerInfo;
    }

    if (includeUsers) {
      const ctx = context as IToolContext;
      const userStats: IUserStats = {
        total: ONE,
        active: ONE,
        admins: ctx.role === 'admin' ? ONE : ZERO
      };
      result.result.users = userStats;
    }

    if (includeTunnels) {
      const tunnelStatus: ITunnelStatus = {
        enabled: false,
        active: ZERO
      };
      result.result.tunnels = tunnelStatus;
    }

    if (includeAuditLog) {
      const auditLog: IAuditLogSummary = {
        entries: ZERO,
        latest: []
      };
      result.result.auditLog = auditLog;
    }

    return result;
  }
};

/**
 * Formats uptime seconds into a human-readable string.
 * @param seconds - Number of seconds to format.
 * @returns Formatted uptime string (e.g., "2d 3h 45m 12s").
 */
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor(seconds % SECONDS_PER_DAY / SECONDS_PER_HOUR);
  const minutes = Math.floor(seconds % SECONDS_PER_HOUR / SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % SECONDS_PER_MINUTE);

  const parts = [];
  if (days > ZERO) { parts.push(`${String(days)}d`); }
  if (hours > ZERO) { parts.push(`${String(hours)}h`); }
  if (minutes > ZERO) { parts.push(`${String(minutes)}m`); }
  if (secs > ZERO || parts.length === ZERO) { parts.push(`${String(secs)}s`); }

  return parts.join(' ');
};
