/**
 * @fileoverview Unit tests for server types
 * @module tests/unit/server
 */

import { describe, it, expect } from 'vitest';
import { MCPErrorCode } from '@/server/types.js';

describe('Server Types', () => {
  describe('MCPErrorCode Enum', () => {
    it('should have correct JSON-RPC 2.0 error codes', () => {
      expect(MCPErrorCode.ParseError).toBe(-32700);
      expect(MCPErrorCode.InvalidRequest).toBe(-32600);
      expect(MCPErrorCode.MethodNotFound).toBe(-32601);
      expect(MCPErrorCode.InvalidParams).toBe(-32602);
      expect(MCPErrorCode.InternalError).toBe(-32603);
      expect(MCPErrorCode.ServerError).toBe(-32000);
    });

    it('should have all expected enum keys', () => {
      const expectedKeys = [
        'ParseError',
        'InvalidRequest',
        'MethodNotFound',
        'InvalidParams',
        'InternalError',
        'ServerError'
      ];
      const actualKeys = Object.keys(MCPErrorCode).filter(k => isNaN(Number(k)));
      expect(actualKeys).toEqual(expectedKeys);
    });

    it('should support reverse lookup for numeric enums', () => {
      expect(MCPErrorCode[MCPErrorCode.ParseError]).toBe('ParseError');
      expect(MCPErrorCode[MCPErrorCode.InvalidRequest]).toBe('InvalidRequest');
      expect(MCPErrorCode[MCPErrorCode.MethodNotFound]).toBe('MethodNotFound');
      expect(MCPErrorCode[MCPErrorCode.InvalidParams]).toBe('InvalidParams');
      expect(MCPErrorCode[MCPErrorCode.InternalError]).toBe('InternalError');
      expect(MCPErrorCode[MCPErrorCode.ServerError]).toBe('ServerError');
    });

    it('should be usable in error responses', () => {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCode.InvalidRequest,
          message: 'Invalid request format'
        },
        id: null
      };
      
      expect(errorResponse.error.code).toBe(-32600);
    });
  });
});