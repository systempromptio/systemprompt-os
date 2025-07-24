/**
 * Database service interface.
 */
export interface IDatabaseService {
    all<T = any>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;

    get<T = any>(sql: string, params?: readonly unknown[]): Promise<T | null>;

    run(sql: string, params?: readonly unknown[]): Promise<void>;

    exec(sql: string): Promise<void>;

    prepare(sql: string): IPreparedStatement;
}

/**
 * Prepared statement interface.
 */
export interface IPreparedStatement {
  run(...params: readonly unknown[]): void;
  get<T>(...params: readonly unknown[]): T | undefined;
  all<T>(...params: readonly unknown[]): readonly T[];
  finalize(): void;
}
