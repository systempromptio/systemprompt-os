/**
 * @fileoverview Unit tests for task-output resource handler
 * @module tests/unit/server/mcp/core/handlers/resources/task-output
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getTaskOutputResource, 
  listTaskOutputResources 
} from '../../../../../../../src/server/mcp/core/handlers/resources/task-output';
import { logger } from '../../../../../../../src/utils/logger';

// Mock logger
vi.mock('../../../../../../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn()
  }
}));

describe('task-output resource handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('getTaskOutputResource', () => {
    it('returns placeholder task output for valid task ID', async () => {
      const uri = new URL('resource:///task-output/task-123');
      const resource = await getTaskOutputResource(uri);
      
      expect(resource).toHaveProperty('uri');
      expect(resource).toHaveProperty('name');
      expect(resource).toHaveProperty('description');
      expect(resource).toHaveProperty('mimeType');
      expect(resource).toHaveProperty('text');
      
      expect(resource.uri).toBe('resource:///task-output/task-123');
      expect(resource.name).toBe('Task Output: Placeholder');
      expect(resource.description).toBe('Placeholder output for task task-123');
      expect(resource.mimeType).toBe('application/json');
    });
    
    it('includes task data in output', async () => {
      const uri = new URL('resource:///task-output/task-456');
      const resource = await getTaskOutputResource(uri);
      
      const output = JSON.parse(resource.text!);
      expect(output.task).toEqual({
        id: 'task-456',
        description: 'Placeholder task',
        status: 'pending',
        elapsedseconds: 0,
        createdat: expect.any(String),
        updatedat: expect.any(String)
      });
    });
    
    it('includes empty arrays for logs and events', async () => {
      const uri = new URL('resource:///task-output/task-789');
      const resource = await getTaskOutputResource(uri);
      
      const output = JSON.parse(resource.text!);
      expect(output.session).toBeNull();
      expect(output.logs).toEqual([]);
      expect(output.streamoutput).toBe('');
      expect(output.progressevents).toEqual([]);
      expect(output.filescreated).toEqual([]);
      expect(output.commandsexecuted).toEqual([]);
    });
    
    it('throws error when task ID is missing', async () => {
      const uri = new URL('resource:///task-output/');
      
      await expect(getTaskOutputResource(uri))
        .rejects.toThrow('Task ID is required');
    });
    
    it('logs warning about unimplemented handler', async () => {
      const uri = new URL('resource:///task-output/task-abc');
      await getTaskOutputResource(uri);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Task output resource handler not implemented',
        { taskId: 'task-abc' }
      );
    });
    
    it('formats JSON output with proper indentation', async () => {
      const uri = new URL('resource:///task-output/task-test');
      const resource = await getTaskOutputResource(uri);
      
      // Check that JSON is properly formatted (has newlines and spaces)
      expect(resource.text).toContain('\n');
      expect(resource.text).toContain('  '); // 2-space indentation
    });
  });
  
  describe('listTaskOutputResources', () => {
    it('returns empty array', async () => {
      const resources = await listTaskOutputResources();
      
      expect(Array.isArray(resources)).toBe(true);
      expect(resources).toHaveLength(0);
    });
    
    it('logs warning about unimplemented listing', async () => {
      await listTaskOutputResources();
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Task output resource listing not implemented'
      );
    });
  });
});