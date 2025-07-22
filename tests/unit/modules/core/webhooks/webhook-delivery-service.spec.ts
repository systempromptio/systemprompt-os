/**
 * @fileoverview Unit tests for webhook delivery service
 * @module tests/unit/modules/core/webhooks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebhookDeliveryService } from '../../../../../src/modules/core/webhooks/services/webhook-delivery-service.js';
import type { WebhookRepository } from '../../../../../src/modules/core/webhooks/repositories/webhook-repository.js';
import type { WebhookConfig, WebhookPayload } from '../../../../../src/modules/core/webhooks/types/webhook.types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;
  let mockRepository: jest.Mocked<WebhookRepository>;
  let mockLogger: any;

  beforeEach(() => {
    // Reset fetch mock
    vi.clearAllMocks();
    (global.fetch as any).mockReset();

    // Mock repository
    mockRepository = {
      recordDelivery: vi.fn()
    } as any;

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    service = new WebhookDeliveryService(mockRepository, mockLogger);
  });

  afterEach(() => {
    // Clear all timers
    vi.clearAllTimers();
  });

  describe('deliverOnce', () => {
    it('should deliver webhook successfully', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        method: 'POST',
        events: ['test.event'],
        headers: { 'X-Custom': 'value' },
        status: 'active',
        timeout: 5000,
        created_at: new Date(),
        updated_at: new Date()
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: { test: true }
      };

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"success":true}'),
        headers: new Map([['content-type', 'application/json']])
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await service.deliverOnce(mockWebhook, mockPayload);

      expect(result.success).toBe(true);
      expect(result.status_code).toBe(200);
      expect(result.response_body).toBe('{"success":true}');
      expect(result.duration).toBeGreaterThanOrEqual(0);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'value',
            'X-Webhook-Event': 'test.event'
          }),
          body: JSON.stringify(mockPayload)
        })
      );
    });

    it('should handle request timeout', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        timeout: 100,
        status: 'active'
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      // Mock fetch to reject with abort error
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (global.fetch as any).mockRejectedValue(abortError);

      const result = await service.deliverOnce(mockWebhook, mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');
    });

    it('should include authentication headers', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        auth: {
          type: 'bearer',
          credentials: { token: 'secret-token' }
        },
        status: 'active'
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
        headers: new Map()
      });

      await service.deliverOnce(mockWebhook, mockPayload);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer secret-token'
          })
        })
      );
    });
  });

  describe('deliver', () => {
    it('should skip inactive webhooks', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        status: 'inactive'
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      await service.deliver(mockWebhook, mockPayload);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Skipping inactive webhook', { webhookId: 'wh_123' });
    });

    it('should record successful delivery', async () => {
      vi.useFakeTimers();

      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active',
        retry: { enabled: false }
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
        headers: new Map()
      });

      await service.deliver(mockWebhook, mockPayload);

      // Allow async operations to complete
      await vi.runAllTimersAsync();

      expect(mockRepository.recordDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          webhook_id: 'wh_123',
          success: true,
          status_code: 200
        })
      );

      vi.useRealTimers();
    });

    it('should handle delivery with retry enabled', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active',
        retry: {
          enabled: true,
          max_attempts: 2,
          strategy: 'exponential',
          initial_delay: 100,
          multiplier: 2
        }
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      // Mock successful response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
        headers: new Map()
      });

      // Start delivery - should not throw
      await expect(service.deliver(mockWebhook, mockPayload)).resolves.not.toThrow();
    });
  });

  describe('cancelDelivery', () => {
    it('should cancel active deliveries for webhook', async () => {
      // Add a fake active delivery
      const controller = new AbortController();
      (service as any).activeDeliveries.set('wh_123_test_12345', controller);

      const abortSpy = vi.spyOn(controller, 'abort');

      await service.cancelDelivery('wh_123');

      expect(abortSpy).toHaveBeenCalled();
      expect((service as any).activeDeliveries.size).toBe(0);
    });
  });

  describe('cancelAllDeliveries', () => {
    it('should cancel all active deliveries', async () => {
      // Add multiple fake active deliveries
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      (service as any).activeDeliveries.set('wh_123_test_12345', controller1);
      (service as any).activeDeliveries.set('wh_456_test_67890', controller2);

      const abortSpy1 = vi.spyOn(controller1, 'abort');
      const abortSpy2 = vi.spyOn(controller2, 'abort');

      await service.cancelAllDeliveries();

      expect(abortSpy1).toHaveBeenCalled();
      expect(abortSpy2).toHaveBeenCalled();
      expect((service as any).activeDeliveries.size).toBe(0);
    });
  });
});