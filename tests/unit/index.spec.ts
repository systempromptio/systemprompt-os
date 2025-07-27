/**
 * @fileoverview Unit tests for Main Entry Point
 * @module tests/unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock server instance
const mockServer = {
  close: vi.fn((cb) => cb && cb())
};

// Mock bootstrap to prevent actual bootstrap from running
vi.mock('../../src/bootstrap', () => ({
  runBootstrap: vi.fn(() => Promise.resolve({
    getModules: vi.fn(() => new Map([
      ['logger', {
        exports: {
          service: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
          }
        }
      }]
    ])),
    getCurrentPhase: vi.fn(() => 'initialized'),
    shutdown: vi.fn(() => Promise.resolve())
  }))
}));

// Mock all dependencies
vi.mock('../../src/server/index', () => ({
  startServer: vi.fn(() => Promise.resolve(mockServer))
}));

// Mock tunnel status
vi.mock('../../src/modules/core/auth/tunnel-status', () => ({
  tunnelStatus: {
    setBaseUrl: vi.fn()
  }
}));

// Mock constants
vi.mock('../../src/constants/process.constants', () => ({
  EXIT_FAILURE: 1,
  EXIT_SUCCESS: 0
}));

// Mock logger types
vi.mock('../../src/modules/core/logger/types/index', () => ({
  LogSource: {
    BOOTSTRAP: 'bootstrap'
  }
}));

describe('Main Entry Point', () => {
  let processListeners: any = {};
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Mock console methods to prevent actual console output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
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
    const { runBootstrap } = await import('../../src/bootstrap');
    
    // Clear any previous module cache and re-import to trigger main execution
    vi.resetModules();
    await import('../../src/index');
    
    // Give time for async operations
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(runBootstrap).toHaveBeenCalled();
    expect(startServer).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('🌟 SystemPrompt OS Starting...');
  });

  it('should handle server startup errors', async () => {
    const { runBootstrap } = await import('../../src/bootstrap');
    
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.mocked(runBootstrap).mockRejectedValueOnce(new Error('Bootstrap failed'));
    
    // Clear any previous module cache and re-import to trigger main execution
    vi.resetModules();
    await import('../../src/index');
    
    // Give time for async operations
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '💥 Failed to start SystemPrompt OS:',
      expect.any(Error)
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    
    mockExit.mockRestore();
  });

  it('should handle SIGTERM signal', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Clear any previous module cache and re-import to trigger main execution
    vi.resetModules();
    await import('../../src/index');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Ensure the SIGTERM handler was registered
    expect(processListeners.SIGTERM).toBeDefined();
    
    // Call the SIGTERM handler and wait for it to complete
    if (processListeners.SIGTERM) {
      await processListeners.SIGTERM();
      // Give additional time for async operations in the handler
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // The actual implementation logs through the logger service
    expect(mockServer.close).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
    
    mockExit.mockRestore();
  });

  it('should handle SIGINT signal', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Clear any previous module cache and re-import to trigger main execution
    vi.resetModules();
    await import('../../src/index');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Ensure the SIGINT handler was registered
    expect(processListeners.SIGINT).toBeDefined();
    
    // Call the SIGINT handler and wait for it to complete
    if (processListeners.SIGINT) {
      await processListeners.SIGINT();
      // Give additional time for async operations in the handler
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // The actual implementation logs through the logger service
    expect(mockServer.close).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
    
    mockExit.mockRestore();
  });
});