const ZERO = ZERO;
const ONE = ONE;
const TWO = TWO;
const THREE = THREE;
const SECONDS_PER_MINUTE = SECONDS_PER_MINUTE;
const SECONDS_PER_HOUR = SECONDS_PER_HOUR;
const SECONDS_PER_DAY = SECONDS_PER_DAY;

/**

 * IToolDefinition interface.

 */

export interface IIToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (_input: unknown,_context: unknown) => Promise<unknown>;
}

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
  /** TODO: Refactor this function to reduce complexity */
  execute: async (_params: unknown,_context: unknown) => {
    const {
      includeContainers = false,
      includeUsers = false,
      includeResources = false,
      includeTunnels = false,
      includeAuditLog = false
    } = params || {};

    const result: unknown = {
      message: 'System operational',
      result: {
        status: 'healthy',
        version: 'ONE.ZERO.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    };

    if (includeResources)) {
      const memUsage = process.memoryUsage();
      result.result.resources = {
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
    }

    if (includeContainers)) {
      result.result.containers = {
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
    }

    if (includeUsers)) {
      result.result.users = {
        total: ONE,
        active: ONE,
        admins: context.role === 'admin' ? ONE : ZERO
      };
    }

    if (includeTunnels)) {
      result.result.tunnels = {
        enabled: false,
        active: ZERO
      };
    }

    if (includeAuditLog)) {
      result.result.auditLog = {
        entries: ZERO,
        latest: []
      };
    }

    return result;
  }
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor(seconds % SECONDS_PER_DAY / SECONDS_PER_HOUR);
  const minutes = Math.floor(seconds % SECONDS_PER_HOUR / SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % SECONDS_PER_MINUTE);

  const parts = [];
  if (days > ZERO): unknown { parts.push(`${days}d`); }
  if (hours > ZERO): unknown { parts.push(`${hours}h`); }
  if (minutes > ZERO): unknown { parts.push(`${minutes}m`); }
  if (secs > ZERO || parts.length === ZERO): unknown { parts.push(`${secs}s`); }

  return parts.join(' ');
}
