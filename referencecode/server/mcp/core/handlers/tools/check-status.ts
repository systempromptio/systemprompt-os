/**
 * @fileoverview Check status tool handler for admin system overview
 * @module handlers/tools/check-status
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from './types.js';
import { formatToolResponse } from './types.js';
import type { Logger } from '@/modules/core/logger/index.js';
import { execSync } from 'node:child_process';
import * as os from 'os';
import { getDatabase } from '@/modules/core/database/index.js';

/**
 * Check status arguments
 */
interface CheckStatusArgs {
  includeContainers?: boolean;
  includeUsers?: boolean;
  includeResources?: boolean;
  includeTunnels?: boolean;
  includeAuditLog?: boolean;
}

/**
 * System status response
 */
interface SystemStatus {
  timestamp: string;
  uptime: number;
  platform: string;
  resources: {
    cpu: {
      model: string;
      cores: number;
      usage: number;
    };
    memory: {
      total: number;
      free: number;
      used: number;
      usagePercent: number;
    };
    disk: {
      total: number;
      free: number;
      used: number;
      usagePercent: number;
    };
  };
  services: {
    mcp: {
      status: string;
      version: string;
      activeSessions: number;
    };
    oauth: {
      status: string;
      tunnelActive: boolean;
      providers: string[];
    };
    docker?: {
      status: string;
      version: string;
      containers: number;
    };
  };
  containers?: Array<{
    id: string;
    name: string;
    userId: string;
    status: string;
    created: string;
    tunnelStatus: string;
  }>;
  users?: Array<{
    id: string;
    email: string;
    name: string;
    roles: string[];
    lastLogin: string;
    isActive: boolean;
    createdAt: string;
    activeContainers: number;
  }>;
  tunnels?: Array<{
    id: string;
    name: string;
    status: string;
    hostname: string;
    created: string;
  }>;
  auditLog?: Array<{
    timestamp: string;
    userId: string;
    action: string;
    resource: string;
    result: string;
  }>;
}

/**
 * Admin-only system status check handler
 */
export const handleCheckStatus: ToolHandler<CheckStatusArgs | undefined> = async (
  args: CheckStatusArgs | undefined,
  context?: ToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    logger.info('Admin checking system status', {
      sessionId: context?.sessionId,
      options: args,
    });

    // Get basic system info
    const status: SystemStatus = {
      timestamp: new Date().toISOString(),
      uptime: os.uptime(),
      platform: `${os.type()} ${os.release()}`,
      resources: await getResourceUsage(),
      services: await getServiceStatus(),
    };

    // Include optional information based on args
    if (args?.includeContainers) {
      status.containers = await getContainerStatus();
    }

    if (args?.includeUsers) {
      status.users = await getUserStatus();
    }

    if (args?.includeTunnels) {
      status.tunnels = await getTunnelStatus();
    }

    if (args?.includeAuditLog) {
      status.auditLog = await getRecentAuditLog();
    }

    logger.info('Admin status check completed', {
      sessionId: context?.sessionId,
      includesContainers: !!status.containers,
      includesUsers: !!status.users,
      includesTunnels: !!status.tunnels,
      includesAudit: !!status.auditLog,
    });

    return formatToolResponse({
      message: 'System status retrieved successfully',
      result: status,
    });
  } catch (error) {
    logger.error('Failed to check system status', { error, args });

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

/**
 * Get system resource usage
 */
async function getResourceUsage() {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  // Calculate CPU usage
  let totalIdle = 0;
  let totalTick = 0;
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });
  const cpuUsage = 100 - ~~((100 * totalIdle) / totalTick);

  // Get disk usage (simplified - you might want to use a library like 'diskusage')
  let diskInfo = { total: 0, free: 0, used: 0, usagePercent: 0 };
  try {
    const dfOutput = execSync('df -k / | tail -1', { encoding: 'utf-8' });
    const parts = dfOutput.trim().split(/\s+/);
    if (parts.length >= 4) {
      diskInfo = {
        total: (parseInt(parts[1] || '0') || 0) * 1024,
        used: (parseInt(parts[2] || '0') || 0) * 1024,
        free: (parseInt(parts[3] || '0') || 0) * 1024,
        usagePercent: parseInt(parts[4] || '0') || 0,
      };
    }
  } catch (_e) {
    logger.warn('Could not get disk usage', _e);
  }

  return {
    cpu: {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      usage: cpuUsage,
    },
    memory: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: Math.round((usedMemory / totalMemory) * 100),
    },
    disk: diskInfo,
  };
}

/**
 * Get service status
 */
async function getServiceStatus() {
  const services: any = {
    mcp: {
      status: 'active',
      version: process.env['npm_package_version'] || 'unknown',
      activeSessions: 0, // Would query from database
    },
    oauth: {
      status: 'active',
      tunnelActive: false,
      providers: [],
    },
  };

  // Check OAuth providers
  if (process.env['GOOGLE_CLIENT_ID']) {
    services.oauth.providers.push('google');
  }
  if (process.env['GITHUB_CLIENT_ID']) {
    services.oauth.providers.push('github');
  }
  if (process.env['MICROSOFT_CLIENT_ID']) {
    services.oauth.providers.push('microsoft');
  }

  // Check OAuth tunnel
  if (process.env['ENABLE_OAUTH_TUNNEL'] === 'true' || process.env['OAUTH_DOMAIN']) {
    services.oauth.tunnelActive = true;
  }

  // Check Docker
  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf-8' }).trim();
    const containerCount = execSync('docker ps -q | wc -l', { encoding: 'utf-8' }).trim();
    services.docker = {
      status: 'active',
      version: dockerVersion,
      containers: parseInt(containerCount) || 0,
    };
  } catch {
    services.docker = {
      status: 'unavailable',
      version: 'n/a',
      containers: 0,
    };
  }

  return services;
}

/**
 * Mock functions for additional status - would be implemented with real database queries
 */
async function getContainerStatus() {
  // In real implementation, query database for container info
  return [
    {
      id: 'container-123',
      name: 'user-john-dev',
      userId: 'user-123',
      status: 'running',
      created: new Date().toISOString(),
      tunnelStatus: 'active',
    },
  ];
}

async function getUserStatus() {
  try {
    const db = getDatabase();

    // Query all users from the database
    const users = await db.query<any>(`
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
    `);

    interface UserStatusRow {
      id: string;
      email: string;
      name?: string;
      roles?: string;
      last_login_at?: string;
      is_active: number;
      created_at: string;
    }

    // Format the user data
    return users.map((user: UserStatusRow) => ({
      id: user.id,
      email: user.email,
      name: user.name || 'N/A',
      roles: user.roles ? user.roles.split(',') : [],
      lastLogin: user.last_login_at || 'Never',
      isActive: Boolean(user.is_active),
      createdAt: user.created_at,
      activeContainers: 0, // TODO: Implement container counting when container module is added
    }));
  } catch (error) {
    logger.error('Failed to get user status from database', { error });
    return [];
  }
}

async function getTunnelStatus() {
  // In real implementation, query Cloudflare API
  return [
    {
      id: 'tunnel-123',
      name: 'user-john-dev',
      status: 'healthy',
      hostname: 'john-dev.containers.example.com',
      created: new Date().toISOString(),
    },
  ];
}

async function getRecentAuditLog() {
  // In real implementation, query audit log table
  return [
    {
      timestamp: new Date().toISOString(),
      userId: 'user-123',
      action: 'container.create',
      resource: 'container-123',
      result: 'success',
    },
  ];
}
