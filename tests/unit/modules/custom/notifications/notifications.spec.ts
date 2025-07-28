/**
 * @file Unit tests for notifications module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsModule } from '@/modules/custom/notifications/index';
import { NotificationsService } from '@/modules/custom/notifications/services/notifications.service';
import { NotificationsRepository } from '@/modules/custom/notifications/repositories/notifications.repository';

// Mock dependencies
vi.mock('@/modules/core/logger/services/logger.service', () => ({
  LoggerService: {
    getInstance: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    })
  }
}));

vi.mock('@/modules/core/database/index', () => ({
  getDatabaseModule: () => ({
    exports: {
      service: () => ({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn()
      })
    }
  })
}));

describe('Notifications Module', () => {
  let module: NotificationsModule;

  beforeEach(() => {
    // Clear singletons
    vi.clearAllMocks();
    (NotificationsService as any).instance = undefined;
    (NotificationsRepository as any).instance = undefined;
    
    module = new NotificationsModule();
  });

  describe('Module Lifecycle', () => {
    it('should initialize successfully', async () => {
      await expect(module.initialize()).resolves.not.toThrow();
      expect(module.status).toBe('stopped');
    });

    it('should start successfully after initialization', async () => {
      await module.initialize();
      await expect(module.start()).resolves.not.toThrow();
      expect(module.status).toBe('running');
    });

    it('should throw error when starting without initialization', async () => {
      await expect(module.start()).rejects.toThrow('Notifications module not initialized');
    });

    it('should stop successfully after starting', async () => {
      await module.initialize();
      await module.start();
      await expect(module.stop()).resolves.not.toThrow();
      expect(module.status).toBe('stopped');
    });

    it('should provide health check status', async () => {
      // Not initialized
      let health = await module.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not initialized');

      // Initialized but not started
      await module.initialize();
      health = await module.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not started');

      // Started
      await module.start();
      health = await module.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.message).toContain('healthy');
    });
  });

  describe('Module Exports', () => {
    it('should expose service through exports', async () => {
      await module.initialize();
      
      const exports = module.exports;
      expect(exports.service).toBeDefined();
      expect(typeof exports.service).toBe('function');
      
      const service = exports.service();
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(NotificationsService);
    });

    it('should throw error when accessing service before initialization', () => {
      const exports = module.exports;
      expect(() => exports.service()).toThrow('Notifications module not initialized');
    });
  });

  describe('Notifications Service', () => {
    let service: NotificationsService;

    beforeEach(async () => {
      service = NotificationsService.getInstance();
      await service.initialize();
    });

    it('should create a new notification', async () => {
      const mockResult = {
        id: 'test-id',
        name: 'Test Notification',
        description: 'Test description',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const repository = NotificationsRepository.getInstance();
      vi.spyOn(repository, 'create').mockResolvedValue(mockResult);

      const result = await service.create({
        name: 'Test Notification',
        description: 'Test description'
      });

      expect(result).toEqual(mockResult);
    });

    it('should validate required fields on create', async () => {
      await expect(service.create({ name: '' })).rejects.toThrow('Name is required');
    });

    it('should get notification by ID', async () => {
      const mockResult = {
        id: 'test-id',
        name: 'Test Notification',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const repository = NotificationsRepository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(mockResult as any);

      const result = await service.getById('test-id');
      expect(result).toEqual(mockResult);
    });

    it('should get all notifications', async () => {
      const mockResults = [
        {
          id: 'test-1',
          name: 'Test 1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'test-2',
          name: 'Test 2',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const repository = NotificationsRepository.getInstance();
      vi.spyOn(repository, 'findAll').mockResolvedValue(mockResults as any);

      const results = await service.getAll();
      expect(results).toHaveLength(2);
      expect(results).toEqual(mockResults);
    });

    it('should update notification', async () => {
      const existing = {
        id: 'test-id',
        name: 'Original Name',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updated = {
        ...existing,
        name: 'Updated Name',
        updatedAt: new Date()
      };

      const repository = NotificationsRepository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(existing as any);
      vi.spyOn(repository, 'update').mockResolvedValue(updated as any);

      const result = await service.update('test-id', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw error when updating non-existent notification', async () => {
      const repository = NotificationsRepository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'Test' }))
        .rejects.toThrow('Notification not found');
    });

    it('should delete notification', async () => {
      const existing = {
        id: 'test-id',
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const repository = NotificationsRepository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(existing as any);
      vi.spyOn(repository, 'delete').mockResolvedValue(undefined);

      await expect(service.delete('test-id')).resolves.not.toThrow();
    });

    it('should throw error when deleting non-existent notification', async () => {
      const repository = NotificationsRepository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(null);

      await expect(service.delete('non-existent'))
        .rejects.toThrow('Notification not found');
    });
  });
});