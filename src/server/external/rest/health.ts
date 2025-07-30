/**
 * Health check endpoint.
 * @file Health check endpoint.
 * @module server/external/rest/health
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import * as os from 'os';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '@/server/config';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

const logger = LoggerService.getInstance();

import type { IHealthResponse, IHeartbeatStatus } from '@/server/external/rest/types/health.types';

/**
 * Health endpoint handler class.
 */
export class HealthEndpoint {
  /**
   * Read heartbeat data from file.
   * @returns Heartbeat status or null if not available.
   */
  private readHeartbeat(): IHeartbeatStatus | null {
    try {
      const heartbeatPath = join(CONFIG.STATEDIR, 'data', 'heartbeat.json');
      if (!existsSync(heartbeatPath)) {
        return null;
      }

      const content = readFileSync(heartbeatPath, 'utf-8');
      const data: unknown = JSON.parse(content);

      if (this.isHeartbeatStatus(data)) {
        return data;
      }

      logger.error(LogSource.SERVER, 'Invalid heartbeat data structure', {
        category: 'health',
        persistToDb: false
      });
      return null;
    } catch (error) {
      logger.error(LogSource.SERVER, 'Failed to read heartbeat data', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'health',
        persistToDb: false
      });
      return null;
    }
  }

  /**
   * Type guard to validate heartbeat status structure.
   * @param data - Unknown data to validate.
   * @returns True if data is a valid IHeartbeatStatus.
   */
  private isHeartbeatStatus(data: unknown): data is IHeartbeatStatus {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    if (
      typeof obj.pid !== 'number'
      || typeof obj.timestamp !== 'string'
      || typeof obj.uptime !== 'number'
      || obj.status !== 'healthy' && obj.status !== 'unhealthy'
      || typeof obj.memory !== 'object'
      || obj.memory === null
    ) {
      return false;
    }

    const memory = obj.memory as Record<string, unknown>;
    return (
      typeof memory.used === 'number'
      && typeof memory.total === 'number'
    );
  }

  /**
   * Check if heartbeat is stale (older than 2 minutes).
   * @param heartbeat - The heartbeat status to check.
   * @returns True if heartbeat is stale.
   */
  private isHeartbeatStale(heartbeat: IHeartbeatStatus): boolean {
    const heartbeatTime = new Date(heartbeat.timestamp).getTime();
    const now = Date.now();
    const staleThreshold = 2 * 60 * 1000;
    return now - heartbeatTime > staleThreshold;
  }

  /**
   * GET /health
   * Returns system health information.
   * @param _req - Express request object (unused).
   * @param res - Express response object.
   * @returns Response with health information.
   */
  public getHealth = (_req: ExpressRequest, res: ExpressResponse): ExpressResponse => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const warnings: string[] = [];
    let status: 'ok' | 'degraded' | 'error' = 'ok';

    const heartbeat = this.readHeartbeat();
    if (heartbeat !== null) {
      if (this.isHeartbeatStale(heartbeat)) {
        warnings.push('Heartbeat is stale');
        status = 'degraded';
      }

      if (heartbeat.status !== 'healthy') {
        warnings.push('Heartbeat reports unhealthy status');
        status = 'degraded';
      }
    } else {
      logger.debug(LogSource.SERVER, 'No heartbeat data available', {
 category: 'health',
persistToDb: false
});
    }

    const health: IHealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      service: 'systemprompt-os',
      version: '0.1.0',
      heartbeat,
      ...warnings.length > 0 && { warnings },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: os.uptime(),
        loadAverage: os.loadavg(),
        memory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          percentUsed: Math.round(usedMem / totalMem * 100),
        },
        cpu: {
          model: cpus[0]?.model ?? 'Unknown',
          cores: cpus.length,
          speed: cpus[0]?.speed ?? 0,
        },
      },
    };

    return res.json(health);
  };
}
