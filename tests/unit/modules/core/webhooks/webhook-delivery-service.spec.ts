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

    it('should handle HTTP error responses', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active'
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: vi.fn().mockResolvedValue('Page not found'),
        headers: new Map()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await service.deliverOnce(mockWebhook, mockPayload);

      expect(result.success).toBe(false);
      expect(result.status_code).toBe(404);
      expect(result.response_body).toBe('Page not found');
      expect(result.error).toBe('HTTP 404: Not Found');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle network errors', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active'
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      const networkError = new Error('Network connection failed');
      (global.fetch as any).mockRejectedValue(networkError);

      const result = await service.deliverOnce(mockWebhook, mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network connection failed');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle unknown error types', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active'
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      // Mock a non-Error object being thrown
      (global.fetch as any).mockRejectedValue('string error');

      const result = await service.deliverOnce(mockWebhook, mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
      expect(result.duration).toBeGreaterThanOrEqual(0);
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

    it('should include bearer authentication headers', async () => {
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

    it('should include basic authentication headers', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        auth: {
          type: 'basic',
          credentials: { username: 'user', password: 'pass' }
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

      const expectedAuth = Buffer.from('user:pass').toString('base64');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Basic ${expectedAuth}`
          })
        })
      );
    });

    it('should include API key authentication headers', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        auth: {
          type: 'api_key',
          credentials: { api_key: 'my-api-key' }
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
            'X-API-Key': 'my-api-key'
          })
        })
      );
    });

    it('should handle authentication with missing bearer token', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        auth: {
          type: 'bearer',
          credentials: {} // Missing token
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
          headers: expect.not.objectContaining({
            'Authorization': expect.anything()
          })
        })
      );
    });

    it('should handle authentication with missing basic credentials', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        auth: {
          type: 'basic',
          credentials: { username: 'user' } // Missing password
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
          headers: expect.not.objectContaining({
            'Authorization': expect.anything()
          })
        })
      );
    });

    it('should handle authentication with missing API key', async () => {
      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        auth: {
          type: 'api_key',
          credentials: {} // Missing api_key
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
          headers: expect.not.objectContaining({
            'X-API-Key': expect.anything()
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

    it('should handle delivery with retry enabled - success on first attempt', async () => {
      vi.useFakeTimers();

      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active',
        retry: {
          enabled: true,
          max_attempts: 3,
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

      // Mock successful response on first attempt
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
        headers: new Map()
      });

      const deliverPromise = service.deliver(mockWebhook, mockPayload);
      await vi.runAllTimersAsync();
      await deliverPromise;

      expect(mockRepository.recordDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          webhook_id: 'wh_123',
          attempt: 1,
          success: true,
          status_code: 200
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook delivered successfully',
        expect.objectContaining({
          webhookId: 'wh_123',
          attempt: 1
        })
      );

      vi.useRealTimers();
    });

    it('should handle delivery with retry - failure then success', async () => {
      vi.useFakeTimers();

      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active',
        retry: {
          enabled: true,
          max_attempts: 3,
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

      // Mock failure then success
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: vi.fn().mockResolvedValue('Server Error'),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
          headers: new Map()
        });

      const deliverPromise = service.deliver(mockWebhook, mockPayload);
      await vi.runAllTimersAsync();
      await deliverPromise;

      expect(mockRepository.recordDelivery).toHaveBeenCalledTimes(2);
      expect(mockRepository.recordDelivery).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          webhook_id: 'wh_123',
          attempt: 1,
          success: false,
          status_code: 500
        })
      );
      expect(mockRepository.recordDelivery).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          webhook_id: 'wh_123',
          attempt: 2,
          success: true,
          status_code: 200
        })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Webhook delivery failed, retrying',
        expect.objectContaining({
          webhookId: 'wh_123',
          attempt: 1,
          nextAttemptIn: 100
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook delivered successfully',
        expect.objectContaining({
          webhookId: 'wh_123',
          attempt: 2
        })
      );

      vi.useRealTimers();
    });

    it('should handle delivery with retry - all attempts fail', async () => {
      vi.useFakeTimers();

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

      // Mock all failures
      (global.fetch as any)
        .mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: vi.fn().mockResolvedValue('Server Error'),
          headers: new Map()
        });

      const deliverPromise = service.deliver(mockWebhook, mockPayload);
      await vi.runAllTimersAsync();
      await deliverPromise;

      expect(mockRepository.recordDelivery).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed after all retry attempts',
        expect.objectContaining({
          webhookId: 'wh_123',
          attempts: 2,
          finalError: 'HTTP 500: Internal Server Error',
          finalStatusCode: 500
        })
      );

      vi.useRealTimers();
    });

    it('should handle linear retry strategy', async () => {
      vi.useFakeTimers();

      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active',
        retry: {
          enabled: true,
          max_attempts: 3,
          strategy: 'linear',
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

      // Mock failure then success on third attempt
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: vi.fn().mockResolvedValue('Server Error'),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: vi.fn().mockResolvedValue('Server Error'),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
          headers: new Map()
        });

      const deliverPromise = service.deliver(mockWebhook, mockPayload);
      await vi.runAllTimersAsync();
      await deliverPromise;

      expect(mockRepository.recordDelivery).toHaveBeenCalledTimes(3);

      // Check that retry warnings were logged with consistent delay for linear strategy
      expect(mockLogger.warn).toHaveBeenNthCalledWith(1,
        'Webhook delivery failed, retrying',
        expect.objectContaining({
          nextAttemptIn: 100
        })
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(2,
        'Webhook delivery failed, retrying',
        expect.objectContaining({
          nextAttemptIn: 100 // Should remain the same for linear strategy
        })
      );

      vi.useRealTimers();
    });

    it('should record failed delivery for single delivery', async () => {
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
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: vi.fn().mockResolvedValue('Page not found'),
        headers: new Map()
      });

      await service.deliver(mockWebhook, mockPayload);

      expect(mockRepository.recordDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          webhook_id: 'wh_123',
          success: false,
          status_code: 404,
          error: 'HTTP 404: Not Found'
        })
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.objectContaining({
          webhookId: 'wh_123',
          error: 'HTTP 404: Not Found',
          statusCode: 404
        })
      );
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cancelled active deliveries for webhook',
        {
          webhookId: 'wh_123',
          cancelledCount: 1
        }
      );
    });

    it('should handle webhook with no active deliveries', async () => {
      await service.cancelDelivery('wh_nonexistent');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cancelled active deliveries for webhook',
        {
          webhookId: 'wh_nonexistent',
          cancelledCount: 0
        }
      );
    });

    it('should only cancel deliveries for specific webhook', async () => {
      // Add multiple fake active deliveries for different webhooks
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const controller3 = new AbortController();
      (service as any).activeDeliveries.set('wh_123_test_12345', controller1);
      (service as any).activeDeliveries.set('wh_456_test_67890', controller2);
      (service as any).activeDeliveries.set('wh_123_test_11111', controller3);

      const abortSpy1 = vi.spyOn(controller1, 'abort');
      const abortSpy2 = vi.spyOn(controller2, 'abort');
      const abortSpy3 = vi.spyOn(controller3, 'abort');

      await service.cancelDelivery('wh_123');

      expect(abortSpy1).toHaveBeenCalled();
      expect(abortSpy2).not.toHaveBeenCalled();
      expect(abortSpy3).toHaveBeenCalled();
      expect((service as any).activeDeliveries.size).toBe(1); // Only wh_456 should remain
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cancelled active deliveries for webhook',
        {
          webhookId: 'wh_123',
          cancelledCount: 2
        }
      );
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cancelled all active deliveries',
        {
          cancelledCount: 2
        }
      );
    });

    it('should handle case with no active deliveries', async () => {
      await service.cancelAllDeliveries();

      expect((service as any).activeDeliveries.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cancelled all active deliveries',
        {
          cancelledCount: 0
        }
      );
    });
  });

  describe('retry configuration defaults', () => {
    it('should use default retry configuration values', async () => {
      vi.useFakeTimers();

      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active',
        retry: {
          enabled: true
          // All other properties undefined to test defaults
        }
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(), 
        data: {}
      };

      // Mock failures to trigger retry logic
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error', 
          text: vi.fn().mockResolvedValue('Error'),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
          headers: new Map()
        });

      const deliverPromise = service.deliver(mockWebhook, mockPayload);
      await vi.runAllTimersAsync();
      await deliverPromise;

      // Should have used default values:
      // max_attempts: 3 (we only fail once, then succeed)
      // strategy: 'exponential'
      // initial_delay: 1000
      // multiplier: 2
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Webhook delivery failed, retrying',
        expect.objectContaining({
          webhookId: 'wh_123',
          attempt: 1,
          nextAttemptIn: 1000 // Default initial_delay
        })
      );

      expect(mockRepository.recordDelivery).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should handle retry with max delay limit', async () => {
      vi.useFakeTimers();

      const mockWebhook: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        method: 'POST',
        status: 'active',
        retry: {
          enabled: true,
          max_attempts: 4,
          strategy: 'exponential',
          initial_delay: 30000, // Large initial delay
          multiplier: 3,
          max_delay: 60000 // Should limit the exponential growth
        }
      } as any;

      const mockPayload: WebhookPayload = {
        webhook_id: 'wh_123',
        event: 'test.event',
        timestamp: new Date(),
        data: {}
      };

      // Mock failures to trigger multiple retries
      (global.fetch as any)
        .mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: vi.fn().mockResolvedValue('Error'),
          headers: new Map()
        });

      const deliverPromise = service.deliver(mockWebhook, mockPayload);
      await vi.runAllTimersAsync();
      await deliverPromise;

      // Should have attempted 4 times (max_attempts)
      expect(mockRepository.recordDelivery).toHaveBeenCalledTimes(4);
      
      // Check that delays were capped at max_delay
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Webhook delivery failed, retrying',
        expect.objectContaining({
          attempt: 1,
          nextAttemptIn: 30000 // initial_delay
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Webhook delivery failed, retrying',
        expect.objectContaining({
          attempt: 2,
          nextAttemptIn: 60000 // Should be capped at max_delay (not 30000 * 3 = 90000)
        })
      );

      vi.useRealTimers();
    });
  });
});