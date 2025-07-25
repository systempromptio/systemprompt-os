/**
 * @file Health check endpoint.
 * @module server/external/rest/health
 */

import type { Request, Response } from 'express';
import os from 'os';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '@/server/config';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

const logger = LoggerService.getInstance();

/*
 * Import { HeartbeatStatus } from '../../../modules/core/heartbeat/types.js';
 * Heartbeat functionality has been absorbed into the system module
 */

interface HeartbeatStatus {
  pid: number;
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  memory: {
    used: number;
    total: number;
  };
  uptime: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  service: string;
  version: string;
  heartbeat?: HeartbeatStatus | null;
  warnings?: string[];
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    uptime: number;
    loadAverage: number[];
    memory: {
      total: number;
      free: number;
      used: number;
      percentUsed: number;
    };
    cpu: {
      model: string;
      cores: number;
      speed: number;
    };
    disk?: {
      total: number;
      free: number;
      used: number;
      percentUsed: number;
    };
  };
}

export class HealthEndpoint {
  /**
   * Read heartbeat data from file.
   */
  private readHeartbeat(): HeartbeatStatus | null {
    try {
      const heartbeatPath = join(CONFIG.STATEDIR, 'data', 'heartbeat.json');
      if (!existsSync(heartbeatPath)) {
        return null;
      }

      const content = readFileSync(heartbeatPath, 'utf-8');
      return JSON.parse(content);
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
   * Check if heartbeat is stale (older than 2 minutes).
   * @param heartbeat
   */
  private isHeartbeatStale(heartbeat: HeartbeatStatus): boolean {
    const heartbeatTime = new Date(heartbeat.timestamp).getTime();
    const now = Date.now();
    const staleThreshold = 2 * 60 * 1000
    return now - heartbeatTime > staleThreshold;
  }

  /**
   * GET /health
   * Returns system health information.
   * @param _req
   * @param res
   */
  getHealth = async (_req: Request, res: Response): Promise<Response> => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const warnings: string[] = [];
    let status: 'ok' | 'degraded' | 'error' = 'ok';

    const heartbeat = this.readHeartbeat();
    if (heartbeat) {
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

    const health: HealthResponse = {
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
          model: cpus[0]?.model || 'Unknown',
          cores: cpus.length,
          speed: cpus[0]?.speed || 0,
        },
      },
    };

    return res.json(health);
  };
}
