/**
 * @fileoverview Unit tests for Main Entry Point
 * @module tests/unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock server instance
const mockServer = {
  close: vi.fn((cb) => cb && cb())
};

// Mock all dependencies
vi.mock('../../src/server/index', () => ({
  startServer: vi.fn(() => Promise.resolve(mockServer))
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Main Entry Point', () => {
  let processListeners: any = {};
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Capture process event listeners
    processListeners = {};
    vi.spyOn(process, 'on').mockImplementation((event: string, listener: any) => {
      processListeners[event] = listener;
      return process;
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start server on import', async () => {
    const { startServer } = await import('../../src/server/index');
    
    await import('../../src/index');
    
    // Give time for async import
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(startServer).toHaveBeenCalled();
  });

  it('should handle server startup errors', async () => {
    const { startServer } = await import('../../src/server/index');
    const { logger } = await import('../../src/utils/logger');
    
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.mocked(startServer).mockRejectedValueOnce(new Error('Server failed'));
    
    await import('../../src/index');
    
    // Give time for async operations
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to start server:',
      expect.any(Error)
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    
    mockExit.mockRestore();
  });

  it('should handle SIGTERM signal', async () => {
    const { logger } = await import('../../src/utils/logger');
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    await import('../../src/index');
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Call the SIGTERM handler
    if (processListeners.SIGTERM) {
      await processListeners.SIGTERM();
    }
    
    expect(logger.info).toHaveBeenCalledWith('SIGTERM received, shutting down gracefully');
    expect(mockServer.close).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
    
    mockExit.mockRestore();
  });

  it('should handle SIGINT signal', async () => {
    const { logger } = await import('../../src/utils/logger');
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    await import('../../src/index');
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Call the SIGINT handler
    if (processListeners.SIGINT) {
      await processListeners.SIGINT();
    }
    
    expect(logger.info).toHaveBeenCalledWith('SIGINT received, shutting down gracefully');
    expect(mockServer.close).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
    
    mockExit.mockRestore();
  });
});