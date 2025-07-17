/**
 * @fileoverview SystemPrompt OS Status Endpoint
 * @module server/external/rest/status
 * 
 * @remarks
 * Provides comprehensive system status including:
 * - MCP server statuses and capabilities
 * - Module health and configuration
 * - System state and resource usage
 * - Recent logs and error tracking
 * 
 * The endpoint aggregates data from multiple sources to provide
 * a unified view of system health.
 */

import type { Request, Response } from 'express';
import { getMCPServerRegistry } from '../../mcp/registry.js';
import { getModuleLoader } from '../../../core/modules/loader.js';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../../config.js';

/**
 * System operational status levels
 */
export enum SystemStatus {
  /** All systems functioning normally */
  OPERATIONAL = 'operational',
  /** Some systems experiencing issues */
  DEGRADED = 'degraded',
  /** Critical system failure */
  ERROR = 'error'
}

/**
 * MCP server status information
 */
export interface ServerStatusInfo {
  /** Display name of the server */
  name: string;
  /** Current operational status */
  status: 'running' | 'stopped' | 'error';
  /** Server version string */
  version: string;
  /** Transport protocol used */
  transport: string;
  /** Number of available tools */
  tools: number;
  /** Number of active sessions */
  sessions: number;
}

/**
 * Provider configuration status
 */
export interface ProviderStatus {
  /** Memory provider implementation */
  memory?: string;
  /** Action provider implementation */
  action?: string;
  /** Authentication provider */
  auth?: string;
  /** Storage provider implementation */
  storage?: string;
}

/**
 * Module status information
 */
export interface ModuleStatusInfo {
  /** Module operational status */
  status: string;
  /** Module type (daemon, service, plugin) */
  type?: string;
  /** Module version */
  version?: string;
  /** Additional module-specific data */
  [key: string]: any;
}

/**
 * System logs summary
 */
export interface LogsSummary {
  /** Recent log entries */
  recent: string[];
  /** Recent error entries */
  errors: string[];
}

/**
 * System state information
 */
export interface SystemState {
  /** State directory path */
  directory: string;
  /** Storage size breakdown */
  size: {
    /** Size of log files in bytes */
    logs: number;
    /** Size of data files in bytes */
    data: number;
    /** Total size in bytes */
    total: number;
  };
  /** File counts by category */
  files: {
    /** Number of sessions */
    sessions: number;
    /** Number of log files */
    logs: number;
  };
}

/**
 * Complete system status response
 */
export interface StatusResponse {
  /** Overall system status */
  status: SystemStatus;
  /** ISO timestamp of status check */
  timestamp: string;
  /** MCP server statuses by ID */
  servers: Record<string, ServerStatusInfo>;
  /** Provider configuration */
  providers: ProviderStatus;
  /** Module statuses by name */
  modules?: Record<string, ModuleStatusInfo>;
  /** System logs summary */
  logs?: LogsSummary;
  /** System state information */
  state?: SystemState;
}

/**
 * Status endpoint handler factory
 * 
 * @returns Express request handler for the status endpoint
 * 
 * @example
 * ```typescript
 * app.get('/status', createStatusHandler());
 * ```
 */
export function createStatusHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const status = await generateSystemStatus();
      res.json(status);
    } catch (error) {
      console.error('Failed to generate system status:', error);
      res.status(500).json({
        status: SystemStatus.ERROR,
        timestamp: new Date().toISOString(),
        error: 'Failed to generate system status'
      });
    }
  };
}

/**
 * Generate comprehensive system status
 * 
 * @returns Complete system status information
 */
async function generateSystemStatus(): Promise<StatusResponse> {
  const status: StatusResponse = {
    status: SystemStatus.OPERATIONAL,
    timestamp: new Date().toISOString(),
    servers: {},
    providers: await getProviderStatus()
  };

  // Add module statuses if loader is available
  try {
    const moduleLoader = getModuleLoader();
    if (moduleLoader) {
      status.modules = await getModuleStatuses(moduleLoader);
    }
  } catch (error) {
    console.warn('Module loader not available:', error);
  }

  // Add logs summary if configured
  if (CONFIG.INCLUDE_LOGS_IN_STATUS) {
    status.logs = await getLogsSummary();
  }

  // Add state information
  status.state = await getSystemState();

  // Get MCP server statuses
  const serverStatuses = await getMCPServerStatuses();
  
  // Process server statuses and determine overall health
  for (const [id, serverStatus] of serverStatuses) {
    const mappedStatus = mapServerStatus(serverStatus.status);
    
    status.servers[id] = {
      name: serverStatus.name,
      status: mappedStatus,
      version: serverStatus.version,
      transport: serverStatus.transport,
      tools: serverStatus.tools || 0,
      sessions: serverStatus.sessions || 0,
    };
    
    // Update overall status based on server health
    status.status = calculateOverallStatus(status.status, serverStatus.status);
  }
  
  // Check module health
  if (status.modules) {
    status.status = calculateModuleImpact(status.status, status.modules);
  }
  
  return status;
}

/**
 * Get provider configuration status
 * 
 * @returns Current provider configuration
 */
async function getProviderStatus(): Promise<ProviderStatus> {
  return {
    memory: process.env.MEMORY_PROVIDER || 'not-configured',
    action: process.env.ACTION_PROVIDER || 'not-configured',
    auth: process.env.AUTH_PROVIDER || 'not-configured',
    storage: process.env.STORAGE_PROVIDER || 'not-configured'
  };
}

/**
 * Get module statuses from the module loader
 * 
 * @param moduleLoader - Module loader instance
 * @returns Module status information
 */
async function getModuleStatuses(moduleLoader: any): Promise<Record<string, ModuleStatusInfo>> {
  const modules: Record<string, ModuleStatusInfo> = {};
  
  try {
    const allModules = moduleLoader.getAllModules();
    
    for (const [name, module] of allModules) {
      modules[name] = {
        status: module.status || 'unknown',
        type: module.type,
        version: module.version,
        ...module.getStatus?.()
      };
    }
  } catch (error) {
    console.warn('Failed to get module statuses:', error);
  }
  
  return modules;
}

/**
 * Get summary of recent logs
 * 
 * @returns Recent log entries and errors
 */
async function getLogsSummary(): Promise<LogsSummary> {
  const logsDir = join(CONFIG.STATE_DIR || './state', 'logs');
  const summary: LogsSummary = {
    recent: [],
    errors: []
  };
  
  if (!existsSync(logsDir)) {
    return summary;
  }
  
  try {
    // Read system log for recent entries
    const systemLogPath = join(logsDir, 'system.log');
    if (existsSync(systemLogPath)) {
      const content = readFileSync(systemLogPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      summary.recent = lines.slice(-10);
    }
    
    // Read error log
    const errorLogPath = join(logsDir, 'error.log');
    if (existsSync(errorLogPath)) {
      const content = readFileSync(errorLogPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      summary.errors = lines.slice(-5);
    }
  } catch (error) {
    console.warn('Failed to read logs:', error);
  }
  
  return summary;
}

/**
 * Get system state information
 * 
 * @returns State directory information and metrics
 */
async function getSystemState(): Promise<SystemState> {
  const stateDir = CONFIG.STATE_DIR || './state';
  const state: SystemState = {
    directory: stateDir,
    size: {
      logs: 0,
      data: 0,
      total: 0
    },
    files: {
      sessions: 0,
      logs: 0
    }
  };
  
  if (!existsSync(stateDir)) {
    return state;
  }
  
  try {
    // Calculate logs size
    const logsDir = join(stateDir, 'logs');
    if (existsSync(logsDir)) {
      const logFiles = readdirSync(logsDir);
      state.files.logs = logFiles.length;
      state.size.logs = calculateDirectorySize(logsDir);
    }
    
    // Calculate data size
    const dataDir = join(stateDir, 'data');
    if (existsSync(dataDir)) {
      state.size.data = calculateDirectorySize(dataDir);
      
      // Count sessions
      const sessionsDir = join(dataDir, 'sessions');
      if (existsSync(sessionsDir)) {
        state.files.sessions = readdirSync(sessionsDir).length;
      }
    }
    
    state.size.total = state.size.logs + state.size.data;
  } catch (error) {
    console.warn('Failed to calculate state metrics:', error);
  }
  
  return state;
}

/**
 * Calculate total size of a directory
 * 
 * @param dirPath - Directory path to measure
 * @returns Total size in bytes
 */
function calculateDirectorySize(dirPath: string): number {
  let totalSize = 0;
  
  try {
    const files = readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = join(dirPath, file);
      const stats = statSync(filePath);
      
      if (stats.isFile()) {
        totalSize += stats.size;
      } else if (stats.isDirectory()) {
        totalSize += calculateDirectorySize(filePath);
      }
    }
  } catch (error) {
    console.warn(`Failed to calculate size for ${dirPath}:`, error);
  }
  
  return totalSize;
}

/**
 * Get MCP server statuses from the registry
 * 
 * @returns Map of server statuses
 */
async function getMCPServerStatuses() {
  try {
    const registry = getMCPServerRegistry();
    return await registry.getServerStatuses();
  } catch (error) {
    console.error('Failed to get MCP server statuses:', error);
    return new Map();
  }
}

/**
 * Map extended server status to simplified status
 * 
 * @param status - Extended server status
 * @returns Simplified status for API response
 */
function mapServerStatus(status: string): 'running' | 'stopped' | 'error' {
  switch (status) {
    case 'error':
      return 'error';
    case 'stopped':
    case 'unreachable':
      return 'stopped';
    default:
      return 'running';
  }
}

/**
 * Calculate overall system status based on server status
 * 
 * @param currentStatus - Current overall status
 * @param serverStatus - Individual server status
 * @returns Updated overall status
 */
function calculateOverallStatus(
  currentStatus: SystemStatus,
  serverStatus: string
): SystemStatus {
  if (serverStatus === 'error') {
    return SystemStatus.ERROR;
  }
  
  if ((serverStatus === 'stopped' || serverStatus === 'unreachable') && 
      currentStatus !== SystemStatus.ERROR) {
    return SystemStatus.DEGRADED;
  }
  
  return currentStatus;
}

/**
 * Calculate module impact on overall system status
 * 
 * @param currentStatus - Current overall status
 * @param modules - Module status information
 * @returns Updated overall status
 */
function calculateModuleImpact(
  currentStatus: SystemStatus,
  modules: Record<string, ModuleStatusInfo>
): SystemStatus {
  for (const moduleStatus of Object.values(modules)) {
    if (moduleStatus.status === 'error' || moduleStatus.status === 'unhealthy') {
      return SystemStatus.ERROR;
    }
    
    if (moduleStatus.status === 'degraded' && currentStatus === SystemStatus.OPERATIONAL) {
      return SystemStatus.DEGRADED;
    }
  }
  
  return currentStatus;
}