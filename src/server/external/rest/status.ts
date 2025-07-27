/**
 * Status endpoint for external server.
 * @description Provides server and system status information.
 * @module server/external/rest/status
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import os from 'os';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

const logger = LoggerService.getInstance();

/**
 * Status endpoint handler.
 */
export class StatusEndpoint {
  private readonly startTime: Date;
  
  constructor() {
    this.startTime = new Date();
  }
  
  public getStatus = (_req: ExpressRequest, res: ExpressResponse): ExpressResponse => {
    try {
      const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
      const version = process.env.npm_package_version || '0.1.0';


      const status = {
        server: {
          status: 'running',
          uptime,
          version,
          timestamp: new Date().toISOString()
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          hostname: os.hostname(),
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
          },
          cpus: os.cpus().length
        },
        mcp: {
          available: true,
          version: '1.0.0',
          tools: [],
          resources: []
        },
        modules: {
          loaded: 0,
          healthy: true
        }
      };

      return res.json(status);
    } catch (error: unknown) {
      logger.error(LogSource.SERVER, 'Status endpoint error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'status',
        persistToDb: false
      });

      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve status information',
        timestamp: new Date().toISOString()
      });
    }
  };
}
