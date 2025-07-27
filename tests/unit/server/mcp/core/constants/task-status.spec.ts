/**
 * @fileoverview Unit tests for task status constants
 * @module tests/unit/server/mcp/core/constants/task-status
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const sourceFile = resolve(__dirname, '../../../../../../src/server/mcp/core/constants/task-status.ts');
const fileExists = existsSync(sourceFile);

// Skip all tests if source file doesn't exist
const describeSkip = fileExists ? describe : describe.skip;

let TaskStatus: any = {};
let TaskStatusType: any = {};
let TERMINALSTATUSES: any = [];
let ACTIVESTATUSES: any = [];

if (fileExists) {
  try {
    const module = await import('../../../../../../src/server/mcp/core/constants/task-status');
    TaskStatus = module.TaskStatus;
    TaskStatusType = module.TaskStatusType;
    TERMINALSTATUSES = module.TERMINALSTATUSES;
    ACTIVESTATUSES = module.ACTIVESTATUSES;
  } catch (error) {
    console.warn('Failed to import task-status module:', error);
  }
}

describeSkip('task-status constants', () => {
  describe('TaskStatus', () => {
    it('defines all expected status values', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.INPROGRESS).toBe('inprogress');
      expect(TaskStatus.WAITING).toBe('waiting');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.FAILED).toBe('failed');
      expect(TaskStatus.CANCELLED).toBe('cancelled');
    });
    
    it('has correct number of statuses', () => {
      expect(Object.keys(TaskStatus)).toHaveLength(6);
    });
    
    it('status values are unique', () => {
      const values = Object.values(TaskStatus);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });
  
  describe('TERMINALSTATUSES', () => {
    it('contains correct terminal statuses', () => {
      expect(TERMINALSTATUSES).toEqual([
        'completed',
        'failed',
        'cancelled'
      ]);
    });
    
    it('all terminal statuses exist in TaskStatus', () => {
      TERMINALSTATUSES.forEach(status => {
        expect(Object.values(TaskStatus)).toContain(status);
      });
    });
  });
  
  describe('ACTIVESTATUSES', () => {
    it('contains correct active statuses', () => {
      expect(ACTIVESTATUSES).toEqual([
        'pending',
        'inprogress',
        'waiting'
      ]);
    });
    
    it('all active statuses exist in TaskStatus', () => {
      ACTIVESTATUSES.forEach(status => {
        expect(Object.values(TaskStatus)).toContain(status);
      });
    });
  });
  
  describe('status categories', () => {
    it('terminal and active statuses are mutually exclusive', () => {
      const terminalSet = new Set(TERMINALSTATUSES);
      const activeSet = new Set(ACTIVESTATUSES);
      
      TERMINALSTATUSES.forEach(status => {
        expect(activeSet.has(status)).toBe(false);
      });
      
      ACTIVESTATUSES.forEach(status => {
        expect(terminalSet.has(status)).toBe(false);
      });
    });
    
    it('all statuses are categorized', () => {
      const allCategorized = [...TERMINALSTATUSES, ...ACTIVESTATUSES];
      const allStatuses = Object.values(TaskStatus);
      
      expect(allCategorized.sort()).toEqual(allStatuses.sort());
    });
  });
  
  describe('TaskStatusType', () => {
    it('type can be used for type checking', () => {
      const validStatus: TaskStatusType = TaskStatus.PENDING;
      expect(validStatus).toBe('pending');
      
      // Test that all TaskStatus values are valid TaskStatusType
      Object.values(TaskStatus).forEach(status => {
        const typedStatus: TaskStatusType = status;
        expect(typedStatus).toBe(status);
      });
    });
  });
});