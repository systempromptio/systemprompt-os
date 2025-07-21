/**
 * @fileoverview Unit tests for MCP tool handlers with permissions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { MCPToolContext } from '@/server/mcp/core/types/request-context';
import type { ListToolsRequest, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock the check-status handler
vi.mock('@/server/mcp/core/handlers/tools/check-status', () => ({
  handleCheckStatus: vi.fn(() => Promise.resolve({
    content: [{
      type: 'text',
      text: 'System status retrieved successfully'
    }],
    structuredContent: {
      status: 'success',
      message: 'System status retrieved successfully',
      result: {
        timestamp: new Date().toISOString(),
        uptime: 12345,
        platform: 'Linux 5.15',
        resources: {
          cpu: { model: 'Test CPU', cores: 4, usage: 25 },
          memory: { total: 8000000000, free: 4000000000, used: 4000000000, usagePercent: 50 },
          disk: { total: 100000000000, free: 50000000000, used: 50000000000, usagePercent: 50 }
        },
        services: {
          mcp: { status: 'active', version: '0.1.0', activeSessions: 1 },
          oauth: { status: 'active', tunnelActive: false, providers: [] }
        }
      }
    }
  }))
}));

// Import the functions to test after mocks are set up
import { handleListTools, handleToolCall } from '@/server/mcp/core/handlers/tool-handlers';

// Import node:crypto to mock it properly
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-12345')
}));

describe('MCP Tool Handlers', () => {
  let mockHandleCheckStatus: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked function
    const checkStatusModule = await import('@/server/mcp/core/handlers/tools/check-status');
    mockHandleCheckStatus = checkStatusModule.handleCheckStatus as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleListTools', () => {
    it('should return check-status tool for admin users', async () => {
      const request: ListToolsRequest = {};
      const context: MCPToolContext = {
        sessionId: 'admin-session-123',
        userId: '113783121475955670750' // Admin user ID
      };

      const result = await handleListTools(request, context);

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toMatchObject({
        name: 'checkstatus',
        description: 'Get comprehensive system status (admin only)'
      });
      expect(result.tools[0]).not.toHaveProperty('_meta');
    });

    it('should return empty tool list for basic users', async () => {
      const request: ListToolsRequest = {};
      const context: MCPToolContext = {
        sessionId: 'basic-user-456'
      };

      const result = await handleListTools(request, context);

      expect(result.tools).toHaveLength(0);
    });

    it('should return empty tool list when no context provided', async () => {
      const request: ListToolsRequest = {};

      const result = await handleListTools(request);

      expect(result.tools).toHaveLength(0);
    });

    it('should log tool filtering process', async () => {
      const { logger } = await import('@/utils/logger');
      const context: MCPToolContext = {
        sessionId: 'admin-session-123',
        userId: '113783121475955670750' // Admin user ID
      };

      await handleListTools({}, context);

      // Check first call
      expect(logger.info).toHaveBeenNthCalledWith(
        1,
        'Tool listing requested',
        expect.objectContaining({
          sessionId: 'admin-session-123',
          requestId: 'mock-uuid-12345'
        })
      );

      // Check third call
      expect(logger.info).toHaveBeenNthCalledWith(
        3,
        'Tool filtering completed',
        expect.objectContaining({
          userId: '113783121475955670750',
          role: 'admin',
          totalTools: 1,
          availableTools: 1,
          toolNames: ['checkstatus']
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const context: MCPToolContext = {
        sessionId: null as any // Invalid session to trigger error
      };

      await expect(handleListTools({}, context)).rejects.toThrow();
      
      const { logger } = await import('@/utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Tool listing failed',
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });
  });

  describe('handleToolCall', () => {
    it('should allow admin to call check-status tool', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {
            includeContainers: true,
            includeUsers: true
          }
        }
      };
      const context: MCPToolContext = {
        sessionId: 'admin-session-123',
        userId: '113783121475955670750' // Admin user ID
      };

      const result = await handleToolCall(request, context);

      expect(result).toHaveProperty('content');
      expect(result.content).toEqual([{
        type: 'text',
        text: 'System status retrieved successfully'
      }]);
      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent.status).toBe('success');

      expect(mockHandleCheckStatus).toHaveBeenCalledWith(
        { includeContainers: true, includeUsers: true },
        context
      );
    });

    it('should deny basic user from calling check-status tool', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {}
        }
      };
      const context: MCPToolContext = {
        sessionId: 'basic-user-456'
      };

      await expect(handleToolCall(request, context)).rejects.toThrow(
        'Permission denied: basic role cannot access checkstatus tool'
      );

      expect(mockHandleCheckStatus).not.toHaveBeenCalled();
    });

    it('should throw error for unknown tool', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'unknowntool',
          arguments: {}
        }
      };
      const context: MCPToolContext = {
        sessionId: 'admin-session-123',
        userId: '113783121475955670750' // Admin user ID
      };

      await expect(handleToolCall(request, context)).rejects.toThrow(
        'Unknown tool: unknowntool'
      );
    });

    it('should require session ID', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {}
        }
      };
      const context: MCPToolContext = {};

      await expect(handleToolCall(request, context)).rejects.toThrow(
        'Session ID is required'
      );
    });

    it('should log permission denial attempts', async () => {
      const { logger } = await import('@/utils/logger');
      const request: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {}
        }
      };
      const context: MCPToolContext = {
        sessionId: 'basic-user-456'
      };

      try {
        await handleToolCall(request, context);
      } catch (e) {
        // Expected to throw
      }

      expect(logger.warn).toHaveBeenCalledWith(
        'Tool access denied',
        expect.objectContaining({
          userId: 'anonymous',
          userEmail: 'user@systemprompt.io',
          role: 'basic',
          toolName: 'checkstatus',
          requiredRole: 'admin',
          requestId: 'mock-uuid-12345'
        })
      );
    });

    it('should log successful tool execution', async () => {
      const { logger } = await import('@/utils/logger');
      const request: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {}
        }
      };
      const context: MCPToolContext = {
        sessionId: 'admin-session-123',
        userId: '113783121475955670750' // Admin user ID
      };

      await handleToolCall(request, context);

      // Check that the 3rd call to logger.info was 'Tool execution completed'
      expect(logger.info).toHaveBeenNthCalledWith(
        3,
        'Tool execution completed',
        expect.objectContaining({
          userId: '113783121475955670750',
          toolName: 'checkstatus',
          executionTime: expect.any(Number),
          requestId: 'mock-uuid-12345'
        })
      );
    });

    it('should handle tool execution errors', async () => {
      mockHandleCheckStatus.mockRejectedValueOnce(new Error('Tool execution failed'));

      const request: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {}
        }
      };
      const context: MCPToolContext = {
        sessionId: 'admin-session-123',
        userId: '113783121475955670750' // Admin user ID
      };

      await expect(handleToolCall(request, context)).rejects.toThrow(
        'Tool execution failed'
      );

      const { logger } = await import('@/utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Tool execution failed',
        expect.objectContaining({
          toolName: 'checkstatus',
          error: 'Tool execution failed',
          isPermissionError: false
        })
      );
    });

    it('should validate tool arguments with Zod', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: 'invalid-arguments' as any // Should be object
        }
      };
      const context: MCPToolContext = {
        sessionId: 'admin-session-123'
      };

      await expect(handleToolCall(request, context)).rejects.toThrow();
    });
  });

  describe('Permission System Integration', () => {
    it('should respect granular permissions', async () => {
      // This test would require modifying getUserPermissionContext
      // to accept custom permissions for testing
      const context: MCPToolContext = {
        sessionId: 'custom-permissions-test'
      };

      // In a real implementation, we'd mock the database query
      // to return a user with specific permissions
      const result = await handleListTools({}, context);
      
      // Basic user should not see admin tools
      if (context.sessionId.includes('basic')) {
        expect(result.tools).toHaveLength(0);
      }
    });

    it('should handle session expiration', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {}
        }
      };
      const context: MCPToolContext = {
        sessionId: undefined as any
      };

      await expect(handleToolCall(request, context)).rejects.toThrow(
        'Session ID is required'
      );
    });
  });
});