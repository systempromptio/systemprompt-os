/**
 * Migration service that manages database version changes
 * for all modules.
 * @file Migration service for database version management.
 * @module database/services/migration
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { glob } from 'glob';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IExecutedMigration, IMigration } from '@/modules/core/database/types/migration.types';
import type { IDatabaseService } from '@/modules/core/database/types/db-service.interface';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';
import { ZERO } from '@/modules/core/database/constants/index';

/**
 * Database row type for migration records.
 */
interface IMigrationRow {
  module: string;
  version: string;
  filename: string;
  checksum: string;
  applied_at: string;
}

/**
 * Service for managing database migrations across modules.
 */
export class MigrationService {
  private static instance: MigrationService;
  private migrations: IMigration[] = [];
  private logger?: ILogger;
  private initialized = false;
  private databaseService: IDatabaseService;

  /**
   * Creates a new migration service instance.
   */
  private constructor() {
    this.databaseService = {} as IDatabaseService;
  }

  /**
   * Initialize the migration service.
   * @param databaseService - Database service instance.
   * @param logger - Optional logger instance.
   * @returns The initialized migration service instance.
   */
  public static initialize(databaseService: IDatabaseService, logger?: ILogger): MigrationService {
    MigrationService.instance ||= new MigrationService();
    MigrationService.instance.databaseService = databaseService;
    if (logger !== undefined) {
      MigrationService.instance.logger = logger;
    }
    MigrationService.instance.initialized = true;
    return MigrationService.instance;
  }

  /**
   * Get the migration service instance.
   * @returns The migration service instance.
   * @throws {Error} If service not initialized.
   */
  public static getInstance(): MigrationService {
    if (!MigrationService.instance?.initialized) {
      throw new Error('MigrationService not initialized. Call initialize() first.');
    }
    return MigrationService.instance;
  }

  /**
   * Discover all migrations from modules.
   * @param baseDir - Base directory to search for migrations.
   * @returns Promise that resolves when discovery is complete.
   */
  public async discoverMigrations(baseDir: string = '/app/src/modules'): Promise<void> {
    try {
      this.logger?.info(LogSource.DATABASE, 'Discovering migrations', {
        category: 'migration',
        baseDir
      });

      const migrationFiles = await glob('**/database/migrations/*.sql', {
        cwd: baseDir,
        absolute: true,
      });

      this.migrations = [];

      const migrationPromises = migrationFiles.map(async (filepath): Promise<IMigration> => {
        const moduleNameResult = this.extractModuleName(filepath, baseDir);
        const filename = basename(filepath);
        const version = this.extractVersion(filename);
        const sql = await readFile(filepath, 'utf-8');
        const checksum = this.calculateChecksum(sql);

        return {
          module: moduleNameResult,
          version,
          filename,
          sql,
          checksum,
        };
      });

      this.migrations = await Promise.all(migrationPromises);

      this.migrations.sort((migrationA, migrationB): number =>
        { return this.compareVersions(migrationA.version, migrationB.version) });

      this.logger?.info(LogSource.DATABASE, 'Migrations discovered', {
        category: 'migration',
        count: this.migrations.length,
      });
    } catch (error) {
      this.logger?.error(LogSource.DATABASE, 'Migration discovery failed', {
        category: 'migration',
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  /**
   * Run all pending migrations.
   * @returns Promise that resolves when all migrations are complete.
   */
  public async runMigrations(): Promise<void> {
    await this.createMigrationTable();

    const applied = await this.getAppliedMigrations();
    const pending = this.migrations.filter((migration): boolean =>
      { return !applied.has(this.getMigrationKey(migration)) });

    if (pending.length === ZERO) {
      this.logger?.info(LogSource.DATABASE, 'No pending migrations', { category: 'migration' });
      return;
    }

    this.logger?.info(LogSource.DATABASE, 'Running migrations', {
 category: 'migration',
pending: pending.length
});

    for (const migration of pending) {
      await this.runMigration(migration);
    }

    this.logger?.info(LogSource.DATABASE, 'All migrations completed', { category: 'migration' });
  }

  /**
   * Run a single migration.
   * @param migration - Migration to run.
   * @returns Promise that resolves when migration is complete.
   */
  private async runMigration(migration: IMigration): Promise<void> {
    try {
      this.logger?.info(LogSource.DATABASE, 'Running migration', {
        category: 'migration',
        module: migration.module,
        version: migration.version,
      });

      await this.databaseService.transaction(async (conn: IDatabaseConnection): Promise<void> => {
        await conn.execute(migration.sql);

        await conn.execute(
          `INSERT INTO _migrations (module, version, filename, checksum, applied_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [migration.module, migration.version, migration.filename, migration.checksum],
        );
      });

      this.logger?.info(LogSource.DATABASE, 'Migration completed', {
        category: 'migration',
        module: migration.module,
        version: migration.version,
      });
    } catch (error) {
      this.logger?.error(LogSource.DATABASE, 'Migration failed', {
        category: 'migration',
        module: migration.module,
        version: migration.version,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Create migration tracking table.
   * @returns Promise that resolves when table is created.
   */
  private async createMigrationTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module TEXT NOT NULL,
        version TEXT NOT NULL,
        filename TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        UNIQUE(module, version)
      )
    `;
    await this.databaseService.execute(sql);
  }

  /**
   * Get applied migrations.
   * @returns Set of applied migration keys.
   */
  private async getAppliedMigrations(): Promise<Set<string>> {
    const rows = await this.databaseService.query<Pick<IMigrationRow, 'module' | 'version'>>(
      'SELECT module, version FROM _migrations'
    );

    return new Set(rows.map((row): string => { return this.getMigrationKey(row) }));
  }

  /**
   * Generate unique key for a migration.
   * @param migration - Migration object.
   * @param migration.module - Module name.
   * @param migration.version - Version string.
   * @returns Unique migration key.
   */
  private getMigrationKey(migration: { module: string; version: string }): string {
    return `${migration.module}:${migration.version}`;
  }

  /**
   * Extract module name from path.
   * @param filepath - File path to extract module from.
   * @param baseDir - Base directory path.
   * @returns Module name.
   */
  private extractModuleName(filepath: string, baseDir: string): string {
    const relativePath = filepath.replace(`${baseDir}/`, '');
    const parts = relativePath.split('/');

    const firstPart = parts[ZERO];
    const secondPart = parts[1];

    if (firstPart === 'core' && parts.length > 1 && secondPart !== undefined) {
      return `core/${secondPart}`;
    }

    return firstPart || '';
  }

  /**
   * Extract version from filename.
   * Expected format: 001_description.sql or v1.0.0_description.sql.
   * @param filename - Migration filename.
   * @returns Version string.
   */
  private extractVersion(filename: string): string {
    const match = filename.match(/^([\d]+|v[\d.]+)_/);
    if (!match || !match[1]) {
      throw new Error(`Invalid migration filename: ${filename}`);
    }
    return match[1];
  }

  /**
   * Calculate checksum for migration SQL.
   * @param sql - SQL content to calculate checksum for.
   * @returns Checksum string.
   */
  private calculateChecksum(sql: string): string {
    const checksum = Buffer.from(sql).toString('base64');
    const CHECKSUM_LENGTH = 16;
    return checksum.substring(ZERO, CHECKSUM_LENGTH);
  }

  /**
   * Compare version strings.
   * @param versionA - First version string.
   * @param versionB - Second version string.
   * @returns Comparison result.
   */
  private compareVersions(versionA: string, versionB: string): number {
    const NUMERIC_PATTERN = /^\d+$/;
    if (NUMERIC_PATTERN.test(versionA) && NUMERIC_PATTERN.test(versionB)) {
      return (parseInt(versionA, 10) || ZERO) - (parseInt(versionB, 10) || ZERO);
    }

    return versionA.localeCompare(versionB);
  }

  /**
   * Get pending migrations that haven't been applied.
   * @returns Array of pending migrations.
   */
  public async getPendingMigrations(): Promise<IMigration[]> {
    if (this.migrations.length === ZERO) {
      await this.discoverMigrations();
    }

    const applied = await this.getAppliedMigrations();
    return this.migrations
      .filter((migration): boolean => { return !applied.has(this.getMigrationKey(migration)) })
      .map((migration): IMigration => { return {
        ...migration,
      } });
  }

  /**
   * Get list of executed migrations.
   * @returns Array of executed migrations.
   */
  public async getExecutedMigrations(): Promise<IExecutedMigration[]> {
    try {
      const rows = await this.databaseService.query<IMigrationRow>(
        'SELECT * FROM _migrations ORDER BY applied_at DESC'
      );

      return rows.map((row): IExecutedMigration => { return {
        module: row.module,
        version: row.version,
        filename: row.filename,
        name: row.filename,
        sql: '',
        checksum: row.checksum,
        executedAt: row.applied_at,
      } });
    } catch (error) {
      this.logger?.debug(LogSource.DATABASE, 'No migrations table found', {
        category: 'migration',
        persistToDb: false,
        error: error instanceof Error ? error : new Error(String(error))
      });
      return [];
    }
  }

  /**
   * Execute a single migration.
   * @param migration - Migration to execute.
   * @returns Promise that resolves when migration is complete.
   */
  public async executeMigration(migration: IMigration): Promise<void> {
    await this.runMigration(migration);
  }

  /**
   * Rollback a migration.
   * @param migration - Migration to rollback.
   * @returns Promise that resolves when rollback is complete.
   */
  public async rollbackMigration(migration: IExecutedMigration): Promise<void> {
    try {
      this.logger?.info(LogSource.DATABASE, 'Rolling back migration', {
        category: 'migration',
        module: migration.module,
        version: migration.version,
      });

      await this.databaseService.transaction(async (conn: IDatabaseConnection): Promise<void> => {
        const rollbackPath = migration.filename.replace('.sql', '.rollback.sql');

        try {
          const rollbackSql = await readFile(rollbackPath, 'utf-8');
          await conn.execute(rollbackSql);
        } catch {
          this.logger?.warn(LogSource.DATABASE, 'No rollback file found, removing record only', {
            category: 'migration',
            module: migration.module,
            version: migration.version,
          });
        }

        await conn.execute('DELETE FROM _migrations WHERE module = ? AND version = ?', [
          migration.module,
          migration.version,
        ]);
      });

      this.logger?.info(LogSource.DATABASE, 'Migration rolled back', {
        category: 'migration',
        module: migration.module,
        version: migration.version,
      });
    } catch (error) {
      this.logger?.error(LogSource.DATABASE, 'Rollback failed', {
        category: 'migration',
        module: migration.module,
        version: migration.version,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }
}
