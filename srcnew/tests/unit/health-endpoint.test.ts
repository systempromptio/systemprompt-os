/**
 * @fileoverview Unit tests for health endpoint with heartbeat integration
 * @module tests/unit/health-endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthEndpoint } from '../../src/server/external/rest/health.js';
import { Request, Response } from 'express';
import { readFileSync, existsSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  readdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  appendFileSync: vi.fn(),
  mkdtempSync: vi.fn((prefix: string) => prefix + 'test'),
  dirname: vi.fn()
}));

describe('Health Endpoint Unit Tests', () => {
  let healthEndpoint: HealthEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create endpoint
    healthEndpoint = new HealthEndpoint();
    
    // Mock request and response
    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    mockRes = {
      json: jsonMock
    } as any;
  });
  
  describe('getHealth', () => {
    it('should return health with fresh heartbeat data', async () => {
      const mockHeartbeat = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        uptime: 3600,
        memory: {
          total: 1000,
          free: 500,
          used: 500,
          percentUsed: 50
        },
        cpu: {
          model: 'Test CPU',
          cores: 4,
          speed: 2400
        }
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockHeartbeat));
      
      const result = await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          heartbeat: mockHeartbeat,
          system: expect.any(Object)
        })
      );
    });
    
    it('should indicate degraded status for stale heartbeat', async () => {
      const staleHeartbeat = {
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes old
        status: 'healthy'
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(staleHeartbeat));
      
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          warnings: expect.arrayContaining(['Heartbeat is stale']),
          heartbeat: staleHeartbeat
        })
      );
    });
    
    it('should handle missing heartbeat gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          heartbeat: null,
          system: expect.any(Object)
        })
      );
    });
    
    it('should detect unhealthy heartbeat status', async () => {
      const unhealthyHeartbeat = {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        errors: ['High memory usage']
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(unhealthyHeartbeat));
      
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          warnings: expect.arrayContaining(['Heartbeat reports unhealthy status']),
          heartbeat: unhealthyHeartbeat
        })
      );
    });
    
    it('should handle heartbeat read errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Failed to read heartbeat');
      });
      
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);
      
      // When readFileSync throws an error, the health endpoint returns null heartbeat
      // and logs the error, but doesn't degrade the status
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          heartbeat: null,
          system: expect.any(Object)
        })
      );
    });
  });
});