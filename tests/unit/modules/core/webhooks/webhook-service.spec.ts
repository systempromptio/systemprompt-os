/**
 * @fileoverview Unit tests for webhook service
 * @module tests/unit/modules/core/webhooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookService } from '../../../../../src/modules/core/webhooks/services/webhook-service.js';
import type { WebhookRepository } from '../../../../../src/modules/core/webhooks/repositories/webhook-repository.js';
import type { WebhookDeliveryService } from '../../../../../src/modules/core/webhooks/services/webhook-delivery-service.js';
import type { CreateWebhookDto } from '../../../../../src/modules/core/webhooks/types/webhook.types.js';

describe('WebhookService', () => {
  let service: WebhookService;
  let mockRepository: jest.Mocked<WebhookRepository>;
  let mockDeliveryService: jest.Mocked<WebhookDeliveryService>;
  let mockLogger: any;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      createWebhook: vi.fn(),
      getWebhook: vi.fn(),
      listWebhooks: vi.fn(),
      updateWebhook: vi.fn(),
      deleteWebhook: vi.fn(),
      getWebhooksByEvent: vi.fn(),
      getWebhookStats: vi.fn(),
      getWebhookDeliveries: vi.fn(),
      recordDelivery: vi.fn(),
      cleanupOldDeliveries: vi.fn()
    } as any;

    // Mock delivery service
    mockDeliveryService = {
      deliver: vi.fn(),
      deliverOnce: vi.fn(),
      cancelDelivery: vi.fn(),
      cancelAllDeliveries: vi.fn()
    } as any;

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    service = new WebhookService(mockRepository, mockDeliveryService, mockLogger);
  });

  describe('createWebhook', () => {
    it('should create a webhook successfully', async () => {
      const createDto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['agent.started', 'agent.failed'],
        method: 'POST'
      };

      const mockWebhook = {
        id: 'wh_123',
        ...createDto,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRepository.createWebhook.mockResolvedValue(mockWebhook as any);

      const result = await service.createWebhook(createDto);

      expect(result).toEqual(mockWebhook);
      expect(mockRepository.createWebhook).toHaveBeenCalledWith(createDto);
      expect(mockLogger.info).toHaveBeenCalledWith('Webhook created', expect.any(Object));
    });

    it('should reject invalid URL', async () => {
      const createDto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'not-a-valid-url',
        events: ['agent.started']
      };

      await expect(service.createWebhook(createDto)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should reject empty events array', async () => {
      const createDto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: []
      };

      await expect(service.createWebhook(createDto)).rejects.toThrow('At least one event must be specified');
    });
  });

  describe('triggerWebhook', () => {
    it('should trigger webhooks for an event', async () => {
      const mockWebhooks = [
        {
          id: 'wh_1',
          name: 'Webhook 1',
          url: 'https://example1.com',
          events: ['agent.started']
        },
        {
          id: 'wh_2',
          name: 'Webhook 2',
          url: 'https://example2.com',
          events: ['agent.started']
        }
      ];

      mockRepository.getWebhooksByEvent.mockResolvedValue(mockWebhooks as any);
      mockDeliveryService.deliver.mockResolvedValue(undefined);

      await service.triggerWebhook('agent.started', { agent_id: '123' });

      expect(mockRepository.getWebhooksByEvent).toHaveBeenCalledWith('agent.started');
      expect(mockDeliveryService.deliver).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Webhooks triggered', expect.any(Object));
    });

    it('should handle no webhooks for event', async () => {
      mockRepository.getWebhooksByEvent.mockResolvedValue([]);

      await service.triggerWebhook('agent.started', { agent_id: '123' });

      expect(mockDeliveryService.deliver).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('No webhooks subscribed to event', { event: 'agent.started' });
    });

    it('should not throw on delivery errors', async () => {
      const mockWebhook = {
        id: 'wh_1',
        name: 'Webhook 1',
        url: 'https://example.com',
        events: ['agent.started']
      };

      mockRepository.getWebhooksByEvent.mockResolvedValue([mockWebhook as any]);
      mockDeliveryService.deliver.mockRejectedValue(new Error('Delivery failed'));

      // Should not throw
      await service.triggerWebhook('agent.started', { agent_id: '123' });

      expect(mockLogger.info).toHaveBeenCalledWith('Webhooks triggered', expect.any(Object));
    });
  });

  describe('testWebhook', () => {
    it('should test a webhook successfully', async () => {
      const mockWebhook = {
        id: 'wh_123',
        name: 'Test Webhook',
        url: 'https://example.com/webhook'
      };

      const mockResult = {
        success: true,
        status_code: 200,
        duration: 150
      };

      mockRepository.getWebhook.mockResolvedValue(mockWebhook as any);
      mockDeliveryService.deliverOnce.mockResolvedValue(mockResult);

      const result = await service.testWebhook('wh_123');

      expect(result).toEqual(mockResult);
      expect(mockDeliveryService.deliverOnce).toHaveBeenCalledWith(
        mockWebhook,
        expect.objectContaining({
          webhook_id: 'wh_123',
          event: 'custom',
          data: expect.objectContaining({ test: true })
        })
      );
    });

    it('should handle webhook not found', async () => {
      mockRepository.getWebhook.mockResolvedValue(null);

      await expect(service.testWebhook('wh_123')).rejects.toThrow('Webhook not found');
    });
  });

  describe('updateWebhook', () => {
    it('should update a webhook', async () => {
      const mockWebhook = {
        id: 'wh_123',
        name: 'Updated Webhook',
        url: 'https://example.com/webhook'
      };

      mockRepository.updateWebhook.mockResolvedValue(mockWebhook as any);

      const result = await service.updateWebhook('wh_123', { name: 'Updated Webhook' });

      expect(result).toEqual(mockWebhook);
      expect(mockRepository.updateWebhook).toHaveBeenCalledWith('wh_123', { name: 'Updated Webhook' });
      expect(mockLogger.info).toHaveBeenCalledWith('Webhook updated', expect.any(Object));
    });

    it('should validate URL when updating', async () => {
      await expect(service.updateWebhook('wh_123', { url: 'invalid-url' })).rejects.toThrow();
    });
  });

  describe('deleteWebhook', () => {
    it('should delete a webhook', async () => {
      mockRepository.deleteWebhook.mockResolvedValue(true);

      const result = await service.deleteWebhook('wh_123');

      expect(result).toBe(true);
      expect(mockRepository.deleteWebhook).toHaveBeenCalledWith('wh_123');
      expect(mockLogger.info).toHaveBeenCalledWith('Webhook deleted', { webhookId: 'wh_123' });
    });
  });

  describe('getWebhook', () => {
    it('should get a webhook by ID', async () => {
      const mockWebhook = {
        id: 'wh_123',
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['agent.started'],
        status: 'active'
      };

      mockRepository.getWebhook.mockResolvedValue(mockWebhook as any);

      const result = await service.getWebhook('wh_123');

      expect(result).toEqual(mockWebhook);
      expect(mockRepository.getWebhook).toHaveBeenCalledWith('wh_123');
    });

    it('should return null when webhook not found', async () => {
      mockRepository.getWebhook.mockResolvedValue(null);

      const result = await service.getWebhook('nonexistent');

      expect(result).toBeNull();
      expect(mockRepository.getWebhook).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('listWebhooks', () => {
    it('should list webhooks without options', async () => {
      const mockWebhooks = [
        { id: 'wh_1', name: 'Webhook 1' },
        { id: 'wh_2', name: 'Webhook 2' }
      ];

      mockRepository.listWebhooks.mockResolvedValue(mockWebhooks as any);

      const result = await service.listWebhooks();

      expect(result).toEqual(mockWebhooks);
      expect(mockRepository.listWebhooks).toHaveBeenCalledWith(undefined);
    });

    it('should list webhooks with options', async () => {
      const mockWebhooks = [{ id: 'wh_1', name: 'Active Webhook' }];
      const options = { status: 'active', limit: 10, offset: 0 };

      mockRepository.listWebhooks.mockResolvedValue(mockWebhooks as any);

      const result = await service.listWebhooks(options);

      expect(result).toEqual(mockWebhooks);
      expect(mockRepository.listWebhooks).toHaveBeenCalledWith(options);
    });
  });

  describe('getWebhookStats', () => {
    it('should get webhook statistics', async () => {
      const mockStats = {
        total_webhooks: 5,
        active_webhooks: 4,
        total_deliveries: 100,
        successful_deliveries: 95,
        failed_deliveries: 5,
        success_rate: 0.95
      };

      mockRepository.getWebhookStats.mockResolvedValue(mockStats);

      const result = await service.getWebhookStats();

      expect(result).toEqual(mockStats);
      expect(mockRepository.getWebhookStats).toHaveBeenCalled();
    });
  });

  describe('getWebhookDeliveries', () => {
    it('should get webhook deliveries without options', async () => {
      const mockDeliveries = [
        { id: 'del_1', webhook_id: 'wh_123', status: 'delivered' },
        { id: 'del_2', webhook_id: 'wh_123', status: 'failed' }
      ];

      mockRepository.getWebhookDeliveries.mockResolvedValue(mockDeliveries as any);

      const result = await service.getWebhookDeliveries('wh_123');

      expect(result).toEqual(mockDeliveries);
      expect(mockRepository.getWebhookDeliveries).toHaveBeenCalledWith('wh_123', undefined);
    });

    it('should get webhook deliveries with options', async () => {
      const mockDeliveries = [{ id: 'del_1', webhook_id: 'wh_123', status: 'delivered' }];
      const options = { limit: 5, offset: 10 };

      mockRepository.getWebhookDeliveries.mockResolvedValue(mockDeliveries as any);

      const result = await service.getWebhookDeliveries('wh_123', options);

      expect(result).toEqual(mockDeliveries);
      expect(mockRepository.getWebhookDeliveries).toHaveBeenCalledWith('wh_123', options);
    });
  });

  describe('createWebhook - additional error scenarios', () => {
    it('should handle repository errors during creation', async () => {
      const createDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['agent.started']
      };

      mockRepository.createWebhook.mockRejectedValue(new Error('Database error'));

      await expect(service.createWebhook(createDto)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create webhook', expect.any(Object));
    });

    it('should handle non-Error objects thrown during creation', async () => {
      const createDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['agent.started']
      };

      mockRepository.createWebhook.mockRejectedValue('String error');

      await expect(service.createWebhook(createDto)).rejects.toBe('String error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create webhook', 
        expect.objectContaining({ error: 'String error' })
      );
    });

    it('should validate http URLs as valid', async () => {
      const createDto = {
        name: 'Test Webhook',
        url: 'http://example.com/webhook',
        events: ['agent.started']
      };

      const mockWebhook = { id: 'wh_123', ...createDto };
      mockRepository.createWebhook.mockResolvedValue(mockWebhook as any);

      const result = await service.createWebhook(createDto);

      expect(result).toBeDefined();
      expect(mockRepository.createWebhook).toHaveBeenCalledWith(createDto);
    });

    it('should reject URLs with invalid protocols', async () => {
      const createDto = {
        name: 'Test Webhook',
        url: 'ftp://example.com/webhook',
        events: ['agent.started']
      };

      await expect(service.createWebhook(createDto)).rejects.toThrow('Invalid webhook URL');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateWebhook - additional scenarios', () => {
    it('should handle repository errors during update', async () => {
      mockRepository.updateWebhook.mockRejectedValue(new Error('Database error'));

      await expect(service.updateWebhook('wh_123', { name: 'Updated' })).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update webhook', expect.any(Object));
    });

    it('should handle non-Error objects thrown during update', async () => {
      mockRepository.updateWebhook.mockRejectedValue('String error');

      await expect(service.updateWebhook('wh_123', { name: 'Updated' })).rejects.toBe('String error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update webhook', 
        expect.objectContaining({ error: 'String error' })
      );
    });

    it('should reject empty events array when updating', async () => {
      await expect(service.updateWebhook('wh_123', { events: [] })).rejects.toThrow('At least one event must be specified');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate http URLs as valid when updating', async () => {
      const mockWebhook = { id: 'wh_123', url: 'http://example.com/webhook' };
      mockRepository.updateWebhook.mockResolvedValue(mockWebhook as any);

      const result = await service.updateWebhook('wh_123', { url: 'http://example.com/webhook' });

      expect(result).toBeDefined();
      expect(mockRepository.updateWebhook).toHaveBeenCalledWith('wh_123', { url: 'http://example.com/webhook' });
    });

    it('should reject URLs with invalid protocols when updating', async () => {
      await expect(service.updateWebhook('wh_123', { url: 'ftp://example.com/webhook' })).rejects.toThrow('Invalid webhook URL');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('deleteWebhook - additional scenarios', () => {
    it('should handle when webhook deletion returns false', async () => {
      mockRepository.deleteWebhook.mockResolvedValue(false);

      const result = await service.deleteWebhook('wh_123');

      expect(result).toBe(false);
      expect(mockRepository.deleteWebhook).toHaveBeenCalledWith('wh_123');
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('triggerWebhook - additional scenarios', () => {
    it('should handle repository errors when getting webhooks by event', async () => {
      mockRepository.getWebhooksByEvent.mockRejectedValue(new Error('Database error'));

      await expect(service.triggerWebhook('agent.started', { data: 'test' })).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to trigger webhooks', expect.any(Object));
    });

    it('should handle non-Error objects thrown when getting webhooks by event', async () => {
      mockRepository.getWebhooksByEvent.mockRejectedValue('String error');

      await expect(service.triggerWebhook('agent.started', { data: 'test' })).rejects.toBe('String error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to trigger webhooks', 
        expect.objectContaining({ error: 'String error' })
      );
    });

    it('should log individual delivery errors without failing the entire trigger', async () => {
      const mockWebhooks = [
        { id: 'wh_1', name: 'Webhook 1', url: 'https://example1.com', events: ['agent.started'] },
        { id: 'wh_2', name: 'Webhook 2', url: 'https://example2.com', events: ['agent.started'] }
      ];

      mockRepository.getWebhooksByEvent.mockResolvedValue(mockWebhooks as any);
      mockDeliveryService.deliver
        .mockRejectedValueOnce(new Error('Delivery failed'))
        .mockResolvedValueOnce(undefined);

      await service.triggerWebhook('agent.started', { agent_id: '123' });

      expect(mockLogger.error).toHaveBeenCalledWith('Webhook delivery failed', expect.objectContaining({
        webhookId: 'wh_1',
        error: 'Delivery failed'
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('Webhooks triggered', expect.any(Object));
    });

    it('should handle non-Error delivery failures', async () => {
      const mockWebhook = {
        id: 'wh_1',
        name: 'Webhook 1',
        url: 'https://example.com',
        events: ['agent.started']
      };

      mockRepository.getWebhooksByEvent.mockResolvedValue([mockWebhook as any]);
      mockDeliveryService.deliver.mockRejectedValue('String error');

      await service.triggerWebhook('agent.started', { agent_id: '123' });

      expect(mockLogger.error).toHaveBeenCalledWith('Webhook delivery failed', expect.objectContaining({
        webhookId: 'wh_1',
        error: 'String error'
      }));
    });
  });

  describe('cleanupOldDeliveries', () => {
    it('should cleanup old deliveries', async () => {
      mockRepository.cleanupOldDeliveries.mockResolvedValue(50);

      const result = await service.cleanupOldDeliveries(30);

      expect(result).toBe(50);
      expect(mockRepository.cleanupOldDeliveries).toHaveBeenCalledWith(30);
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up old webhook deliveries', {
        deleted: 50,
        retentionDays: 30
      });
    });

    it('should not log if no deliveries cleaned', async () => {
      mockRepository.cleanupOldDeliveries.mockResolvedValue(0);

      await service.cleanupOldDeliveries(30);

      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });
});