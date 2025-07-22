/**
 * Migration service that manages database version changes
 * for all modules
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { glob } from 'glob';
import { Logger } from '@/modules/core/logger/types';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { MigrationError, DatabaseError } from '@/modules/core/database/utils/errors';
import type { MigrationFile, MigrationStatus, MigrationPlan } from '@/modules/core/database/types';

export interface Migration {
  module: string;
  version: string;
  filename: string;
  sql: string;
  checksum: string;
}

export interface ExecutedMigration extends Migration {
  executed_at: string;
  name?: string;
}

/**
 * Service for managing database migrations across modules
 */
export class MigrationService {
  private static instance: MigrationService;
  private migrations: Migration[] = [];
  private logger?: Logger;
  private initialized = false;

  private constructor(private databaseService: DatabaseService) {}

  /**
   * Initialize the migration service
   * @param databaseService Database service instance
   * @param logger Optional logger instance
   */
  static initialize(databaseService: DatabaseService, logger?: Logger): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService(databaseService);
    }
    MigrationService.instance.logger = logger;
    MigrationService.instance.initialized = true;
    return MigrationService.instance;
  }

  /**
   * Get the migration service instance
   * @throws {DatabaseError} If service not initialized
   */
  static getInstance(): MigrationService {
    if (!MigrationService.instance || !MigrationService.instance.initialized) {
      throw new DatabaseError(
        'MigrationService not initialized. Call initialize() first.',
        'SERVICE_NOT_INITIALIZED'
      );
    }
    return MigrationService.instance;
  }

  /**
   * Discover all migrations from modules
   */
  async discoverMigrations(baseDir: string = '/app/src/modules'): Promise<void> {
    try {
      this.logger?.info('Discovering migrations', { baseDir });

      const migrationFiles = await glob('**/database/migrations/*.sql', {
        cwd: baseDir,
        absolute: true
      });

      this.migrations = [];

      for (const filepath of migrationFiles) {
        const module = this.extractModuleName(filepath, baseDir);
        const filename = basename(filepath);
        const version = this.extractVersion(filename);
        const sql = await readFile(filepath, 'utf-8');
        const checksum = this.calculateChecksum(sql);

        this.migrations.push({
          module,
          version,
          filename,
          sql,
          checksum
        });
      }

      // Sort migrations by version
      this.migrations.sort((a, b) => 
        this.compareVersions(a.version, b.version)
      );

      this.logger?.info('Migrations discovered', { 
        count: this.migrations.length 
      });
    } catch (error) {
      this.logger?.error('Migration discovery failed', { error });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    await this.createMigrationTable();

    const applied = await this.getAppliedMigrations();
    const pending = this.migrations.filter(m => 
      !applied.has(this.getMigrationKey(m))
    );

    if (pending.length === 0) {
      this.logger?.info('No pending migrations');
      return;
    }

    this.logger?.info('Running migrations', { pending: pending.length });

    for (const migration of pending) {
      await this.runMigration(migration);
    }

    this.logger?.info('All migrations completed');
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    try {
      this.logger?.info('Running migration', { 
        module: migration.module,
        version: migration.version 
      });

      await this.databaseService.transaction(async (conn) => {
        // Execute migration SQL
        await conn.execute(migration.sql);

        // Record migration
        await conn.execute(
          `INSERT INTO _migrations (module, version, filename, checksum, applied_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [
            migration.module,
            migration.version,
            migration.filename,
            migration.checksum
          ]
        );
      });

      this.logger?.info('Migration completed', { 
        module: migration.module,
        version: migration.version 
      });
    } catch (error) {
      this.logger?.error('Migration failed', { 
        module: migration.module,
        version: migration.version,
        error 
      });
      throw error;
    }
  }

  /**
   * Create migration tracking table
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
   * Get applied migrations
   */
  private async getAppliedMigrations(): Promise<Set<string>> {
    const rows = await this.databaseService.query<{
      module: string;
      version: string;
    }>('SELECT module, version FROM _migrations');
    
    return new Set(rows.map(r => this.getMigrationKey(r)));
  }

  /**
   * Generate unique key for a migration
   */
  private getMigrationKey(migration: { module: string; version: string }): string {
    return `${migration.module}:${migration.version}`;
  }

  /**
   * Extract module name from path
   */
  private extractModuleName(filepath: string, baseDir: string): string {
    const relativePath = filepath.replace(baseDir + '/', '');
    const parts = relativePath.split('/');
    
    if (parts[0] === 'core' && parts.length > 1) {
      return `core/${parts[1]}`;
    }
    
    return parts[0];
  }

  /**
   * Extract version from filename
   * Expected format: 001_description.sql or v1.0.0_description.sql
   */
  private extractVersion(filename: string): string {
    const match = filename.match(/^([\d]+|v[\d\.]+)_/);
    if (!match) {
      throw new Error(`Invalid migration filename: ${filename}`);
    }
    return match[1];
  }

  /**
   * Calculate checksum for migration SQL
   */
  private calculateChecksum(sql: string): string {
    // Simple checksum - in production use crypto.createHash
    return Buffer.from(sql).toString('base64').substring(0, 16);
  }

  /**
   * Compare version strings
   */
  private compareVersions(a: string, b: string): number {
    // Handle numeric versions (001, 002, etc)
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
      return parseInt(a) - parseInt(b);
    }
    
    // Handle semantic versions
    return a.localeCompare(b);
  }

  /**
   * Get pending migrations that haven't been applied
   */
  async getPendingMigrations(): Promise<Migration[]> {
    // Ensure migrations are discovered
    if (this.migrations.length === 0) {
      await this.discoverMigrations();
    }

    const applied = await this.getAppliedMigrations();
    return this.migrations.filter(m => 
      !applied.has(this.getMigrationKey(m))
    ).map(m => ({
      ...m,
      name: m.filename
    }));
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations(): Promise<ExecutedMigration[]> {
    try {
      const rows = await this.databaseService.query<{
        module: string;
        version: string;
        filename: string;
        checksum: string;
        applied_at: string;
      }>('SELECT * FROM _migrations ORDER BY applied_at DESC');
      
      return rows.map(row => ({
        module: row.module,
        version: row.version,
        filename: row.filename,
        name: row.filename,
        sql: '', // Not stored in DB
        checksum: row.checksum,
        executed_at: row.applied_at
      }));
    } catch (error) {
      this.logger?.debug('No migrations table found', { error });
      return [];
    }
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration: Migration): Promise<void> {
    await this.runMigration(migration);
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migration: ExecutedMigration): Promise<void> {
    try {
      this.logger?.info('Rolling back migration', { 
        module: migration.module,
        version: migration.version 
      });

      await this.databaseService.transaction(async (conn) => {
        // Look for rollback file
        const rollbackPath = migration.filename.replace('.sql', '.rollback.sql');
        
        try {
          const rollbackSql = await readFile(rollbackPath, 'utf-8');
          await conn.execute(rollbackSql);
        } catch (error) {
          this.logger?.warn('No rollback file found, removing record only', { 
            module: migration.module,
            version: migration.version 
          });
        }

        // Remove migration record
        await conn.execute(
          'DELETE FROM _migrations WHERE module = ? AND version = ?',
          [migration.module, migration.version]
        );
      });

      this.logger?.info('Migration rolled back', { 
        module: migration.module,
        version: migration.version 
      });
    } catch (error) {
      this.logger?.error('Rollback failed', { 
        module: migration.module,
        version: migration.version,
        error 
      });
      throw error;
    }
  }
}