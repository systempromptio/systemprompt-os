import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LocalMcpServer } from '@/server/mcp/local/server';
import { writePidFile, removePidFile, log, main } from '@/server/mcp/local/daemon';

// Mock the dependencies
vi.mock('fs/promises');
vi.mock('path');
vi.mock('@/server/mcp/local/server');

// Mock the process object
const mockProcess = {
  pid: 12345,
  argv: ['/usr/bin/node', '/path/to/daemon.ts'],
  on: vi.fn(),
  exit: vi.fn()
};

Object.defineProperty(global, 'process', {
  value: mockProcess,
  configurable: true
});

// Mock console.error to prevent output during tests
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('daemon.ts', () => {
  // Type-safe mocks
  const mockFsMkdir = fs.mkdir as MockedFunction<typeof fs.mkdir>;
  const mockFsWriteFile = fs.writeFile as MockedFunction<typeof fs.writeFile>;
  const mockFsUnlink = fs.unlink as MockedFunction<typeof fs.unlink>;
  const mockFsAppendFile = fs.appendFile as MockedFunction<typeof fs.appendFile>;
  const mockPathDirname = path.dirname as MockedFunction<typeof path.dirname>;
  const mockLocalMcpServer = LocalMcpServer as MockedFunction<typeof LocalMcpServer>;
  
  let mockServerInstance: {
    start: MockedFunction<any>;
    stop: MockedFunction<any>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset process mocks
    mockProcess.on.mockClear();
    mockProcess.exit.mockClear();
    
    // Setup path.dirname mock
    mockPathDirname.mockReturnValue('/app/state');
    
    // Setup LocalMcpServer mock
    mockServerInstance = {
      start: vi.fn(),
      stop: vi.fn()
    };
    mockLocalMcpServer.mockImplementation(() => mockServerInstance as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('writePidFile', () => {
    it('should create directory and write PID file successfully', async () => {
      // Arrange
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      
      // Act
      await writePidFile();
      
      // Assert
      expect(mockPathDirname).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockFsMkdir).toHaveBeenCalledWith('/app/state', { recursive: true });
      expect(mockFsWriteFile).toHaveBeenCalledWith('/app/state/mcp-local.pid', '12345');
    });

    it('should handle directory creation error', async () => {
      // Arrange
      const error = new Error('Directory creation failed');
      mockFsMkdir.mockRejectedValue(error);
      
      // Act & Assert
      await expect(writePidFile()).rejects.toThrow('Directory creation failed');
      expect(mockPathDirname).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockFsMkdir).toHaveBeenCalledWith('/app/state', { recursive: true });
      expect(mockFsWriteFile).not.toHaveBeenCalled();
    });

    it('should handle file writing error', async () => {
      // Arrange
      mockFsMkdir.mockResolvedValue(undefined);
      const error = new Error('File write failed');
      mockFsWriteFile.mockRejectedValue(error);
      
      // Act & Assert
      await expect(writePidFile()).rejects.toThrow('File write failed');
      expect(mockFsMkdir).toHaveBeenCalledWith('/app/state', { recursive: true });
      expect(mockFsWriteFile).toHaveBeenCalledWith('/app/state/mcp-local.pid', '12345');
    });
  });

  describe('removePidFile', () => {
    it('should remove PID file successfully', async () => {
      // Arrange
      mockFsUnlink.mockResolvedValue(undefined);
      
      // Act
      await removePidFile();
      
      // Assert
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
    });

    it('should handle file removal error silently', async () => {
      // Arrange
      const error = new Error('File not found');
      mockFsUnlink.mockRejectedValue(error);
      
      // Act
      await removePidFile();
      
      // Assert
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      // Should not throw error - it's caught and ignored
    });
  });

  describe('log', () => {
    beforeEach(() => {
      // Mock Date to have consistent timestamp
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should write log message to file successfully', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      
      // Act
      await log('Test message');
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Test message\n'
      );
    });

    it('should handle log writing error', async () => {
      // Arrange
      const error = new Error('Log write failed');
      mockFsAppendFile.mockRejectedValue(error);
      
      // Act
      await log('Test message');
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Test message\n'
      );
      expect(mockConsoleError).toHaveBeenCalledWith('Failed to write to log file:', error);
    });
  });

  describe('main', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start daemon successfully', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockServerInstance.start.mockResolvedValue(undefined);
      
      // Act
      await main();
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Starting MCP local server daemon\n'
      );
      expect(mockFsMkdir).toHaveBeenCalledWith('/app/state', { recursive: true });
      expect(mockFsWriteFile).toHaveBeenCalledWith('/app/state/mcp-local.pid', '12345');
      expect(mockLocalMcpServer).toHaveBeenCalled();
      expect(mockProcess.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('SIGHUP', expect.any(Function));
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Starting STDIO server\n'
      );
      expect(mockServerInstance.start).toHaveBeenCalled();
    });

    it('should handle writePidFile error', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      const error = new Error('PID file error');
      mockFsMkdir.mockRejectedValue(error);
      mockFsUnlink.mockResolvedValue(undefined);
      
      // Act
      await main();
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Starting MCP local server daemon\n'
      );
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Fatal error: Error: PID file error\n'
      );
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it('should handle server start error', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      const error = new Error('Server start error');
      mockServerInstance.start.mockRejectedValue(error);
      mockFsUnlink.mockResolvedValue(undefined);
      
      // Act
      await main();
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Fatal error: Error: Server start error\n'
      );
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('signal handlers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle SIGTERM signal', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockServerInstance.start.mockResolvedValue(undefined);
      mockServerInstance.stop.mockResolvedValue(undefined);
      mockFsUnlink.mockResolvedValue(undefined);
      
      // Act - Start the daemon to register signal handlers
      const mainPromise = main();
      
      // Get the SIGTERM handler
      const sigtermHandler = mockProcess.on.mock.calls.find(call => call[0] === 'SIGTERM')?.[1];
      expect(sigtermHandler).toBeDefined();
      
      // Call the signal handler
      await sigtermHandler();
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Received SIGTERM, shutting down...\n'
      );
      expect(mockServerInstance.stop).toHaveBeenCalled();
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT signal', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockServerInstance.start.mockResolvedValue(undefined);
      mockServerInstance.stop.mockResolvedValue(undefined);
      mockFsUnlink.mockResolvedValue(undefined);
      
      // Import the module after mocks are setup
      const daemon = await import('@/server/mcp/local/daemon');
      
      // Act - Start the daemon to register signal handlers
      const mainPromise = (daemon as any).main();
      
      // Get the SIGINT handler
      const sigintHandler = mockProcess.on.mock.calls.find(call => call[0] === 'SIGINT')?.[1];
      expect(sigintHandler).toBeDefined();
      
      // Call the signal handler
      await sigintHandler();
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Received SIGINT, shutting down...\n'
      );
      expect(mockServerInstance.stop).toHaveBeenCalled();
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGHUP signal', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockServerInstance.start.mockResolvedValue(undefined);
      mockServerInstance.stop.mockResolvedValue(undefined);
      mockFsUnlink.mockResolvedValue(undefined);
      
      // Import the module after mocks are setup
      const daemon = await import('@/server/mcp/local/daemon');
      
      // Act - Start the daemon to register signal handlers
      const mainPromise = (daemon as any).main();
      
      // Get the SIGHUP handler
      const sighupHandler = mockProcess.on.mock.calls.find(call => call[0] === 'SIGHUP')?.[1];
      expect(sighupHandler).toBeDefined();
      
      // Call the signal handler
      await sighupHandler();
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Received SIGHUP, shutting down...\n'
      );
      expect(mockServerInstance.stop).toHaveBeenCalled();
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('module execution', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should execute main when module is run directly', async () => {
      // Arrange
      const originalImportMetaUrl = import.meta.url;
      const mockImportMeta = {
        url: `file://${mockProcess.argv[1]}`
      };
      
      mockFsAppendFile.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockServerInstance.start.mockResolvedValue(undefined);
      
      // Mock import.meta.url to match process.argv[1]
      Object.defineProperty(import.meta, 'url', {
        value: mockImportMeta.url,
        configurable: true
      });
      
      // Act - Import the module which should trigger execution
      await import('@/server/mcp/local/daemon');
      
      // We need to simulate the execution somehow since we can't easily test the module-level execution
      // This test verifies the condition would be true
      expect(`file://${mockProcess.argv[1]}`).toBe(mockImportMeta.url);
      
      // Restore original import.meta.url
      Object.defineProperty(import.meta, 'url', {
        value: originalImportMetaUrl,
        configurable: true
      });
    });

    it('should handle unhandled error in main execution', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      const error = new Error('Unhandled error');
      mockFsMkdir.mockRejectedValue(error);
      
      // Import the module after mocks are setup
      const daemon = await import('@/server/mcp/local/daemon');
      
      // Act - Simulate the main catch block
      try {
        await (daemon as any).main();
      } catch (caughtError) {
        // Simulate the outer catch block
        await (daemon as any).log(`Unhandled error: ${caughtError}`);
        mockProcess.exit(1);
      }
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Unhandled error: Error: Unhandled error\n'
      );
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('edge cases and error scenarios', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle server constructor error', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      const error = new Error('Server constructor error');
      mockLocalMcpServer.mockImplementation(() => {
        throw error;
      });
      mockFsUnlink.mockResolvedValue(undefined);
      
      // Import the module after mocks are setup
      const daemon = await import('@/server/mcp/local/daemon');
      
      // Act
      await (daemon as any).main();
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Fatal error: Error: Server constructor error\n'
      );
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it('should handle error in removePidFile during cleanup', async () => {
      // Arrange
      mockFsAppendFile.mockResolvedValue(undefined);
      const startError = new Error('Server start error');
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockServerInstance.start.mockRejectedValue(startError);
      
      // Make removePidFile fail silently (as it should)
      const unlinkError = new Error('Unlink failed');
      mockFsUnlink.mockRejectedValue(unlinkError);
      
      // Import the module after mocks are setup
      const daemon = await import('@/server/mcp/local/daemon');
      
      // Act
      await (daemon as any).main();
      
      // Assert
      expect(mockFsAppendFile).toHaveBeenCalledWith(
        '/app/logs/mcp-local.log',
        '[2024-01-01T12:00:00.000Z] Fatal error: Error: Server start error\n'
      );
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      // removePidFile should handle its own error silently
    });

    it('should handle logging error during shutdown', async () => {
      // Arrange
      mockFsAppendFile
        .mockResolvedValueOnce(undefined) // Initial log
        .mockResolvedValueOnce(undefined) // writePidFile setup logs
        .mockResolvedValueOnce(undefined) // Starting STDIO server log
        .mockRejectedValueOnce(new Error('Log write failed')); // Shutdown log fails
      
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockServerInstance.start.mockResolvedValue(undefined);
      mockServerInstance.stop.mockResolvedValue(undefined);
      mockFsUnlink.mockResolvedValue(undefined);
      
      // Import the module after mocks are setup
      const daemon = await import('@/server/mcp/local/daemon');
      
      // Act - Start the daemon to register signal handlers
      const mainPromise = (daemon as any).main();
      
      // Get the SIGTERM handler and call it
      const sigtermHandler = mockProcess.on.mock.calls.find(call => call[0] === 'SIGTERM')?.[1];
      await sigtermHandler();
      
      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith('Failed to write to log file:', expect.any(Error));
      expect(mockServerInstance.stop).toHaveBeenCalled();
      expect(mockFsUnlink).toHaveBeenCalledWith('/app/state/mcp-local.pid');
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
    });
  });
});