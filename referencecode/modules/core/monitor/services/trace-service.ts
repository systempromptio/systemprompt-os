/**
 * @fileoverview Distributed tracing service
 * @module modules/core/monitor/services
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { MonitorRepository } from '../repositories/monitor-repository.js';
import type { Trace, TraceEvent } from '../types/monitor.types.js';

export class TraceService extends EventEmitter {
  private readonly activeSpans: Map<string, Trace> = new Map();

  constructor(
    private readonly repository: MonitorRepository,
    private readonly logger: any,
    private readonly config: any,
  ) {
    super();
  }

  async initialize(): Promise<void> {
    this.logger?.info('Trace service initialized');
  }

  async shutdown(): Promise<void> {
    // Complete any active spans
    for (const [spanId, _trace] of this.activeSpans) {
      await this.endSpan(spanId, 'cancelled');
    }
  }

  // Start a new trace span
  startSpan(
    operationName: string,
    options: {
      traceId?: string;
      parentSpanId?: string;
      serviceName?: string;
      attributes?: Record<string, any>;
    } = {},
  ): string {
    const spanId = randomUUID();
    const traceId = options.traceId || randomUUID();

    const trace: Trace = {
      id: randomUUID(),
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: options.parentSpanId,
      operation_name: operationName,
      service_name: options.serviceName || this.config?.serviceName || 'monitor',
      start_time: new Date(),
      status: 'ok',
      attributes: options.attributes || {},
      events: [],
      links: [],
    };

    this.activeSpans.set(spanId, trace);
    this.emit('span:started', trace);

    return spanId;
  }

  // End a span
  async endSpan(
    spanId: string,
    status: 'ok' | 'error' | 'cancelled' = 'ok',
    error?: Error,
  ): Promise<void> {
    const trace = this.activeSpans.get(spanId);
    if (!trace) {
      this.logger?.warn('Attempted to end non-existent span', { spanId });
      return;
    }

    trace.end_time = new Date();
    trace.duration = trace.end_time.getTime() - trace.start_time.getTime();
    trace.status = status;

    if (error) {
      trace.attributes['error'] = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    // Apply sampling
    const samplingRate = this.config?.traces?.sampling || 1.0;
    if (Math.random() <= samplingRate) {
      await this.repository.recordTrace(trace);
      this.emit('span:recorded', trace);
    }

    this.activeSpans.delete(spanId);
    this.emit('span:ended', trace);
  }

  // Add event to span
  addEvent(spanId: string, name: string, attributes: Record<string, any> = {}): void {
    const trace = this.activeSpans.get(spanId);
    if (!trace) {
      this.logger?.warn('Attempted to add event to non-existent span', { spanId });
      return;
    }

    const event: TraceEvent = {
      timestamp: new Date(),
      name,
      attributes,
    };

    trace.events.push(event);
    this.emit('span:event', { spanId, event });
  }

  // Set span attributes
  setAttributes(spanId: string, attributes: Record<string, any>): void {
    const trace = this.activeSpans.get(spanId);
    if (!trace) {
      this.logger?.warn('Attempted to set attributes on non-existent span', { spanId });
      return;
    }

    Object.assign(trace.attributes, attributes);
  }

  // Get recent traces
  async getTraces(limit: number = 100): Promise<Trace[]> {
    return this.repository.getTraces(limit);
  }

  // Get trace by ID
  async getTrace(traceId: string): Promise<Trace[]> {
    return this.repository.getTraceById(traceId);
  }

  // Create a traced function wrapper
  traced<T extends (...args: any[]) => any>(
    operationName: string,
    fn: T,
    options?: {
      serviceName?: string;
      extractAttributes?: (...args: Parameters<T>) => Record<string, any>;
    },
  ): T {
    const service = this;

    return async function tracedFunction(...args: Parameters<T>): Promise<ReturnType<T>> {
      const spanId = service.startSpan(operationName, {
        serviceName: options?.serviceName,
        attributes: options?.extractAttributes ? options.extractAttributes(...args) : {},
      });

      try {
        const result = await fn(...args);
        await service.endSpan(spanId, 'ok');
        return result;
      } catch (error) {
        await service.endSpan(spanId, 'error', error as Error);
        throw error;
      }
    } as T;
  }

  // Cleanup old traces
  async cleanupOldTraces(retentionDays: number): Promise<void> {
    try {
      await this.repository.deleteOldTraces(retentionDays);
      this.logger?.info('Cleaned up old traces', { retentionDays });
    } catch (error) {
      this.logger?.error('Failed to cleanup old traces', { error });
      throw error;
    }
  }

  // Get trace statistics
  async getTraceStats(): Promise<any> {
    return this.repository.getTraceStats();
  }
}
