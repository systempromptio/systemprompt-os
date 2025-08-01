/**
 * Health check endpoints for monitoring system and module status.
 * @module server/health
 */

import type {
 Express, Request, Response
} from 'express';
// Note: Using dynamic requires to avoid circular dependencies and module resolution issues

// Dynamic imports for modules to avoid circular dependencies
const getModuleRegistry = (): any => {
  try {
    const { getModuleRegistry } = require('../../modules/core/modules/index');
    return getModuleRegistry();
  } catch (error) {
    console.warn('Module registry not available:', error);
    return {
      getAll: () => new Map(),
      get: () => undefined
    };
  }
};

const getLoggerService = (): any => {
  try {
    const { LoggerService } = require('../../modules/core/logger/services/logger.service');
    return LoggerService.getInstance();
  } catch (error) {
    return {
      info: () => {},
      warn: () => {},
      error: () => {}
    };
  }
};

const getLogSource = (): any => {
  try {
    const { LogSource } = require('../../modules/core/logger/types/manual');
    return LogSource;
  } catch (error) {
    return { SERVER: 'server' };
  }
};

const getModulesStatus = (): any => {
  try {
    const { ModulesStatus } = require('../../modules/core/modules/types/manual');
    return ModulesStatus;
  } catch (error) {
    return { RUNNING: 'running' };
  }
};

const logger = getLoggerService();
const LogSource = getLogSource();
const ModulesStatus = getModulesStatus();

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  modules?: Record<string, ModuleHealthStatus>;
  system?: SystemHealthStatus;
}

interface ModuleHealthStatus {
  status: string;
  healthy: boolean;
  message?: string;
}

interface SystemHealthStatus {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  platform: string;
  nodeVersion: string;
}

/**
 * Get system health information.
 * @returns System health status.
 */
function getSystemHealth(): SystemHealthStatus {
  const memUsage = process.memoryUsage();
  const totalMem = memUsage.heapTotal + memUsage.external;
  const usedMem = memUsage.heapUsed + memUsage.external;

  return {
    uptime: process.uptime(),
    memory: {
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percentage: Math.round(usedMem / totalMem * 100)
    },
    platform: process.platform,
    nodeVersion: process.version
  };
}

/**
 * Check health of all modules.
 * @returns Module health statuses.
 */
async function checkModuleHealth(): Promise<Record<string, ModuleHealthStatus>> {
  const registry = getModuleRegistry();
  const modules = registry.getAll();
  const healthStatuses: Record<string, ModuleHealthStatus> = {};

  for (const [name, module] of modules) {
    try {
      if (module.health && typeof module.health === 'function') {
        const health = await module.health();
        healthStatuses[name] = {
          status: module.status,
          healthy: health.status === 'healthy',
          message: health.message ?? undefined
        };
      } else {
        healthStatuses[name] = {
          status: module.status,
          healthy: module.status === 'running',
          message: `Module status: ${module.status}`
        };
      }
    } catch (error) {
      logger.warn(LogSource.SERVER, `Health check failed for module ${name}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      healthStatuses[name] = {
        status: module.status,
        healthy: false,
        message: `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  return healthStatuses;
}

/**
 * Handle basic health check request.
 * @param _req - Express request object.
 * @param res - Express response object.
 */
async function handleBasicHealth(_req: Request, res: Response): Promise<void> {
  try {
    const packageJson = require('@/../package.json');

    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: packageJson.version || '0.1.0'
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error(LogSource.SERVER, 'Basic health check failed', {
      error: error instanceof Error ? error : new Error(String(error))
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: 'unknown',
      error: 'Health check failed'
    });
  }
}

/**
 * Handle detailed health check request.
 * @param _req - Express request object.
 * @param res - Express response object.
 */
async function handleDetailedHealth(_req: Request, res: Response): Promise<void> {
  try {
    const packageJson = require('@/../package.json');
    const moduleHealth = await checkModuleHealth();
    const systemHealth = getSystemHealth();

    const unhealthyModules = Object.values(moduleHealth).filter(m => { return !m.healthy });
    const criticalModules = ['logger', 'database', 'auth'];
    const criticalUnhealthy = unhealthyModules.some(m =>
      { return criticalModules.includes(Object.keys(moduleHealth).find(k => { return moduleHealth[k] === m }) || '') });

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (criticalUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (unhealthyModules.length > 0) {
      overallStatus = 'degraded';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: packageJson.version || '0.1.0',
      modules: moduleHealth,
      system: systemHealth
    };

    const statusCode = overallStatus === 'healthy' ? 200
                      : overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error(LogSource.SERVER, 'Detailed health check failed', {
      error: error instanceof Error ? error : new Error(String(error))
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: 'unknown',
      error: 'Health check failed'
    });
  }
}

/**
 * Handle module-specific health check request.
 * @param req - Express request object.
 * @param res - Express response object.
 */
async function handleModuleHealth(req: Request, res: Response): Promise<void> {
  const { moduleName } = req.params;

  if (!moduleName) {
    res.status(400).json({
      error: 'Module name is required',
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const registry = getModuleRegistry();
    const module = registry.get(moduleName);

    if (!module) {
      res.status(404).json({
        error: 'Module not found',
        module: moduleName
      });
      return;
    }

    let health: { healthy: boolean; message?: string };

    if (module.health && typeof module.health === 'function') {
      const healthResult = await module.health();
      health = {
        healthy: healthResult.status === 'healthy',
        message: healthResult.message ?? undefined
      };
    } else {
      health = {
        healthy: module.status === 'running',
        message: `Module status: ${module.status}`
      };
    }

    res.status(health.healthy ? 200 : 503).json({
      module: moduleName,
      status: module.status,
      healthy: health.healthy,
      message: health.message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(LogSource.SERVER, `Module health check failed for ${moduleName}`, {
      error: error instanceof Error ? error : new Error(String(error))
    });

    res.status(503).json({
      module: moduleName,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Set up health check endpoints on the Express app.
 * @param app - Express application instance.
 */
export function setupHealthEndpoints(app: Express): void {
  logger.info(LogSource.SERVER, 'Setting up health endpoints');

  app.get('/health', handleBasicHealth);

  app.get('/health/detailed', handleDetailedHealth);

  app.get('/health/modules/:moduleName', handleModuleHealth);

  logger.info(LogSource.SERVER, 'Health endpoints configured');
}
