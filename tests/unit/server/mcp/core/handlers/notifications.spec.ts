/**
 * @fileoverview Unit tests for MCP Notification Handlers
 * @module tests/unit/server/mcp/core/handlers/notifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendOperationNotification,
  sendJsonResultNotification,
  sendConfigNotification,
  sendProgressNotification,
  sendRootsListChangedNotification,
  sendResourcesUpdatedNotification,
  sendResourcesListChangedNotification
} from '../../../../../../src/server/mcp/core/handlers/notifications';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Mock the MCP handler
vi.mock('../../../../../../src/server/mcp', () => ({
  getMCPHandlerInstance: vi.fn()
}));

// Mock the Server class
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn()
}));

describe('Notification Handlers', () => {
  let mockHandler: any;
  let mockServer: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create mock server instance
    mockServer = {
      notification: vi.fn().mockResolvedValue(undefined)
    };
    
    // Create mock handler instance
    mockHandler = {
      getActiveServer: vi.fn().mockReturnValue(null),
      getAllServers: vi.fn().mockReturnValue([]),
      getServerForSession: vi.fn().mockReturnValue(null)
    };
    
    // Setup getMCPHandlerInstance mock
    const { getMCPHandlerInstance } = vi.mocked(await import('../../../../../../src/server/mcp'));
    getMCPHandlerInstance.mockReturnValue(mockHandler);
  });

  describe('sendOperationNotification', () => {
    it('should send operation notification to all servers', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendOperationNotification('create', 'Resource created successfully');
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/message',
        params: {
          meta: expect.any(Object),
          message: 'Operation create: Resource created successfully',
          level: 'info',
          timestamp: expect.any(String)
        }
      });
    });

    it('should send operation notification to specific session', async () => {
      mockHandler.getServerForSession.mockReturnValue(mockServer);
      
      await sendOperationNotification('update', 'Resource updated', 'session-123');
      
      expect(mockHandler.getServerForSession).toHaveBeenCalledWith('session-123');
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/message',
        params: {
          meta: expect.any(Object),
          message: 'Operation update: Resource updated',
          level: 'info',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle no active servers gracefully', async () => {
      mockHandler.getAllServers.mockReturnValue([]);
      
      // Should not throw
      await expect(sendOperationNotification('delete', 'Resource deleted')).resolves.toBeUndefined();
    });

    it('should handle notification failures silently', async () => {
      mockServer.notification.mockRejectedValue(new Error('Network error'));
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      // Should not throw
      await expect(sendOperationNotification('test', 'Test message')).resolves.toBeUndefined();
    });
  });

  describe('sendJsonResultNotification', () => {
    it('should send JSON result notification', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendJsonResultNotification('JSON processing complete');
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/message',
        params: {
          meta: {},
          message: 'JSON processing complete',
          level: 'info',
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('sendConfigNotification', () => {
    it('should send configuration change notification', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendConfigNotification('Configuration updated');
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'server/config/changed',
        params: {
          meta: {},
          message: 'Configuration updated',
          level: 'info',
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('sendProgressNotification', () => {
    it('should send progress notification with total', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendProgressNotification('task-123', 50, 100);
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'task-123',
          progress: 50,
          total: 100
        }
      });
    });

    it('should send progress notification without total', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendProgressNotification('task-456', 75);
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'task-456',
          progress: 75
        }
      });
    });

    it('should send progress notification to specific session', async () => {
      mockHandler.getServerForSession.mockReturnValue(mockServer);
      
      await sendProgressNotification('task-789', 100, 100, 'session-999');
      
      expect(mockHandler.getServerForSession).toHaveBeenCalledWith('session-999');
      expect(mockServer.notification).toHaveBeenCalled();
    });

    it('should handle numeric progress tokens', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendProgressNotification(12345, 25, 50);
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 12345,
          progress: 25,
          total: 50
        }
      });
    });
  });

  describe('sendRootsListChangedNotification', () => {
    it('should send roots list changed notification', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendRootsListChangedNotification();
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/roots/listchanged',
        params: {}
      });
    });
  });

  describe('sendResourcesUpdatedNotification', () => {
    it('should send resources updated notification', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendResourcesUpdatedNotification('task://123');
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/resources/updated',
        params: {
          uri: 'task://123'
        }
      });
    });

    it('should send resources updated notification to specific session', async () => {
      mockHandler.getServerForSession.mockReturnValue(mockServer);
      
      await sendResourcesUpdatedNotification('resource://456', 'session-abc');
      
      expect(mockHandler.getServerForSession).toHaveBeenCalledWith('session-abc');
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/resources/updated',
        params: {
          uri: 'resource://456'
        }
      });
    });
  });

  describe('sendResourcesListChangedNotification', () => {
    it('should send resources list changed notification', async () => {
      mockHandler.getAllServers.mockReturnValue([mockServer]);
      
      await sendResourcesListChangedNotification();
      
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/resources/listchanged',
        params: {}
      });
    });
  });

  describe('broadcast behavior', () => {
    it('should broadcast to multiple servers', async () => {
      const mockServer1 = { notification: vi.fn().mockResolvedValue(undefined) };
      const mockServer2 = { notification: vi.fn().mockResolvedValue(undefined) };
      mockHandler.getAllServers.mockReturnValue([mockServer1, mockServer2]);
      
      await sendConfigNotification('Config changed');
      
      expect(mockServer1.notification).toHaveBeenCalled();
      expect(mockServer2.notification).toHaveBeenCalled();
    });

    it('should continue broadcasting even if one server fails', async () => {
      const mockServer1 = { notification: vi.fn().mockRejectedValue(new Error('Failed')) };
      const mockServer2 = { notification: vi.fn().mockResolvedValue(undefined) };
      mockHandler.getAllServers.mockReturnValue([mockServer1, mockServer2]);
      
      await sendConfigNotification('Config changed');
      
      expect(mockServer1.notification).toHaveBeenCalled();
      expect(mockServer2.notification).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle missing handler gracefully', async () => {
      const mcpModule = await import('../../../../../../src/server/mcp');
      const { getMCPHandlerInstance } = vi.mocked(mcpModule);
      getMCPHandlerInstance.mockReturnValue(null);
      
      // Should not throw
      await expect(sendOperationNotification('test', 'message')).resolves.toBeUndefined();
    });

    it('should handle missing server for session gracefully', async () => {
      mockHandler.getServerForSession.mockReturnValue(null);
      
      // Should not throw
      await expect(sendOperationNotification('test', 'message', 'session-123')).resolves.toBeUndefined();
    });
  });
});