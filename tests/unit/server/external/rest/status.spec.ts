import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusEndpoint } from '../../../../../src/server/external/rest/status';
import type { Request, Response } from 'express';

// Mock all dependencies before imports
vi.mock('../../../../../src/server/mcp/registry.js');
vi.mock('../../../../../src/modules/loader.js');
vi.mock('fs');
vi.mock('../../../../../src/server/config.js');

describe('StatusEndpoint', () => {
  let statusEndpoint: StatusEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis()
    };

    statusEndpoint = new StatusEndpoint();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('should return status response', async () => {
      await statusEndpoint.getStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalled();
      const response = (mockRes.json as any).mock.calls[0][0];
      
      // Basic structure checks
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('servers');
      expect(response).toHaveProperty('providers');
      expect(response).toHaveProperty('logs');
      expect(response).toHaveProperty('state');
    });

    it('should handle errors and return 500 status', async () => {
      // Mock console.error to avoid test output noise
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Make the status generation fail by causing an error in one of the dependencies
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error('File system error');
      });

      await statusEndpoint.getStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        timestamp: expect.any(String),
        error: 'Failed to generate system status'
      });

      consoleErrorSpy.mockRestore();
    });
  });
});