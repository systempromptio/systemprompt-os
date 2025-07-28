import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthEndpoint } from '../../../../../src/server/external/rest/health.js';
import { Request, Response } from 'express';
import { readFileSync, existsSync } from 'fs';
import { setupTestEnvironment } from '../../../../helpers/test-utils.js';

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

describe('HealthEndpoint', () => {
  let healthEndpoint: HealthEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  const { setEnv } = setupTestEnvironment();

  beforeEach(() => {
    vi.clearAllMocks();
    healthEndpoint = new HealthEndpoint();
    mockReq = {};
    jsonMock = vi.fn().mockReturnThis();
    mockRes = {
      json: jsonMock
    } as any;
  });
  describe('getHealth', () => {
    it('should return health status with fresh heartbeat data', async () => {
      // Arrange
      const mockHeartbeat: HeartbeatData = {
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

      // Act
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          heartbeat: mockHeartbeat,
          system: expect.any(Object)
        })
      );
    });
    it('should indicate degraded status when heartbeat is stale', async () => {
      // Arrange
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const staleHeartbeat: Partial<HeartbeatData> = {
        timestamp: tenMinutesAgo.toISOString(),
        status: 'healthy'
      };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(staleHeartbeat));

      // Act
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          warnings: expect.arrayContaining(['Heartbeat is stale']),
          heartbeat: staleHeartbeat
        })
      );
    });
    it('should handle missing heartbeat file gracefully', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          heartbeat: null,
          system: expect.any(Object)
        })
      );
    });

    it('should detect unhealthy heartbeat status', async () => {
      // Arrange
      const unhealthyHeartbeat: Partial<HeartbeatData> = {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        errors: ['High memory usage']
      };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(unhealthyHeartbeat));

      // Act
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          warnings: expect.arrayContaining(['Heartbeat reports unhealthy status']),
          heartbeat: unhealthyHeartbeat
        })
      );
    });

    it('should handle heartbeat read errors gracefully', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Failed to read heartbeat');
      });

      // Act
      await healthEndpoint.getHealth(mockReq as Request, mockRes as Response);

      // Assert
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