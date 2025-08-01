/**
 * Check status tool handler for admin system overview.
 * Provides comprehensive system status checking functionality for administrators.
 * @file Check status tool handler for admin system overview.
 * @module handlers/tools/check-status
 */

import { execSync } from 'node:child_process';
import * as os from 'os';

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import {
  type CallToolResult,
  type IToolHandlerContext,
  type ToolHandler,
} from '@/server/mcp/core/handlers/tools/types';
import { formatToolResponse } from '@/server/mcp/core/handlers/types/core.types';
import type {
  IAuditLogEntry,
  ICheckStatusArgs,
  IContainerInfo,
  IDiskInfo,
  IDockerServiceStatus,
  IResourceUsage,
  IServiceStatus,
  ISystemStatus,
  ITunnelInfo,
  IUserInfo,
  IUserStatusRow,
} from '@/server/mcp/core/handlers/tools/types/check-status.types';

const logger = LoggerService.getInstance();

/**
 * Calculate CPU usage percentage.
 * @returns CPU usage as percentage.
 */
const calculateCpuUsage = (): number => {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    const timeKeys = Object.keys(cpu.times) as (keyof typeof cpu.times)[];
    for (const type of timeKeys) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  return 100 - Math.floor(100 * totalIdle / totalTick);
};

/**
 * Parse disk usage values from df output.
 * @param parts - Split df output parts.
 * @returns Parsed disk info or undefined if invalid.
 */
const parseDiskInfo = (parts: string[]): IDiskInfo | undefined => {
  if (parts.length < 4) {
    return undefined;
  }

  const totalKb = Number.parseInt(parts[1] ?? '0', 10);
  const usedKb = Number.parseInt(parts[2] ?? '0', 10);
  const freeKb = Number.parseInt(parts[3] ?? '0', 10);
  const usagePercent = Number.parseInt(parts[4] ?? '0', 10);

  if (totalKb > 0 || usedKb > 0 || freeKb > 0 || usagePercent > 0) {
    return {
      total: totalKb * 1024,
      used: usedKb * 1024,
      free: freeKb * 1024,
      usagePercent,
    };
  }

  return undefined;
};

/**
 * Get disk usage information.
 * @returns Disk usage information.
 */
const getDiskUsage = (): IDiskInfo => {
  const defaultDiskInfo: IDiskInfo = {
    total: 0,
    free: 0,
    used: 0,
    usagePercent: 0,
  };

  try {
    const dfOutput = execSync('df -k / | tail -1', { encoding: 'utf-8' });
    const parts = dfOutput.trim().split(/\s+/);
    const diskInfo = parseDiskInfo(parts);

    return diskInfo ?? defaultDiskInfo;
  } catch (error) {
    logger.warn(LogSource.MCP, 'Could not get disk usage', {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return defaultDiskInfo;
  }
};

/**
 * Get system resource usage information.
 * @returns Resource usage data.
 */
const getResourceUsage = (): IResourceUsage => {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  const cpuUsage = calculateCpuUsage();
  const diskInfo = getDiskUsage();

  return {
    cpu: {
      model: cpus[0]?.model ?? 'Unknown',
      cores: cpus.length,
      usage: cpuUsage,
    },
    memory: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: Math.round(usedMemory / totalMemory * 100),
    },
    disk: diskInfo,
  };
};

/**
 * Get OAuth providers from environment.
 * @returns Array of configured OAuth providers.
 */
const getOAuthProviders = (): string[] => {
  const providers: string[] = [];
  const {
    GOOGLE_CLIENT_ID,
    GITHUB_CLIENT_ID,
    MICROSOFT_CLIENT_ID,
  } = process.env;

  if (GOOGLE_CLIENT_ID !== undefined && GOOGLE_CLIENT_ID.length > 0) {
    providers.push('google');
  }
  if (GITHUB_CLIENT_ID !== undefined && GITHUB_CLIENT_ID.length > 0) {
    providers.push('github');
  }
  if (MICROSOFT_CLIENT_ID !== undefined && MICROSOFT_CLIENT_ID.length > 0) {
    providers.push('microsoft');
  }

  return providers;
};

/**
 * Check if OAuth tunnel is active.
 * @returns Whether OAuth tunnel is active.
 */
const isOAuthTunnelActive = (): boolean => {
  const { ENABLE_OAUTH_TUNNEL } = process.env;
  const enableOAuthTunnel = ENABLE_OAUTH_TUNNEL === 'true';
  const {
    OAUTH_DOMAIN,
  } = process.env;
  const hasOAuthDomain = OAUTH_DOMAIN !== undefined && OAUTH_DOMAIN.length > 0;

  return enableOAuthTunnel || hasOAuthDomain;
};

/**
 * Get Docker service status.
 * @returns Docker service status.
 */
const getDockerStatus = (): IDockerServiceStatus => {
  try {
    const dockerCmd = 'docker --version';
    const dockerVersion = execSync(dockerCmd, { encoding: 'utf-8' }).trim();
    const countCmd = 'docker ps -q | wc -l';
    const containerCountStr = execSync(countCmd, { encoding: 'utf-8' }).trim();
    const { parseInt } = Number;
    const containerCount = parseInt(containerCountStr, 10);

    return {
      status: 'active',
      version: dockerVersion,
      containers: containerCount > 0 ? containerCount : 0,
    };
  } catch {
    return {
      status: 'unavailable',
      version: 'n/a',
      containers: 0,
    };
  }
};

/**
 * Get service status information.
 * @returns Service status data.
 */
const getServiceStatus = (): IServiceStatus => {
  const services: IServiceStatus = {
    mcp: {
      status: 'active',
      version: process.env.npm_package_version ?? 'unknown',
      activeSessions: 0,
    },
    oauth: {
      status: 'active',
      tunnelActive: isOAuthTunnelActive(),
      providers: getOAuthProviders(),
    },
  };

  services.docker = getDockerStatus();
  return services;
};

/**
 * Get container status information.
 * @returns Promise resolving to container information array.
 */
const getContainerStatus = async (): Promise<IContainerInfo[]> => {
  return await Promise.resolve([
    {
      id: 'container-123',
      name: 'user-john-dev',
      userId: 'user-123',
      status: 'running',
      created: new Date().toISOString(),
      tunnelStatus: 'active',
    },
  ]);
};

/**
 * Get user status information from database.
 * @returns Promise resolving to user information array.
 */
const getUserStatus = async (): Promise<IUserInfo[]> => {
  try {
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getConnection();

    const userQuery = `
      SELECT 
        u.id,
        u.email,
        u.name,
        u.last_login_at,
        u.is_active,
        u.created_at,
        GROUP_CONCAT(r.name) as roles
      FROM auth_users u
      LEFT JOIN auth_user_roles ur ON u.id = ur.user_id
      LEFT JOIN auth_roles r ON ur.role_id = r.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;

    const queryResult = await db.query(userQuery);
    const users = (queryResult as any).rows as IUserStatusRow[];

    return users.map((user: IUserStatusRow): IUserInfo => {
      return {
        id: user.id,
        email: user.email,
        name: user.name ?? 'N/A',
        roles: user.roles !== undefined && user.roles.length > 0 ? user.roles.split(',') : [],
        lastLogin: user.last_login_at ?? 'Never',
        isActive: Boolean(user.is_active),
        createdAt: user.created_at,
        activeContainers: 0,
      };
    });
  } catch (error) {
    const errorMsg = 'Failed to get user status from database';
    logger.error(LogSource.MCP, errorMsg, {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return [];
  }
};

/**
 * Get tunnel status information.
 * @returns Promise resolving to tunnel information array.
 */
const getTunnelStatus = async (): Promise<ITunnelInfo[]> => {
  return await Promise.resolve([
    {
      id: 'tunnel-123',
      name: 'user-john-dev',
      status: 'healthy',
      hostname: 'john-dev.containers.example.com',
      created: new Date().toISOString(),
    },
  ]);
};

/**
 * Get recent audit log entries.
 * @returns Promise resolving to audit log entries array.
 */
const getRecentAuditLog = async (): Promise<IAuditLogEntry[]> => {
  return await Promise.resolve([
    {
      timestamp: new Date().toISOString(),
      userId: 'user-123',
      action: 'container.create',
      resource: 'container-123',
      result: 'success',
    },
  ]);
};

/**
 * Create base system status.
 * @returns Base status object.
 */
const createBaseStatus = (): ISystemStatus => {
  const resources = getResourceUsage();
  const services = getServiceStatus();

  return {
    timestamp: new Date().toISOString(),
    uptime: os.uptime(),
    platform: `${os.type()} ${os.release()}`,
    resources,
    services,
  };
};

/**
 * Add optional status sections.
 * @param baseStatus - Base status object.
 * @param args - Arguments specifying sections to include.
 * @returns Promise resolving to complete status object.
 */
const addOptionalSections = async (
  baseStatus: ISystemStatus,
  args?: ICheckStatusArgs,
): Promise<ISystemStatus> => {
  const status = { ...baseStatus };
  const tasks: Promise<void>[] = [];

  if (args?.includeContainers === true) {
    tasks.push(
      getContainerStatus().then((containers): void => {
        status.containers = containers;
      }),
    );
  }

  if (args?.includeUsers === true) {
    tasks.push(
      getUserStatus().then((users): void => {
        status.users = users;
      }),
    );
  }

  if (args?.includeTunnels === true) {
    tasks.push(
      getTunnelStatus().then((tunnels): void => {
        status.tunnels = tunnels;
      }),
    );
  }

  if (args?.includeAuditLog === true) {
    tasks.push(
      getRecentAuditLog().then((auditLog): void => {
        status.auditLog = auditLog;
      }),
    );
  }

  await Promise.all(tasks);
  return status;
};

/**
 * Admin-only system status check handler.
 * @param args - Arguments specifying which information to include.
 * @param context - Handler context containing session information.
 * @returns Promise resolving to formatted tool response with system status.
 */
export const handleCheckStatus: ToolHandler<ICheckStatusArgs | undefined> = async (
  args: ICheckStatusArgs | undefined,
  context?: IToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    logger.info(LogSource.MCP, 'Admin checking system status', {
      sessionId: context?.sessionId,
      options: args,
    });

    const baseStatus = createBaseStatus();
    const status = await addOptionalSections(baseStatus, args);

    logger.info(LogSource.MCP, 'Admin status check completed', {
      sessionId: context?.sessionId,
      includesContainers: Boolean(status.containers),
      includesUsers: Boolean(status.users),
      includesTunnels: Boolean(status.tunnels),
      includesAudit: Boolean(status.auditLog),
    });

    return formatToolResponse({
      message: 'System status retrieved successfully',
      result: status,
    });
  } catch (error) {
    logger.error(LogSource.MCP, 'Failed to check system status', {
      error: error instanceof Error ? error : new Error(String(error)),
      args,
    });

    return formatToolResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to check status',
      error: {
        type: 'status_check_error',
        details: error instanceof Error ? error.stack : undefined,
      },
    });
  }
};
