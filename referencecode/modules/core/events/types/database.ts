/**
 * @fileoverview Database adapter interface for events module
 * @module modules/core/events/types/database
 */

/**
 * Database adapter interface compatible with module adapters
 */
export interface IEventDatabase {
  run(sql: string, params?: readonly unknown[]): Promise<void>;
  get<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  all<T = unknown>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  exec(sql: string): Promise<void>;
  prepare(sql: string): {
    run(...params: readonly unknown[]): void;
    get<T = unknown>(...params: readonly unknown[]): T | undefined;
    all<T = unknown>(...params: readonly unknown[]): readonly T[];
  };
}