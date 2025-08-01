/**
 * Events repository for database operations.
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IEventsRow, IEventSubscriptionsRow } from '@/modules/core/events/types/database.generated';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

export class EventsRepository {
  private static instance: EventsRepository | null = null;
  private readonly db: DatabaseService;
  private readonly logger: ILogger;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.logger = LoggerService.getInstance();
  }

  /**
   * Get singleton instance of EventsRepository.
   */
  static getInstance(): EventsRepository {
    EventsRepository.instance ??= new EventsRepository();
    return EventsRepository.instance;
  }

  /**
   * Persist an event to the database.
   */
  async createEvent(eventName: string, eventData: unknown, moduleSource?: string): Promise<IEventsRow> {
    try {
      const result = await this.db.execute(
        `INSERT INTO events (event_name, event_data, module_source) VALUES (?, ?, ?) RETURNING *`,
        [
          eventName,
          JSON.stringify(eventData),
          moduleSource || 'system'
        ]
      );

      if (!result || result.length === 0) {
        throw new Error('Failed to create event - no data returned');
      }

      return result[0] as IEventsRow;
    } catch (error) {
      this.logger.error(LogSource.DATABASE, 'Failed to create event', { 
        eventName, 
        moduleSource,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get recent events.
   */
  async getRecentEvents(limit: number = 10): Promise<IEventsRow[]> {
    try {
      const result = await this.db.query<IEventsRow>(
        'SELECT * FROM events ORDER BY emitted_at DESC LIMIT ?',
        [limit]
      );
      return result;
    } catch (error) {
      this.logger.error(LogSource.DATABASE, 'Failed to get recent events', { 
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get events by name.
   */
  async getEventsByName(eventName: string, limit: number = 10): Promise<IEventsRow[]> {
    try {
      const result = await this.db.query<IEventsRow>(
        'SELECT * FROM events WHERE event_name = ? ORDER BY emitted_at DESC LIMIT ?',
        [eventName, limit]
      );
      return result;
    } catch (error) {
      this.logger.error(LogSource.DATABASE, 'Failed to get events by name', { 
        eventName,
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create event subscription record.
   */
  async createSubscription(
    eventName: string, 
    subscriberModule: string, 
    handlerName?: string
  ): Promise<IEventSubscriptionsRow> {
    try {
      const result = await this.db.execute(
        `INSERT INTO event_subscriptions (event_name, subscriber_module, handler_name) VALUES (?, ?, ?) RETURNING *`,
        [eventName, subscriberModule, handlerName]
      );

      if (!result || result.length === 0) {
        throw new Error('Failed to create subscription - no data returned');
      }

      return result[0] as IEventSubscriptionsRow;
    } catch (error) {
      this.logger.error(LogSource.DATABASE, 'Failed to create subscription', { 
        eventName, 
        subscriberModule,
        handlerName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get active subscriptions.
   */
  async getActiveSubscriptions(): Promise<Array<{ event_name: string; subscriber_count: number }>> {
    try {
      const result = await this.db.query<{ event_name: string; subscriber_count: number }>(
        `SELECT event_name, COUNT(*) as subscriber_count 
         FROM event_subscriptions 
         WHERE active = TRUE 
         GROUP BY event_name`
      );
      return result;
    } catch (error) {
      this.logger.error(LogSource.DATABASE, 'Failed to get active subscriptions', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Deactivate subscription.
   */
  async deactivateSubscription(eventName: string, subscriberModule: string): Promise<void> {
    try {
      await this.db.execute(
        'UPDATE event_subscriptions SET active = FALSE WHERE event_name = ? AND subscriber_module = ?',
        [eventName, subscriberModule]
      );
    } catch (error) {
      this.logger.error(LogSource.DATABASE, 'Failed to deactivate subscription', { 
        eventName, 
        subscriberModule,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get event statistics.
   */
  async getEventStats(): Promise<{ total_events: number }> {
    try {
      const result = await this.db.query<{ total_events: number }>(
        'SELECT COUNT(*) as total_events FROM events'
      );
      return result[0] || { total_events: 0 };
    } catch (error) {
      this.logger.error(LogSource.DATABASE, 'Failed to get event statistics', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Reset singleton instance for testing purposes.
   */
  static reset(): void {
    EventsRepository.instance = null;
  }
}