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