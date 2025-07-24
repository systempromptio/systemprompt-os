/**
 * Event handler function type.
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Event subscription.
 */
export interface EventSubscription {
  id: string;
  event: string;
  handler: EventHandler;
  once: boolean;
}

/**
 * Event entry for history.
 */
export interface EventEntry {
  id: string;
  event: string;
  data: any;
  timestamp: Date;
}

/**
 * Event bus service interface.
 */
export interface IEventBusService {
    initialize(): Promise<void>;

    on(event: string, handler: EventHandler): string;

    once(event: string, handler: EventHandler): string;

    off(event: string, handlerOrId: string | EventHandler): void;

    emit(event: string, data?: any): Promise<void>;

    removeAllListeners(event?: string): void;

    getListeners(event?: string): EventSubscription[];

    getHistory(limit?: number): EventEntry[];
}
