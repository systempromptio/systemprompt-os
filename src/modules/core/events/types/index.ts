/**
 * Event handler function type.
 */
export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * Event subscription.
 */
export interface IEventSubscription {
  id: string;
  event: string;
  handler: EventHandler;
  once: boolean;
}

/**
 * Event entry for history.
 */
export interface IEventEntry {
  id: string;
  event: string;
  payload: unknown;
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

    emit(event: string, payload?: unknown): Promise<void>;

    removeAllListeners(event?: string): void;

    getListeners(event?: string): IEventSubscription[];

    getHistory(limit?: number): IEventEntry[];
}
