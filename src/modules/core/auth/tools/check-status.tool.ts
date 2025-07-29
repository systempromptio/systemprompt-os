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
import type {
  IAuditLogSummary,
  IContainerInfo,
  IResourceInfo,
  IStatusCheckInput,
  IStatusCheckResponse,
  IStatusCheckResult,
  ITunnelStatus,
  IUserStats
} from '@/modules/core/auth/types';

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

  const parts: string[] = [];
  if (days > ZERO) { parts.push(`${String(days)}d`); }
  if (hours > ZERO) { parts.push(`${String(hours)}h`); }
  if (minutes > ZERO) { parts.push(`${String(minutes)}m`); }
  if (secs > ZERO || parts.length === ZERO) { parts.push(`${String(secs)}s`); }

  return parts.join(' ');
};

/**
 * Creates resource information object.
 * @returns Resource information with memory and uptime data.
 */
const createResourceInfo = (): IResourceInfo => {
  const memUsage = process.memoryUsage();
  const uptimeSeconds = process.uptime();

  return {
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    uptime: {
      seconds: Math.floor(uptimeSeconds),
      formatted: formatUptime(uptimeSeconds)
    }
  };
};

/**
 * Creates container information object.
 * @returns Container status and details.
 */
const createContainerInfo = (): IContainerInfo => { return {
  status: 'running',
  count: ONE,
  details: [
    {
      name: 'systemprompt-os',
      status: 'running',
      health: 'healthy'
    }
  ]
} };

/**
 * Creates user statistics object.
 * @param context - Tool execution context.
 * @returns User statistics including admin count.
 */
const createUserStats = (context: IToolContext): IUserStats => { return {
  total: ONE,
  active: ONE,
  admins: context.role === 'admin' ? ONE : ZERO
} };

/**
 * Creates tunnel status object.
 * @returns Tunnel status information.
 */
const createTunnelStatus = (): ITunnelStatus => { return {
  active: false,
  type: 'none'
} };

/**
 * Creates audit log summary object.
 * @returns Audit log summary with entry count and recent entries.
 */
const createAuditLogSummary = (): IAuditLogSummary => { return {
  entries: ZERO,
  latest: []
} };

/**
 * Type guard to check if value is a valid input object.
 * @param value - Value to check.
 * @returns True if value is a valid input object.
 */
const isValidInputObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && value !== undefined && typeof value === 'object';
};

/**
 * Validates and parses input parameters.
 * @param params - Raw input parameters.
 * @returns Validated input parameters with defaults.
 */
const parseInput = (params: unknown): IStatusCheckInput => {
  if (!isValidInputObject(params)) {
    return {};
  }

  return {
    includeContainers: typeof params.includeContainers === 'boolean'
      ? params.includeContainers : false,
    includeUsers: typeof params.includeUsers === 'boolean'
      ? params.includeUsers : false,
    includeResources: typeof params.includeResources === 'boolean'
      ? params.includeResources : false,
    includeTunnels: typeof params.includeTunnels === 'boolean'
      ? params.includeTunnels : false,
    includeAuditLog: typeof params.includeAuditLog === 'boolean'
      ? params.includeAuditLog : false
  };
};

/**
 * Type guard to check if value is a valid context object.
 * @param value - Value to check.
 * @returns True if value is a valid context object.
 */
const isValidContextObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && value !== undefined && typeof value === 'object';
};

/**
 * Validates and parses context parameters.
 * @param context - Raw context object.
 * @returns Validated context with defaults.
 */
const parseContext = (context: unknown): IToolContext => {
  if (!isValidContextObject(context)) {
    return {};
  }

  const result: IToolContext = {};

  if (typeof context.userId === 'string') {
    result.userId = context.userId;
  }
  if (typeof context.userEmail === 'string') {
    result.userEmail = context.userEmail;
  }
  if (typeof context.role === 'string') {
    result.role = context.role;
  }
  if (typeof context.sessionId === 'string') {
    result.sessionId = context.sessionId;
  }
  if (typeof context.isLocal === 'boolean') {
    result.isLocal = context.isLocal;
  }
  if (Array.isArray(context.permissions)) {
    const filteredPermissions = context.permissions.filter((permission): permission is string => {
      return typeof permission === 'string';
    });
    if (filteredPermissions.length > 0) {
      result.permissions = filteredPermissions;
    }
  }

  return result;
};

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
   * @returns Status check response.
   */
  execute: async (params: unknown, context: IToolContext): Promise<IToolResult> => {
    const input = parseInput(params);
    const ctx = parseContext(context);

    const statusResult: IStatusCheckResult = {
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    const result: IStatusCheckResponse = {
      message: 'System operational',
      result: statusResult
    };

    if (input.includeResources === true) {
      result.result.resources = createResourceInfo();
    }

    if (input.includeContainers === true) {
      result.result.containers = createContainerInfo();
    }

    if (input.includeUsers === true) {
      result.result.users = createUserStats(ctx);
    }

    if (input.includeTunnels === true) {
      result.result.tunnels = createTunnelStatus();
    }

    if (input.includeAuditLog === true) {
      result.result.auditLog = createAuditLogSummary();
    }

    return await Promise.resolve(result);
  }
};
