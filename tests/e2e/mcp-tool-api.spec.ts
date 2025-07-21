/**
 * @fileoverview End-to-end tests for MCP Tool API with permissions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleListTools, handleToolCall } from '@/server/mcp/core/handlers/tool-handlers';
import type { MCPToolContext } from '@/server/mcp/core/types/request-context';
import type { ListToolsRequest, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

// Mock the logger to suppress output during tests
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: vi.fn(() => 'mock-uuid-' + Date.now())
} as any;

describe('MCP Tool API E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Listing Flow', () => {
    it('should show different tools based on user role', async () => {
      // Test admin user flow
      const adminContext: MCPToolContext = {
        sessionId: 'admin-session-e2e-test',
        userId: '113783121475955670750' // Admin user ID
      };
      
      const adminTools = await handleListTools({}, adminContext);
      expect(adminTools.tools).toHaveLength(1);
      expect(adminTools.tools[0].name).toBe('checkstatus');

      // Test basic user flow
      const basicContext: MCPToolContext = {
        sessionId: 'basic-user-e2e-test',
        userId: 'basic-user-123'
      };
      
      const basicTools = await handleListTools({}, basicContext);
      expect(basicTools.tools).toHaveLength(0);

      // Test unauthenticated flow
      const noAuthTools = await handleListTools({});
      expect(noAuthTools.tools).toHaveLength(0);
    });
  });

  describe('Tool Execution Flow', () => {
    it('should enforce permissions throughout tool execution', async () => {
      const toolRequest: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {
            includeContainers: true,
            includeUsers: true,
            includeResources: true
          }
        }
      };

      // Admin should succeed
      const adminContext: MCPToolContext = {
        sessionId: 'admin-e2e-test-123',
        userId: '113783121475955670750' // Admin user ID
      };
      
      const adminResult = await handleToolCall(toolRequest, adminContext);
      expect(adminResult).toHaveProperty('content');
      expect(adminResult.content[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('System status')
      });
      expect(adminResult).toHaveProperty('structuredContent');
      expect(adminResult.structuredContent.status).toBe('success');
      expect(adminResult.structuredContent.result).toHaveProperty('timestamp');
      expect(adminResult.structuredContent.result).toHaveProperty('resources');
      expect(adminResult.structuredContent.result).toHaveProperty('services');

      // Basic user should be denied
      const basicContext: MCPToolContext = {
        sessionId: 'basic-e2e-test-456'
      };
      
      await expect(handleToolCall(toolRequest, basicContext)).rejects.toThrow(
        'Permission denied: basic role cannot access checkstatus tool'
      );
    });

    it('should handle tool errors gracefully', async () => {
      // Test with invalid tool name
      const invalidToolRequest: CallToolRequest = {
        params: {
          name: 'nonexistent-tool',
          arguments: {}
        }
      };

      const context: MCPToolContext = {
        sessionId: 'admin-error-test',
        userId: '113783121475955670750' // Admin user ID
      };

      await expect(handleToolCall(invalidToolRequest, context)).rejects.toThrow(
        'Unknown tool: nonexistent-tool'
      );

      // Test with missing session
      const validRequest: CallToolRequest = {
        params: {
          name: 'checkstatus',
          arguments: {}
        }
      };

      await expect(handleToolCall(validRequest, {} as MCPToolContext)).rejects.toThrow(
        'Session ID is required'
      );
    });
  });

  describe('Audit Trail', () => {
    it('should create comprehensive audit logs', async () => {
      const { logger } = await import('@/utils/logger');
      
      // Test successful execution
      const adminContext: MCPToolContext = {
        sessionId: 'admin-audit-test',
        userId: '113783121475955670750' // Admin user ID
      };
      
      await handleToolCall({
        params: {
          name: 'checkstatus',
          arguments: { includeAuditLog: true }
        }
      }, adminContext);

      // Verify audit entries
      expect(logger.info).toHaveBeenCalledWith(
        'Tool call initiated',
        expect.objectContaining({
          toolName: 'checkstatus',
          sessionId: 'admin-audit-test'
        })
      );

      // Check the second call which should be 'Tool execution started'
      expect(logger.info).toHaveBeenNthCalledWith(
        2,
        'Tool execution started',
        expect.objectContaining({
          userId: '113783121475955670750',
          role: 'admin',
          toolName: 'checkstatus'
        })
      );

      // Check the 5th call which should be 'Tool execution completed'
      expect(logger.info).toHaveBeenNthCalledWith(
        5,
        'Tool execution completed',
        expect.objectContaining({
          userId: '113783121475955670750',
          toolName: 'checkstatus',
          executionTime: expect.any(Number)
        })
      );

      // Test permission denial
      vi.clearAllMocks();
      
      const basicContext: MCPToolContext = {
        sessionId: 'basic-audit-test'
      };
      
      try {
        await handleToolCall({
          params: {
            name: 'checkstatus',
            arguments: {}
          }
        }, basicContext);
      } catch (e) {
        // Expected to throw
      }

      expect(logger.warn).toHaveBeenCalledWith(
        'Tool access denied',
        expect.objectContaining({
          userId: 'anonymous',
          role: 'basic',
          toolName: 'checkstatus',
          requiredRole: 'admin'
        })
      );
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const contexts = Array(10).fill(null).map((_, i) => ({
        sessionId: i % 2 === 0 ? `admin-perf-${i}` : `basic-perf-${i}`,
        userId: i % 2 === 0 ? '113783121475955670750' : `basic-user-${i}`
      }));

      const startTime = Date.now();
      
      const promises = contexts.map(context =>
        handleListTools({}, context).catch(() => null)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify results
      const adminResults = results.filter((r, i) => i % 2 === 0);
      const basicResults = results.filter((r, i) => i % 2 === 1);

      adminResults.forEach(result => {
        expect(result?.tools).toHaveLength(1);
      });

      basicResults.forEach(result => {
        expect(result?.tools).toHaveLength(0);
      });
    });
  });

  describe('Integration with Permission System', () => {
    it('should respect custom permissions', async () => {
      // This test demonstrates how custom permissions would work
      // In a real implementation, the getUserPermissionContext would
      // fetch custom permissions from the database
      
      const context: MCPToolContext = {
        sessionId: 'custom-permissions-test'
      };

      // For now, this will use standard role-based permissions
      const result = await handleListTools({}, context);
      
      // Basic users (non-admin session IDs) should not see admin tools
      expect(result.tools).toHaveLength(0);
    });
  });

  describe('Error Recovery', () => {
    it('should handle and log various error conditions', async () => {
      const { logger } = await import('@/utils/logger');
      
      // Test various error conditions
      const errorCases = [
        {
          name: 'Invalid session',
          context: { sessionId: null as any },
          expectedError: 'Session ID is required'
        },
        {
          name: 'Invalid tool',
          context: { sessionId: 'admin-test', userId: '113783121475955670750' },
          request: { params: { name: 'invalid', arguments: {} } },
          expectedError: 'Unknown tool'
        },
        {
          name: 'Invalid arguments',
          context: { sessionId: 'admin-test', userId: '113783121475955670750' },
          request: { params: { name: 'checkstatus', arguments: 'not-an-object' } },
          expectedError: 'Expected object'
        }
      ];

      for (const testCase of errorCases) {
        vi.clearAllMocks();
        
        try {
          await handleToolCall(
            testCase.request || { params: { name: 'checkstatus', arguments: {} } },
            testCase.context as MCPToolContext
          );
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          if (testCase.expectedError) {
            expect((error as Error).message).toContain(testCase.expectedError);
          }
        }

        // Verify error was logged
        expect(logger.error).toHaveBeenCalled();
      }
    });
  });
});