/**
 * Users module tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsersModule, createModule, initialize } from '../../../../../src/modules/core/users/index.js';
import type { IUsersModuleExports } from '../../../../../src/modules/core/users/index.js';

describe('UsersModule', () => {
  let module: UsersModule;
  let mockLogger: any;
  
  beforeEach(async () => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    module = new UsersModule();
    await module.initialize({ logger: mockLogger });
  });
  
  afterEach(async () => {
    await module.stop();
  });
  
  describe('Module Lifecycle', () => {
    it('should initialize successfully', () => {
      expect(module.name).toBe('users');
      expect(module.version).toBe('1.0.0');
      expect(module.type).toBe('service');
      expect(mockLogger.info).toHaveBeenCalledWith('Users module initialized');
    });
    
    it('should start successfully', async () => {
      await module.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Users module started');
    });
    
    it('should stop successfully', async () => {
      await module.start();
      await module.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Users module stopped');
    });
    
    it('should return healthy status', async () => {
      const health = await module.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('Users module is healthy');
    });
  });
  
  describe('User Management', () => {
    it('should list users', async () => {
      const users = await module.listUsers();
      expect(Array.isArray(users)).toBe(true);
    });
    
    it('should create a user', async () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User'
      };
      
      const user = await module.createUser(input);
      expect(user).toBeDefined();
      expect(user.email).toBe(input.email);
      expect(user.name).toBe(input.name);
      expect(user.status).toBe('active');
    });
    
    it('should get user by ID or email', async () => {
      const result = await module.getUser('test@example.com');
      expect(result).toBeNull(); // Since DB is not connected
    });
    
    it('should handle update user error', async () => {
      await expect(module.updateUser('test-id', {
        name: 'Updated Name'
      })).rejects.toThrow('User not found');
    });
    
    it('should handle enable user error', async () => {
      await expect(module.enableUser('test-id')).rejects.toThrow('User not found');
    });
    
    it('should handle disable user error', async () => {
      await expect(module.disableUser('test-id', 'Test reason')).rejects.toThrow('User not found');
    });
  });
  
  describe('Session Management', () => {
    it('should get user sessions', async () => {
      const sessions = await module.getUserSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });
    
    it('should create session', async () => {
      const session = await module.createSession({
        userId: 'test-user',
        token: 'test-token',
        ipAddress: '127.0.0.1'
      });
      expect(session).toBeDefined();
      expect(session.userId).toBe('test-user');
      expect(session.isActive).toBe(true);
    });
    
    it('should validate session', async () => {
      const result = await module.validateSession('test-token');
      expect(result).toBeNull(); // Since DB is not connected
    });
    
    it('should revoke sessions', async () => {
      await expect(module.revokeUserSessions('test-user')).resolves.not.toThrow();
    });
  });
  
  describe('Activity Tracking', () => {
    it('should get user activity', async () => {
      const activities = await module.getUserActivity();
      expect(Array.isArray(activities)).toBe(true);
    });
    
    it('should record activity', async () => {
      await expect(module.recordActivity({
        userId: 'test-user',
        type: 'user.created',
        action: 'Test action'
      })).resolves.not.toThrow();
    });
  });
  
  describe('CLI Commands', () => {
    it('should provide CLI command', async () => {
      const command = await module.getCommand();
      expect(command).toBeDefined();
      expect(command.name()).toBe('users');
      expect(command.alias()).toBe('user');
      
      // Check subcommands
      const subcommands = command.commands.map((cmd: any) => cmd.name());
      expect(subcommands).toContain('list');
      expect(subcommands).toContain('create');
      expect(subcommands).toContain('update');
      expect(subcommands).toContain('delete');
      expect(subcommands).toContain('enable');
      expect(subcommands).toContain('disable');
      expect(subcommands).toContain('sessions');
      expect(subcommands).toContain('activity');
    });
  });
  
  describe('Module Interface Compliance', () => {
    it('should implement required module interface methods', () => {
      expect(typeof module.initialize).toBe('function');
      expect(typeof module.start).toBe('function');
      expect(typeof module.stop).toBe('function');
      expect(typeof module.healthCheck).toBe('function');
    });
    
    it('should have required module properties', () => {
      expect(module.name).toBeDefined();
      expect(module.version).toBeDefined();
      expect(module.type).toBeDefined();
    });
  });
});